output "cluster_id" {
  description = "ECS Cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "service_name" {
  description = "ECS Service name"
  value       = aws_ecs_service.app.name
}

output "task_definition_arn" {
  description = "ECS Task Definition ARN"
  value       = aws_ecs_task_definition.app.arn
}

output "load_balancer_dns" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.app.dns_name
}

output "load_balancer_zone_id" {
  description = "Application Load Balancer hosted zone ID"
  value       = aws_lb.app.zone_id
}

output "target_group_arn" {
  description = "ALB Target Group ARN"
  value       = aws_lb_target_group.app.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.app.name
}

output "security_group_app" {
  description = "Application security group ID"
  value       = aws_security_group.app.id
}

output "security_group_lb" {
  description = "Load balancer security group ID"
  value       = aws_security_group.lb.id
}
