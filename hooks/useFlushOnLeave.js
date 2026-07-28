import { useEffect } from 'react';

import { flush } from '../utils/sessionScoreStore';

// `enabled` lets callers gate subscription (T1.11 mitigation (b-i)): when false,
// no beforeRemove listener is registered and no flush fires. Defaults to true
// so GuessFeedScreen's existing call site is unchanged.
export function useFlushOnLeave({ navigation, authContext, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      void flush({ authContext });
    });

    return () => unsubscribe();
  }, [navigation, authContext, enabled]);
}
