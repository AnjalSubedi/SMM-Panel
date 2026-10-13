# Security review — 13 October 2026

## Required production action

The BETTER_AUTH_SECRET value previously pasted into this conversation matched the local configuration. It has been replaced with a newly generated private value in the ignored .env.local file. **Copy that new value into Vercel's Production BETTER_AUTH_SECRET setting and redeploy.** Do not paste it into chat or commit it. The local change cannot update Vercel's environment automatically. Until the cloud value is replaced, the exposed key remains a production risk if Vercel still uses it. Users will need to sign in again; pending verification/reset links and OAuth flows should be restarted. Account identities, passwords, balances and orders are preserved.

For an exposed key, do not keep the compromised key as a compatibility fallback. Secret rotation and session revocation behavior were tested locally. See [Better Auth security](https://better-auth.com/docs/reference/security).

## Findings and changes

| Finding | Change | Status |
| --- | --- | --- |
| Shared auth secret exposed in conversation | Replaced local value; production replacement requires the Vercel setting above | Local fixed; cloud action required |
| Body limit applied after full buffering | Stream reads stop above 20,000 bytes; reject excessive declared lengths, compressed requests and stalled bodies; applied to commerce and auth POST routes | Fixed |
| All guests shared one order limit | Per-client buckets from Vercel's overwritten forwarding header; IPv6 /64 normalization, hashed keys, safe fallback when trustworthy IP is unavailable | Fixed in code for Vercel |
| Generic proxy header trusted by auth | Auth trusts only x-vercel-forwarded-for when VERCEL=1; no client-supplied forwarding headers are trusted on other runtimes | Fixed |
| Read endpoints had no application quota | Account/notification reads limited to 90 per minute per user; admin reads to 60; mutation quotas retained | Fixed |
| Limit counters and retained keys could grow indefinitely | Saturating atomic counters, Retry-After, indexed and bounded cleanup of old application rate-limit records | Fixed |
| Browser framing, MIME sniffing and referrer protections absent | Anti-framing, CSP, nosniff, no-referrer, restricted browser permissions, HSTS in production; removed framework disclosure header | Fixed |
| Profile restrictions only enforced by the UI | Server hooks validate names and public image URLs; verification/privilege fields remain controlled by auth | Fixed |
| Order URLs could use deceptive credentials or local addresses | Reject URL credentials, IP literals/private hostnames/custom ports and domains outside the selected social platform | Fixed |
| Unused Google API credentials retained in database | Google account hooks discard access/refresh/ID tokens; migration 004-security and legacy import remove them while preserving Google account IDs | Fixed after migration/deployment |
| Production auth could default to HTTP localhost | Require an explicit canonical origin and HTTPS for production public hosts; explicit loopback is allowed for isolated QA | Fixed |

Google is used only for authentication here. Its login flow still validates provider responses before saving the identity. Features that require ongoing Google API access must be designed separately rather than relying on retained tokens. Account linking explicitly requires a verified local identity and matching emails. The existing deployment command applies migration 004-security automatically. No business records are deleted by this migration.

Vercel documents that its [forwarding header is overwritten at the edge](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for). A future hosting migration must configure a trusted proxy deliberately; arbitrary headers must never be accepted as proof of the client IP. The conservative fallback still limits requests, but shares a bucket if trustworthy client IP information is unavailable.

## Controls checked

- Session validation, revoked-session rejection, HttpOnly/SameSite cookies, verified owner/admin access, account isolation and notification ownership.
- Server-side service prices, integer paisa rounding, approved-payment requirements, atomic wallet debits, repeat-safe requests, concurrent payment approvals/debits and payment-gated delivery scheduling.
- Parameterized PostgreSQL statements, verified remote database TLS, private no-store API responses, CSRF origin checks, OAuth callback URL validation, forged OAuth state rejection and local redirect validation.
- Catalog stays local; no automatic provider spending is connected. The 58-service catalog/prices were not changed.
- .env.local and runtime/test data stay ignored. No secrets were committed or printed.

## Validation and limits

The npm dependency audit reported **zero known advisories** for the installed dependency graph at review time; this is not a guarantee against undisclosed bugs. Run npm audit regularly.

All 26 backend tests passed, including a mocked new/returning Google callback and session flow. Reproduce the production browser check with npm run build followed by npm run test:security:production. Backend regressions use isolated PostgreSQL; HTTP/browser checks use simulated eSewa payments and disabled provider/email credentials. Production browser checks verify the enforced policy without touching customer data. External Google login/payment completion is not tested with real customer credentials, and this review does not cover the configuration of Google, Namecheap, Neon or your Vercel account itself.

The CSP preserves the statically generated services page and allows Next.js inline hydration scripts/styles. It blocks framing, plugins, remote scripts and production eval; it is **not a strict nonce CSP**. A nonce policy would require dynamic rendering and further navigation testing; see [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy). React escaping and server validation remain necessary. Application quotas supplement Vercel's edge protection; they are not a replacement for a network DDoS defense.

Keep the owner Google account protected with two-step verification and use separate preview databases/credentials. Do not test fabricated deposits or approvals against production balances.
