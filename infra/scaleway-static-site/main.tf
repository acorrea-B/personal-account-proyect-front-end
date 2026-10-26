resource "scaleway_object_bucket_policy" "static_site_public_read" {
  bucket     = var.bucket_name
  project_id = var.project_id
  region     = var.region

  policy = jsonencode({
    Id      = "profile-web-app-policy"
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
          SCW = [
            "user_id:${var.scw_user_id}"
          ]
        }

        Action = [
          "s3:GetBucketCORS",
          "s3:ListBucket",
          "s3:GetObject",
          "s3:GetObjectAcl",
          "s3:PutObject",
          "s3:DeleteObject"
        ]

        Resource = [
          var.bucket_name,
          "${var.bucket_name}/*"
        ]
      }
    ]
  })

}

resource "scaleway_object_bucket_website_configuration" "static_site" {
  bucket     = var.bucket_name
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
