import { syncEntitlement } from '../services/billing/billingApi';

export function getPurchasesModule() {
  try {
    return require('react-native-purchases').default;
  } catch (error) {
    return null;
  }
}

export function entitlementToContextPayload(entitlement) {
  return {
    isPaid: entitlement.is_paid,
    paidTier: entitlement.paid_tier,
    paidExpiresAt: entitlement.paid_expires_at,
    isGroupOwner: entitlement.is_group_owner,
    activeGroupId: entitlement.active_group_id,
  };
}

export function applyEntitlementToContext(authContext, entitlement) {
  if (!entitlement) {
    return;
  }
  authContext?.setEntitlement?.(entitlementToContextPayload(entitlement));
}

export async function refreshEntitlement(authContext) {
  let response;
  try {
    response = await syncEntitlement(authContext);
  } catch (_) {
    return { ok: false, refreshed: false };
  }
  const ok = response?.status === 200;
  const data = response?.data;
  if (ok && data) {
    applyEntitlementToContext(authContext, data);
  }
  return { ok, refreshed: ok && !!data };
}

export async function restoreAndSync(authContext) {
  const Purchases = getPurchasesModule();
  const customerInfo = await Purchases.restorePurchases();
  const response = await syncEntitlement(authContext);
  const entitlement = response?.data ?? null;
  const hasEntitlement = response?.status === 200 && !!entitlement?.is_paid;
  return { hasEntitlement, entitlement, customerInfo };
}
