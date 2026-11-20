import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

const BASE_URL = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/billing`;

export async function syncEntitlement(context) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };

  return axios.post(`${BASE_URL}/sync_entitlement`, {}, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);
}
