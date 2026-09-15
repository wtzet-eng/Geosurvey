# Paddle payment setup

SurveyLand now supports one-time Paddle credit packs for authenticated AI interpretation. The public evidence report remains available without payment. Payment is disabled by default.

## Sandbox configuration

Set these server-side values in the Cloud Run/AI Studio environment:

- `PADDLE_BILLING_ENABLED=true`
- `PADDLE_ENVIRONMENT=sandbox`
- `PADDLE_API_KEY`
- `PADDLE_CLIENT_TOKEN`
- `PADDLE_AI_CREDIT_PRICE_ID`
- `PADDLE_WEBHOOK_SECRET`
- `AI_CREDIT_PACK_SIZE`
- `AI_QUOTA_ENFORCEMENT=true`
- `AI_QUOTA_FIRESTORE_PROJECT_ID`

The Paddle price must be a one-time price. The configured pack size is recorded in the order before checkout, so later price or pack-size changes do not alter an existing purchase.

## Paddle notification destination

Create a sandbox notification destination pointing to:

`https://<your-app-host>/api/billing/paddle/webhook`

Subscribe it to `transaction.completed`. Keep the destination secret server-side. The handler verifies the `Paddle-Signature` against the raw request body, rejects stale signatures, and returns a non-2xx response when fulfillment cannot be durably completed so Paddle retries.

## API behavior

- `GET /api/billing/status` returns entitlement and public billing state.
- `POST /api/billing/checkout` creates a server-owned transaction.
- `POST /api/billing/confirm` is a browser recovery path for a signed-in buyer.
- The webhook is authoritative and browser confirmation is idempotent.
- Credits are granted only to the authenticated owner and only once per transaction.

Orders and transaction receipts are stored in Firestore using the configured quota and transaction collections. The Cloud Run service account needs Firestore read/write access.

## Verification checklist

1. Leave billing disabled while deploying the code.
2. Configure Paddle sandbox product, one-time price, client token and notification destination.
3. Set the server-side variables and enable billing.
4. Sign in, buy one credit pack, and verify the transaction reaches `completed`.
5. Confirm the entitlement increases once; replay the webhook and confirm it does not increase again.
6. Test a failed AI request and confirm the reserved credit is restored.

Paddle references: [signature verification](https://developer.paddle.com/webhooks/about/signature-verification/), [transaction completed](https://developer.paddle.com/webhooks/transactions/transaction-completed/), and [create transaction](https://developer.paddle.com/api-reference/transactions/create-transaction/).