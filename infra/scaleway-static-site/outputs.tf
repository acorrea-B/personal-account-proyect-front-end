output "bucket_name" {
  description = "Storage bucket published by GitHub Actions."
  value       = var.bucket_name
}

output "region" {
  description = "Bucket region."
  value       = var.region
}

output "website_endpoint" {
  description = "Scaleway static website endpoint."
  value       = scaleway_object_bucket_website_configuration.static_site.website_endpoint
}

output "website_domain" {
  description = "Scaleway static website domain."
  value       = scaleway_object_bucket_website_configuration.static_site.website_domain
}
