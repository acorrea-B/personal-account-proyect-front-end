resource "scaleway_object_bucket" "static_site" {
  name          = var.bucket_name
  force_destroy = false

  tags = {
    project   = "professional-profile-front-end"
    component = "static-site"
    managed   = "terraform"
  }
}

resource "scaleway_object_bucket_policy" "static_site_public_read" {
  bucket     = scaleway_object_bucket.static_site.name
  project_id = var.project_id
  region     = var.region

  policy = jsonencode({
    Version = "2023-04-17"

    Statement = [
      {
        Sid       = "PublicReadObjects"
        Effect    = "Allow"
        Principal = "*"

        Action = [
          "s3:GetObject"
        ]

        Resource = [
          "${scaleway_object_bucket.static_site.name}/*"
        ]
      }
    ]
  })

  depends_on = [scaleway_object_bucket.static_site]
}

resource "scaleway_object_bucket_website_configuration" "static_site" {
  bucket     = scaleway_object_bucket.static_site.name
  project_id = var.project_id

  depends_on = [
    scaleway_object_bucket_policy.static_site_public_read
  ]

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = var.error_document
  }
}
