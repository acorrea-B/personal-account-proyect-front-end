resource "scaleway_object_bucket" "static_site" {
  name          = var.bucket_name
  acl           = "public-read"
  force_destroy = false

  tags = {
    project   = "professional-profile-front-end"
    component = "static-site"
    managed   = "terraform"
  }
}

resource "scaleway_object_bucket_website_configuration" "static_site" {
  bucket     = scaleway_object_bucket.static_site.name
  project_id = var.project_id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = var.error_document
  }
}
