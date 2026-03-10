# LeadLock Webhook Setup

This guide explains how to send actual sale conversions from LeadLock to Social Ads Intelligence when a Meta lead converts to a sale. Meta does not know if a lead became an actual sale; this webhook fills that gap.

---

## Webhook URL

```
https://YOUR-APP.up.railway.app/api/webhooks/leadlock
```

Replace `YOUR-APP` with your Railway (or hosting) app subdomain.

---

## Authentication

**Required headers:**

| Header            | Description                                                                 |
| ----------------- | --------------------------------------------------------------------------- |
| `x-workspace-key` | Your workspace API key (e.g. from Settings or environment)                   |
| `x-webhook-secret` **or** `x-make-signature` | Your `WEBHOOK_SECRET` value, or HMAC-SHA256 signature of the request body |

**Quick auth (no HMAC):** Set `x-webhook-secret` to the exact value of `WEBHOOK_SECRET`. The server will accept if the header matches.

**HMAC auth:** Compute `HMAC-SHA256(body, WEBHOOK_SECRET)` and send as `x-make-signature`.

---

## Payload Schema

**Content-Type:** `application/json`

| Field         | Type   | Required | Description                                                  |
| ------------- | ------ | -------- | ------------------------------------------------------------ |
| `sale_amount` | number | Yes      | Sale value (positive number)                                 |
| `sale_date`   | string | No       | ISO date (e.g. `2025-03-10`). Defaults to today              |
| `ad_id`       | string | No*      | Meta ad ID for attribution (external ID from Meta API)       |
| `adset_id`    | string | No*      | Meta ad set ID for attribution                               |
| `campaign_id` | string | No*      | Meta campaign ID for attribution                             |
| `leadlock_id` | string | No       | Unique ID for deduplication (prevents duplicate processing)   |
| `event_id`    | string | No       | Alternative to `leadlock_id` for deduplication               |
| `notes`       | string | No       | Optional notes                                               |

\* At least one of `ad_id`, `adset_id`, or `campaign_id` is required. Use the most specific level you have (ad preferred over adset over campaign).

---

## Example Payload

```json
{
  "sale_amount": 2500,
  "sale_date": "2025-03-10",
  "ad_id": "120212345678901234",
  "leadlock_id": "lead-abc123-sale-xyz",
  "notes": "Wedding package booking"
}
```

---

## Setup in LeadLock / HighLevel

1. Create a webhook or "HTTP Request" action that fires when a lead converts to a sale.
2. Configure:
   - **Method:** POST
   - **URL:** Your `https://.../api/webhooks/leadlock` URL
   - **Headers:**
     - `Content-Type`: `application/json`
     - `x-workspace-key`: Your workspace API key
     - `x-webhook-secret`: Your `WEBHOOK_SECRET` environment variable value
3. **Body:** Map the sale amount, date, and ad/campaign attribution to the payload fields above. Use `leadlock_id` or `event_id` with a unique value per sale to avoid duplicates on retries.

---

## Prerequisites

- Meta data must already be synced to Social Ads Intelligence (via the Make.com webhook) so that the referenced `ad_id`, `adset_id`, or `campaign_id` exists in the workspace.
- Attribution IDs should match the external IDs from Meta (e.g. numeric IDs or `act_` prefixed where applicable).

---

## Manual Sale Entry

You can also record sales manually from the app:

1. Go to **Record sale** in the navigation.
2. Select the campaign, ad set, or ad to attribute the sale to.
3. Enter the sale date, amount, and optional notes.
4. Click **Record sale**.

Manual and LeadLock sales both contribute to conversions, ROAS, and CPA metrics across the dashboard.
