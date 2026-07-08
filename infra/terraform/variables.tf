variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "app_count" {
  description = "Number of ECS task replicas"
  type        = number
  default     = 3
}

variable "app_cpu" {
  description = "CPU units for ECS task (512 = 0.5 vCPU, 1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "app_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 2048
}

variable "certificate_arn" {
  description = "ARN of the ACM SSL certificate"
  type        = string
}

variable "redis_url" {
  description = "Redis connection URL (stored in SSM)"
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "PostgreSQL connection URL (stored in SSM)"
  type        = string
  sensitive   = true
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"

  validation {
    condition     = contains(["debug", "info", "warn", "error"], var.log_level)
    error_message = "Log level must be one of: debug, info, warn, error."
  }
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "api.agent-preflight.io"
}

variable "tags" {
  description = "Additional resource tags"
  type        = map(string)
  default     = {}
}
