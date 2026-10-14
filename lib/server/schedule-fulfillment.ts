import "server-only";
import { after } from "next/server";
import { runFulfillment } from "./fulfillment";
import { automationEnabled, providerConfigured } from "./suvakrio";
export function scheduleFulfillment(scope: { userId?: string; orderId?: string } = {}) {
  if (automationEnabled() && providerConfigured()) after(() => runFulfillment(scope));
}
