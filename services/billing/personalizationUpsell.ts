import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';

// Structural type over the i18next translator so .js callers and tests stay
// dependency-free (mirrors the untyped-boundary casts used across screens).
type Translate = (key: string, options?: Record<string, unknown>) => string;

type OpenStore = () => void;

/**
 * Shared 403 upsell alert for free users hitting a Creator-gated action.
 *
 * Single Responsibility: present the localize-and-store-linked upsell dialog.
 * The store CTA (optional) routes to the paywall; Cancel dismisses. Callers
 * inject their own navigation callback, keeping this module UI-agnostic.
 */
export function showPersonalizationUpsellAlert(t: Translate, openStore?: OpenStore) {
  const buttons: AlertButton[] = [];
  if (openStore) {
    buttons.push({ text: t('settings.viewPlans'), onPress: openStore });
  }
  buttons.push({ text: t('common.close'), style: 'cancel' });
  Alert.alert(t('billing.paywall.personalizeTitle'), t('billing.paywall.personalizeMessage'), buttons);
}
