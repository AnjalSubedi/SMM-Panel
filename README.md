# Digital Marketing NP

Next.js App Router, TypeScript, Tailwind CSS 4, Better Auth, and SQLite. A light storefront with a 58-service catalog, four bundles, customer accounts, wallet payments, direct eSewa orders, and an admin operations panel.

## Run locally

```powershell
npm.cmd install
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
- Eligible signed-in follower orders unlock delivery selection after payment approval (or a successful wallet debit). Customers choose default speed or a 1-hour to 7-day gradual window in My orders, then the order enters the delivery queue. Timing selection never charges again.
- Gradual delivery uses equal batches that satisfy provider minimums. Orders too small to split retain default delivery. Bundles, unmatched services and guest orders use default timing.
- Automatic provider fulfillment is not connected. Admins configure the saved batch quantity, runs and interval with the provider, record its reference, and confirm the schedule before marking a timed order processing. The window describes batch dispatch spacing; provider processing can extend completion.

`config/catalogData.js` remains unchanged, including all 58 services, prices and combo packages. `config/serviceQuantityMappings.json` maps 41 standalone services to equivalents from Suvakrio’s public service list for quantity limits. The 17 services without a clear equivalent retain their configured limits and display a confirmation notice. Variable quantities start at 10 or the provider minimum, whichever is higher; existing retail caps and fixed packages are preserved.

Quantity mappings use `data/suvakrio-services.json`, verified against all nine public service-list pages on 13 October 2026. No API key is needed. They establish quantity limits only; delivery variants, guarantees, additional order fields and bundle fulfillment must be verified before connecting automatic Suvakrio ordering. Loading the catalog or checking out never calls the provider API.

## Main files

- `components/Brand.tsx`, `Header.tsx`, `Footer.tsx`: vector identity and responsive shell.
- `components/HeroSection.tsx`, `ComboPackagesGrid.tsx`, `WebDevUpsellBanner.tsx`: marketing sections.
- `components/InteractiveServiceDirectory.tsx`: platform -> category -> service dropdowns and quantity calculator.
- `components/CheckoutModal.tsx`: direct eSewa and wallet checkout, with saved selections across sign-in.
- `components/AuthForm.tsx`, `AccountDashboard.tsx`, `AdminDashboard.tsx`: account and operations UI.
- `lib/server/`: authentication, authorization, SQLite storage, money transactions and API guards.
- `lib/order.ts`: frontend quantity calculations; checkout revalidates prices on the server.
- `lib/providerCatalog.ts`, `config/serviceQuantityMappings.json`: equivalent-service quantity limits shared by the UI, catalog endpoint and server checkout.
- `config/site.ts`: public contacts and the supplied eSewa QR at `public/esewa-qr.jpg`.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run test:accounts
npm.cmd run build
```

Browser and HTTP QA instructions are in [the setup guide](docs/ACCOUNTS_SETUP.md#verification). Private configuration and runtime database files are ignored. SQLite requires persistent storage; do not use an ephemeral serverless filesystem for account balances.
