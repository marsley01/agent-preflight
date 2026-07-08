import type {
  AgentId,
  Duration,
  SemVer,
  TaskId,
  TaskInput,
  TaskOutput,
  TaskStatus,
  TaskPriority,
  Timestamp,
  Percentage,
  ErrorDetail,
  AgentCapabilities,
  AgentInfo,
  TaskResult,
  TaskContext,
} from "@agent-preflight/types";

// ---------------------------------------------------------------------------
// Orchestration Strategy
// ---------------------------------------------------------------------------

export type OrchestrationStrategy =
  | "SEQUENTIAL"
  | "PARALLEL"
  | "HYBRID"
  | "DYNAMIC";

export type FallbackStrategy =
  | "RETRY"
  | "ALTERNATIVE_AGENT"
  | "SIMPLIFIED"
  | "HUMAN"
  | "FAIL";

export type AgentSelectorStrategy =
  | "ROUND_ROBIN"
  | "LEAST_BUSY"
  | "FASTEST"
  | "CHEAPEST"
  | "MOST_CAPABLE"
  | "PREFERRED";

// ---------------------------------------------------------------------------
// Workflow Step Type
// ---------------------------------------------------------------------------

export type WorkflowStepType =
  | "TASK"
  | "DECISION"
  | "PARALLEL"
  | "SUBWORKFLOW"
  | "CONDITION"
  | "LOOP"
  | "WAIT";

// ---------------------------------------------------------------------------
// Orchestration Config
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxRetries: number;
  baseDelay: Duration;
  maxDelay: Duration;
  backoffFactor: number;
  retryableErrors: string[];
}

export interface OrchestrationConfig {
  maxAgentsPerWorkflow: number;
  defaultTimeout: Duration;
  retryPolicy: RetryPolicy;
  fallbackStrategy: FallbackStrategy;
  parallelization: {
    maxParallelBranches: number;
    dynamicParallelization: boolean;
    minTaskSizeForParallel: number;
  };
  scheduling: {
    strategy: OrchestrationStrategy;
    preemptionEnabled: boolean;
    priorityLevels: TaskPriority[];
    queueMaxSize: number;
  };
  monitoring: {
    progressInterval: Duration;
    heartbeatTimeout: Duration;
    checkpointEnabled: boolean;
    checkpointInterval: Duration;
  };
}

// ---------------------------------------------------------------------------
// Workflow Definition & Step
// ---------------------------------------------------------------------------

export interface WorkflowStepCondition {
  runIf?: string | undefined;
  skipIf?: string | undefined;
  waitFor?: string | undefined;
}

export interface WorkflowStepErrorHandling {
  maxRetries: number;
  retryDelay: Duration;
  fallbackStrategy: FallbackStrategy;
  fallbackStepId?: string | undefined;
  timeout: Duration;
  onError:
    | "FAIL"
    | "SKIP"
    | "RETRY"
    | "FALLBACK"
    | "CONTINUE"
    | "HUMAN_INTERVENTION";
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  agentId?: AgentId | undefined;
  input?: TaskInput | undefined;
  dependsOn: string[];
  timeout: Duration;
  priority: TaskPriority;
  conditions?: WorkflowStepCondition | undefined;
  errorHandling?: WorkflowStepErrorHandling | undefined;
  metadata?: Record<string, unknown> | undefined;

  loopConfig?: {
    maxIterations: number;
    condition: string;
    breakCondition?: string | undefined;
  } | undefined;

  parallelConfig?: {
    branchSteps: WorkflowStep[];
    joinCondition: "ALL" | "ANY" | "MAJORITY" | "CUSTOM";
    maxConcurrency: number;
  } | undefined;

  decisionConfig?: {
    choices: { condition: string; stepId: string }[];
    defaultStepId: string;
  } | undefined;

  approvalConfig?: {
    required: boolean;
    approvers: string[];
    timeout: Duration;
    autoApproveCondition?: string | undefined;
  } | undefined;

  subworkflowConfig?: {
    workflowId: string;
    awaitCompletion: boolean;
    passthroughContext: boolean;
  } | undefined;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: SemVer;
  description: string;
  steps: WorkflowStep[];
  dependencies: Record<string, string[]>;
  conditions?: Record<string, string> | undefined;
  errorHandling?: {
    globalFallback: FallbackStrategy;
    stepErrorDefaults: WorkflowStepErrorHandling;
  } | undefined;
  timeout: Duration;
  tags: string[];
  metadata?: Record<string, unknown> | undefined;
  inputSchema?: Record<string, unknown> | undefined;
  outputSchema?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Workflow Execution & Timeline
// ---------------------------------------------------------------------------

export type WorkflowExecutionStatus =
  | "PENDING"
  | "INITIALIZING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMEOUT"
  | "WAITING_APPROVAL"
  | "WAITING_INPUT";

export interface WorkflowTimelineEvent {
  id: string;
  timestamp: Timestamp;
  type:
    | "WORKFLOW_STARTED"
    | "WORKFLOW_COMPLETED"
    | "WORKFLOW_FAILED"
    | "WORKFLOW_CANCELLED"
    | "WORKFLOW_PAUSED"
    | "WORKFLOW_RESUMED"
    | "STEP_STARTED"
    | "STEP_COMPLETED"
    | "STEP_FAILED"
    | "STEP_SKIPPED"
    | "STEP_RETRY"
    | "BRANCH_STARTED"
    | "BRANCH_COMPLETED"
    | "AGENT_ASSIGNED"
    | "AGENT_FAILED"
    | "APPROVAL_REQUESTED"
    | "APPROVAL_GRANTED"
    | "APPROVAL_DENIED"
    | "HUMAN_INTERVENTION"
    | "CHECKPOINT_CREATED"
    | "CHECKPOINT_RESTORED"
    | "ERROR"
    | "CUSTOM";
  stepId?: string | undefined;
  agentId?: AgentId | undefined;
  message?: string | undefined;
  data?: unknown | undefined;
}

export interface WorkflowExecution {
  id: string;
  definitionId: string;
  status: WorkflowExecutionStatus;
  context: TaskContext;
  results: Map<string, TaskResult>;
  errors: Map<string, ErrorDetail>;
  timeline: WorkflowTimelineEvent[];
  currentStepIds: string[];
  completedStepIds: string[];
  failedStepIds: string[];
  skippedStepIds: string[];
  startedAt: Timestamp;
  completedAt?: Timestamp | undefined;
  updatedAt: Timestamp;
  progress: Percentage;
  checkpoint?: WorkflowCheckpoint | undefined;
}

export interface WorkflowCheckpoint {
  id: string;
  executionId: string;
  completedStepIds: string[];
  runningStepIds: string[];
  context: Record<string, unknown>;
  results: Map<string, TaskResult>;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Workflow Template
// ---------------------------------------------------------------------------

export interface WorkflowTemplate {
  id: string;
  name: string;
  version: SemVer;
  description: string;
  category: string;
  template: Omit<WorkflowDefinition, "id" | "version">;
  parameters: {
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object";
    required: boolean;
    default?: unknown | undefined;
    description?: string | undefined;
  }[];
  tags: string[];
  metadata?: Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export interface ScheduledTask {
  id: TaskId;
  workflowId: string;
  stepId: string;
  agentId: AgentId;
  priority: TaskPriority;
  status: "QUEUED" | "ASSIGNED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  input: TaskInput;
  timeout: Duration;
  createdAt: Timestamp;
  startedAt?: Timestamp | undefined;
  completedAt?: Timestamp | undefined;
  estimatedDuration?: Duration | undefined;
  dependencies: TaskId[];
  metadata?: Record<string, unknown> | undefined;
}

export interface SchedulingStrategy {
  type: OrchestrationStrategy;
  selectNext(
    queue: ScheduledTask[],
    availableAgents: AgentInfo[],
  ): ScheduledTask | null;
  distribute(
    tasks: ScheduledTask[],
    agents: AgentInfo[],
  ): Map<AgentId, ScheduledTask[]>;
  prioritize(tasks: ScheduledTask[]): ScheduledTask[];
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface TaskDecomposition {
  originalTask: string;
  subtasks: {
    id: string;
    description: string;
    requiredCapabilities: string[];
    estimatedComplexity: number;
    dependencies: string[];
  }[];
  suggestedOrder: string[];
  parallelGroups: string[][];
}

export interface PlanValidation {
  valid: boolean;
  issues: {
    severity: "ERROR" | "WARNING" | "INFO";
    message: string;
    stepId?: string | undefined;
    suggestion?: string | undefined;
  }[];
  estimatedDuration: Duration;
  riskScore: number;
}

export interface AgentAssignment {
  stepId: string;
  agentId: AgentId;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedDuration: Duration;
}

// ---------------------------------------------------------------------------
// Coordinator
// ---------------------------------------------------------------------------

export interface DelegationRequest {
  taskId: TaskId;
  targetAgentId: AgentId;
  input: TaskInput;
  timeout: Duration;
  priority: TaskPriority;
  context: TaskContext;
  correlationId: string;
}

export interface DelegationResult {
  taskId: TaskId;
  agentId: AgentId;
  status: TaskStatus;
  output?: TaskOutput | undefined;
  error?: ErrorDetail | undefined;
  duration: Duration;
  metrics?: Record<string, number> | undefined;
}

export interface ConflictResolution {
  conflicts: {
    stepId: string;
    agents: AgentId[];
    differingOutputs: Map<AgentId, unknown>;
    resolvedOutput: unknown;
    resolutionStrategy: "MAJORITY" | "WEIGHTED" | "LATEST" | "MANUAL";
    confidence: number;
  }[];
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

export interface AgentSelectionCriteria {
  requiredCapabilities: string[];
  preferredAgentId?: AgentId | undefined;
  maxCost?: number | undefined;
  maxLatency?: Duration | undefined;
  minCapabilityScore?: number | undefined;
  excludeAgentIds?: AgentId[] | undefined;
  requireStreaming?: boolean | undefined;
  requireFunctionCalling?: boolean | undefined;
  modelFamilies?: string[] | undefined;
}

export interface AgentScore {
  agentId: AgentId;
  score: number;
  breakdown: Record<string, number>;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Execution Graph
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  stepId: string;
  name: string;
  type: WorkflowStepType;
  agentId?: AgentId | undefined;
  level: number;
  estimatedDuration: Duration;
  criticalPath: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "DEPENDENCY" | "CONDITIONAL" | "LOOP" | "FEEDBACK";
  label?: string | undefined;
}

export interface CriticalPath {
  nodes: GraphNode[];
  totalDuration: Duration;
  slack: Map<string, Duration>;
}
