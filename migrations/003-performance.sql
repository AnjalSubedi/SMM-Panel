-- Support the bounded account notification and operations lists as history grows.
CREATE INDEX IF NOT EXISTS "appOrderUserUpdatedIndex" ON "appOrder" ("userId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "appPaymentUserKindReviewedIndex" ON "appPayment" ("userId", kind, (COALESCE("reviewedAt", "createdAt")) DESC);
CREATE INDEX IF NOT EXISTS "appOrderCreatedIndex" ON "appOrder" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "appPaymentReviewIndex" ON "appPayment" ((status = 'pending') DESC, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "appAuditCreatedIndex" ON "appAudit" ("createdAt" DESC);
