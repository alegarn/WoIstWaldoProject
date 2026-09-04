import {
  CREATOR_MIN_TIER,
  FREE_MEMBER_CAP,
  CREATOR_MEMBER_CAP,
  canPersonalizeGroup,
  memberCapFor,
} from '../../services/billing/groupPersonalization';

describe('services/billing/groupPersonalization', () => {
  it('exports the tier contract constants', () => {
    expect(CREATOR_MIN_TIER).toBe(2);
    expect(FREE_MEMBER_CAP).toBe(10);
    expect(CREATOR_MEMBER_CAP).toBe(30);
  });

  describe('canPersonalizeGroup', () => {
    it.each([
      [0, false],
      [1, false],
      [2, true],
      [3, true],
    ])('tier %p → %p', (tier, expected) => {
      expect(canPersonalizeGroup(tier)).toBe(expected);
    });
  });

  describe('memberCapFor', () => {
    it.each([
      [0, FREE_MEMBER_CAP],
      [1, FREE_MEMBER_CAP],
      [2, CREATOR_MEMBER_CAP],
      [3, CREATOR_MEMBER_CAP],
    ])('tier %p → %p', (tier, expected) => {
      expect(memberCapFor(tier)).toBe(expected);
    });

    it('returns the free cap for tiers below creator', () => {
      expect(memberCapFor(0)).toBe(10);
      expect(memberCapFor(1)).toBe(10);
    });

    it('returns the creator cap for creator-and-above tiers', () => {
      expect(memberCapFor(2)).toBe(30);
      expect(memberCapFor(3)).toBe(30);
    });
  });
});
