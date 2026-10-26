output "website_endpoint" {
  description = "Endpoint del hosting estático de Scaleway"
  value       = scaleway_object_bucket_website_configuration.web.website_endpoint
}
