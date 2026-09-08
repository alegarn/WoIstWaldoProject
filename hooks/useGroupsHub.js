import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchGroups } from '../services/groups/groupApi';
import { readGroupHubCache, writeGroupHubCache } from '../services/groups/groupHubCache';
import { getSnapshot, publish, subscribe } from '../services/groups/groupHubStore';
import { AuthContext } from '../store/auth-context';

const MAX_TRANSPORT_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 1500];
const EMPTY_CONFIRMATION_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hasHubRows(hub) {
  return Boolean(hub?.owned?.length || hub?.joined?.length);
}

// Strict identityKey compare: returns the store payload only when it belongs
// to this identity, preserving the data=null semantics for wrong-identity
// data.
function snapshotDataFor(snapshot, identityKey) {
  return snapshot && snapshot.identityKey === identityKey && snapshot.data
    ? snapshot.data
    : null;
}

// Never logs token/userId values — only whether an identityKey was present.
function warnFetchFailed(errorOrResponse, attempts, hasIdentity) {
  console.warn('[useGroupsHub] groups fetch failed', {
    status: errorOrResponse?.status ?? null,
    message: (
      errorOrResponse?.data?.message
      ?? errorOrResponse?.message
      ?? String(errorOrResponse ?? 'unknown')
    ).slice(0, 200),
    attempts,
    identityKey: hasIdentity ? 'present' : 'empty',
  });
}

export function useGroupsHub({ enabled = true } = {}) {
  const { token, userId } = useContext(AuthContext);
  const identityKey = `${token ?? ''}|${userId ?? ''}`;
  const [data, setData] = useState(() => snapshotDataFor(getSnapshot(), identityKey));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFresh, setIsFresh] = useState(false);

  const mounted = useRef(false);
  const identityRef = useRef(null);
  const seqRef = useRef(0);
  const inFlightRef = useRef(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (identityRef.current === null) {
      identityRef.current = identityKey;
      return;
    }

    if (identityRef.current !== identityKey) {
      identityRef.current = identityKey;
      seqRef.current += 1;
      if (mounted.current) {
        const nextData = snapshotDataFor(getSnapshot(), identityKey);
        dataRef.current = nextData;
        setData(nextData);
        setError(null);
        setIsFresh(false);
        setIsLoading(true);
      }
    }
  }, [identityKey]);

  // Manual effect subscription instead of useSyncExternalStore: a publish
  // landing in the render-to-effect window can be missed, which is acceptable
  // because every instance also runs its own flight — whose transport-failure
  // path falls back to the store snapshot — and the AsyncStorage cache covers
  // cold start.
  useEffect(() => {
    const unsubscribe = subscribe((snapshot) => {
      if (!mounted.current || !snapshot?.data) return;
      if (snapshot.identityKey !== identityKey || identityRef.current !== identityKey) return;

      // Publish vs in-flight precedence rule: a publish for the current
      // identity ALWAYS applies. It cannot clobber this instance's flight
      // outcome, because any in-flight flight still applies its own 200
      // afterwards under the latest-seq guard (seq === seqRef.current), and a
      // transport-failed flight hydrates from this same snapshot before
      // surfacing an error. A publish can only pre-empt a flight, never
      // overwrite it.
      dataRef.current = snapshot.data;
      setData(snapshot.data);
      setIsFresh(true);
      setError(null);
      setIsLoading(false);
    });
    return unsubscribe;
  }, [identityKey]);

  const refresh = useCallback(async () => {
    // Without credentials/disabled the hub has "no data yet", not "loaded
    // empty": stay in the pending loading state so consumers keep showing
    // their loading UI instead of a degraded body.
    if (!enabled || !token || !userId) {
      if (mounted.current) {
        setError(null);
        setIsLoading(true);
      }
      return;
    }

    const flightIdentity = identityKey;
    const inFlight = inFlightRef.current;
    if (inFlight && inFlight.identityKey === flightIdentity) {
      return inFlight.promise;
    }

    const seq = ++seqRef.current;

    const runFlight = async ({ seq: flightSeq, isConfirmation = false }) => {
      const seq = flightSeq;
      if (mounted.current) {
        setIsLoading(true);
        setError(null);
      }

      let cached = null;
      try {
        cached = await readGroupHubCache(userId);
        if (mounted.current && cached && seq === seqRef.current) {
          setData((prev) => prev ?? cached);
        }
      } catch {
        // best-effort: unreadable cache behaves like no cache
      }

      let response = null;
      let transportFailure = null;
      let attempts = 0;

      // Transport failures (rejection or no HTTP status) retry with backoff;
      // any real HTTP response (including 4xx/5xx) settles the loop without
      // retry. All attempts stay inside one flight: the latest-seq guard
      // below still rules.
      for (let attempt = 1; attempt <= MAX_TRANSPORT_ATTEMPTS; attempt++) {
        attempts = attempt;
        try {
          const result = await fetchGroups({ token, userId });
          if (result != null && result.status != null) {
            response = result;
            transportFailure = null;
            break;
          }
          transportFailure = result ?? new Error('groups fetch returned no response');
        } catch (requestError) {
          transportFailure = requestError;
        }

        if (attempt < MAX_TRANSPORT_ATTEMPTS) {
          await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 0);
          if (!mounted.current || seq !== seqRef.current) return;
        }
      }

      if (!mounted.current || seq !== seqRef.current) return;

      if (response) {
        // fetchGroups flags any 200 whose body is not a valid groups payload
        // (proxy error bodies, HTML garbage) with `payloadInvalid`. Route it
        // through the error branch below — an error body is never "zero
        // groups" and must not reach the empty-200 guard or be published.
        if (!response.payloadInvalid && response.status === 200) {
          const isEmpty = response.data?.owned?.length === 0 && response.data?.joined?.length === 0;

          if (isEmpty) {
            const hadPriorRows = hasHubRows(dataRef.current)
              || hasHubRows(snapshotDataFor(getSnapshot(), flightIdentity))
              || hasHubRows(cached);

            console.warn('[useGroupsHub] 200 with empty groups payload', {
              hadCachedData: hadPriorRows,
              ...(response.rawBodyType != null ? { rawType: response.rawBodyType } : {}),
              ...(response.rawBodySample != null ? { bodySample: response.rawBodySample } : {}),
            });

            if (hadPriorRows && !isConfirmation) {
              setIsFresh(true);
              if (mounted.current) setIsLoading(false);
              scheduleEmptyConfirmation(seq);
              return;
            }
          }

          publish(flightIdentity, response.data);
          dataRef.current = response.data;
          setData(response.data);
          setIsFresh(true);

          try {
            await writeGroupHubCache(userId, response.data);
          } catch {
            // best-effort: cache write failure must not fail the refresh
          }
        } else {
          if (response.payloadInvalid) {
            console.warn('[useGroupsHub] groups payload rejected', {
              bodySample: String(response.rawBodySample ?? response.data ?? 'unknown').slice(0, 200),
              rawType: response.rawBodyType ?? null,
              bodyStatus: response.status ?? null,
            });
          } else {
            warnFetchFailed(response, attempts, Boolean(flightIdentity));
          }

          // Same heal as the transport-failure path below: a sibling
          // instance may have published a 200 for this identity in this
          // instance's render-to-effect window (initializer ran on an older
          // snapshot, subscriber not yet attached). Surface the store data
          // instead of the error; the warn above keeps the HTTP failure
          // visible in logs.
          const healed = snapshotDataFor(getSnapshot(), flightIdentity);
          if (healed) {
            dataRef.current = healed;
            setData(healed);
            setIsFresh(true);
            setError(null);
          } else {
            setError(response?.data ?? response);
            setIsFresh(false);
          }
        }

        if (mounted.current) setIsLoading(false);
        return;
      }

      warnFetchFailed(transportFailure, attempts, Boolean(flightIdentity));

      // A sibling instance may have published a 200 while this flight was
      // retrying: heal from the store instead of degrading to the empty or
      // error state.
      const healed = snapshotDataFor(getSnapshot(), flightIdentity);
      if (healed) {
        dataRef.current = healed;
        setData(healed);
        setIsFresh(true);
        setError(null);
      } else {
        setError(transportFailure?.data ?? transportFailure);
        setIsFresh(false);
      }
      if (mounted.current) setIsLoading(false);
    };

    const scheduleEmptyConfirmation = (baseSeq) => {
      setTimeout(() => {
        if (!mounted.current || baseSeq !== seqRef.current) return;
        if (inFlightRef.current) return;

        const seq = ++seqRef.current;
        const promise = runFlight({ seq, isConfirmation: true });
        inFlightRef.current = { identityKey: flightIdentity, promise };
        promise.finally(() => {
          if (inFlightRef.current?.promise === promise) {
            inFlightRef.current = null;
          }
        });
      }, EMPTY_CONFIRMATION_DELAY_MS);
    };

    const promise = runFlight({ seq });
    inFlightRef.current = { identityKey: flightIdentity, promise };
    promise.finally(() => {
      if (inFlightRef.current?.promise === promise) {
        inFlightRef.current = null;
      }
    });
    return promise;
  }, [enabled, token, userId, identityKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, isFresh, refresh };
}
