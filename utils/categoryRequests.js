import axios from "axios";
import { getBackendHeaders, setHeaders } from "./auth";
import { buildE2ECategories, isE2EMode } from "./e2eMode";

function normalizeCategory(category) {
  const { thumbnail_url, sort_order, ...rest } = category;
  return {
    ...rest,
    thumbnailUrl: thumbnail_url,
    sortOrder: sort_order,
  };
}

export async function getCategories({ context }) {
  if (isE2EMode()) {
    return { data: buildE2ECategories() };
  }

  const { token } = await getBackendHeaders(context);
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/categories`;
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };

  const response = await axios
    .get(url, config)
    .then((response) => {
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
      return { data: rows.map(normalizeCategory) };
    })
    .catch((error) => {
      return { isError: true, message: error?.message ?? 'Failed to load categories' };
    });

  return response;
}
