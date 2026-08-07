# OpenPay → OpenLedger Transaction Integration

**Version 1.0 · Base URL:** `https://openledger.lovable.app`
(stable alias: `https://openpyledger.space`)

OpenLedger is the public, hash-chained audit layer for the OpenPay ecosystem.
This document explains how OpenPay (and OpenPay Pro / OpenNFT) push or expose
transactions, and — most importantly — **how to build a permanent "View on
OpenLedger" link for every single order** so a user can open the exact ledger
entry for that order.

---

## 1. The one thing that makes deep links work: `external_ref`

Every transaction sent to OpenLedger carries an `external_ref` — **your** order /
transaction ID on the OpenPay side (e.g. `op_txn_9f3c21`, `ORDER-10245`).

- OpenLedger stores it on the ledger row.
- OpenLedger hashes the row (SHA‑256, chained to the previous block) and produces
  a canonical `hash`.
- You can then link by **your** ID — no need to store our hash.

> **Rule:** `external_ref` must be unique and stable per order. If you omit it,
> deep linking by order ID is impossible and users can only find the tx by hash.

---

## 2. Link formats (use these in the OpenPay UI)

| Purpose | URL |
| --- | --- |
| **By your order ID** (recommended) | `https://openledger.lovable.app/tx/ref/{external_ref}` |
| By ledger hash (canonical permalink) | `https://openledger.lovable.app/tx/{hash}` |
| Wallet history | `https://openledger.lovable.app/wallet/{address}` |
| Merchant page | `https://openledger.lovable.app/merchants/{merchant_id}` |
| Explorer (filtered) | `https://openledger.lovable.app/explorer?source=openpay` |

`/tx/ref/{external_ref}` resolves the order and forwards to the canonical
`/tx/{hash}` page. Safe to render immediately after checkout; if the sync has
not landed yet the page shows a "not synced yet" message instead of a 404.

### Drop-in button (OpenPay side)

```html
<a
  class="openledger-link"
  target="_blank"
  rel="noopener"
  href="https://openledger.lovable.app/tx/ref/ORDER-10245"
>
  🔗 View on OpenLedger
</a>
```

```tsx
// React
const ledgerUrl = (orderId: string) =>
  `https://openledger.lovable.app/tx/ref/${encodeURIComponent(orderId)}`;

<a href={ledgerUrl(order.id)} target="_blank" rel="noopener">View on OpenLedger</a>
```

---

## 3. Resolve API (get the hash / verify programmatically)

```http
GET /api/public/ledger/resolve?ref={external_ref}
GET /api/public/ledger/resolve?hash={hash}
GET /api/public/ledger/resolve?ref={external_ref}&redirect=1   # 302 → /tx/{hash}
```

**200 OK**

```json
{
  "found": true,
  "permalink": "https://openledger.lovable.app/tx/4c1f...e9",
  "transaction": {
    "hash": "4c1f...e9",
    "previous_hash": "9ab0...71",
    "block_number": 1842,
    "ts": "2026-08-07T10:22:31.000Z",
    "source": "openpay",
    "type": "payment",
    "from_address": "@alice",
    "to_address": "@merchant_store",
    "amount": 25.5,
    "currency": "OUSD",
    "network_fee": 0,
    "status": "confirmed",
    "merchant_id": "store_001",
    "external_ref": "ORDER-10245",
    "metadata": { "items": [{ "sku": "TS-1", "qty": 2 }] },
    "verified": true
  }
}
```

**404** `{ "found": false, "error": "Not found" }` — not ingested yet.

Use this when you want to store our `hash` on your order record (best practice:
save it once, then link to `/tx/{hash}` forever).

---

## 4. Pushing transactions (webhook / push model)

### 4.1 Single transaction

```http
POST /api/public/ledger/record
Content-Type: application/json
x-openpay-signature: <hex HMAC-SHA256 of the raw body>
```

```json
{
  "source": "openpay",
  "type": "payment",
  "from_address": "@alice",
  "to_address": "@merchant_store",
  "amount": 25.5,
  "currency": "OUSD",
  "network_fee": 0,
  "status": "confirmed",
  "merchant_id": "store_001",
  "external_ref": "ORDER-10245",
  "timestamp": "2026-08-07T10:22:31.000Z",
  "metadata": {
    "order_id": "ORDER-10245",
    "items": [{ "sku": "TS-1", "name": "Tee", "qty": 2, "price": 12.75 }],
    "note": "Pi Browser checkout",
    "image_url": "https://openpy.space/img/tee.png"
  }
}
```

**Response**

```json
{ "ok": true, "transaction": { "hash": "4c1f...e9", "block_number": 1842, "...": "..." } }
```

Store `transaction.hash` on your order → permanent link `/tx/{hash}`.

### 4.2 Bulk (up to 500)

```http
POST /api/public/ledger/bulk
x-openpay-signature: <hex HMAC-SHA256 of the raw body>

{ "transactions": [ { ...same shape... }, { ... } ] }
```

Response: `{ "ok": 498, "failed": 2, "errors": ["..."] }`

### 4.3 Signature

```js
const crypto = require("crypto");
const raw = JSON.stringify(payload);           // sign the EXACT bytes you send
const sig = crypto.createHmac("sha256", OPENPAY_WEBHOOK_SECRET)
                  .update(raw).digest("hex");

await fetch("https://openledger.lovable.app/api/public/ledger/record", {
  method: "POST",
  headers: { "content-type": "application/json", "x-openpay-signature": sig },
  body: raw,
});
```

The shared secret is stored on both sides as `OPENPAY_WEBHOOK_SECRET`.
Requests with a bad or missing signature get `401`.

---

## 5. Field reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `source` | `openpay` \| `openpay_pro` | ✅ | Which app produced it |
| `type` | `payment`, `transfer`, `swap`, `nft_mint`, `nft_sale`, `merchant_payment`, `withdrawal`, `deposit`, `refund` | ✅ | Ledger classification |
| `from_address` | string (2–128) | ➖ | Username, wallet or `@handle` |
| `to_address` | string (2–128) | ➖ | Same |
| `amount` | number \| numeric string | ✅ | Positive value |
| `currency` | string (≤16) | ✅ | `OUSD`, `PI`, `OPEN` … |
| `network_fee` | number | ➖ | Default `0` |
| `status` | `pending` \| `confirmed` \| `failed` \| `reversed` | ➖ | Default `confirmed` |
| `merchant_id` | string | ➖ | Links the tx to a merchant page |
| `external_ref` | string (≤256) | **✅ for deep links** | Your order ID |
| `timestamp` | ISO‑8601 | ➖ | Defaults to now |
| `metadata` | object | ➖ | Anything: items, images, notes, KYC refs |

**Metadata is rendered richly** on the transaction page: image URLs / data URIs
become thumbnails, ISO dates become readable dates, booleans become badges,
nested objects expand. Send structured data, not stringified blobs.

---

## 6. Pull model (OpenLedger polls you)

OpenLedger also runs an automatic pull sync (every minute, via a scheduled job)
against each enabled integration configured in the OpenLedger admin panel:

| Integration | Endpoint OpenLedger calls | Auth |
| --- | --- | --- |
| OpenPay | `{base_url}/public?limit=&offset=` | none (public feed) |
| OpenPay Pro | `{base_url}/entries?cursor=` | `x-api-key` |
| OpenNFT | `{base_url}/activity`, `/collections`, `/stats` | none |

Requirements for the pull feed:

- Deterministic ordering (newest first or cursor based) and a stable `id` per row
  → OpenLedger maps that `id` into `external_ref`, so `/tx/ref/{id}` works with
  the pull model too.
- Include `created_at` (ISO), amount, currency, status, sender/receiver, category.
- Support `limit`/`offset` or `cursor`; page size ≤ 100.

---

## 7. Read APIs (for OpenPay UI widgets)

| Endpoint | Description |
| --- | --- |
| `GET /api/public/transactions?limit=&source=&type=&merchant_id=` | Recent ledger entries |
| `GET /api/public/transaction/{hash}` | One transaction |
| `GET /api/public/ledger/resolve?ref=` | Resolve order → tx + permalink |
| `GET /api/public/wallet/{address}` | Wallet summary + history |
| `GET /api/public/merchant/{id}` | Merchant stats |
| `GET /api/public/token/{symbol}` | Token stats (OUSD pegged 1 OUSD = 1 PI = $1) |
| `GET /api/public/analytics` | Daily aggregates (volume, tx count, by source) |
| `GET /api/public/nft-market/collections \| /activity \| /stats` | NFT data |

All read endpoints are CORS-friendly, unauthenticated and read-only.

---

## 8. Recommended OpenPay implementation checklist

1. On every completed transaction, `POST /api/public/ledger/record` with
   `external_ref = your order id`.
2. Save the returned `hash` on the order row (`ledger_hash`).
3. In the order/receipt UI render:
   - `View on OpenLedger → /tx/{ledger_hash}` if you have the hash, else
   - `→ /tx/ref/{order_id}` (always safe).
4. In transaction history lists, add a small 🔗 icon per row using the same URL.
5. Optional: show a "Verified on OpenLedger" badge by calling
   `/api/public/ledger/resolve?ref=…` and checking `transaction.verified`.
6. Retry failed pushes with exponential backoff; the ledger is idempotent per
   `external_ref` on the pull path and safe to re-resolve.

---

## 9. Guarantees

- **Immutable:** ledger rows and blocks reject `UPDATE`/`DELETE` at the database level.
- **Chained:** each entry stores `previous_hash`; any tampering breaks the chain.
- **Public:** anyone can verify an order without an account.
- **Live:** new entries stream to the explorer in real time.
