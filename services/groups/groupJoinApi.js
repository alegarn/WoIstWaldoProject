import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups`;

export async function joinByCode(context, code) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const body = { join: { code } };

  return axios.post(`${BASE_URL}/join`, body, config)
    .then((response) => ({ status: response.status, data: response.data?.data ?? response.data }))
    .catch(mapRequestError);
}
