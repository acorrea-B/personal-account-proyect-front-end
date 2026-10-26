resource "scaleway_object_bucket" "static_site" {
  name          = var.bucket_name
  acl           = var.public_read ? "public-read" : "private"
  force_destroy = false

  tags = {
    project   = "professional-profile-front-end"
    component = "static-site"
    managed   = "terraform"
  }
}

resource "scaleway_object_bucket_acl" "public_read" {
  count  = var.public_read ? 1 : 0
  bucket = scaleway_object_bucket.static_site.id
  acl    = "public-read"
}

resource "scaleway_object_bucket_policy" "public_read" {
  count  = var.public_read ? 1 : 0
  bucket = scaleway_object_bucket.static_site.id
  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "StaticSitePublicRead"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = ["${var.bucket_name}/*"]
      }
    ]
  })
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
