// Saved checkout navigation does not require loading provider service data.
export const checkoutPaths = { services: "/services?resumeOrder=1#calculator", account: "/account?resumeOrder=1#new-order" } as const;

export function checkoutReturnPath(value: unknown): string {
  return value === checkoutPaths.account ? checkoutPaths.account : checkoutPaths.services;
}
