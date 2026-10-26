terraform {
  required_version = ">= 1.5.0"

  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.86.0"
    }
  }
}

provider "scaleway" {
  region     = var.region
  project_id = var.project_id
}
