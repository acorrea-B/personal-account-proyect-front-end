
terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket = "perfil-api-terraform-state"
    key    = "perfil-web/terraform.tfstate"
    region = "fr-par"

    endpoints = {
      s3 = "https://s3.fr-par.scw.cloud"
    }

    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }

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
