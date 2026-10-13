export type AccountNotification = {
  id: string; kind: "order" | "wallet"; title: string; description: string;
  href: string; createdAt: string; read: boolean;
};
export type NotificationData = { items: AccountNotification[]; unreadCount: number; isAdmin: boolean };
