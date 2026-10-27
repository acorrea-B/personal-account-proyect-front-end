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
    # The project_id principal is only supported in the bucket-policy version
    # 2012-10-17 (Scaleway API: "MalformedPolicy: project_id Principal is
    # deprecated and only supported in the bucket-policy version
    # 2012-10-17" — v0.2.2 run). The 2023-04-17 recommended version accepts
    # user_id and application_id principals only, which would need per-identity
    # configuration that breaks on key rotations.
    Version = "2012-10-17"

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
        Sid    = "ProjectAccess"
        Effect = "Allow"
        Principal = {
          SCW = "project_id:${var.project_id}"
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

  # The bucket policy governs bucket S3 access while it exists: a policy that
  # does not cover the CI caller locks it out of every read and 403s the
  # whole deploy (v0.2.1 rerun). The project principal grants the CI key
  # regardless of whether the API key belongs to an IAM user or an
  # application, and it survives key rotations. Without this dependency the
  # policy PUT also ran in parallel with the bucket creation on a first
  # deploy and failed with 404 NoSuchBucket.
  depends_on = [
    scaleway_object_bucket.web
  ]
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
