import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups`;

export async function listMembers({ context, groupId }) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.get(`${BASE_URL}/${groupId}/memberships`, config)
    .then((response) => ({ status: response.status, data: response.data?.data ?? response.data }))
    .catch(mapRequestError);
}

export async function removeMember({ context, groupId, membershipId }) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${BASE_URL}/${groupId}/memberships/${membershipId}`, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}

export async function leaveGroup({ context, groupId }) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.post(`${BASE_URL}/${groupId}/memberships/leave`, {}, config)
    .then((response) => ({ status: response.status, data: response.data }))
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
