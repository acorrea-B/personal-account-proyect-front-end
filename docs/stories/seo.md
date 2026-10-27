# Story: SEO hardening for the public export

## Evidence

The operator ran seobility on the deployed bucket (findings pasted) and the
direct curl confirmed the HTTP layer: `content-type: text/html` without
charset, no content-encoding, no cache-control on any object; the checker
URL rode the raw S3 API endpoint (root 403 XML) instead of the website host.
The baseline is captured in `docs/task-metrics.md` for the post-DNS delta.

## v0.4.4 scope

1. **tf charset (this window):** `text/*` mime entries carry
   `; charset=utf-8` - fixed by the tag deploy itself (a content_type
   attribute update on the objects).
2. Landing copy: 250+ real words in paragraphs aligned with the h1 (fixes
   the wordcount, the missing-paragraph and the h1-match findings).
3. Favicon set: favicon.ico + icon.svg + apple-touch + manifest.
4. Per-segment metadata through server layouts (title template, og, twitter,
   canonicals), robots.ts + sitemap.ts, JSON-LD on the landing; /app/**
   gets noindex.

## Provider limit recorded

`scaleway_object` does not support a `cache_control` argument (verified in
the provider docs at the pinned `~> 2.86.0`) and its `metadata` map rides
as x-amz-meta-* user metadata, not as the Cache-Control header. Cache
policies therefore join gzip, the www/apex 301s and the https redirect in
the custom-domain + CDN decision (v2 queue), evaluated with the captured
baseline.
