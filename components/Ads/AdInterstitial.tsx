import { useEffect, useRef } from 'react';
import { BackHandler, View } from 'react-native';

import LoadingOverlay from '../../components/UI/LoadingOverlay';
import type { AdSource } from '../../services/ads/AdSource';

interface AdInterstitialProps {
  adSource: AdSource;
  onDone: () => void;
}

/**
 * In-component ad overlay. Props identity MUST be stable for the component's
 * lifetime: `adSource` (memoized via useAdSource) and `onDone` (useCallback-
 * stable). The show-effect deps `[adSource, onDone]` rely on stable identity —
 * a mid-flight identity change would dead-end `onDone` (cleanup cancels the
 * in-flight show(); re-subscription early-returns via the shownRef guard).
 */
export default function AdInterstitial({ adSource, onDone }: AdInterstitialProps) {
  const shownRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;

    let cancelled = false;
    adSource.show().then(() => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      onDone();
    });

    return () => { cancelled = true; };
  }, [adSource, onDone]);

  const surface = adSource.renderSurface();

  return (
    <View style={{ flex: 1 }}>
      {surface !== null ? surface : <LoadingOverlay message="Loading Ads…" />}
    </View>
  );
}
