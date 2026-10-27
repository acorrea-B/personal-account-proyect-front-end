# Deploy variables of the static site. The project ID is explicit: with IAM
# keys the provider does not resolve it from the token (`project_id is
# required`), and it stays as a GitHub secret because the repo is public and
# only secret values are masked in the logs. The bucket policy derives its
# project principal from it, so no per-identity configuration is needed: any
# API key scoped to the projects keeps bucket access even after key rotations.

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