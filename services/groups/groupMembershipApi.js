import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';
import { clearGroupFeedCache } from './groupFeedCache';
import { clearGroupThumbnails } from './groupCategoryThumbnails';
import { clearGroupHomeBackgrounds } from './groupHomeBackgrounds';

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups`;

async function clearDepartedGroupCaches(groupId) {
  await Promise.allSettled([
    clearGroupFeedCache(groupId),
    clearGroupThumbnails(groupId),
    clearGroupHomeBackgrounds(groupId),
  ]);
}

function isSameUser(left, right) {
  if (left == null || right == null) {
    return false;
  }

  return String(left) === String(right);
}

export async function listMembers({ context, groupId }) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.get(`${BASE_URL}/${groupId}/memberships`, config)
    .then((response) => ({ status: response.status, data: response.data?.data ?? response.data }))
    .catch(mapRequestError);
}

export async function removeMember({ context, groupId, membershipId, removedUserId }) {
  const { token, userId } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${BASE_URL}/${groupId}/memberships/${membershipId}`, config)
    .then(async (response) => {
      if ((response?.status === 200 || response?.status === 204) && isSameUser(removedUserId, userId)) {
        await clearDepartedGroupCaches(groupId);
      }

      return { status: response.status, data: response.data };
    })
    .catch(mapRequestError);
}

export async function leaveGroup({ context, groupId }) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.post(`${BASE_URL}/${groupId}/memberships/leave`, {}, config)
    .then(async (response) => {
      if (response?.status === 200 || response?.status === 204) {
        await clearDepartedGroupCaches(groupId);
      }

      return { status: response.status, data: response.data };
    })
    .catch(mapRequestError);
}

export async function transferOwnership({ context, groupId, targetUserId }) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const body = { transfer: { target_user_id: targetUserId } };

  return axios.post(`${BASE_URL}/${groupId}/memberships/transfer`, body, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}
