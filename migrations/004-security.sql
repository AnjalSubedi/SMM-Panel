-- Google is used only to establish identity. Keep account bindings, not reusable Google credentials.
UPDATE "account" SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL
WHERE "providerId" = 'google' AND ("accessToken" IS NOT NULL OR "refreshToken" IS NOT NULL OR "idToken" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "appLimitBucketIndex" ON "appLimit" (bucket);
