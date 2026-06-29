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
    isPremium: entitlement.is_premium,
    premiumTier: entitlement.premium_tier,
    premiumExpiresAt: entitlement.premium_expires_at,
  });
}

export async function restoreAndSync(authContext) {
  const Purchases = getPurchasesModule();
  const customerInfo = await Purchases.restorePurchases();
  const response = await syncEntitlement(authContext);
  const entitlement = response?.data ?? null;
  const hasEntitlement = !!entitlement?.is_premium || hasActiveEntitlement(customerInfo);
  return { hasEntitlement, entitlement, customerInfo };
}
