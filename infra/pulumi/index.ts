import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const environment = config.get("environment") || "production";
const domainName = config.get("domainName") || "api.agent-preflight.io";
const appCount = config.getNumber("appCount") || 3;
const certificateArn = config.require("certificateArn");

const commonTags = {
  Project: "agent-preflight",
  ManagedBy: "pulumi",
  Environment: environment,
};

const vpc = awsx.ec2.Vpc.getDefault();

const cluster = new aws.ecs.Cluster("agent-preflight-cluster", {
  name: `agent-preflight-${environment}`,
  settings: [{ name: "containerInsights", value: "enabled" }],
  tags: { ...commonTags, Name: `agent-preflight-${environment}` },
});

const logGroup = new aws.cloudwatch.LogGroup("app-logs", {
  name: `/ecs/agent-preflight-${environment}`,
  retentionInDays: 30,
  tags: commonTags,
});

const ecrRepo = aws.ecr.getRepositoryOutput({
  name: "agent-preflight",
});

const taskRole = new aws.iam.Role("task-role", {
  name: `agent-preflight-task-${environment}`,
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
      },
    ],
  },
  tags: commonTags,
});

const executionRole = new aws.iam.Role("execution-role", {
  name: `agent-preflight-execution-${environment}`,
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: { Service: "ecs-tasks.amazonaws.com" },
      },
    ],
  },
  managedPolicyArns: [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
    "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess",
  ],
  tags: commonTags,
});

const redisUrl = new aws.ssm.Parameter("redis-url", {
  name: `/agent-preflight/${environment}/redis-url`,
  type: "SecureString",
  value: config.requireSecret("redisUrl"),
  tags: commonTags,
});

const databaseUrl = new aws.ssm.Parameter("database-url", {
  name: `/agent-preflight/${environment}/database-url`,
  type: "SecureString",
  value: config.requireSecret("databaseUrl"),
  tags: commonTags,
});

const taskDefinition = new aws.ecs.TaskDefinition("app-task", {
  family: `agent-preflight-${environment}`,
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  cpu: "1024",
  memory: "2048",
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  runtimePlatform: {
    operatingSystemFamily: "LINUX",
    cpuArchitecture: "X86_64",
  },
  containerDefinitions: pulumi.jsonStringify([
    {
      name: "app",
      image: pulumi.interpolate`${ecrRepo.repositoryUrl}:latest`,
      essential: true,
      portMappings: [
        { containerPort: 3000, protocol: "tcp", appProtocol: "http" },
      ],
      environment: [
        { name: "NODE_ENV", value: "production" },
        { name: "PORT", value: "3000" },
        { name: "LOG_LEVEL", value: "info" },
      ],
      secrets: [
        {
          name: "REDIS_URL",
          valueFrom: redisUrl.arn,
        },
        {
          name: "DATABASE_URL",
          valueFrom: databaseUrl.arn,
        },
      ],
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 60,
      },
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": logGroup.name,
          "awslogs-region": aws.config.region,
          "awslogs-stream-prefix": "ecs",
        },
      },
    },
  ]),
  tags: commonTags,
});

const alb = new awsx.lb.ApplicationLoadBalancer("app-alb", {
  name: `agent-preflight-${environment}`,
  internal: false,
  enableDeletionProtection: environment === "production",
  tags: commonTags,
});

const targetGroup = new awsx.lb.ApplicationTargetGroup("app-tg", {
  name: `agent-preflight-${environment}`,
  port: 3000,
  protocol: "HTTP",
  targetType: "ip",
  vpc: vpc,
  healthCheck: {
    enabled: true,
    path: "/health",
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    timeout: 5,
    interval: 30,
    matcher: "200",
  },
  tags: commonTags,
});

const listener = new awsx.lb.ApplicationListener("app-listener", {
  loadBalancer: alb,
  port: 443,
  protocol: "HTTPS",
  sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
  certificateArn: certificateArn,
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

const httpRedirect = new awsx.lb.ApplicationListener("http-redirect", {
  loadBalancer: alb,
  port: 80,
  protocol: "HTTP",
  defaultActions: [
    {
      type: "redirect",
      redirect: {
        port: "443",
        protocol: "HTTPS",
        statusCode: "HTTP_301",
      },
    },
  ],
});

const service = new aws.ecs.Service("app-service", {
  name: `agent-preflight-${environment}`,
  cluster: cluster.arn,
  taskDefinition: taskDefinition.arn,
  desiredCount: appCount,
  launchType: "FARGATE",
  enableExecuteCommand: true,
  deploymentCircuitBreaker: {
    enable: true,
    rollback: true,
  },
  networkConfiguration: {
    assignPublicIp: false,
    subnets: vpc.privateSubnetIds,
    securityGroups: [alb.securityGroupIds.apply((ids) => ids[0])],
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroup.arn,
      containerName: "app",
      containerPort: 3000,
    },
  ],
  tags: commonTags,
});

export const clusterId = cluster.id;
export const serviceName = service.name;
export const taskDefinitionArn = taskDefinition.arn;
export const loadBalancerDns = alb.loadBalancer.dnsName;
export const cloudwatchLogGroup = logGroup.name;
