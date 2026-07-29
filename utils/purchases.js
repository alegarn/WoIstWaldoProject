import { syncEntitlement } from '../services/billing/billingApi';

export function getPurchasesModule() {
  try {
    return require('react-native-purchases').default;
  } catch (error) {
    return null;
  }
}

export function hasActiveEntitlement(customerInfo) {
  const active = customerInfo?.entitlements?.active;
  return !!active && Object.keys(active).length > 0;
}

export function applyEntitlementToContext(authContext, entitlement) {
  if (!entitlement) {
    return;
  }
  authContext?.setEntitlement?.({
    isPaid: entitlement.is_paid,
    paidTier: entitlement.paid_tier,
    paidExpiresAt: entitlement.paid_expires_at,
  });
}

export async function restoreAndSync(authContext) {
  const Purchases = getPurchasesModule();
  const customerInfo = await Purchases.restorePurchases();
  const response = await syncEntitlement(authContext);
  const entitlement = response?.data ?? null;
  const hasEntitlement = response?.status === 200 && !!entitlement?.is_paid;
  return { hasEntitlement, entitlement, customerInfo };
}
