import { useEffect } from 'react';

import { flush } from '../utils/sessionScoreStore';

export function useFlushOnLeave({ navigation, authContext }) {
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      void flush({ authContext });
    });

    return () => unsubscribe();
  }, [navigation, authContext]);
}
