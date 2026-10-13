# Accounts, Google login, wallet and admin setup

## What works now

- Email/password registration, login, logout and server-validated sessions.
- Google OAuth integration, enabled when its client credentials are configured.
- Password reset and email verification, enabled when email delivery is configured.
- A private account dashboard with wallet balance, orders, deposits and transaction history.
- eSewa QR deposit claims with administrator verification before wallet credit.
- Wallet checkout with an atomic debit and server-side pricing.
- Direct eSewa checkout for account holders or guests without using wallet funds.
- An administrator panel for payment reviews, delivery status, users and an append-only audit log.
- Checkout selections survive a trip to login/register in the same browser tab.

The configured owner is **digitalmarketingnp0@gmail.com**. Registering that email alone does not grant administrator access.

## Local startup

An ignored `.env.local` with a random authentication secret and a local database has been created. Real credentials are never committed.

```powershell
npm.cmd install
npm.cmd run accounts:setup
npm.cmd run dev
```

Open `/register` to create an account, `/login` to sign in, and `/account` for the wallet and orders.

Email/password accounts can be used without verification during local development while an email provider is absent. This development exception does **not** give an unverified account automatic administrator access.

## Owner access

Recommended: configure Google OAuth below, then sign in with the verified Google account **digitalmarketingnp0@gmail.com**. That verified identity receives owner access at `/admin`.

For a local email/password owner account:

1. Register your own owner account using **digitalmarketingnp0@gmail.com** and a password you choose.
2. From the trusted server terminal, explicitly grant access after confirming that this is your own account:

```powershell
npm.cmd run admin:grant -- digitalmarketingnp0@gmail.com --confirm-email-ownership
```

This command only permits the designated `ADMIN_EMAIL`. It never creates a default password. It does not claim that an email verification message was sent. Production password sign-in still requires email verification.

## Google sign-in

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create OAuth credentials for a **Web application** and configure the consent screen.

Authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://digitalmarketingnp.me/api/auth/callback/google
```

Authorized JavaScript origins, if requested:

```text
http://localhost:3000
https://digitalmarketingnp.me
```

Add these **server-only** values to `.env.local`:

```text
GOOGLE_CLIENT_ID=your-google-web-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BETTER_AUTH_URL=http://localhost:3000
```

Use `BETTER_AUTH_URL=https://digitalmarketingnp.me` on the production server. Restart development or rebuild/restart production after changing environment variables. While the Google consent screen is in testing mode, add the intended users as test users.

Reference: [Better Auth Google provider](https://better-auth.com/docs/authentication/google).

## Verification and password recovery

Configure a Resend API key and a sender on a domain you have verified:

```text
RESEND_API_KEY=your-server-only-key
AUTH_EMAIL_FROM="Digital Marketing NP <accounts@digitalmarketingnp.me>"
```

In production, email registration is disabled until email delivery is configured; password sign-in requires a verified email. Google sign-in can still be used without the email provider. Recovery emails use expiring links, and a successful password reset revokes existing sessions.

Never paste OAuth secrets, authentication secrets, email API keys or provider keys into frontend code or `NEXT_PUBLIC_` variables.

## Funding and checkout

### Add funds

1. Sign in, open `/account#add-funds`, and pay with the supplied eSewa QR.
2. Enter the exact amount paid and its transaction reference.
3. The claim appears as **Under review**. The spendable balance stays unchanged.
4. The admin verifies the payer, reference and exact amount in the actual merchant eSewa account, records a note and approves.
5. Approval credits the wallet once and writes a ledger and audit entry.

Deposits accept NPR 100-100,000 with at most two decimal places. A submitted reference is reserved across deposits and direct orders to prevent reuse. Rejected or incorrect references should be resolved with support; they are not automatically released for reuse.

### Wallet order

The server reloads the configured service, validates its quantity and platform links, calculates the amount in integer paisa, and creates the order and wallet debit in one database transaction. Insufficient funds roll back both. An identical request-key retry returns the existing order without another charge.

### Direct order

Choose direct eSewa in checkout, enter the reference and the required public links, and submit. Account holders get the order in their history; guests supply an email and receive an order ID on screen. No wallet balance is debited. The order remains under payment review until approval.

For multi-platform bundles, checkout asks for one public link per included platform. Guest orders are not linked to a later account merely because the email matches.

### Delivery

Paid orders enter the queue. The admin can record a provider reference, mark processing, and then mark completed. **Automatic Suvakrio dispatch is not connected**: the existing catalog's provider IDs must be verified before integrating live fulfillment. No request to a paid provider is sent by these tests or flows.

## Storage and deployment

Requires Node.js 22.13+ and a long-running Node server with persistent disk. The default SQLite database is `.runtime/digitalmarketing.sqlite`; set `DATABASE_PATH` to a mounted persistent location on your server. Keep the database, WAL and related files private and maintain database-consistent backups.

Do not deploy this SQLite configuration to an ephemeral serverless filesystem or separate instances with separate databases. Use a shared transactional database such as PostgreSQL before moving to that deployment model.

Set a unique `BETTER_AUTH_SECRET` of at least 32 characters in production. The development fallback secret is stored privately under `.runtime/`; it is not a production fallback. `.runtime/`, `.env*` and `.qa/` are excluded from deployment tracing.

The catalog and its prices remain in the original, unmodified `config/catalogData.js`. Quantity limits are derived in `lib/services.ts` using explicit equivalents in `config/serviceQuantityMappings.json` and the local public-page snapshot. Unmatched services retain configured limits. The storefront, catalog endpoint and checkout share these limits. Mappings do not enable automatic provider fulfillment or use the API key.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run test:accounts
npm.cmd run build
```

The account tests use a temporary database and cover authorization, password hashing, pending deposits, one-time credits, server pricing, atomic debits, overspending prevention, payment replay, bundles, and paid-order state transitions.

For full HTTP/browser QA, start an **isolated** development server:

```powershell
$env:DATABASE_PATH='.qa/accounts-e2e.sqlite'
$env:NEXT_DIST_DIR='.qa/next-accounts-e2e'
$env:BETTER_AUTH_URL='http://localhost:3002'
$env:ADMIN_EMAIL='qa-owner@example.test'
$env:RESEND_API_KEY=''
$env:AUTH_EMAIL_FROM=''
$env:GOOGLE_CLIENT_ID=''
$env:GOOGLE_CLIENT_SECRET=''
$env:SUVAKRIO_API_KEY=''
npm.cmd run dev -- --port 3002
```

From a second terminal:

```powershell
node scripts/verify-accounts-http.cjs
```

`scripts/verify-accounts-browser.cjs` additionally needs an isolated Chrome instance with `--remote-debugging-port=9223` and a unique profile in the system temporary folder. It is restricted to localhost:3002 and the disposable QA database. It simulates verified payments there only, never in the actual account database.

Google's external OAuth callback and real email delivery require credentials and must be verified after those are configured. eSewa approvals are manual checks against real merchant receipts; the application does not treat a typed reference as automatic payment proof.

## Delivery timing after payment approval

For eligible signed-in follower services, approving direct eSewa payment changes the order to `awaiting_delivery`. A successful wallet debit does the same immediately because those funds were already approved. The customer selects Default or a gradual 1-hour to 7-day window in My orders. The account page checks pending payments every 15 seconds while visible.

`POST /api/account/orders/delivery` requires the order owner's session and a same-origin JSON request. It only accepts `orderId` and `deliveryWindowMinutes` (0 for Default). The server computes and stores the plan, moves the already-paid order to queued, and records an audit entry without another debit. Repeated identical requests are idempotent. Different changes after confirmation require support.

The plan uses whole, equal batches, each at least the verified service minimum, with the first and final dispatch separated by the requested window. For 100 followers on a service with minimum 10, one hour can be 5 batches of 20 every 15 minutes. A service with minimum 100 cannot drip-feed a 100-unit order. Fixed packages, unmatched services, non-follower services and guest orders retain default delivery.

Provider dispatch remains manual. Admin orders display Suvakrio's per-run quantity, runs, interval and service reference. Quantity must be per run: entering the full order quantity alongside runs would multiply delivery and provider charges. Admins must confirm the configured schedule before changing a timed order's delivery status. Verify the exact provider variant and drip-feed support before dispatch. The selected timeframe starts with the first batch dispatch; it is not a guaranteed completion deadline.

The database adds delivery columns idempotently and preserves existing orders, statuses and amounts. Tests use disposable databases and never call the provider API.
