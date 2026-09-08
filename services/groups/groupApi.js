import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';
import { clearGroupFeedCache, purgeAllPrivateCaches } from './groupFeedCache';
import { clearGroupThumbnails } from './groupCategoryThumbnails';
import { clearGroupHomeBackgrounds } from './groupHomeBackgrounds';

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups`;

async function clearDeletedGroupCaches(groupId) {
  await Promise.allSettled([
    clearGroupFeedCache(groupId),
    clearGroupThumbnails(groupId),
    clearGroupHomeBackgrounds(groupId),
    purgeAllPrivateCaches(),
  ]);
}

function normalizeGroupRow(row, userId) {
  if (!row || typeof row !== 'object') {
    return row;
  }

  return {
    ...row,
    role: String(row.owner_id) === String(userId) ? 'owner' : 'member',
  };
}

function normalizeGroupsPayload(payload, userId) {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  const normalized = rows.map((row) => normalizeGroupRow(row, userId));

  return {
    owned: normalized.filter((row) => row?.role === 'owner'),
    joined: normalized.filter((row) => row?.role !== 'owner'),
    pendingInvites: [],
  };
}

function rawBodySample(rawBody) {
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
export function looksLikeErrorPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  if (Array.isArray(payload.data)) {
    return false;
  }
  return typeof payload.error === 'string'
    || payload.exception != null
    || (typeof payload.status === 'number' && payload.status >= 400);
}

function unwrapData(payload) {
  return payload?.data ?? payload;
}

export async function fetchGroups(context) {
  const { token, userId } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

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
          rawBodySample: rawBodySample(response.data),
        };
      }

      return {
        status: response.status,
        data: normalizeGroupsPayload(response.data, userId),
        rawBodyType: typeof response.data,
        rawBodySample: rawBodySample(response.data),
      };
    })
    .catch(mapRequestError);
}

export async function createGroup(context, { name, primaryColor, secondaryColor } = {}) {
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

export async function updateGroupSettings(context, groupId, {
  name,
  primaryColor,
  secondaryColor,
  hideBgImageId,
  findBgImageId,
  rankingBgImageId,
} = {}) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const private_group = {};
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

export async function deletePrivateImage(context, groupId, imageId) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${BASE_URL}/${groupId}/images/${imageId}`, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}

export async function deleteGroup(context, groupId) {
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

export async function setActiveGroup(context, groupId) {
  const { token, userId } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/active_group`;
  const config = { headers: setHeaders({ token }) };
  const body = { active_group: { group_id: groupId ?? null } };

  return axios.patch(url, body, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}
