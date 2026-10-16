# Combo package fulfillment audit

Checked on 16 October 2026 using the current read-only provider catalog and isolated, mocked fulfillment tests. No paid provider orders were created for this audit. Rates and availability can change; checkout and dispatch validate them again.

| Package | Provider add calls after confirmed payment | Required links | Result |
| --- | --- | --- | --- |
| Facebook followers and watch time (A) | 1731: quantity 10,000; 1741: quantity 1 fixed pack representing 60,000 minutes | Facebook page and a separate public 3-hour video | Mapped; full provider cost at checked rates is NPR 1,677.53 |
| Facebook and Instagram starter (B) | 1731: quantity 5,000; 1914: quantity 2,500; 1756: quantity 1,000 | Facebook page, Instagram profile, Facebook post | Mapped; full provider cost at checked rates is NPR 2,386.20 |
| Reel views and likes (C) | 1688: quantity 50,000; 1695: quantity 2,000; 1740: quantity 25,000 | Instagram reel shared by its two components, separate Facebook video | Mapped; full provider cost at checked rates is NPR 539.59 |
| YouTube subscribers and watch time (D) | No add calls | Channel and video would be required | Blocked: subscriber component has no verified mapping. Never substitute an unrelated service or charge for an incomplete package. |

## Payment and dispatch safeguards

- Each checkout is one customer order with one wallet debit, or one direct-payment claim pending receipt verification. Its component jobs are saved atomically with the order.
- New combos are unavailable before payment when current provider funds cannot cover every component. Prices use the complete mapped provider cost plus the configured markup.
- Before the first add call, an untouched package is checked as a whole for current service limits, component prices and sufficient provider funds. An outage or insufficient balance queues it for retry. A definitively unavailable or unaffordable component rejects all untouched components and returns account funds once.
- Each later add call retains its own current-price and balance checks. Accepted provider references are saved independently. Completed components stay paid; rejected, cancelled or partially delivered components receive only their allocated refund. Refunded retail allocations cannot exceed the original payment.
- Unknown acceptance or a timeout pauses the order for reconciliation. Do not automatically resend it: Suvakrio does not give the application an idempotency key for add requests. An administrator can link the existing provider reference before resuming remaining work.
- Repeated customer requests, concurrent workers and status polling must not duplicate the customer debit or resend accepted components.

## Customer wording and remaining limits

The starter's third component is Facebook post likes, matching provider service 1756; it is not a selectable Love/Care/Wow reaction service. The Facebook watch-time package now states its 3-hour-video requirement in the package details and beside the checkout link input.

Multiple provider add calls are not an atomic transaction. A later component can fail after an earlier one has started, and external spending can change the provider balance between checks. The application cannot guarantee social-platform delivery, monetization eligibility, or the provider's own refund behavior. Partial deliveries remain visible with their component status and account refund. Guest payments without a linked account require manual refund support; there is no automatic cash-refund integration.

Provider documentation: https://suvakriosmm.com/api and https://suvakriosmm.com/services. The API documents separate add/status calls and quantity per run for drip-feed. The public service catalog describes per-1,000 rates; fixed watch-time mapping 1741 uses one provider unit, not 60,000 provider units.

Read-only catalog, balance and status checks can recover from a connection timeout through the existing public-DNS HTTPS path. Certificate validation and the original provider hostname are preserved. Paid add calls never retry after a connection timeout or uncertain acceptance. Connection failures make checkout unavailable rather than accepting a payment against an unverified provider connection.

Production verification: the Mumbai runtime (bom1) returned source=live from /api/services in approximately 3 seconds after the region change. Frankfurt connection checks had timed out. At the observed provider funding level, A-C remained unavailable as intended; D was unavailable because its subscriber mapping is unverified. Recheck availability after funding or provider catalog changes.
