# PostgreSQL setup and SQLite import

The application runtime uses `pg` and PostgreSQL exclusively. SQLite is used only by the optional offline importer and its migration test. All 58 services, prices and combo packages remain unchanged.

## Configure and initialize

Put your provider connection string in ignored `.env.local`:

```env
DATABASE_URL=postgresql://YOUR_PRIVATE_CONNECTION_STRING
```

Keep your existing auth secret, Google credentials and admin email. Never prefix the database URL with NEXT_PUBLIC_ or commit it. Remote PostgreSQL connections use verified TLS; localhost development connections can run without TLS. Use a trusted hosted certificate rather than disabling verification.

```powershell
npm.cmd install
npm.cmd run db:migrate
```

The migration creates Better Auth tables and applies `migrations/001-commerce.sql` and `migrations/002-notifications.sql`. A PostgreSQL advisory lock serializes setup across processes. Setup is additive and repeatable. Schema migrations are explicit and are never run during normal customer requests.

## Preserve existing local accounts and orders

Stop the old application before importing, and keep the SQLite file and its WAL files private. Use an empty PostgreSQL target before creating new accounts there.

```powershell
npm.cmd run db:import-sqlite -- .runtime/digitalmarketing.sqlite
```

The importer opens the source read-only, initializes the target schema, imports users/account password hashes, explicit admin grants, wallets, orders, payment reviews, ledger entries and audit history in a transaction, and compares row counts and reconciles wallet balances with the ledger. Existing target data is never merged or overwritten. Failures roll back imported rows. Existing delivery fields are preserved; old orders without those fields receive default delivery values without status/amount changes.

Google-linked account records and password hashes are preserved. Active sessions, password-reset/email-verification tokens and transient rate limits are not imported. Users sign in again. The original SQLite file is left intact as a private rollback source; do not run two writable application versions against different databases after cutover.

## Vercel

1. Connect Neon or another PostgreSQL integration in Vercel Marketplace to SMM-Panel. Vercel injects its connection variables automatically; manual entry is unnecessary when `DATABASE_URL` is already present. This does not automatically update your local `.env.local`.
2. Ensure `DATABASE_URL` is set for the intended environment. Use distinct production and preview databases.
3. Add the existing auth/contact environment variables and the correct public BETTER_AUTH_URL.
4. Set Vercel Build Command to `npm run db:migrate && npm run build`.
5. Deploy and verify sign-in, admin access, wallet transactions and order history.

Import legacy data from your local computer before allowing production signups/payments. The build setup initializes tables but does not copy your local data automatically. Do not upload the SQLite file to Vercel or GitHub.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run test:accounts
npm.cmd run test:browser
npm.cmd run build
```

Unit/integration tests start an isolated real PostgreSQL cluster, generate private temporary credentials, and use separate databases per test file. They do not read your hosted database URL. Tests cover existing functionality plus concurrent approval/order retries, wallet overspending, mutually exclusive delivery choices, repeatable migrations and imported password sign-in. Browser tests use fake users and simulated payments on localhost:3002 with a hidden Chrome instance on port 9223. No Suvakrio API calls are made.
