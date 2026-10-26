variable "project_id" {
  description = "Scaleway project ID that owns the storage bucket. Leave null to use SCW_DEFAULT_PROJECT_ID."
  type        = string
  default     = null
}

variable "region" {
  description = "Scaleway region used for the static website bucket."
  type        = string
  default     = "fr-par"
}

variable "bucket_name" {
  description = "Globally unique Scaleway storage bucket name."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "Scaleway bucket names use lowercase alphanumeric DNS-compatible names."
  }
}

variable "error_document" {
  description = "Object key served for 4XX website errors."
  type        = string
  default     = "404.html"
}

variable "public_read" {
  description = "Allow anonymous static website access."
  type        = bool
  default     = true
}
