-- Nullable associations keep existing orders unchanged; only new submissions record explicit consent.
CREATE TABLE IF NOT EXISTS "appTermsAcceptance" (
  id TEXT PRIMARY KEY,
  "orderId" TEXT UNIQUE REFERENCES "appOrder"(id),
  "paymentId" TEXT UNIQUE REFERENCES "appPayment"(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('order', 'wallet')),
  version TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('en', 'ne')),
  content TEXT NOT NULL,
  "acceptedAt" TEXT NOT NULL,
  CHECK ((purpose = 'order' AND "orderId" IS NOT NULL AND "paymentId" IS NULL)
    OR (purpose = 'wallet' AND "paymentId" IS NOT NULL AND "orderId" IS NULL))
);
