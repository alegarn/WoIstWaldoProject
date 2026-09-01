import axios from 'axios';
import { File, Paths } from 'expo-file-system';
import { decodeImagePayload } from '../../utils/imageFormats';
import Image from '../../models/image';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';
import { saveLastImageUuid } from '../../utils/storageDatum';

export const PRIVATE_FEED_END_CURSOR = '__private_feed_end__';

function imagesUrl(groupId) {
  return `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups/${groupId}/images`;
}

function setStorageDownloadHeaders(token) {
  return {
    Authorization: token,
    HTTP_AUTHORIZATION: token,
  };
}

function usesBackendStorage(storageUrl) {
  const backendUrl = process.env.EXPO_PUBLIC_APP_BACKEND_URL;

  return typeof storageUrl === 'string' && typeof backendUrl === 'string' && storageUrl.startsWith(backendUrl);
}

async function ensureDirExists() {
  Paths.cache.create({ idempotent: true, intermediates: true });
}

async function downloadImageToFile(url, imageId, token) {
  const downloadConfig = usesBackendStorage(url)
    ? { headers: setStorageDownloadHeaders(token), responseType: 'arraybuffer', timeout: 15000 }
    : { responseType: 'arraybuffer', timeout: 15000 };

  try {
    const response = await axios.get(url, downloadConfig);
    const decoded = decodeImagePayload(response?.data, response?.headers?.['content-type']);
    if (!decoded) {
      return null;
    }

    await ensureDirExists();
    const imageFile = new File(Paths.cache, `private-${imageId}.${decoded.extension}`);
    imageFile.write(decoded.base64, { encoding: 'base64' });

    return imageFile.uri;
  } catch {
    return null;
  }
}

function normalizePrivateImage(row, filePath) {
  const safeRow = {
    ...row,
    id: row?.id ?? row?.name,
    name: row?.name ?? row?.id,
    ratings_average: row?.ratings_average ?? null,
    ratings_count: row?.ratings_count ?? 0,
    creator_username: row?.creator_username ?? '',
    created_at: row?.created_at ?? null,
    full_description: row?.full_description ?? row?.description ?? '',
    language: row?.language ?? null,
    category: row?.category
      ? {
          ...row.category,
          key: row.category.key ?? row.category.id,
        }
      : null,
  };

  const image = new Image(
    filePath,
    safeRow.name,
    safeRow.description ?? safeRow.full_description,
    safeRow.image_height,
    safeRow.image_width,
    safeRow.is_portrait,
    { x: safeRow.x_location, y: safeRow.y_location },
    safeRow.screen_height,
    safeRow.screen_width,
    null,
    safeRow.ratings_average,
    safeRow.ratings_count,
    safeRow.creator_username,
    safeRow.created_at,
    safeRow.full_description,
    safeRow.language,
    safeRow.category,
  );

  return image;
}

export async function fetchPrivateFeedPage(context, { groupId, cursor, categoryId, language } = {}) {
  const { token } = await getBackendHeaders(context);
  const config = {
    headers: setHeaders({ token }),
    params: {},
  };

  if (cursor) config.params.after = cursor;
  if (categoryId) config.params.category_id = categoryId;
  if (language) config.params.language = language;

  const response = await axios.get(`${imagesUrl(groupId)}/`, config)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);

  if (response.status !== 200) {
    return response;
  }

  const payload = response.data ?? {};
  const images = Array.isArray(payload.images)
    ? payload.images
    : Array.isArray(payload.data)
      ? payload.data
      : [];
  const nextCursor = payload.next_cursor ?? payload.nextCursor ?? null;

  return { status: response.status, data: { images, nextCursor } };
}

export async function downloadPrivateImage(context, { groupId, imageId }) {
  const { token } = await getBackendHeaders(context);
  const presignUrl = `${imagesUrl(groupId)}/${imageId}`;
  const presignConfig = { headers: setHeaders({ token }) };

  const presignResponse = await axios.get(presignUrl, presignConfig)
    .then((response) => ({ status: response.status, data: response.data }))
    .catch(mapRequestError);

  if (presignResponse.status !== 200) {
    return null;
  }

  const payload = presignResponse.data ?? {};
  const body = payload.data ?? payload;
  const presignedUrl = body.url ?? body.presigned_url ?? body.storage_url;

  if (!presignedUrl || typeof presignedUrl !== 'string') {
    return null;
  }

  return downloadImageToFile(presignedUrl, imageId, token);
}

export async function downloadPrivateImageFromRow(context, { groupId, row }) {
  const imageId = row?.id ?? row?.name;
  const storageUrl = row?.storage_url;

  if (typeof storageUrl === 'string' && storageUrl.length > 0) {
    const { token } = await getBackendHeaders(context);
    const filePath = await downloadImageToFile(storageUrl, imageId, token);
    if (filePath) {
      return filePath;
    }
    // C7: presigned storage_url can be expired (~120s) when a cached feed
    // list replays stale rows — fall back to the per-image presign endpoint.
  }

  return downloadPrivateImage(context, { groupId, imageId });
}

export async function fetchPrivateFeedPageForGame(pictureId, context, { groupId, categoryId, language, categoryKey, persistCursor = true } = {}) {
  if (pictureId === PRIVATE_FEED_END_CURSOR) {
    return { isError: false, images: [] };
  }

  // Group-scoped cursor namespace (F1/F2 review fix): the private transport
  // cursor + END sentinel persist under `groupFeed:<gid>:game:<cat>:<lang>:cursor`
  // via saveLastImageUuid's scope param — never the shared public
  // `lastImageUuid:*` namespace. Legacy unscoped private keys are dead (one
  // head-probe degradation after update, then the scoped cursor takes over).
  const cursorScope = { kind: 'private', groupId };
  const response = await fetchPrivateFeedPage(context, {
    groupId,
    cursor: pictureId || null,
    categoryId,
    language,
  });

  if (response.status !== 200) {
    return { isError: true, title: 'Failed to load private images.', message: 'Please retry later...' };
  }

  const rows = response.data?.images ?? [];
  const nextCursor = response.data?.nextCursor ?? null;

  if (rows.length === 0) {
    if (persistCursor) {
      await saveLastImageUuid(PRIVATE_FEED_END_CURSOR, categoryKey, language, cursorScope);
    }
    return { isError: false, images: [] };
  }

  if (persistCursor) {
    await saveLastImageUuid(nextCursor ?? PRIVATE_FEED_END_CURSOR, categoryKey, language, cursorScope);
  }

  const downloaded = await Promise.all(
    rows.map(async (row) => {
      const filePath = await downloadPrivateImageFromRow(context, {
        groupId,
        row,
      });

      if (!filePath) {
        return null;
      }

      return normalizePrivateImage(row, filePath);
    }),
  );

  return { isError: false, images: downloaded.filter(Boolean) };
}
