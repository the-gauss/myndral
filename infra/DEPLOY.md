# GCP Deployment Guide

One-time setup for deploying MyndralAI on Google Cloud Platform at near-zero
monthly cost.

**Final URLs:**
- Web player → `app.myndral.com`
- Internal studio → `studio.myndral.com`
- API → `api.myndral.com`

---

## Prerequisites

- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- Docker installed locally (needed for the first manual image build)
- A billing account ready to attach to the project

---

## Step 1 — Create a GCP project

```bash
gcloud projects create myndral-prod --name="MyndralAI Production"
gcloud config set project myndral-prod

# Replace BILLING_ACCOUNT_ID with your billing account ID
# (find it at: gcloud billing accounts list)
gcloud billing projects link myndral-prod \
  --billing-account=BILLING_ACCOUNT_ID
```

---

## Step 2 — Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com
```

---

## Step 3 — Create an Artifact Registry repository

```bash
gcloud artifacts repositories create myndral \
  --repository-format=docker \
  --location=us-central1 \
  --description="MyndralAI container images"

gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## Step 4 — Create a Cloud SQL (PostgreSQL 16) instance

```bash
# --edition=ENTERPRISE is required: the CLI now defaults to ENTERPRISE_PLUS,
# which only accepts db-perf-optimized-N-* tiers starting at ~$450/month.
# Enterprise edition allows db-f1-micro, the smallest shared-core tier (~$7/month).
#
# We keep the public IP (default) and do NOT configure a private IP.
# Cloud Run connects exclusively through the Cloud SQL Auth Proxy via an
# IAM-authenticated Unix socket (--add-cloudsql-instances), so the public
# endpoint is never reachable by raw TCP from the internet.
# Private IP requires setting up VPC peering first — unnecessary complexity here.
gcloud sql instances create myndral-db \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB

# Create the database and user
gcloud sql databases create myndral --instance=myndral-db
gcloud sql users create myndral \
  --instance=myndral-db \
  --password=CHANGE_ME_STRONG_PASSWORD
```

Once it's ready, apply the base schema. Install the proxy first if you don't
have it: https://cloud.google.com/sql/docs/postgres/sql-proxy

```bash
# Terminal 1 — start the proxy
cloud-sql-proxy myndral-prod:us-central1:myndral-db

# Terminal 2 — apply schema
psql "host=127.0.0.1 user=myndral dbname=myndral" -f db/schema.sql
```

---

## Step 5 — Create a GCS bucket

```bash
gcloud storage buckets create gs://myndral-media \
  --location=us-central1 \
  --uniform-bucket-level-access

# Make the images/ prefix public (artist photos, album art).
# Audio is served through /v1/stream which enforces access control — not public.
gcloud storage buckets add-iam-policy-binding gs://myndral-media \
  --member=allUsers \
  --role=roles/storage.objectViewer \
  --condition='expression=resource.name.startsWith("projects/_/buckets/myndral-media/objects/images/"),title=images-public-read'
```

---

## Step 6 — Store secrets in Secret Manager

Run each block separately, replacing the placeholder values.

```bash
# Generate a strong random secret key (copy the output)
python3 -c "import secrets; print(secrets.token_hex(32))"

echo -n "PASTE_SECRET_KEY_HERE" | \
  gcloud secrets create myndral-secret-key --data-file=-
```

```bash
# The Cloud SQL connection string uses the Auth Proxy socket path.
# The format is fixed — only change the password.
echo -n "postgresql+asyncpg://myndral:CHANGE_ME_STRONG_PASSWORD@/myndral?host=/cloudsql/myndral-prod:us-central1:myndral-db" | \
  gcloud secrets create myndral-database-url --data-file=-
```

```bash
# Redis — use Upstash free tier (upstash.com → create a Redis DB → copy the TLS URL)
echo -n "rediss://default:YOUR_UPSTASH_PASSWORD@YOUR_UPSTASH_ENDPOINT:PORT" | \
  gcloud secrets create myndral-redis-url --data-file=-
```

```bash
echo -n "YOUR_ELEVENLABS_API_KEY" | \
  gcloud secrets create myndral-elevenlabs-api-key --data-file=-
```

```bash
echo -n "myndral-media" | \
  gcloud secrets create myndral-gcs-bucket-name --data-file=-
```

---

## Step 7 — Service accounts and IAM

```bash
# Create the API's runtime service account
gcloud iam service-accounts create myndral-api-sa \
  --display-name="MyndralAI API"

# Allow it to read secrets
gcloud projects add-iam-policy-binding myndral-prod \
  --member="serviceAccount:myndral-api-sa@myndral-prod.iam.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor

# Allow it to connect to Cloud SQL via the Auth Proxy
gcloud projects add-iam-policy-binding myndral-prod \
  --member="serviceAccount:myndral-api-sa@myndral-prod.iam.gserviceaccount.com" \
  --role=roles/cloudsql.client

# Allow it to upload files to the media bucket
gcloud storage buckets add-iam-policy-binding gs://myndral-media \
  --member="serviceAccount:myndral-api-sa@myndral-prod.iam.gserviceaccount.com" \
  --role=roles/storage.objectCreator

# Grant Cloud Build permission to deploy services and act as the API service account
PROJECT_NUMBER=$(gcloud projects describe myndral-prod --format='value(projectNumber)')

gcloud projects add-iam-policy-binding myndral-prod \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding myndral-prod \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/iam.serviceAccountUser

gcloud projects add-iam-policy-binding myndral-prod \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor
```

---

## Step 8 — Build and deploy services (first time)

This is a one-off manual bootstrap. All future deploys happen automatically
via Cloud Build on every push to `main`.

### 8a — API

```bash
# Build and push from the monorepo root
docker build -f apps/api/Dockerfile \
  -t us-central1-docker.pkg.dev/myndral-prod/myndral/api:latest .
docker push us-central1-docker.pkg.dev/myndral-prod/myndral/api:latest

# Deploy
gcloud run deploy myndral-api \
  --image=us-central1-docker.pkg.dev/myndral-prod/myndral/api:latest \
  --region=us-central1 \
  --platform=managed \
  --service-account=myndral-api-sa@myndral-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances=myndral-prod:us-central1:myndral-db \
  --set-secrets=SECRET_KEY=myndral-secret-key:latest,DATABASE_URL=myndral-database-url:latest,REDIS_URL=myndral-redis-url:latest,ELEVENLABS_API_KEY=myndral-elevenlabs-api-key:latest,GCS_BUCKET_NAME=myndral-gcs-bucket-name:latest \
  --min-instances=0 \
  --max-instances=4 \
  --memory=512Mi \
  --cpu=1 \
  --allow-unauthenticated
```

The deploy command prints a `Service URL` like
`https://myndral-api-xxxx-uc.a.run.app`. **Copy it** — you'll need it as
a temporary API URL for the next two builds (before the custom domain is live).

### 8b — Web player

```bash
# Replace the URL below with the one printed in step 8a
docker build -f apps/web/Dockerfile \
  --build-arg VITE_API_URL=https://myndral-api-xxxx-uc.a.run.app \
  -t us-central1-docker.pkg.dev/myndral-prod/myndral/web:latest .
docker push us-central1-docker.pkg.dev/myndral-prod/myndral/web:latest

gcloud run deploy myndral-web \
  --image=us-central1-docker.pkg.dev/myndral-prod/myndral/web:latest \
  --region=us-central1 \
  --platform=managed \
  --min-instances=0 \
  --max-instances=4 \
  --memory=256Mi \
  --cpu=1 \
  --allow-unauthenticated
```

### 8c — Internal studio

```bash
docker build -f apps/internal-web/Dockerfile \
  --build-arg VITE_API_URL=https://myndral-api-xxxx-uc.a.run.app \
  -t us-central1-docker.pkg.dev/myndral-prod/myndral/studio:latest .
docker push us-central1-docker.pkg.dev/myndral-prod/myndral/studio:latest

gcloud run deploy myndral-studio \
  --image=us-central1-docker.pkg.dev/myndral-prod/myndral/studio:latest \
  --region=us-central1 \
  --platform=managed \
  --min-instances=0 \
  --max-instances=2 \
  --memory=256Mi \
  --cpu=1 \
  --allow-unauthenticated
```

---

## Step 9 — DB migration job

```bash
docker build -f infra/migrate/Dockerfile \
  -t us-central1-docker.pkg.dev/myndral-prod/myndral/migrate:latest .
docker push us-central1-docker.pkg.dev/myndral-prod/myndral/migrate:latest

gcloud run jobs create myndral-migrate \
  --image=us-central1-docker.pkg.dev/myndral-prod/myndral/migrate:latest \
  --region=us-central1 \
  --service-account=myndral-api-sa@myndral-prod.iam.gserviceaccount.com \
  --add-cloudsql-instances=myndral-prod:us-central1:myndral-db \
  --set-secrets=DATABASE_URL=myndral-database-url:latest \
  --max-retries=0 \
  --task-timeout=300s

# Run it immediately to apply any pending migrations
gcloud run jobs execute myndral-migrate --region=us-central1 --wait
```

---

## Step 10 — Custom domains (myndral.com)

GCP needs to verify you own myndral.com before it can issue TLS certificates.

### 10a — Verify domain ownership

Go to **GCP Console → Cloud Run → Domain mappings → Manage custom domains**
and click **Add mapping**. When prompted to verify `myndral.com`, GCP will show
you a TXT record to add to your DNS. Add it at your registrar, wait a minute,
then click Verify.

You only do this once — all subdomains under myndral.com are then trusted.

### 10b — Map subdomains to services

```bash
gcloud run domain-mappings create \
  --service=myndral-api \
  --domain=api.myndral.com \
  --region=us-central1

gcloud run domain-mappings create \
  --service=myndral-web \
  --domain=app.myndral.com \
  --region=us-central1

gcloud run domain-mappings create \
  --service=myndral-studio \
  --domain=studio.myndral.com \
  --region=us-central1
```

### 10c — Add DNS records at your registrar

Get the records GCP expects:

```bash
gcloud run domain-mappings describe --domain=api.myndral.com --region=us-central1
gcloud run domain-mappings describe --domain=app.myndral.com --region=us-central1
gcloud run domain-mappings describe --domain=studio.myndral.com --region=us-central1
```

Each command prints CNAME or A/AAAA records. Go to your registrar's DNS panel
and add all of them. They typically look like:

| Name | Type | Value |
|---|---|---|
| `api` | CNAME | `ghs.googlehosted.com.` |
| `app` | CNAME | `ghs.googlehosted.com.` |
| `studio` | CNAME | `ghs.googlehosted.com.` |

TLS certificates are provisioned automatically by GCP within ~15 minutes of DNS
propagating. You can check status with:

```bash
gcloud run domain-mappings describe --domain=app.myndral.com --region=us-central1
```

Look for `certificateStatus: ACTIVE`.

### 10d — Update VITE_API_URL to the custom domain

Now that `api.myndral.com` is live, rebuild the frontends so the JS bundle
points to the clean domain instead of the auto-generated URL. Update the Cloud
Build trigger's `_API_URL` substitution variable to `https://api.myndral.com`
(Step 11 below), then trigger a build — this takes care of it permanently.

---

## Step 11 — Connect Cloud Build to GitHub

1. **GCP Console → Cloud Build → Repositories** → connect your GitHub account
   and link the `myndral` repository.

2. **Cloud Build → Triggers → Create trigger:**
   - Event: **Push to a branch**
   - Branch regex: `^main$`
   - Configuration: **Cloud Build configuration file** → `infra/cloudbuild.yaml`
   - Substitution variables:

   | Variable | Value |
   |---|---|
   | `_REGION` | `us-central1` |
   | `_AR_REPO` | `myndral` |
   | `_API_SERVICE` | `myndral-api` |
   | `_WEB_SERVICE` | `myndral-web` |
   | `_STUDIO_SERVICE` | `myndral-studio` |
   | `_MIGRATE_JOB` | `myndral-migrate` |
   | `_API_URL` | `https://api.myndral.com` |

3. Click **Save**. Every merge to `main` now triggers a full
   build → migrate → deploy pipeline automatically.

---

## Cost estimate

| Resource | Monthly cost |
|---|---|
| Cloud Run — 3 services, scales to zero | ~$0 (2M free requests/month) |
| Cloud SQL db-f1-micro | ~$7 |
| GCS — first 5 GB storage | ~$0 (free tier) |
| Artifact Registry — first 0.5 GB | ~$0 (free tier) |
| Cloud Build — first 120 min/day | ~$0 (free tier) |
| Custom domain TLS (Cloud Run managed) | $0 |
| **Total** | **~$7/month** |

---

## Redis note

Memorystore (GCP's managed Redis) starts at ~$25/month. Use
[Upstash](https://upstash.com) instead — free tier gives 10k commands/day
which is sufficient for low traffic. Create a Redis database there, copy the
TLS connection URL, and store it in the `myndral-redis-url` secret (Step 6).
