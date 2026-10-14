CREATE TABLE IF NOT EXISTS "appFulfillment" (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "appOrder"(id),
  step INTEGER NOT NULL,
  payload JSONB NOT NULL,
  "retailPaisa" BIGINT NOT NULL CHECK("retailPaisa" > 0),
  state TEXT NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','submitting','submitted','completed','partial','cancelled','rejected','unknown')),
  "providerOrderId" TEXT UNIQUE,
  "providerStatus" TEXT NOT NULL DEFAULT '',
  remains INTEGER,
  "refundedPaisa" BIGINT NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leaseUntil" TIMESTAMPTZ,
  "lastCheckedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("orderId",step)
);
CREATE INDEX IF NOT EXISTS "appFulfillmentWorkIndex" ON "appFulfillment" (state,"nextAttemptAt");
CREATE TABLE IF NOT EXISTS "appProviderCatalog" (id INTEGER PRIMARY KEY CHECK(id=1), digest TEXT NOT NULL, services JSONB NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE "appAudit" ALTER COLUMN "actorId" DROP NOT NULL;
