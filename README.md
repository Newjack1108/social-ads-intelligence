# Social Ads Intelligence

Production-ready Meta/Facebook Ads analytics dashboard. Ingest ad performance data via Make.com webhooks and visualize KPIs, trends, breakdowns, and rules-based recommendations.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **PostgreSQL** via Prisma ORM
- **NextAuth** (email magic link)
- **Recharts** for visualizations
- **Vercel**-ready / **Railway**-ready deployment

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Resend account (or SMTP) for magic link emails

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/social_ads_intelligence"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-min-32-chars"

# Email (Resend or SMTP)
# Option A: Resend
EMAIL_SERVER='{"host":"smtp.resend.com","port":465,"auth":{"user":"resend","pass":"re_xxxxxxxx"}}'
EMAIL_FROM="noreply@yourdomain.com"

# Option B: Generic SMTP
# EMAIL_SERVER="smtps://user:pass@smtp.example.com:465"
# EMAIL_FROM="noreply@example.com"

# Webhook security (required for Make.com ingestion)
WEBHOOK_SECRET="your-webhook-secret-for-hmac-signing"

# Optional: Logging
LOG_LEVEL="info"
```

## Running Locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up the database**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Seed sample data**

   ```bash
   npm run db:seed
   ```

   This creates a workspace with API key `wk_seed_test_local_dev_12345` and sample ad metrics.

4. **Create a user and workspace membership**

   - Sign in via the magic link flow at `/auth/signin`
   - Call `POST /api/workspace/join-default` to join the seeded workspace (or run the SQL below)

   From browser console or curl:
   ```bash
   curl -X POST http://localhost:3000/api/workspace/join-default -H "Cookie: <your-session-cookie>"
   ```
   Or from an authenticated page, use `fetch('/api/workspace/join-default', { method: 'POST' })`.

   Alternatively, add your user manually:
   ```sql
   INSERT INTO "WorkspaceMember" (id, role, "workspaceId", "userId", "createdAt")
   SELECT gen_random_uuid(), 'owner', w.id, u.id, NOW()
   FROM "Workspace" w, "User" u
   WHERE w."apiKey" = 'wk_seed_test_local_dev_12345' AND u.email = 'your@email.com';
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploying to Railway (GitHub + Railway PostgreSQL)

### 1. Push to GitHub

```bash
cd "c:\projects\Social Hub\social-ads-intelligence"

# Initialize git (if not already)
git init

# Add all files and commit
git add .
git commit -m "Initial commit: Social Ads Intelligence"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/social-ads-intelligence.git
git branch -M main
git push -u origin main
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in (GitHub).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select your `social-ads-intelligence` repository (authorize GitHub if needed).
5. Railway will create a new service from the repo.

### 3. Add PostgreSQL Database

1. In your Railway project, click **+ New**.
2. Select **Database** → **PostgreSQL**.
3. Railway creates a PostgreSQL instance and injects `DATABASE_URL` into your app.

### 4. Link Database to Your App

1. Click your **web service** (the one from GitHub).
2. Go to the **Variables** tab.
3. Click **+ Add Variable** → **Add Reference**.
4. Select your PostgreSQL service and choose `DATABASE_URL`.
5. Railway will add it automatically.

### 5. Set Environment Variables

In your web service → **Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXTAUTH_URL` | `https://YOUR-APP.up.railway.app` *(replace with your Railway URL)* |
| `NEXTAUTH_SECRET` | Random 32+ char string *(e.g. `openssl rand -base64 32`)* |
| `EMAIL_SERVER` | `{"host":"smtp.resend.com","port":465,"auth":{"user":"resend","pass":"re_YOUR_KEY"}}` |
| `EMAIL_FROM` | `noreply@yourdomain.com` |
| `WEBHOOK_SECRET` | Random secret for Make.com webhook signing |

**Important:** Set `NEXTAUTH_URL` *after* your first deploy so you know the exact URL. Railway shows it under **Settings** → **Domains**.

### 6. Deploy

- Railway auto-deploys on every push to `main`.
- The build runs: `prisma generate` → `prisma db push` → `next build`.
- Tables are created automatically from your schema.

### 7. Seed Data (First Time Only)

After the first successful deploy:

1. Install [Railway CLI](https://docs.railway.app/develop/cli): `npm i -g @railway/cli`
2. Link and run the seed:
   ```bash
   railway login
   railway link   # select your project
   railway run npm run db:seed
   ```
3. The seed creates a workspace with API key `wk_seed_test_local_dev_12345`.

### 8. Generate a Domain

1. In your web service → **Settings** → **Networking**.
2. Click **Generate Domain**.
3. Use this URL as `NEXTAUTH_URL` in Variables, then redeploy.

### 9. Sign In and Join Workspace

1. Visit `https://YOUR-APP.up.railway.app`.
2. Sign in with your email (magic link).
3. Click **Join default workspace** on the dashboard.
4. You should see sample data (if seeded).

### Webhook URL for Make.com

Use:

```
POST https://YOUR-APP.up.railway.app/api/webhooks/meta
```

Headers: `x-workspace-key`, `x-make-signature`, `Content-Type: application/json`.

## Make.com Webhook Setup

**Full step-by-step guide:** See [docs/MAKE_COM_SETUP.md](docs/MAKE_COM_SETUP.md) for creating a Make.com scenario that fetches Meta Ads and posts to this webhook.

### Endpoint

```
POST https://your-app.up.railway.app/api/webhooks/meta
```
*(or your Vercel/Railway/custom domain)*

### Required Headers

| Header           | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `x-workspace-key` | Workspace API key (from `Workspace.apiKey` in the database)                 |
| `Content-Type`   | `application/json`                                                          |

### Authentication (choose one)

| Header | Description |
| ------ | ----------- |
| `x-make-signature` | HMAC SHA256 of the **raw JSON body** using `WEBHOOK_SECRET` as the key (recommended for production) |
| `x-webhook-secret` | Plain `WEBHOOK_SECRET` value – simpler, no Code module needed in Make.com |

### Signature Verification

1. Compute `HMAC-SHA256(rawBody, WEBHOOK_SECRET)` in hex.
2. Send the result in `x-make-signature`.
3. If the signature is missing or invalid, the endpoint returns `401`.

### Payload Format

```json
{
  "source": "meta",
  "account_id": "act_123456789",
  "sync_id": "uuid-optional",
  "generated_at": "2024-03-01T12:00:00Z",
  "grain": "daily",
  "rows": [
    {
      "account_id": "act_123456789",
      "campaign_id": "camp_001",
      "campaign_name": "Brand Campaign",
      "adset_id": "adset_001",
      "adset_name": "US 18-35",
      "ad_id": "ad_001",
      "ad_name": "Summer Sale",
      "date_start": "2024-02-28",
      "date_stop": "2024-02-28",
      "spend": 125.50,
      "impressions": 25000,
      "reach": 18000,
      "frequency": 1.39,
      "clicks": 350,
      "unique_clicks": 320,
      "link_clicks": 350,
      "cpc": 0.36,
      "cpm": 5.02,
      "ctr": 1.4,
      "actions": [
        { "action_type": "link_click", "value": 350 },
        { "action_type": "omni_purchase", "value": 12, "action_value": 480.00 }
      ],
      "action_values": [
        { "action_type": "omni_purchase", "action_value": 480.00 }
      ]
    }
  ],
  "creatives": [
    {
      "ad_id": "ad_001",
      "creative_id": "cr_001",
      "primary_text": "Up to 40% off!",
      "headline": "Summer Sale",
      "cta": "SHOP_NOW",
      "destination_url": "https://example.com/sale",
      "image_url": "https://..."
    }
  ]
}
```

### Suggested Meta Fields for Make.com

When building your Make.com scenario to fetch Meta Ads Insights, request:

- **Ids:** `account_id`, `campaign_id`, `adset_id`, `ad_id`
- **Names:** `campaign_name`, `adset_name`, `ad_name`
- **Dates:** `date_start`, `date_stop`
- **Spend / reach:** `spend`, `impressions`, `reach`, `frequency`
- **Clicks:** `clicks`, `unique_clicks`, `link_clicks`, `inline_link_clicks`, `outbound_clicks`
- **Costs:** `cpc`, `cpm`, `ctr`, `unique_ctr`, `cpp`
- **Actions:** `actions`, `action_values` (with breakdown by `action_type`)
- **Video:** `video_play_actions`, `video_thruplays`, `video_p25_watched_actions`, `video_p50_watched_actions`, `video_p75_watched_actions`, `video_p95_watched_actions`
- **Breakdowns (optional):** `age`, `gender`, `country`, `region`, `placement`, `device_platform`, `publisher_platform`, `platform_position`

Transform the Meta API response into the payload format above before sending to the webhook.

## Troubleshooting

### Webhook returns 401

- Confirm `x-workspace-key` matches a `Workspace.apiKey` in the database.
- Confirm `x-make-signature` is the hex HMAC-SHA256 of the **exact raw request body** (before JSON parse). Whitespace and key order must match.

### Webhook returns 400 "Validation failed"

- Ensure `source` is exactly `"meta"`.
- Ensure `account_id` and `rows` are present.
- Check that each row has `date_start` and numeric values where expected.
- Use `creatives` array for creative metadata (optional).

### No data on dashboard

- Ensure you have run the seed script or received at least one successful webhook.
- Confirm your user has a `WorkspaceMember` record for the workspace.
- Check the date range picker includes the dates of your data.

### Magic link not received

- Verify `EMAIL_SERVER` and `EMAIL_FROM` are correct.
- For Resend: ensure the API key has sending permissions and the domain is verified.
- Check spam folder.

### Prisma errors

- Run `npx prisma generate` after schema changes.
- Run `npx prisma db push` to sync the schema (dev) or `npx prisma migrate dev` for migrations.

## Project Structure

```
├── app/
│   ├── (app)/           # Authenticated app routes
│   │   ├── dashboard/
│   │   ├── campaigns/
│   │   ├── adsets/
│   │   ├── ads/
│   │   ├── creatives/
│   │   └── recommendations/
│   ├── api/
│   │   ├── auth/
│   │   └── webhooks/meta/
│   └── auth/
├── components/
├── lib/
│   ├── meta/            # Meta normalization + schema
│   ├── auth.ts
│   ├── dashboard.ts
│   ├── db.ts
│   └── logger.ts
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

## License

MIT
#   s o c i a l - a d s - i n t e l l i g e n c e 
 
 #   s o c i a l - a d s - i n t e l l i g e n c e 
 
 