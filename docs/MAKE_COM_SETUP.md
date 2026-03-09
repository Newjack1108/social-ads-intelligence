# Make.com + Facebook/Meta Ads Setup Guide

This guide walks you through creating a Make.com scenario that fetches Meta Ads insights and sends them to your Social Ads Intelligence webhook.

**Quick auth (no Code module):** Add header `x-webhook-secret` with your `WEBHOOK_SECRET` value. No HMAC or Code module required. See Step 8.

---

## Prerequisites

- Make.com account
- Meta Business account with ads
- Meta App with Marketing API access
- Your Railway app URL and credentials:
  - **Webhook URL**: `https://YOUR-APP.up.railway.app/api/webhooks/meta`
  - **Workspace API Key**: `wk_seed_test_local_dev_12345` (or your workspace key)
  - **Webhook Secret**: Your `WEBHOOK_SECRET` from Railway variables

---

## Part 1: Meta App Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App** (or use an existing app).
2. Add the **Marketing API** product to your app.
3. In **App Review** → **Permissions**, request:
   - `ads_read` (required)
   - `ads_management` (optional, for broader access)
4. Generate a **User Access Token** with `ads_read`:
   - Use [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app → Get User Access Token → check `ads_read`
   - Copy the token (short-lived; for production use a long-lived token or System User token)
5. Get your **Ad Account ID**: Go to [business.facebook.com](https://business.facebook.com) → Business Settings → Accounts → Ad Accounts → copy the ID (e.g. `act_123456789`).

---

## Part 2: Make.com Scenario Structure

### Overview

```
[Schedule Trigger] → [Facebook: Get Insights] → [Iterator] → [Aggregate] → [Build Payload] → [HTTP: POST to Webhook]
```

### Step-by-Step

---

### Step 1: Create a New Scenario

1. Make.com → **Create new scenario**
2. Name it: e.g. "Meta Ads → Social Ads Intelligence"

---

### Step 2: Add Trigger – Schedule

1. Add module → **Schedules** → **Every day** (or **Every 15 minutes** for testing)
2. Set time: e.g. 6:00 AM (after Meta’s data is typically available)
3. Optional: Add **Set variable** for `date_start` and `date_stop` (yesterday’s date)

---

### Step 3: Add Facebook Marketing Module

1. Add module → **Facebook Marketing** (or **Facebook Insights**)
2. If not connected: **Add** → sign in and authorize
3. Choose **Get an Ad Insight** (or equivalent)

**Configure:**
- **Ad Account ID**: `act_YOUR_ACCOUNT_ID`
- **Level**: `ad` (for ad-level insights) or `campaign` / `adset` if you prefer
- **Time Range**: 
  - **Date preset**: `yesterday` or `last_7d`
  - Or custom: `date_start` = yesterday, `date_stop` = yesterday
- **Time increment**: `1` (daily breakdown)
- **Fields** (comma-separated):
  ```
  account_id,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,date_stop,spend,impressions,reach,frequency,clicks,unique_clicks,link_clicks,inline_link_clicks,outbound_clicks,cpc,cpm,ctr,unique_ctr,cpp,video_play_actions,video_thruplays,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,actions,action_values
  ```

---

### Step 4: Add Iterator

The Facebook module may return one object or multiple. Add **Iterator** to loop over the output:
- **Array**: `data` (or the array from the previous module)
- Map each item for the next step

---

### Step 5: Add Aggregate (Array Builder)

1. Add **Tools** → **Array aggregator** (or **Set multiple variables** if you need custom logic)
2. Aggregate the iterator output into a single array named `rows`
3. Map Meta fields to our schema. Meta uses similar names; ensure:
   - `date_start` → string (e.g. `2024-03-01`)
   - `spend`, `impressions`, etc. → numbers (parse if strings)
   - `actions`, `action_values` → array of `{ action_type, value, action_value }` if present

---

### Step 6: Add Code Module (Build Payload + HMAC)

1. Add **Code** → **Run JavaScript**
2. Paste the script below (replace placeholders)
3. Inputs: `rows` from aggregator, `account_id`, `WEBHOOK_SECRET` (from scenario variable)

```javascript
// Inputs: rows (array), account_id (string), webhookSecret (string)
function main(rows, accountId, webhookSecret) {
  const payload = {
    source: "meta",
    account_id: accountId,
    sync_id: `sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    generated_at: new Date().toISOString(),
    grain: "daily",
    rows: rows.map(r => ({
      account_id: r.account_id || accountId,
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      adset_id: r.adset_id,
      adset_name: r.adset_name,
      ad_id: r.ad_id,
      ad_name: r.ad_name,
      date_start: r.date_start,
      date_stop: r.date_stop || r.date_start,
      spend: parseFloat(r.spend || 0),
      impressions: parseInt(r.impressions || 0, 10),
      reach: parseInt(r.reach || 0, 10),
      frequency: parseFloat(r.frequency || 0),
      clicks: parseInt(r.clicks || 0, 10),
      unique_clicks: parseInt(r.unique_clicks || 0, 10),
      link_clicks: parseInt(r.link_clicks || 0, 10),
      inline_link_clicks: parseInt(r.inline_link_clicks || 0, 10),
      outbound_clicks: parseInt(r.outbound_clicks || 0, 10),
      cpc: parseFloat(r.cpc || 0),
      cpm: parseFloat(r.cpm || 0),
      ctr: parseFloat(r.ctr || 0),
      unique_ctr: parseFloat(r.unique_ctr || 0),
      cpp: parseFloat(r.cpp || 0),
      video_play_actions: parseInt(r.video_play_actions || 0, 10),
      video_thruplays: parseInt(r.video_thruplays || 0, 10),
      video_p25_watched_actions: parseInt(r.video_p25_watched_actions || 0, 10),
      video_p50_watched_actions: parseInt(r.video_p50_watched_actions || 0, 10),
      video_p75_watched_actions: parseInt(r.video_p75_watched_actions || 0, 10),
      video_p95_watched_actions: parseInt(r.video_p95_watched_actions || 0, 10),
      actions: r.actions || [],
      action_values: r.action_values || []
    })),
    creatives: []
  };

  const body = JSON.stringify(payload);
  
  // HMAC-SHA256
  const crypto = require('crypto');
  const signature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

  return { body, signature };
}
```

**Note:** Make.com’s Code module may use a different runtime. If `require('crypto')` isn’t available, use Make.com’s **Hash** tool with HMAC-SHA256 instead (see alternative below).

**If `require('crypto')` fails:** Copy the full script from `docs/make-com-transform.js` in this repo—it includes a pure-JS HMAC implementation that works without Node.js.

---

### Step 7: Alternative – Without Code (Hash Tool)

If you can’t use a Code module:

1. Use **HTTP** → **Make a request** to send the payload
2. Use **Tools** → **Hash** (if available) with:
   - Algorithm: HMAC-SHA256
   - Input: your JSON string
   - Key: `WEBHOOK_SECRET`
3. Use the hash output as `x-make-signature`

If Make.com doesn’t expose HMAC in the UI, the Code module or a separate “signer” webhook/service is required.

---

### Step 8: HTTP – POST to Webhook

1. Add **HTTP** → **Make a request**
2. **URL**: `https://YOUR-APP.up.railway.app/api/webhooks/meta`
3. **Method**: POST
4. **Headers**:
   - `Content-Type`: `application/json`
   - `x-workspace-key`: `wk_seed_test_local_dev_12345` (or your workspace key)
   - Either:
     - **Option A (simple):** `x-webhook-secret`: `{{WEBHOOK_SECRET}}` (no Code module needed)
     - **Option B (HMAC):** `x-make-signature`: output from Code module
5. **Body type**: Raw
6. **Body**: the JSON payload (from Set Variables or Code module)

---

## Part 3: Scenario Variables

Create these in your scenario (Settings → Variables):

| Name            | Value                      |
|-----------------|----------------------------|
| `WEBHOOK_SECRET` | Your Railway `WEBHOOK_SECRET` |
| `WORKSPACE_KEY`  | `wk_seed_test_local_dev_12345` |
| `WEBHOOK_URL`    | `https://YOUR-APP.up.railway.app/api/webhooks/meta` |
| `AD_ACCOUNT_ID`  | `act_123456789`            |

Reference them in modules with `{{WEBHOOK_SECRET}}`, etc.

---

## Part 4: Meta API Field Mapping

| Meta API Field | Our Schema Field | Notes |
|----------------|------------------|-------|
| `account_id`   | `account_id`     | |
| `campaign_id`  | `campaign_id`    | |
| `campaign_name`| `campaign_name`  | |
| `adset_id`     | `adset_id`       | |
| `adset_name`   | `adset_name`     | |
| `ad_id`        | `ad_id`          | |
| `ad_name`      | `ad_name`        | |
| `date_start`   | `date_start`     | Format: `YYYY-MM-DD` |
| `date_stop`    | `date_stop`      | |
| `spend`        | `spend`          | Number |
| `impressions`  | `impressions`    | Integer |
| `reach`        | `reach`          | Integer |
| `frequency`    | `frequency`      | Number |
| `clicks`       | `clicks`         | Integer |
| `cpc`          | `cpc`            | Number |
| `cpm`          | `cpm`            | Number |
| `ctr`          | `ctr`            | Number (Meta often returns as string) |
| `actions`      | `actions`        | Array of `{action_type, value}` |
| `action_values`| `action_values`  | Array of `{action_type, action_value}` |

---

## Part 5: Testing

1. **Run once** manually to test
2. In **Operations**, check execution history
3. If webhook returns 401: wrong `x-workspace-key` or `x-make-signature`
4. If 400: payload shape doesn’t match schema – inspect request body and compare to our schema
5. If 200: check your app dashboard for new data

---

## Part 6: Troubleshooting

| Error | Cause |
|-------|-------|
| 401 Unauthorized | Invalid `x-workspace-key` or `x-make-signature` |
| 400 Validation failed | Check `source`, `account_id`, `rows`, and field types |
| Empty rows | Meta date range or level may not return data |
| Signature mismatch | Body used for hashing must be identical to HTTP body; no extra whitespace or key reordering |

---

## Simplified Flow (Minimal)

If you want a minimal setup:

1. **Schedule** (daily)
2. **Facebook Marketing** → Get Ad Insights (ad level, yesterday)
3. **Code** → Build payload and compute HMAC
4. **HTTP** → POST to webhook with headers

This omits creatives; you can add a separate Facebook Creative fetch and append to `creatives` later.
