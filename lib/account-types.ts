import type { CatalogItem } from "./catalog";
export type AccountUser = { id: string; name: string; email: string; emailVerified: boolean; isAdmin: boolean };
export type PublicLink = { platform: string; url: string; target?: string };
export type OrderRecord = {
  id: string; userId: string | null; email: string; itemId: string; itemKind: string; itemName: string; quantity: number;
  fulfillment?: { id: string; name: string; quantity: number; state: string; providerOrderId: string | null; providerStatus: string; remains: number | null; refundedPaisa: number; message: string }[];
  amountPaisa: number; links: string; deliveryWindowMinutes: number; deliveryPlan: string | null; method: "wallet" | "direct"; status: string; createdAt: string; updatedAt: string;
};
export type PaymentRecord = {
  id: string; userId: string | null; orderId: string | null; kind: "topup" | "order"; amountPaisa: number; reference: string;
  status: "pending" | "approved" | "rejected"; note: string; createdAt: string; reviewedAt: string | null;
};
export type LedgerRecord = { id: string; amountPaisa: number; kind: string; sourceId: string; createdAt: string };
export type AccountData = { user: AccountUser; balancePaisa: number; orders: OrderRecord[]; deliveryServices: CatalogItem[]; payments: PaymentRecord[]; ledger: LedgerRecord[] };
export type AdminData = {
  automaticDelivery?: boolean;
  providerConfigured?: boolean;
  users: { id: string; name: string; email: string; emailVerified: boolean; createdAt: string; balancePaisa: number }[];
  payments: (PaymentRecord & { email: string; itemName: string | null })[]; orders: OrderRecord[];
  audit: { id: string; action: string; targetId: string; note: string; createdAt: string; actorEmail: string }[];
  totals: { users: number; pendingPayments: number; queuedOrders: number; walletLiabilityPaisa: number };
};
