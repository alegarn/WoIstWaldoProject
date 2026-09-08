import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchGroups } from '../services/groups/groupApi';
import type { GroupsResponse, RequestResult } from '../services/groups/groupApi';
import { readGroupHubCache, writeGroupHubCache } from '../services/groups/groupHubCache';
import { getSnapshot, publish, subscribe } from '../services/groups/groupHubStore';
import { AuthContext } from '../store/auth-context';
import type { GroupsHubData } from '../types/groups';

type HubSnapshot = {
  identityKey: string;
  data: GroupsHubData | null;
  updatedAt?: number;
};

type HubResponse = GroupsResponse | RequestResult;

type UseGroupsHubOptions = {
  enabled?: boolean;
};

type UseGroupsHubResult = {
  data: GroupsHubData | null;
  isLoading: boolean;
  error: unknown;
  isFresh: boolean;
  refresh: () => Promise<void>;
};

const MAX_TRANSPORT_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 1500];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function hasHubRows(hub: GroupsHubData | null | undefined): boolean {
  return Boolean(hub?.owned?.length || hub?.joined?.length);
}

// Strict identityKey compare: returns the store payload only when it belongs
// to this identity, preserving the data=null semantics for wrong-identity
// data.
function snapshotDataFor(snapshot: HubSnapshot | null | undefined, identityKey: string): GroupsHubData | null {
  return snapshot && snapshot.identityKey === identityKey && snapshot.data
    ? snapshot.data
    : null;
}

// Never logs token/userId values — only whether an identityKey was present.
function warnFetchFailed(errorOrResponse: unknown, attempts: number, hasIdentity: boolean) {
  const candidate = (errorOrResponse ?? {}) as HubResponse & {
    message?: string;
    data?: { message?: string } | null;
  };
  console.warn('[useGroupsHub] groups fetch failed', {
    status: candidate.status ?? null,
    message: (
      candidate.data?.message
      ?? candidate.message
      ?? String(errorOrResponse ?? 'unknown')
    ).slice(0, 200),
    attempts,
    identityKey: hasIdentity ? 'present' : 'empty',
  });
}

export function useGroupsHub({ enabled = true }: UseGroupsHubOptions = {}): UseGroupsHubResult {
  const { token, userId } = useContext(AuthContext);
  const identityKey = `${token ?? ''}|${userId ?? ''}`;
  const [data, setData] = useState<GroupsHubData | null>(() => snapshotDataFor(getSnapshot(), identityKey));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [isFresh, setIsFresh] = useState(false);

  const mounted = useRef(false);
  const identityRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const inFlightRef = useRef<{ identityKey: string; promise: Promise<void> } | null>(null);
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
    const unsubscribe = subscribe((snapshot: HubSnapshot) => {
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

  const refresh = useCallback(async (): Promise<void> => {
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

    // Shared tail for both failure arms: a sibling instance may have
    // published a 200 for this identity in this instance's render-to-effect
    // window or while this flight was retrying. Surface the store data
    // instead of the error; the warns above keep the failure visible in logs.
    const healOrSurfaceError = (failure: unknown) => {
      const healed = snapshotDataFor(getSnapshot(), flightIdentity);
      if (healed) {
        dataRef.current = healed;
        setData(healed);
        setIsFresh(true);
        setError(null);
      } else {
        setError((failure as HubResponse)?.data ?? failure);
        setIsFresh(false);
      }
      if (mounted.current) setIsLoading(false);
    };

    const runFlight = async (flightSeq: number): Promise<void> => {
      const seq = flightSeq;
      if (mounted.current) {
        setIsLoading(true);
        setError(null);
      }

      let cached: GroupsHubData | null = null;
      try {
        cached = await readGroupHubCache(userId);
        if (mounted.current && cached && seq === seqRef.current) {
          setData((prev) => prev ?? cached);
        }
      } catch {
        // best-effort: unreadable cache behaves like no cache
      }

      let response: HubResponse | null = null;
      let transportFailure: unknown = null;
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
        // Anything reaching this block carries the full hub envelope shape;
        // narrow once so payloadInvalid/data/raw* reads stay typed.
        const hubResponse = response as GroupsResponse;
        // fetchGroups flags any 200 whose body is not a valid groups payload
        // (proxy error bodies, HTML garbage) with `payloadInvalid`. Route it
        // through the error branch below — an error body is never "zero
        // groups" and must not reach the empty-200 branch or be published.
        if (!hubResponse.payloadInvalid && hubResponse.status === 200) {
          const isEmpty = hubResponse.data?.owned?.length === 0 && hubResponse.data?.joined?.length === 0;

          if (isEmpty) {
            // Payload validation already rejected error/garbage bodies, so a
            // well-formed empty 200 is server truth and applies immediately;
            // the warn keeps the diagnostic trail when the empty replaces rows.
            console.warn('[useGroupsHub] 200 with empty groups payload', {
              hadCachedData: hasHubRows(dataRef.current)
                || hasHubRows(snapshotDataFor(getSnapshot(), flightIdentity))
                || hasHubRows(cached),
              ...(hubResponse.rawBodyType != null ? { rawType: hubResponse.rawBodyType } : {}),
              ...(hubResponse.rawBodySample != null ? { bodySample: hubResponse.rawBodySample } : {}),
            });
          }

          publish(flightIdentity, hubResponse.data);
          dataRef.current = hubResponse.data;
          setData(hubResponse.data);
          setIsFresh(true);

          try {
            await writeGroupHubCache(userId, hubResponse.data);
          } catch {
            // best-effort: cache write failure must not fail the refresh
          }

          if (mounted.current) setIsLoading(false);
          return;
        }

        if (hubResponse.payloadInvalid) {
          console.warn('[useGroupsHub] groups payload rejected', {
            bodySample: String(hubResponse.rawBodySample ?? hubResponse.data ?? 'unknown').slice(0, 200),
            rawType: hubResponse.rawBodyType ?? null,
            bodyStatus: hubResponse.status ?? null,
          });
        } else {
          warnFetchFailed(hubResponse, attempts, Boolean(flightIdentity));
        }

        healOrSurfaceError(hubResponse);
        return;
      }

      warnFetchFailed(transportFailure, attempts, Boolean(flightIdentity));
      healOrSurfaceError(transportFailure);
    };

    const promise = runFlight(seq);
    inFlightRef.current = { identityKey: flightIdentity, promise };
    promise.finally(() => {
      if (inFlightRef.current?.promise === promise) {
        inFlightRef.current = null;
      }
    });
    return promise;
  }, [enabled, token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, isFresh, refresh };
}
