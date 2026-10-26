resource "scaleway_object_bucket" "web" {
  name       = var.bucket_name
  project_id = var.project_id
  region     = var.region

  lifecycle {
    ignore_changes = [acl, tags]
  }
}

resource "scaleway_object_bucket_policy" "web" {
  bucket     = var.bucket_name
  project_id = var.project_id

  policy = jsonencode({
    Version = "2023-04-17"

    Statement = [
      {
        Sid       = "PublicWebsiteRead"
        Effect    = "Allow"
        Principal = "*"

        Action = [
          "s3:GetObject"
        ]

        Resource = [
          "${var.bucket_name}/*"
        ]
      },
      {
        Sid    = "TerraformUserAccess"
        Effect = "Allow"
        Principal = {
          SCW = "user_id:2f4164cc-8eea-46cd-b6b4-47214a57783c"
        }

        Action = [
          "s3:*"
        ]

        Resource = [
          "${var.bucket_name}",
          "${var.bucket_name}/*"
        ]
      }
    ]
  })
}

resource "scaleway_object_bucket_website_configuration" "web" {
  bucket     = var.bucket_name
  project_id = var.project_id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }

  depends_on = [
    scaleway_object_bucket.web,
    scaleway_object_bucket_policy.web
  ]
}

locals {
  site_files = fileset(
    "${path.module}/${var.site_directory}",
    "**"
  )

  mime_types = {
    html  = "text/html"
    css   = "text/css"
    js    = "application/javascript"
    json  = "application/json"
    svg   = "image/svg+xml"
    png   = "image/png"
    jpg   = "image/jpeg"
    jpeg  = "image/jpeg"
    ico   = "image/x-icon"
    txt   = "text/plain"
    xml   = "application/xml"
    webp  = "image/webp"
    woff  = "font/woff"
    woff2 = "font/woff2"
  }
}

resource "scaleway_object" "site_files" {
  for_each = local.site_files

  bucket     = var.bucket_name
  project_id = var.project_id

  key  = each.value
  file = "${path.module}/${var.site_directory}/${each.value}"

  hash = filemd5(
    "${path.module}/${var.site_directory}/${each.value}"
  )

  content_type = lookup(
    local.mime_types,
    try(reverse(split(".", each.value))[0], ""),
    "application/octet-stream"
  )

  visibility = "public-read"

  depends_on = [
    scaleway_object_bucket.web,
    scaleway_object_bucket_policy.web,
    scaleway_object_bucket_website_configuration.web
  ]
}
