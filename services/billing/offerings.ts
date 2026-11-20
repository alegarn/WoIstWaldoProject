export const CREATOR_TIER_KEY = 'private_group_creator';

export type BillingTier = {
  key: string;
  offeringId: string;
  productId: string;
  tier: number;
  testId: string;
  // i18n keys; resolved with t() in PaywallScreen. `features` maps to a
  // string[] resource resolved via returnObjects.
  label: string;
  eyebrow: string;
  image: number;
  features: string;
  priceSuffix: string;
  isSubscription: boolean;
  ctaText: string;
  featured: boolean;
};

export const BILLING_TIERS: BillingTier[] = [
  {
    key: 'premium',
    offeringId: 'premium',
    productId: 'premium',
    tier: 3,
    testId: 'paywall.tier.premium',
    label: 'billing.tiers.premium.label',
    eyebrow: 'billing.tiers.premium.eyebrow',
    image: require('../../assets/categories/all-image-cat.webp'),
    features: 'billing.tiers.premium.features',
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'billing.tiers.premium.cta',
    featured: true,
  },
  {
    key: CREATOR_TIER_KEY,
    offeringId: 'private_group_creator_offering',
    productId: 'private_group_creator',
    tier: 2,
    testId: 'paywall.tier.private-group-creator',
    label: 'billing.tiers.private_group_creator.label',
    eyebrow: 'billing.tiers.private_group_creator.eyebrow',
    image: require('../../assets/home/WoIstWaldo-character-hide.webp'),
    features: 'billing.tiers.private_group_creator.features',
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'billing.tiers.private_group_creator.cta',
    featured: false,
  },
  {
    key: 'no_ads',
    offeringId: 'no_ads_offering',
    productId: 'no_ads',
    tier: 1,
    testId: 'paywall.tier.no-ads',
    label: 'billing.tiers.no_ads.label',
    eyebrow: 'billing.tiers.no_ads.eyebrow',
    image: require('../../assets/home/WoIstWaldo-character-stats.webp'),
    features: 'billing.tiers.no_ads.features',
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'billing.tiers.no_ads.cta',
    featured: false,
  },
];
