# Scaleway static website storage

This module owns the Scaleway Object Storage bucket used by the production
deployment workflow in `.github/workflows/deploy.yml`.

Terraform owns the bucket, public read policy, static website configuration and
the objects published from the prepared static artifact directory.

## Required environment variables

Export these variables (never commit them):

- `SCW_ACCESS_KEY`
- `SCW_SECRET_KEY`
- `SCW_DEFAULT_PROJECT_ID` or `SCW_PROJECT_ID`
- `TF_VAR_bucket_name`
- `TF_VAR_project_id`
- `TF_VAR_region`

## Usage

```bash
cd infra/scaleway-static-site
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Copy `terraform.tfvars.example` to `terraform.tfvars` and set real values.
Do not commit `terraform.tfvars`.

## Existing bucket

If the bucket already exists in Scaleway but is not in Terraform state, import it
before applying:

```bash
terraform import scaleway_object_bucket.web fr-par/<bucket-name>
```

## State

Use a persistent shared backend between CI runs. Do not use the public site
bucket to store Terraform state.
