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

An ignored `.env.local` contains local credentials. Set `DATABASE_URL` to your PostgreSQL connection string before startup. Real credentials are never committed.

```powershell
npm.cmd install
npm.cmd run accounts:setup
npm.cmd run dev
```

Open `/register` to create an account, `/login` to sign in, and `/account` for the wallet and orders.

Email/password sign-up requires a six-digit email code before account access, in development and production. Configure the sender below for local signup. Existing verified accounts can still sign in when the email service is unavailable. Tests use mocked email delivery and disposable databases.

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
https://www.digitalmarketingnp.me/api/auth/callback/google
```

Authorized JavaScript origins, if requested:

```text
http://localhost:3000
https://www.digitalmarketingnp.me
```

Add these **server-only** values to `.env.local`:

```text
GOOGLE_CLIENT_ID=your-google-web-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
BETTER_AUTH_URL=http://localhost:3000
```

Use `BETTER_AUTH_URL=https://www.digitalmarketingnp.me` on the production server. Restart development or rebuild/restart production after changing environment variables. While the Google consent screen is in testing mode, add the intended users as test users.

Reference: [Better Auth Google provider](https://better-auth.com/docs/authentication/google).

## Verification and password recovery

Configure a Resend API key and a sender on a domain you have verified:

```text
RESEND_API_KEY=your-server-only-key
AUTH_EMAIL_FROM="Digital Marketing NP <accounts@digitalmarketingnp.me>"
```

Signup collects a name, email and password, then sends a six-digit verification code. Codes expire after 10 minutes, permit at most five incorrect attempts, and can be resent after 60 seconds. Resending replaces the previous code. Verification checks both the code and the signup password, then the browser signs in and returns to the requested page. Refreshing the page clears the in-memory password; sign in again to resume verification. No passwords or codes are stored in browser storage. Codes are stored as keyed hashes. Old unverified sessions cannot access account APIs and are revoked when verification completes.

Email signup stays unavailable in production until delivery is configured. Google sign-in and verified email/password sign-in continue working without a sender. Password recovery retains expiring links and revokes existing sessions after a successful reset.

### Resend and Vercel setup

1. Create an account at [Resend](https://resend.com), open **Domains**, and add **digitalmarketingnp.me**. A dedicated subdomain such as **mail.digitalmarketingnp.me** is also supported; the sender address must use the domain you actually verify.
2. In Namecheap, open **Domain List ? Manage ? Advanced DNS**. Add the DNS records Resend displays, using their exact types, host names and values. Keep the existing Vercel A/CNAME and Google Search Console TXT records. If Namecheap appends your domain automatically, enter only the host portion rather than repeating the domain.
3. Click **Verify** in Resend and wait for the domain to show **Verified**.
4. In Resend **API Keys**, create a **Sending access** key scoped to the verified domain. Save it privately.
5. In Vercel **digital-hub ? Environment Variables**, add **RESEND_API_KEY** as **Secret**, and **AUTH_EMAIL_FROM** as **Config** with the value **Digital Marketing NP <accounts@digitalmarketingnp.me>** (use your verified subdomain if different). Select **Production**. Add the same values to your ignored local **.env.local** for development. Never paste the key into chat or commit it.
6. Redeploy the project. Register with an email address you control, check inbox/spam, and enter the code. Verify your account is signed in only after the code succeeds.

Reference: [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction), [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction).

### Isolated verification checks

Run **npm run test:accounts** for mocked delivery, expiry, password binding, attempts, resend cooldown, replay/concurrency, unavailable delivery, and verification-gated account access. Run **npm run build** then **npm run test:email:production** for production browser signup/code/login with a test-only email transport. Neither check sends real email or contacts the provider.

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

For bundles, checkout asks for separate profile/page/channel and content links when the included services need different targets. Guest orders are not linked to a later account merely because the email matches.

### Delivery

Paid orders are submitted automatically using verified provider mappings. Add `SUVAKRIO_API_KEY` as a Secret in Vercel Production, keep the Suvakrio balance funded, and redeploy. Orders remain gated by verified payment and any customer timing choice. Durable database jobs prevent repeated submission; provider references and statuses appear in order history. Manual status changes are blocked for automatic orders, including while the emergency manual mode is enabled. Tests use a fake provider and never use the configured key.

## Storage and deployment

Requires Node.js 22.13+ and hosted PostgreSQL through the private `DATABASE_URL` environment variable. Remote connections require verified TLS. The application uses a small connection pool and asynchronous transactions with row locks, request locks and unique constraints. Money remains integer paisa.

Run `npm run db:migrate` before serving a new database. On Vercel, use Build Command `npm run db:migrate && npm run build` and separate databases for Production and Preview. Normal requests do not create tables or run migrations. Set a unique, stable `BETTER_AUTH_SECRET` of at least 32 characters in production; the local fallback secret is not a production fallback.

Existing SQLite data can be imported into an empty PostgreSQL database using `npm run db:import-sqlite -- .runtime/digitalmarketing.sqlite`. Stop the old app first. The importer opens the source read-only and checks counts and wallet/ledger reconciliation in a PostgreSQL transaction. Existing targets are never overwritten. Users must sign in again because active sessions and reset tokens are not copied. See [migration details](POSTGRESQL_MIGRATION.md).

The original 58-service definitions remain unmodified in `config/catalogData.js`. Available service and bundle prices are calculated from provider cost plus `SERVICE_MARKUP_PERCENT` (default 75), with integer-paisa rounding. Explicit equivalents in `config/serviceQuantityMappings.json` supply real provider IDs and quantities. The live catalog is cached for 60 seconds. Checkout verifies the displayed price before charging. Unmapped products and products requiring unsupported custom inputs are displayed as temporarily unavailable; they cannot accept payment.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run test:accounts
npm.cmd run build
```

The account tests use a temporary database and cover authorization, password hashing, pending deposits, one-time credits, server pricing, atomic debits, overspending prevention, payment replay, bundles, and paid-order state transitions.

For full HTTP/browser QA, run the isolated PostgreSQL and browser runner:

```powershell
npm.cmd run test:browser
```

This runner uses a temporary local PostgreSQL cluster, localhost:3002, hidden Chrome on port 9223, fake credentials and simulated payments. No hosted database or provider key is used.

Google's external OAuth callback and real email delivery require credentials and must be verified after those are configured. eSewa approvals are manual checks against real merchant receipts; the application does not treat a typed reference as automatic payment proof.

## Delivery timing during checkout

Eligible follower services offer delivery timing before payment, with Default preselected. An information button explains gradual delivery, unchanged pricing and provider processing time. Checkout offers valid windows from 1 hour to 7 days and saves the selection when a customer signs in or adds funds.

POST /api/orders accepts deliveryWindowMinutes (omitted or 0 means Default). The server validates the live service and computes the entire batch plan before creating a payment or debiting a wallet. Timing is part of the request's idempotency checks. Wallet orders immediately enter queued; direct eSewa orders enter queued after payment approval. Guests can choose supported gradual timing too. No second confirmation in My orders is required.

The plan uses whole, equal batches, each at least the verified service minimum, with the first and final dispatch separated by the requested window. For 100 followers on a service with minimum 10, one hour can be 5 batches of 20 every 15 minutes. A service with minimum 100 cannot split a 100-unit order. Bundles, unmatched services and non-follower services use default delivery. Explicitly unsupported provider drip-feed is excluded and rejected before charging.

Suvakrio receives the per-run quantity, runs and interval automatically. Its native drip-feed continues after the customer closes the browser. The selected timeframe starts with the first batch dispatch and is not a guaranteed completion deadline. The account page checks pending payments and active delivery every 15 seconds while visible.

POST /api/account/orders/delivery remains available to the order owner for older already-paid orders in awaiting_delivery. It computes and saves their choice without another debit. New orders do not enter that state. Existing submitted orders and saved delivery plans remain unchanged. Tests use disposable PostgreSQL databases and mocked provider calls.

## Signed-in navigation and notifications

Signed-in visits to the root URL redirect to /account. The public /services page keeps the calculator, bundles and saved-checkout return flow available to every user. The header avatar menu links to orders, wallet funding, payment history, notifications, profile settings and WhatsApp support. Admin access appears only for authorized accounts; the server continues to enforce it. Sign-out lives in the profile menu.

Notification updates are derived from each account's latest 50 orders and 50 wallet deposits. Payment review, delivery timing, processing and completion changes produce new unread updates. The appNotificationRead table stores read status per user across devices. The header bell opens an anchored notification popup with All/Unread filters, the latest 10 matching updates, individual and bulk read controls, and a link to the complete notification page. Opening the popup does not mark updates as read. Selecting an update marks it as read and opens its related order or payment. The popup closes with Escape or an outside click and fits mobile viewports. There are no provider calls, email sends or browser push notifications involved. Normal requests require migration 002 to have been applied with npm run db:migrate.

Profile settings can update the display name through Better Auth. Sign-in email remains read-only; password recovery is offered only when email delivery is configured.

## Automatic fulfillment recovery

Migration 006 adds durable jobs and a short-lived provider-catalog cache. Migration 007 adds a token-owned worker lease and a customer-visible message for pre-submission failures. The lease uses atomic SQL and works with Neon/PgBouncer transaction pooling; session advisory locks are not used for delivery. Expired leases recover after two minutes, and an old worker cannot release another worker's lease. Next.js after-response work submits paid orders immediately and refreshes statuses on account/admin visits. Jobs are recovered without another customer debit. A Vercel Hobby cron runs daily as a backup: set a random 32+ character `CRON_SECRET` in Production and redeploy. For reliable frequent recovery/status updates when there is no site traffic, configure an external scheduler or upgrade the cron frequency; the authenticated endpoint is `GET /api/cron/fulfillment` with `Authorization: Bearer <CRON_SECRET>`. Never expose this secret to browsers.

Low provider balance retries safely after five minutes when a worker runs. Definitive rejection or cancellation refunds the account wallet once; partial delivery refunds the undelivered proportion. Guest direct-payment refunds require support because there is no account wallet or eSewa refund API.

The provider has no documented add-order idempotency key. A timeout, invalid response, or interrupted submission therefore becomes `needs_attention`; it is never automatically submitted again. In the admin orders view, check Suvakrio and link the existing provider reference to resume status updates. These exceptional checks prevent duplicate provider charges. Do not create another provider order while acceptance is uncertain.

Queued legacy orders with safe mappings, correct links and sufficient paid value can be adopted automatically. Previously manually processed orders are excluded. Unsupported legacy orders require a support check; their paid amounts are never silently increased.

Provider connection failures are recorded in the private audit log using controlled diagnostic codes, without request bodies or secrets. If the normal provider lookup fails with ENOTFOUND before a request is sent, the server resolves the fixed provider hostname through Cloudflare or Google HTTPS DNS. Recovery has a separate 15-second deadline only after a DNS failure proves the provider was not contacted; a resolved address is reused for up to five minutes. The fallback accepts public IPv4 answers only and preserves the original hostname, SNI and certificate verification. Timeouts, TLS failures and uncertain submissions are never retried through this fallback. DNS lookups contain no API key.

## Combo package safety

See [COMBO_PACKAGE_AUDIT.md](COMBO_PACKAGE_AUDIT.md) for component mappings, exact API quantities, funding checks, partial refunds and reconciliation limits. New combo checkout is blocked unless the live provider balance covers the whole package; dispatch checks again before its first component starts.
