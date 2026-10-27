# Deploy variables of the static site. The project ID is explicit: with IAM
# keys the provider does not resolve it from the token (`project_id is
# required`), and it stays as a GitHub secret because the repo is public and
# only secret values are masked in the logs. The IAM user ID of the CI key
# ships as a validated default so a deploy needs no extra configuration;
# override it with `TF_VAR_iam_user_id` when the CI API key is rotated.

variable "project_id" {
  description = "Scaleway project ID (console: Project management)."
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.project_id))
    error_message = "project_id must be a UUID."
  }
}

variable "region" {
  description = "Region of the Object Storage resources."
  type        = string
  default     = "fr-par"
}

variable "bucket_name" {
  description = "Unique name of the public site bucket."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "bucket_name must be a DNS-compatible bucket name (3-63 chars, lowercase letters, digits, dots or dashes)."
  }
}

variable "site_directory" {
  description = "Directory that contains the static files, relative to this module."
  type        = string
  default     = "site"
}

variable "iam_user_id" {
  description = "UUID of the IAM user owning the CI API key; the bucket policy grants it s3:* so state reads, imports and file sync never fail with 403."
  type        = string
  default     = "2f4164cc-8eea-46cd-b6b4-47214a57783c"

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.iam_user_id))
    error_message = "iam_user_id must be a UUID."
  }
}