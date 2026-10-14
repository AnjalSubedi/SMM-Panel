-- A stored lease survives commits and backend changes in transaction pooling.
CREATE TABLE IF NOT EXISTS "appFulfillmentWorker" (
  id INTEGER PRIMARY KEY CHECK(id=1),
  token TEXT NOT NULL,
  "leaseUntil" TIMESTAMPTZ NOT NULL
);
ALTER TABLE "appOrder" ADD COLUMN IF NOT EXISTS "deliveryMessage" TEXT NOT NULL DEFAULT '';
