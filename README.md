# Digital Marketing NP

Next.js App Router, TypeScript, Tailwind CSS 4, Better Auth, and PostgreSQL. A light storefront with a 58-service catalog, four bundles, customer accounts, wallet payments, direct eSewa orders, and an admin operations panel.

## Run locally

```powershell
npm.cmd install
# Set DATABASE_URL and auth settings in .env.local first.
npm.cmd run accounts:setup
npm.cmd run dev
```

Open the Local URL printed by Next.js, usually http://localhost:3000. Requires Node.js 22.13 or newer. On other shells, `npm` can be used instead of `npm.cmd`.

## Accounts and payments

See [the account setup guide](docs/ACCOUNTS_SETUP.md) for Google OAuth, email verification, owner access, funding and deployment.

- `/register`, `/login`, `/forgot-password`, `/reset-password`: account access.
- `/account`: wallet balance, eSewa deposits, orders and transaction history.
- `/admin`: payment verification, paid-order status, users and audit history.
- Configured owner: **digitalmarketingnp0@gmail.com**.
- Deposits and directly paid orders require admin verification against eSewa receipts.
- Wallet debits are atomic and prices are calculated on the server.
- Google login activates after OAuth credentials are supplied. Production email access and recovery require the configured email sender.
- Eligible follower orders choose default or gradual delivery during checkout, before payment. The selection is saved with the order; paid wallet orders queue immediately and direct eSewa orders queue after payment approval. No extra timing confirmation is needed afterward.
- Gradual delivery uses equal batches that satisfy provider minimums. Unsupported services and orders too small to split use default delivery. Guest checkout supports eligible gradual delivery too.
- Automatic fulfillment sends confirmed paid orders and their saved timing to Suvakrio. Native gradual delivery uses per-run quantities, runs and intervals; the window describes batch dispatch spacing, and provider processing can extend completion.

`config/catalogData.js` remains unchanged, including all 58 services, prices and combo packages. `config/serviceQuantityMappings.json` maps 41 standalone services to equivalents from Suvakrio’s public service list for quantity limits. The 17 services without a clear equivalent retain their configured limits and display a confirmation notice. Variable quantities start at 10 or the provider minimum, whichever is higher; existing retail caps and fixed packages are preserved.

Quantity mappings use `data/suvakrio-services.json`, verified against all nine public service-list pages on 13 October 2026. No API key is needed. They establish quantity limits only; delivery variants, guarantees, additional order fields and bundle fulfillment must be verified before connecting automatic Suvakrio ordering. Loading the catalog or checking out never calls the provider API.

## Main files

- `components/Brand.tsx`, `Header.tsx`, `Footer.tsx`: vector identity and responsive shell.
- `components/HeroSection.tsx`, `ComboPackagesGrid.tsx`, `WebDevUpsellBanner.tsx`: marketing sections.
- `components/InteractiveServiceDirectory.tsx`: platform -> category -> service dropdowns and quantity calculator.
- `components/CheckoutModal.tsx`: direct eSewa and wallet checkout, with saved selections across sign-in.
- `components/AuthForm.tsx`, `AccountDashboard.tsx`, `AdminDashboard.tsx`: account and operations UI.
- `lib/server/`: authentication, authorization, PostgreSQL storage, money transactions and API guards.
- `lib/order.ts`: frontend quantity calculations; checkout revalidates prices on the server.
- `lib/providerCatalog.ts`, `config/serviceQuantityMappings.json`: equivalent-service quantity limits shared by the UI, catalog endpoint and server checkout.
- `config/site.ts`: public contacts and the supplied eSewa QR at `public/esewa-qr.jpg`.

## Security

See [the security review](docs/SECURITY_REVIEW.md) for the fixes, verification scope and required Vercel auth-secret rotation. The new local secret stays in ignored .env.local and must be copied into the cloud environment separately.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run test:accounts
npm.cmd run build
npm.cmd run test:security:production
```

Browser and HTTP QA instructions are in [the setup guide](docs/ACCOUNTS_SETUP.md#verification). Private configuration and legacy database files are ignored. PostgreSQL stores accounts, orders and balances outside Vercel Functions. See [Vercel hosting](docs/VERCEL_HOSTING.md) and [PostgreSQL migration](docs/POSTGRESQL_MIGRATION.md).

## Navigation and performance

Internal routes use Next.js client navigation so the header, profile menu and notification state stay mounted. Account and auth routes stream loading placeholders; checkout code loads on demand and is warmed when a customer starts selecting a service. Wallet and account responses remain private and uncached. Forced refreshes after payments bypass in-flight background reads.

The committed Vercel function region is Singapore (sin1), matching the current Neon database region. Revisit regions in vercel.json if the database moves. The additive 003-performance migration indexes account notifications and admin history; the existing deployment build runs it automatically. Run timing measurements against a production build rather than next dev, which compiles routes on demand.

## PostgreSQL and existing data

Set the private `DATABASE_URL` from Neon, Supabase or another PostgreSQL provider. `npm run db:migrate` creates/updates authentication and commerce tables explicitly; application requests never run DDL. For Vercel, set the Build Command to `npm run db:migrate && npm run build` after configuring environment variables.

To preserve existing local data, stop the old app and run `npm run db:import-sqlite -- .runtime/digitalmarketing.sqlite` against an empty PostgreSQL target before signing up there. The importer preserves accounts, password hashes, wallet balances/ledger, orders, reviews, delivery settings and audit records. The source is read-only and sessions/reset tokens are not imported; users sign in again. It refuses nonempty targets and checks row counts and wallet reconciliation.

`npm run test:accounts` starts isolated real PostgreSQL and verifies transactions and concurrent retries without using hosted credentials. `npm run test:browser` additionally runs the local HTTP/browser flows with simulated payments and a hidden Chrome instance. No provider API requests are used.
