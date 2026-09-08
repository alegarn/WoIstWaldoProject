import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';
import { clearGroupFeedCache, purgeAllPrivateCaches } from './groupFeedCache';
import { clearGroupThumbnails } from './groupCategoryThumbnails';
import { clearGroupHomeBackgrounds } from './groupHomeBackgrounds';
import type { Group, GroupRole, GroupsHubData } from '../../types/groups';

export type BackendRequestContext = {
  token?: string | null;
  userId?: string | null;
  [key: string]: unknown;
};

export type GroupsResponse = {
  status: number;
  data: GroupsHubData;
  payloadInvalid?: boolean;
  rawBodyType?: string;
  rawBodySample?: string;
};

export type RequestResult = {
  status?: number | undefined;
  data?: any;
};

type GroupWriteAttributes = {
  name?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

type GroupSettingsPatch = {
  name?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  hideBgImageId?: string | number | null;
  findBgImageId?: string | number | null;
  rankingBgImageId?: string | number | null;
  [key: string]: unknown;
};

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups`;

async function clearDeletedGroupCaches(groupId: string | null | undefined): Promise<void> {
  await Promise.allSettled([
    clearGroupFeedCache(groupId as string),
    clearGroupThumbnails(groupId),
    clearGroupHomeBackgrounds(groupId),
    purgeAllPrivateCaches(),
  ]);
}

function normalizeGroupRow(row: Group, userId: string | number | null | undefined): Group {
  if (!row || typeof row !== 'object') {
    return row;
  }

  const role: GroupRole = String(row.owner_id) === String(userId) ? 'owner' : 'member';

  return {
    ...row,
    role,
  };
}

function normalizeGroupsPayload(payload: unknown, userId: string | number | null | undefined): GroupsHubData {
  const envelope = payload as { data?: Group[] } | null | undefined;
  const rows: Group[] = Array.isArray(envelope?.data)
    ? envelope.data
    : Array.isArray(payload)
      ? (payload as Group[])
      : [];

  const normalized = rows.map((row) => normalizeGroupRow(row, userId));

  return {
    owned: normalized.filter((row) => row?.role === 'owner'),
    joined: normalized.filter((row) => row?.role !== 'owner'),
    pendingInvites: [],
  };
}

function rawBodySample(rawBody: unknown): string {
  if (rawBody == null) {
    return String(rawBody);
  }
  if (typeof rawBody === 'string') {
    return rawBody.slice(0, 200);
  }
  try {
    return JSON.stringify(rawBody).slice(0, 200);
  } catch {
    return String(rawBody);
  }
}

// Detects proxy/carrier error bodies smuggled inside a 200 response (e.g. a
// stale Rails 404 JSON served by an intermediary cache). An error body is
// never "zero groups".
export function looksLikeErrorPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const body = payload as {
    data?: unknown;
    error?: unknown;
    exception?: unknown;
    status?: unknown;
  };
  if (Array.isArray(body.data)) {
    return false;
  }
  return typeof body.error === 'string'
    || body.exception != null
    || (typeof body.status === 'number' && body.status >= 400);
}

function unwrapData(payload: unknown): unknown {
  const envelope = payload as { data?: unknown } | null | undefined;
  return envelope?.data ?? payload;
}

export async function fetchGroups(context: BackendRequestContext): Promise<GroupsResponse | RequestResult> {
  const { token, userId } = await getBackendHeaders(context);
  const config: AxiosRequestConfig = { headers: setHeaders({ token }) };

  // Carrier transparent proxies can serve a poisoned cached body for this
  // static GET URL (HTTP 200 wrapping a stale Rails 404 JSON). The
  // per-request timestamp param busts any intermediary cache so every hub
  // fetch reaches the origin instead of the proxy cache entry.
  return axios.get(`${BASE_URL}/`, {
    ...config,
    params: { ...(config.params ?? {}), _ts: Date.now() },
  })
    .then((response) => {
      const hasValidPayload = Array.isArray(response.data?.data) || Array.isArray(response.data);

      // Invalid-payload contract: any 200 whose body is not a groups payload is
      // returned with `payloadInvalid: true` for the hub to route through its
      // error branch (never normalized into an empty groups list). Bodies that
      // look like a JSON error object also morph `status` to the body-claimed
      // status so the surfaced error reflects the real HTTP outcome (e.g. 404).
      if (!hasValidPayload) {
        const errorShaped = looksLikeErrorPayload(response.data);
        return {
          status: errorShaped ? (response.data.status ?? response.status) : response.status,
          data: response.data,
          payloadInvalid: true,
          rawBodyType: typeof response.data,
          ...(__DEV__ ? { rawBodySample: rawBodySample(response.data) } : {}),
        };
      }

      return {
        status: response.status,
        data: normalizeGroupsPayload(response.data, userId),
        rawBodyType: typeof response.data,
        ...(__DEV__ ? { rawBodySample: rawBodySample(response.data) } : {}),
      };
    })
    .catch(mapRequestError);
}

export async function createGroup(context: BackendRequestContext, {
  name,
  primaryColor,
  secondaryColor,
}: GroupWriteAttributes = {}): Promise<RequestResult> {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const body = {
    private_group: {
      name,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    },
  };

  return axios.post(`${BASE_URL}/`, body, config)
    .then((response) => ({ status: response.status, data: unwrapData(response.data) }))
    .catch(mapRequestError);
}

export async function updateGroupSettings(context: BackendRequestContext, groupId: string | null | undefined, {
  name,
  primaryColor,
  secondaryColor,
  hideBgImageId,
  findBgImageId,
  rankingBgImageId,
}: GroupSettingsPatch = {}): Promise<RequestResult> {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const private_group: Record<string, unknown> = {};
  if (name !== undefined) private_group.name = name;
  if (primaryColor !== undefined) private_group.primary_color = primaryColor;
  if (secondaryColor !== undefined) private_group.secondary_color = secondaryColor;
  if (hideBgImageId !== undefined) private_group.hide_bg_image_id = hideBgImageId;
  if (findBgImageId !== undefined) private_group.find_bg_image_id = findBgImageId;
  if (rankingBgImageId !== undefined) private_group.ranking_bg_image_id = rankingBgImageId;
  const body = { private_group };

  return axios.patch(`${BASE_URL}/${groupId}/`, body, config)
    .then((response) => ({ status: response.status, data: unwrapData(response.data) }))
    .catch(mapRequestError);
}

export async function deletePrivateImage(context: BackendRequestContext, groupId: string | null | undefined, imageId: string | number): Promise<RequestResult> {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${BASE_URL}/${groupId}/images/${imageId}`, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}

export async function deleteGroup(context: BackendRequestContext, groupId: string | null | undefined): Promise<RequestResult> {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${BASE_URL}/${groupId}/`, config)
    .then(async (response) => {
      if (response?.status === 200 || response?.status === 204) {
        await clearDeletedGroupCaches(groupId);
      }

      return { status: response.status, data: response.data };
    })
    .catch(mapRequestError);
}

export async function setActiveGroup(context: BackendRequestContext, groupId: string | null | undefined): Promise<RequestResult> {
  const { token, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/active_group`;
  const config = { headers: setHeaders({ token }) };
  const body = { active_group: { group_id: groupId ?? null } };

  return axios.patch(url, body, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}
