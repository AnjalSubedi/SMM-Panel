CREATE TABLE IF NOT EXISTS "appAdmin" ("userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, "grantedAt" TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS "appWallet" ("userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE, "balancePaisa" BIGINT NOT NULL DEFAULT 0 CHECK("balancePaisa" >= 0 AND "balancePaisa" <= 1000000000000));

CREATE TABLE IF NOT EXISTS "appOrder" (id TEXT PRIMARY KEY, "userId" TEXT REFERENCES "user"(id), email TEXT NOT NULL, "itemId" TEXT NOT NULL, "itemKind" TEXT NOT NULL, "itemName" TEXT NOT NULL, quantity INTEGER NOT NULL, "amountPaisa" BIGINT NOT NULL CHECK("amountPaisa" > 0), links TEXT NOT NULL, method TEXT NOT NULL CHECK(method IN ('wallet','direct')), status TEXT NOT NULL, "requestScope" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, UNIQUE("requestScope","requestKey"));

CREATE TABLE IF NOT EXISTS "appPayment" (id TEXT PRIMARY KEY, "userId" TEXT REFERENCES "user"(id), "orderId" TEXT UNIQUE REFERENCES "appOrder"(id), kind TEXT NOT NULL CHECK(kind IN ('topup','order')), "amountPaisa" BIGINT NOT NULL CHECK("amountPaisa" > 0), reference TEXT NOT NULL UNIQUE, "requestKey" TEXT, status TEXT NOT NULL DEFAULT 'pending', note TEXT NOT NULL DEFAULT '', "reviewedBy" TEXT REFERENCES "user"(id), "createdAt" TEXT NOT NULL, "reviewedAt" TEXT, UNIQUE("userId","requestKey"));

CREATE TABLE IF NOT EXISTS "appLedger" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "user"(id), "amountPaisa" BIGINT NOT NULL CHECK("amountPaisa" != 0), kind TEXT NOT NULL, "sourceId" TEXT NOT NULL UNIQUE, "createdAt" TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS "appAudit" (id TEXT PRIMARY KEY, "actorId" TEXT NOT NULL REFERENCES "user"(id), action TEXT NOT NULL, "targetId" TEXT NOT NULL, note TEXT NOT NULL, "createdAt" TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS "appLimit" (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL);

CREATE INDEX IF NOT EXISTS "appOrderUserIndex" ON "appOrder"("userId","createdAt");

CREATE INDEX IF NOT EXISTS "appPaymentUserIndex" ON "appPayment"("userId","createdAt");

CREATE INDEX IF NOT EXISTS "appLedgerUserIndex" ON "appLedger"("userId","createdAt");

ALTER TABLE "appOrder" ADD COLUMN IF NOT EXISTS "deliveryWindowMinutes" INTEGER NOT NULL DEFAULT 0 CHECK ("deliveryWindowMinutes" >= 0 AND "deliveryWindowMinutes" <= 10080);
ALTER TABLE "appOrder" ADD COLUMN IF NOT EXISTS "deliveryPlan" TEXT;
