import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

function categoriesUrl(groupId) {
  return `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups/${groupId}/categories`;
}

export async function listGroupCategories(context, groupId) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.get(`${categoriesUrl(groupId)}/`, config)
    .then((response) => ({ status: response.status, data: response.data?.data ?? response.data }))
    .catch(mapRequestError);
}

export async function createGroupCategory(context, groupId, { name, sortOrder, thumbnailImageId } = {}) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const private_category = { name, sort_order: sortOrder };
  if (thumbnailImageId !== undefined) private_category.thumbnail_image_id = thumbnailImageId;
  const body = { private_category };

  return axios.post(`${categoriesUrl(groupId)}/`, body, config)
    .then((response) => ({ status: response.status, data: response.data?.data ?? response.data }))
    .catch(mapRequestError);
}

export async function updateGroupCategory(context, groupId, categoryId, { name, sortOrder, thumbnailImageId } = {}) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const private_category = {};
  if (name !== undefined) private_category.name = name;
  if (sortOrder !== undefined) private_category.sort_order = sortOrder;
  if (thumbnailImageId !== undefined) private_category.thumbnail_image_id = thumbnailImageId;
  const body = { private_category };

  return axios.patch(`${categoriesUrl(groupId)}/${categoryId}/`, body, config)
    .then((response) => ({ status: response.status, data: response.data?.data ?? response.data }))
    .catch(mapRequestError);
}

export async function deleteGroupCategory(context, groupId, categoryId) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.delete(`${categoriesUrl(groupId)}/${categoryId}/`, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}
