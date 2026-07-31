jest.mock('../../services/billing/billingApi', () => ({
  syncEntitlement: jest.fn(),
}));

import { syncEntitlement } from '../../services/billing/billingApi';
import {
  applyEntitlementToContext,
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
      });
    });
  });
});
