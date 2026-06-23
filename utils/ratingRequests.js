import axios from 'axios';

import { getBackendHeaders, setHeaders } from './auth';
import { buildE2EImageRating, buildE2EImageTags, isE2EMode } from './e2eMode';

function unwrapData(responseData) {
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    return responseData.data;
  }

  return responseData;
}

async function handleRatingRequest(promise, fallbackMessage) {
  try {
    const response = await promise;
    return { data: unwrapData(response.data) };
  } catch (error) {
    return { isError: true, message: error?.message ?? fallbackMessage };
  }
}

function buildImageUrl(userId, pictureId) {
  return `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/images/${pictureId}`;
}

function buildRatingPayload(payload = {}) {
  const body = { global_rating: payload.global_rating };
  if (payload.quality_rating != null) body.quality_rating = payload.quality_rating;
  if (payload.enigma_rating != null) body.enigma_rating = payload.enigma_rating;
  if (payload.fun_rating != null) body.fun_rating = payload.fun_rating;
  if (payload.difficulty_rating != null) body.difficulty_rating = payload.difficulty_rating;
  return { image_rating: body };
}

export async function submitRating({ pictureId, context, payload }) {
  if (isE2EMode()) {
    return {
      data: {
        ...buildE2EImageRating(),
        id: 'e2e-image-rating-id',
        image_id: 'e2e-image-id',
        user_id: 'e2e-rater-id',
      },
    };
  }

  const { token, userId } = await getBackendHeaders(context);
  const url = `${buildImageUrl(userId, pictureId)}/image_rating`;
  const headers = setHeaders({ token });

  return handleRatingRequest(
    axios.post(url, buildRatingPayload(payload), { headers }),
    'Failed to submit rating'
  );
}

export async function getImageRating({ pictureId, context }) {
  if (isE2EMode()) {
    return {
      data: {
        ...buildE2EImageRating(),
        id: 'e2e-image-rating-id',
        image_id: 'e2e-image-id',
        user_id: 'e2e-rater-id',
      },
    };
  }

  const { token, userId } = await getBackendHeaders(context);
  const url = `${buildImageUrl(userId, pictureId)}/image_rating`;
  const headers = setHeaders({ token });

  return handleRatingRequest(
    axios.get(url, { headers }),
    'Failed to load rating'
  );
}

export async function getImageTags({ pictureId, context }) {
  if (isE2EMode()) {
    return { data: buildE2EImageTags() };
  }

  const { token, userId } = await getBackendHeaders(context);
  const url = `${buildImageUrl(userId, pictureId)}/image_tags`;
  const headers = setHeaders({ token });

  return handleRatingRequest(
    axios.get(url, { headers }),
    'Failed to load tags'
  );
}

export async function addImageTag({ pictureId, context, name }) {
  if (isE2EMode()) {
    return {
      data: {
        id: 'e2e-image-tag-new',
        name: String(name).toLowerCase(),
        user_id: 'e2e-tagger-id',
        username: 'e2e_tagger',
      },
    };
  }

  const { token, userId } = await getBackendHeaders(context);
  const url = `${buildImageUrl(userId, pictureId)}/image_tags`;
  const headers = setHeaders({ token });

  return handleRatingRequest(
    axios.post(url, { tag: { name } }, { headers }),
    'Failed to add tag'
  );
}

export async function deleteImageTag({ pictureId, context, id }) {
  if (isE2EMode()) {
    return { data: { id } };
  }

  const { token, userId } = await getBackendHeaders(context);
  const url = `${buildImageUrl(userId, pictureId)}/image_tags/${id}`;
  const headers = setHeaders({ token });

  return handleRatingRequest(
    axios.delete(url, { headers }),
    'Failed to delete tag'
  );
}
