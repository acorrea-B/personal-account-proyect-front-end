variable "project_id" {
  description = "ID del proyecto de Scaleway"
  type        = string
}

variable "region" {
  description = "Región de Object Storage"
  type        = string
  default     = "fr-par"
}

variable "bucket_name" {
  description = "Nombre único del bucket"
  type        = string
}

variable "site_directory" {
  description = "Directorio que contiene los archivos estáticos"
  type        = string
  default     = "site"
}
