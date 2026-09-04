export type BillingTier = {
  key: string;
  offeringId: string;
  productId: string;
  tier: number;
  testId: string;
  label: string;
  eyebrow: string;
  image: number;
  features: string[];
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
    label: 'Premium',
    eyebrow: 'BUNDLE',
    image: require('../../assets/categories/all-image-cat.webp'),
    features: ['Personalize your group (images, categories) + 30 members', 'Remove mandatory ads', 'All core game modes'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: true,
  },
  {
    key: 'private_group_creator',
    offeringId: 'private_group_creator_offering',
    productId: 'private_group_creator',
    tier: 2,
    testId: 'paywall.tier.private-group-creator',
    label: 'Private Group',
    eyebrow: 'PRIVATE',
    image: require('../../assets/home/WoIstWaldo-character-hide.webp'),
    features: ['Personalize your group home screen', 'Add new categories to guess', 'Max 30 members'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: false,
  },
  {
    key: 'no_ads',
    offeringId: 'no_ads_offering',
    productId: 'no_ads',
    tier: 1,
    testId: 'paywall.tier.no-ads',
    label: 'No Ads',
    eyebrow: 'AD-FREE',
    image: require('../../assets/home/WoIstWaldo-character-stats.webp'),
    features: ['Remove all ads', 'Uninterrupted play', 'Faster rounds'],
    priceSuffix: '/month',
    isSubscription: true,
    ctaText: 'Subscribe',
    featured: false,
  },
];
