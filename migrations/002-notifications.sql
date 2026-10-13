CREATE TABLE IF NOT EXISTS "appNotificationRead" (
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "notificationId" TEXT NOT NULL,
  "readAt" TEXT NOT NULL,
  PRIMARY KEY ("userId", "notificationId")
);
