# Payment terms

The policy at /terms is shared with checkout and wallet funding through lib/terms.ts. Both English and Nepali versions express the same conditions. The footer links to the permanent page; checkout links open a new tab so order details remain available.

## Order flow

Review the service and total, enter the public link and (for guests) email, read the terms, explicitly accept, then continue. The eSewa QR and transaction-code field are only rendered after acceptance and pre-payment link validation. Wallet orders require a separate final confirmation before any debit. Editing a public link or switching the terms language resets acceptance. Resuming a saved checkout requires fresh acceptance; drafts never retain consent.

The browser validates the platform domain before revealing payment instructions. This cannot prove an account is public or that the content exists; the customer must check and confirm those details. The same URL validation is enforced by the order API.

## Wallet funding

Choose the amount, accept the separate wallet terms, then reveal eSewa instructions. Editing the amount resets acceptance and removes payment instructions. The receipt reference is cleared when the amount changes. Deposits remain pending until an administrator verifies the received amount and transaction code. The terms do not promise instant credit or an automatic cash withdrawal feature.

## Server evidence

Migration 005-terms creates appTermsAcceptance without changing existing orders or balances. A new submission must include termsAccepted=true, the current termsVersion and an allowed termsLanguage. Missing, false or outdated consent is rejected before a wallet debit or order/deposit insertion.

Each successful new order or top-up stores a purpose, version, language, exact accepted policy text and a server-generated timestamp. The evidence is linked by a unique foreign key and saved in the same PostgreSQL transaction. Retries preserve the original evidence and cannot create duplicate payments or consent records. Failed wallet debits roll back evidence too. Existing records are not assigned fabricated acceptance.

The Vercel build already runs npm run db:migrate before npm run build. Locally, use npm run db:migrate before testing real submissions against your configured database. Automated suites use disposable local PostgreSQL and disable provider credentials.

## Policy maintenance

Increment TERMS_VERSION whenever wording changes, and update the English and Nepali text together. Existing records preserve the accepted text even after a policy update. Do not restore blanket delivery deadlines or automatic-refill promises unless they match the actual service. Cancellation after provider dispatch may be unavailable; failed or undelivered services receive support review, with applicable consumer rights preserved. Automatic fulfillment credits account wallets once for definitively rejected, cancelled or partially undelivered orders. Guest refunds still require support. Follower drops and refill terms remain service-specific.

## Validation

The account suite checks consent enforcement, immutable evidence, retries, rollback, wallet/direct/guest flows and migrations with legacy records. Browser checks cover bilingual terms, pre-payment QR gating, link changes, wallet confirmation, guest orders, saved checkout and account/admin functionality.

Production browser validation: npm run test:accounts:production (after build) uses verified identities seeded only in disposable local PostgreSQL. It signs in through the real API when the isolated production UI has no configured email sender. Production email verification and registration restrictions remain enabled. No hosted accounts, provider credentials or email sends are used.
