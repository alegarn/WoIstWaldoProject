jest.mock('../../services/billing/billingApi', () => ({
  syncEntitlement: jest.fn(),
}));

import { syncEntitlement } from '../../services/billing/billingApi';
import {
  applyEntitlementToContext,
  entitlementToContextPayload,
  refreshEntitlement,
} from '../../utils/purchases';

describe('utils/purchases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshEntitlement', () => {
    it('writes all 5 entitlement fields from a 200 backend response and reports a successful refresh', async () => {
      syncEntitlement.mockResolvedValue({
        status: 200,
        data: {
          is_paid: true,
          paid_tier: 3,
          paid_expires_at: null,
          is_group_owner: true,
          active_group_id: 'g1',
        },
      });
      const authContext = { setEntitlement: jest.fn() };

      const result = await refreshEntitlement(authContext);

      expect(syncEntitlement).toHaveBeenCalledTimes(1);
      expect(syncEntitlement).toHaveBeenCalledWith(authContext);
      expect(authContext.setEntitlement).toHaveBeenCalledTimes(1);
      expect(authContext.setEntitlement).toHaveBeenCalledWith({
        isPaid: true,
        paidTier: 3,
        paidExpiresAt: null,
        isGroupOwner: true,
        activeGroupId: 'g1',
        earnedAdFree: false,
        earnedPremium: false,
      });
      expect(result).toEqual({ ok: true, refreshed: true });
    });

    it('does not write entitlement, returns ok:false refreshed:false, and does not throw when the backend responds 502', async () => {
      syncEntitlement.mockResolvedValue({ status: 502 });
      const authContext = { setEntitlement: jest.fn() };

      const result = await refreshEntitlement(authContext);

      expect(authContext.setEntitlement).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: false, refreshed: false });
    });
  });

  describe('entitlementToContextPayload', () => {
    it('maps earned_ad_free and earned_premium to earnedAdFree and earnedPremium when both are true', () => {
      const payload = entitlementToContextPayload({
        is_paid: true,
        paid_tier: 3,
        paid_expires_at: null,
        is_group_owner: true,
        active_group_id: 'g1',
        earned_ad_free: true,
        earned_premium: true,
      });

      expect(payload.earnedAdFree).toBe(true);
      expect(payload.earnedPremium).toBe(true);
    });

    it('maps earned_ad_free and earned_premium to false when both are false', () => {
      const payload = entitlementToContextPayload({
        is_paid: false,
        paid_tier: 0,
        paid_expires_at: null,
        is_group_owner: false,
        active_group_id: null,
        earned_ad_free: false,
        earned_premium: false,
      });

      expect(payload.earnedAdFree).toBe(false);
      expect(payload.earnedPremium).toBe(false);
    });

    it('maps absent earned_ad_free and earned_premium (older server / stale cache) to false without crashing', () => {
      const payload = entitlementToContextPayload({
        is_paid: true,
        paid_tier: 2,
        paid_expires_at: null,
        is_group_owner: true,
        active_group_id: 'g1',
      });

      expect(payload.earnedAdFree).toBe(false);
      expect(payload.earnedPremium).toBe(false);
    });
  });

  describe('applyEntitlementToContext', () => {
    it('writes all 5 fields from a full backend payload', () => {
      const authContext = { setEntitlement: jest.fn() };
      const entitlement = {
        is_paid: true,
        paid_tier: 2,
        paid_expires_at: '2099-01-01T00:00:00Z',
        is_group_owner: true,
        active_group_id: 'g-42',
      };

      applyEntitlementToContext(authContext, entitlement);

      expect(authContext.setEntitlement).toHaveBeenCalledTimes(1);
      expect(authContext.setEntitlement).toHaveBeenCalledWith({
        isPaid: true,
        paidTier: 2,
        paidExpiresAt: '2099-01-01T00:00:00Z',
        isGroupOwner: true,
        activeGroupId: 'g-42',
        earnedAdFree: false,
        earnedPremium: false,
      });
    });
  });
});
