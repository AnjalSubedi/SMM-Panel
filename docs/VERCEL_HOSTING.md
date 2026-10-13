# Hosting Digital Marketing NP on Vercel

Checked against the project and official documentation on 13 October 2026.

## Current readiness

The Next.js frontend builds successfully. The full application is not yet ready to deploy on Vercel: authentication, orders, wallet balances and payment review currently use a local SQLite file through node:sqlite. Vercel Functions do not provide the shared persistent local disk this design requires. Setting DATABASE_PATH to /tmp does not solve persistence or consistency.

Required application work before deployment: migrate authentication and the commerce database layer to hosted PostgreSQL, preserving wallet transactions, payment idempotency, order history, admin authorization and delivery choices. Adding DATABASE_URL alone will not change the existing SQLite implementation. Do not enable production payments until this migration and its checks are complete.

Recommended setup: Vercel for Next.js, Neon PostgreSQL for persistent data, Google OAuth for sign-in, and the existing optional email sender for email verification/recovery. Provider fulfillment remains manual and does not need a Suvakrio API key in Vercel yet.

## 1. Create your Vercel account

1. Open https://vercel.com/signup.
2. Choose Continue with GitHub and use your existing GitHub account.
3. Complete the account/team setup. For this commercial agency site, review Vercel Pro; the free Hobby plan is restricted to personal, non-commercial use.
4. Do not purchase a domain again if you already own digitalmarketingnp.me.

## 2. Create the database

Create a Neon PostgreSQL project through https://neon.com or Vercel Marketplace. Choose compatible locations for the database and Vercel Functions to reduce latency. Follow the provider's connection instructions and save the connection string privately as DATABASE_URL. Keep the provider's TLS settings.

The application must then be migrated to PostgreSQL and initialized before deploying the complete site. Use a separate test database for tests/previews. Existing local accounts and balances do not move to Neon automatically; decide which existing records should be imported and verify their balances after import.

Never post the database URL, OAuth secret, or auth secret in chat or commit them to GitHub.

## 3. Upload the project to a private GitHub repository

Repository: https://github.com/AnjalSubedi/SMM-Panel

The local project has been initialized with Git. To publish future changes in VS Code:

1. Open Source Control and review the changed files.
2. Review the files shown before committing. The existing .gitignore excludes .env.local, .runtime, .qa, node_modules and build files.
3. Commit the application source.
4. Choose Sync Changes / Push to publish your commit to the connected repository. If creating a new repository, choose private visibility.

Do not manually upload the whole folder through GitHub's browser file uploader. Never upload .env.local, the SQLite database, runtime files or test database files. Commit public/esewa-qr.jpg because the website displays that image publicly.

## 4. Import into Vercel after the database migration is ready

1. In Vercel, choose Add New > Project.
2. Connect GitHub and grant access to the specific private repository.
3. Import digital-marketing-np.
4. Use Framework Preset: Next.js, Root Directory: project root, Build Command: npm run build, and the default Next.js output settings.
5. Choose a supported Node.js version compatible with the completed application; Node 22.x matches the current project runtime baseline.
6. Add the production environment variables before the first complete deployment.

## 5. Production environment variables

These settings describe the intended PostgreSQL deployment after migration. The current SQLite code does not yet read DATABASE_URL.

| Variable | Production value/purpose |
| --- | --- |
| DATABASE_URL | Private hosted PostgreSQL connection string |
| BETTER_AUTH_SECRET | A strong private secret of at least 32 characters, stable across deployments |
| BETTER_AUTH_URL | The exact canonical public origin, initially your actual project.vercel.app origin, later https://digitalmarketingnp.me |
| ADMIN_EMAIL | digitalmarketingnp0@gmail.com |
| GOOGLE_CLIENT_ID | Google web OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google web OAuth client secret |
| RESEND_API_KEY | Optional verified email provider key; needed for production email account verification/recovery |
| AUTH_EMAIL_FROM | Verified sender for production email verification/recovery |
| NEXT_PUBLIC_WHATSAPP_NUMBER | 9779744505435 |
| NEXT_PUBLIC_ESEWA_QR_URL | /esewa-qr.jpg |
| NEXT_PUBLIC_ESEWA_ID | Your merchant ID, if you want to display it |

Keep DATABASE_PATH, NEXT_DIST_DIR and QA overrides out of Vercel. Do not upload .env.local as a public file. Only deliberately public values should have NEXT_PUBLIC_ prefixes.

Production password registration currently requires configured email delivery; Google sign-in can be used separately. Services and prices remain in config/catalogData.js. SERVICE_MARKUP_PERCENT does not automatically reprice this curated catalog.

Use separate preview credentials and a separate preview database. Do not connect development or preview tests to real wallet balances or production payment data.

## 6. Configure Google sign-in for the public URL

After Vercel gives you the actual stable project URL, add these entries to your Google OAuth web client, replacing your-project with the actual hostname:

Authorized JavaScript origin:
https://your-project.vercel.app

Authorized redirect URI:
https://your-project.vercel.app/api/auth/callback/google

When using your custom domain, also add:
https://digitalmarketingnp.me
https://digitalmarketingnp.me/api/auth/callback/google

BETTER_AUTH_URL must match the origin users actually sign into. Keep the existing localhost entries for local development. While Google OAuth is in Testing mode, only approved test users can use the testing application; complete Google's production audience/publishing setup for customer access.

Redeploy after changing Vercel environment variables. Register/sign in with the configured owner Google account to obtain verified admin access; no default admin password is created.

## 7. Connect your domain

In the Vercel project's Settings > Domains, add digitalmarketingnp.me and, if desired, www.digitalmarketingnp.me. Use the exact DNS values Vercel shows for your project at the domain registrar. Choose one canonical hostname and redirect the other.

Preserve existing email MX and verification TXT records when updating DNS. Once HTTPS and the domain work, set BETTER_AUTH_URL to the canonical origin and redeploy. Update the Google OAuth origin and callback as described above.

## 8. Verify before accepting real payments

Use a separate staging database for simulated payment approval, wallet funding/debits and delivery choices. Check Google login, owner/admin authorization, payment review, wallet transactions, direct orders and saved delivery schedules. Confirm data survives a deployment and is shared across function instances.

No Suvakrio API calls are necessary for hosting preparation or these checks. Do not make paid provider test calls without the user's explicit approval.

## Official references

- SQLite and Vercel: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel
- Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs
- Git deployment: https://vercel.com/docs/git
- Hosted database integrations: https://vercel.com/docs/storage
- Environment variables: https://vercel.com/docs/environment-variables
- Supported Node versions: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions
- Hobby plan restrictions: https://vercel.com/docs/plans/hobby
- Custom domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain