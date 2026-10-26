# Scaleway static website storage

This module owns the Scaleway Object Storage bucket used by the production
deployment workflow in `.github/workflows/deploy.yml`.

The application repository only publishes static artifacts with `aws s3 sync`.
Terraform owns the bucket, website routing, ACL and public read policy.

## Required environment variables

Use the Terraform CLI or a backend with these variables exported:

- `SCW_ACCESS_KEY`
- `SCW_SECRET_KEY`
- `SCW_DEFAULT_PROJECT_ID` (included in the GitHub `production` environment)

## Usage

```bash
cd infra/scaleway-static-site
terraform init
terraform plan
terraform apply
```

Copy `terraform.tfvars.example` to `terraform.tfvars` and set the real project ID
and bucket name. Do not commit `terraform.tfvars` if it contains project
details that should not be shared; it is gitignored by the root ignored patterns.

## Integration with deployment

After apply, store:

- `terraform output -raw bucket_name` as `SCALEWAY_STORAGE_BUCKET`
- `terraform output -raw website_endpoint` as the public site endpoint

in the GitHub `production` environment. The deploy workflow will only publish
the built `out/` directory.
