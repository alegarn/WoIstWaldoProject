import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups`;

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

function unwrapData(payload) {
  return payload?.data ?? payload;
}

export async function fetchGroups(context) {
  const { token, userId } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.get(`${BASE_URL}/`, config)
    .then((response) => ({
      status: response.status,
      data: normalizeGroupsPayload(response.data, userId),
    }))
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

export async function updateGroupSettings(context, groupId, { name, primaryColor, secondaryColor } = {}) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const private_group = {};
  if (name !== undefined) private_group.name = name;
  if (primaryColor !== undefined) private_group.primary_color = primaryColor;
  if (secondaryColor !== undefined) private_group.secondary_color = secondaryColor;
  const body = { private_group };

  return axios.patch(`${BASE_URL}/${groupId}/`, body, config)
    .then((response) => ({ status: response.status, data: unwrapData(response.data) }))
    .catch(mapRequestError);
}

export async function deleteGroup(context, groupId) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${BASE_URL}/${groupId}/`, config)
    .then((response) => ({ status: response.status, data: response.data }))
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
