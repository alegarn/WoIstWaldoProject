import axios from "axios";
import { File, Paths } from 'expo-file-system';
import Image from "../models/image";
import { setHeaders, getBackendHeaders } from "./auth";

export { getBackendHeaders };
import { saveLastImageUuid } from "./storageDatum";
import { fetchPrivateFeedPageForGame } from "../services/groups/groupFeedApi";

function isPrivateScope(scope) {
  return scope && typeof scope === 'object' && scope.kind === 'private' && !!scope.groupId;
}

const MAX_EMPTY_DOWNLOAD_BATCHES = 3;

function setUploadHeaders({ plan, fileExtension, contentLength, token }) {

  const headers = {
    "Content-Type": "image/" + fileExtension,
    "Content-Length": contentLength,
    ...plan?.headers,
  };

  if (plan?.provider === "local_disk") {
    headers.Authorization = token;
    headers.HTTP_AUTHORIZATION = token;
  };

  return headers;
};

export function setStorageDownloadHeaders(token) {
  return {
    Authorization: token,
    HTTP_AUTHORIZATION: token,
  };
};

export function usesBackendStorage(storageUrl) {
  const backendUrl = process.env.EXPO_PUBLIC_APP_BACKEND_URL;

  return typeof storageUrl === 'string' && typeof backendUrl === 'string' && storageUrl.startsWith(backendUrl);
};

function errorType(status) {
  switch (status) {
    case 401:
      return "Unauthorized, please try to reconnect";
    case 500:
      return "Internal server error, please wait and try again";
    default:
      return "Something went wrong, please try again later";
  };
};

/**
 * @typedef {'empty' | 'network' | 'server'} GetImagesErrorReason
 *
 * @typedef {Object} GetImagesResult
 * @property {boolean} isError
 * @property {GetImagesErrorReason} [reason] Tagged outcome so callers can
 *   distinguish transient failures ('network', 'server') from a genuine
 *   exhausted feed ('empty'). Absent on the 401 path: the global apiClient
 *   unauthorized handler owns logout/navigation out-of-band (plan §5.3), so
 *   no 'auth' reason is ever emitted here.
 * @property {string} [title]
 * @property {string} [message]
 * @property {Array} [images]
 */
function classifyImagesErrorReason(error) {
  const status = error?.response?.status ?? error?.request?.status;
  if (typeof status === 'number' && status >= 500 && status <= 599) {
    return 'server';
  }
  return 'network';
};


export async function getUploadUrl(context) {
  return prepareImageUpload(context);
};

export async function prepareImageUpload(context, { contentType, contentLength } = {}) {
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/aws_requests/get_secure_upload_url`;
  const { token } = await getBackendHeaders(context);
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
    params: {
      content_type: contentType,
      content_length: contentLength,
    },
  };

  const response = await axios
    .get(url, config)
    .then((response) => {
      return response;
    }).catch((error) => {
      console.log("error getUploadUrl", error);
      return { status: error?.response?.status ?? error?.request?.status, message: error.message, data: error?.response?.data };
    });

  const title = response.status === 200 ? "" : errorType(response.status);

  return { status: response.status, title: title, message: response.message, data: response.data};
};



/**
 * Fetch the head (first) image-metadata batch for a user. Used when no cursor
 * exists yet (`pictureId === null` in `getImages`). Hits `get_image_batch`.
 * `timeout: 15000` on every request. Returns `{ data: 401 }` on auth failure
 * or `{ data: null, errorReason }` on other failures — never throws.
 *
 * @param {Object}  params
 * @param {Object}  params.config  Axios config (headers) to merge with timeout.
 * @param {string|number} params.userId Target user id.
 * @param {Object}  [params.filters] Optional `category_id` (private UUID),
 *   `category_key` (public bundled key), and `language` filters.
 * @returns {Promise<{data: 401} | {data: null, errorReason: GetImagesErrorReason} | import('axios').AxiosResponse>}
 */
async function getImagesInfos({ config, userId, filters }) {
  //console.log("getImagesInfos");
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_image_batch`;
  const requestConfig = { ...config, timeout: 15000 };
  const params = {};
  if (filters?.category_id != null) params.category_id = filters.category_id;
  if (filters?.category_key != null) params.category_key = filters.category_key;
  if (filters?.language != null) params.language = filters.language;
  if (Object.keys(params).length > 0) {
    requestConfig.params = { ...requestConfig.params, ...params };
  }
  const response = await axios.get(url, requestConfig).then((response) => {
    //console.log("response getImagesInfos", response);
    return response;
  }).catch((error) => {
    //console.log("error getImagesInfos", error.request);
    if (error?.request?.status === 401 || error?.response?.status === 401) {
      return { data: 401 };
    };
    return { data: null, errorReason: classifyImagesErrorReason(error) };
  });
  return response;
};

/**
 * Fetch the next image-metadata batch using keyset pagination "after" a cursor.
 * Posts the last picture's `name` as `{ image: { name: pictureId } }` to
 * `next_image_batch`; the server returns strictly newer rows. Same timeout
 * (15000) and same `{ data: 401 }` / `{ data: null, errorReason }` error
 * contract as `getImagesInfos` — never throws.
 *
 * @param {Object}  params
 * @param {Object}  params.config    Axios config (headers) to merge with timeout.
 * @param {string|number} params.userId Target user id.
 * @param {string}  params.pictureId Keyset cursor: the `name` of the last
 *   image of the previous batch.
 * @param {Object}  [params.filters] Optional `category_id` (private UUID),
 *   `category_key` (public bundled key), and `language` filters.
 * @returns {Promise<{data: 401} | {data: null, errorReason: GetImagesErrorReason} | import('axios').AxiosResponse>}
 */
async function getNextImagesInfos({ config, userId, pictureId, filters }){
  //console.log("getNextImagesInfos");
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/next_image_batch`;
  const imageBody = {
    name: pictureId
  };
  if (filters?.category_id != null) imageBody.category_id = filters.category_id;
  if (filters?.category_key != null) imageBody.category_key = filters.category_key;
  if (filters?.language != null) imageBody.language = filters.language;
  const imageData = {
    image: imageBody
  };
  const response = await axios.post(url, imageData, { ...config, timeout: 15000 })
    .then((response) => {
      //console.log("response getNextImagesInfos", response);
      return response;
    }).catch((error) => {
      console.log("error getNextImagesInfos", error.request);
      if (error?.request?.status === 401 || error?.response?.status === 401) {
        return { data: 401 };
      }
      return { data: null, errorReason: classifyImagesErrorReason(error) };
    });
  return response;
};

/**
 * Download one image's bytes from its storage URL (backend or external).
 * GET with `timeout: 15000`; auth headers are attached only when the URL is
 * backend-hosted (`usesBackendStorage`). On failure it `console.warn`s the URL
 * + reason and resolves `undefined` (a falsy sentinel) — it does NOT throw, so
 * a `Promise.all` batch keeps the successful downloads and the caller drops
 * failures.
 *
 * @param {Object} params
 * @param {string} params.storageUrl Absolute URL to fetch.
 * @param {string} [params.token]    Auth token, attached only for backend URLs.
 * @returns {Promise<string|undefined>} Resolves to the response body on
 *   success, or `undefined` on failure.
 */
async function getImageFromStorage({ storageUrl, token }) {
  console.log("getImageFromStorage");
  const config = usesBackendStorage(storageUrl) ? { headers: setStorageDownloadHeaders(token), timeout: 15000 } : { timeout: 15000 };
  const imageData = await axios.get(storageUrl, config)
  .then((response) => {
    //console.log("imageData response, getImageFromStorage");
    return response.data;
  }).catch((error) => {
    const reason = error?.response?.status ?? error?.code ?? error?.message ?? 'unknown';
    console.warn("getImageFromStorage failed", storageUrl, reason);
  });
  // if "The specified key does not exist" -> send server image is not in aws -> error
  return imageData;
};

function verifyItsBase64(imageData) {
  if (typeof imageData !== 'string') {
    return false;
  }

  const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,/;

  if (base64Regex.test(imageData)) {
    // Extract the base64 data
    const base64Data = imageData.replace(base64Regex, '');
    return base64Data;
  } else {
    console.log('The string is not a base64 image.');
    return false;
  };
};

async function ensureDirExists() {
  Paths.cache.create({ idempotent: true, intermediates: true });
};

/**
 * Decode a base64 data-URL and persist it to the cache dir as a file.
 * Writes `<filename>.<ext>` under `Paths.cache` and returns its `file://` uri.
 * Returns `false` when `imageData` is not a base64 data-URL (caller treats
 * falsy as "skip this image"). Does not throw.
 *
 * @param {string|*} imageData The raw base64 data-URL from storage.
 * @param {string}   filename  Filename stem (no extension); extension is
 *   parsed from the data-URL prefix.
 * @returns {Promise<string|false>} The written file's `file://` uri, or `false`.
 */
async function extractBase64(imageData, filename) {
  console.log("extract base64 filename", filename);

  const base64Data = verifyItsBase64(imageData);
  if (!base64Data) {
    console.log(`${filename}: imageData is not base64`);
    // send server error
    return false;
  };

  const extension_matche = imageData.match(/^data:image\/(\w+);base64,/);
  const fileExtension = extension_matche[1];
  //console.log("fileExtension", fileExtension);

  // Create a new file path
  await ensureDirExists();
  const imageFile = new File(Paths.cache, `${filename}.${fileExtension}`);
  imageFile.write(base64Data, { encoding: 'base64' });

  return imageFile.uri;

};

/**
 * Fetch one image's bytes and decode to a cached `file://` path. Composes
 * `getImageFromStorage` → `extractBase64`. Returns the file uri, or `false`
 * (from `extractBase64`) when the payload is not base64. Does not throw.
 *
 * @param {Object} image Metadata row with at least `storage_url` and `name`.
 * @param {string} token Auth token forwarded to `getImageFromStorage`.
 * @returns {Promise<string|false>} Cached file uri or `false`.
 */
async function handleImagesDownload(image, token) {
  console.log("handleImagesDownload");
  console.log("image location", image.storage_url);
  const imageData = await getImageFromStorage({ storageUrl: image.storage_url, token: token });
  const filePath = await extractBase64(imageData, image.name);
  return filePath;
};

export function buildImageObject(image, filePath) {
  const imageObject = new Image(
    filePath,
    image.name,
    image.description,
    image.image_height,
    image.image_width,
    image.is_portrait,
    {x: image.x_location, y: image.y_location},
    image.screen_height,
    image.screen_width,
    null
  );

  imageObject.averageRating = image.ratings_average;
  imageObject.ratingsCount = image.ratings_count;
  imageObject.creatorUsername = image.creator_username;
  imageObject.createdAt = image.created_at;
  imageObject.fullDescription = image.full_description;
  imageObject.language = image.language;

  if (image.category != null) {
    const { thumbnail_url, sort_order, ...rest } = image.category;
    imageObject.category = {
      ...rest,
      thumbnailUrl: thumbnail_url,
      sortOrder: sort_order,
    };
  } else {
    imageObject.category = image.category;
  }

  return imageObject;
}

/**
 * Download + decode every image in a metadata batch concurrently. Uses
 * `Promise.all`, so it resolves when the slowest image finishes (failures do
 * not short-circuit). Per-image failures resolve falsy and are dropped by
 * `.filter(Boolean)`, so the result holds only the partial successes.
 *
 * @param {Array<Object>} imagesInfosData Batch of metadata rows.
 * @param {string}        token           Auth token for `getImageFromStorage`.
 * @returns {Promise<Array<Object>>} Built `Image` objects (failures excluded).
 */
async function downloadImageBatch(imagesInfosData, token) {
  const downloadedImages = await Promise.all(
    imagesInfosData.map(async (image) => {
      const filePath = await handleImagesDownload(image, token);

      if (!filePath) {
        return null;
      }

      return buildImageObject(image, filePath);
    })
  );

  return downloadedImages.filter(Boolean);
}


/**
 * Main feed entry. Resolves one playable batch of images for the public feed
 * (private scopes are delegated to `fetchPrivateFeedPageForGame`).
 *
 * Bounded retry loop: at most `MAX_EMPTY_DOWNLOAD_BATCHES` (3) consecutive
 * "broken" batches — a batch whose metadata fetched OK but yielded zero
 * downloaded images — are skipped before giving up with a `reason: 'server'`
 * error. Each iteration:
 *   1. fetch metadata (`getImagesInfos` for the head / `getNextImagesInfos`
 *      for an "after cursor" batch keyed by the previous tail `name`);
 *   2. early returns: `data === null` → `{ isError: true, reason }`;
 *      `data === 401` → auth error (no 'auth' `reason`; global apiClient
 *      unauthorized handler owns logout/nav out-of-band);
 *      empty `imagesInfosData.length === 0` → `{ isError: false, reason:'empty',
 *      images: [] }` BEFORE any cursor write;
 *   3. CURSOR ADVANCE: `saveLastImageUuid(lastBatchPictureId, ...)` is fired
 *      for every valid non-empty batch — strictly BEFORE `downloadImageBatch`.
 *      So the cursor never freezes on a broken batch: if every download in a
 *      batch fails, the cursor has already advanced past it and the loop
 *      re-queries beyond it next pass instead of re-querying the same batch
 *      forever. Accepted trade-off over the old freeze behaviour.
 *
 * @param {string|null} pictureId Cursor: `name` of the last image of the
 *   previous page, or `null` for the first page.
 * @param {Object}      context   Auth context (forwarded to `getBackendHeaders`).
 * @param {Object}      [filters] Optional `{ category_id, language, category_key, scope }`.
 * @returns {Promise<GetImagesResult>}
 */
export async function getImages(pictureId, context, filters = {}) {
  console.log("getImages");
  console.log("getImages pictureId", pictureId);

  if (isPrivateScope(filters?.scope)) {
    // Private cursor namespace: PRIVATE filters carry no category_key (server
    // contract stays category_id), so derive the LOCAL cursor/exhausted
    // namespace from the category id (or 'all'). cardDeck.fetchCardBatch reads
    // the cursor with the same categoryKey value, so the private cursor
    // round-trips instead of falling back to the shared public 'all' key.
    return fetchPrivateFeedPageForGame(pictureId, context, {
      groupId: filters.scope.groupId,
      categoryId: filters?.category_id,
      language: filters?.language,
      categoryKey: filters?.category_key ?? filters?.category_id ?? 'all',
    });
  }

  const { token, userId } = await getBackendHeaders(context);
  const headers = setHeaders({ token });

  const config = {
    headers: headers,
  };

  let nextPictureId = pictureId;
  let skippedBrokenBatches = 0;

  while (skippedBrokenBatches <= MAX_EMPTY_DOWNLOAD_BATCHES) {
    const imagesInfos = nextPictureId === null
      ? await getImagesInfos({ config, userId, filters })
      : await getNextImagesInfos({ config, userId, pictureId: nextPictureId, filters });

    if (imagesInfos?.data === null) {
      return {
        isError: true,
        reason: imagesInfos?.errorReason ?? 'server',
        title: "There is an error downloading user's images.",
        message: "Please retry later..."
      };
    };

    if (imagesInfos?.data === 401) {
      return { isError: true, title: "There is an authentication error.", message: "Please reconnect" };
    };

    const imagesInfosData = imagesInfos?.data?.data ?? [];

    if (imagesInfosData.length === 0) {
      return { isError: false, reason: 'empty', images: [] };
    };

    const lastBatchPictureId = imagesInfosData[imagesInfosData.length - 1].name;
    await saveLastImageUuid(lastBatchPictureId, filters?.category_key, filters?.language);
    const images = await downloadImageBatch(imagesInfosData, token);

    if (images.length > 0) {
      return { isError: false, images: images };
    }

    skippedBrokenBatches += 1;
    nextPictureId = lastBatchPictureId;
  }

  return {
    isError: true,
    reason: 'server',
    title: "There is an error downloading user's images.",
    message: "Please retry later..."
  };
};


  /* https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/
  CORS and using pre-signed process.env.EXPO_PUBLIC_APP_BACKEND_URLs in the browser
*/

/* binary, with content-length multipart/form-data */
/* https://www.nicesnippets.com/blog/how-to-upload-image-to-server-using-axios-in-react-native */

/* https://repost.aws/knowledge-center/s3-presigned-url-signature-mismatch */

/*  How to view raw HTTP request and response in Postman
https://www.youtube.com/watch?v=eM1-YTBUFj4 */


export async function saveImageToAws({ plan, fileUrl, fileExtension, contentLength, context }) {
  return performImageUpload({ plan, fileUrl, fileExtension, contentLength, context });
};

export async function performImageUpload({ plan, fileUrl, fileExtension, contentLength, context }) {
  const { token } = await getBackendHeaders(context);
  const requestMethod = (plan?.method || 'PUT').toLowerCase();
  const requestWithMethod = axios[requestMethod];

  if (typeof requestWithMethod !== 'function') {
    const title = errorType(500);

    return {
      status: 500,
      title: title,
      message: `Unsupported upload method: ${plan?.method}`,
    };
  };

  const headers = setUploadHeaders({ plan, fileExtension, contentLength, token });
  console.log("performImageUpload", plan?.image_key);


  const config = {
    headers: headers,
  };

  //console.log("fileUrl", fileUrl);

  try {
    const uploadFile = new File(fileUrl);

    if (!uploadFile.exists) {
      throw new Error('Selected image file is no longer available.');
    }

    const base64 = await uploadFile.base64();
    const response = await requestWithMethod(plan.url, `data:image/${fileExtension};base64,` + base64, config)
      .then((response) => {
        if (response.status === 200) {
          console.log("post img base64 ok", Object.keys(response).filter((key) => key !== 'data'));
        };
        return response;
      })
      .catch((error) => {
        console.log("error axios img base64 upload", error);
        console.log("message", error.message);
          return {
            status: error?.response?.status ?? error?.request?.status,
            message: error.message,
            data: error?.response?.data,
          };
      });

        const title = response.status === 200 ? "" : errorType(response.status);

    return { status: response.status, title: title, message: response.message };

  } catch (error) {
    const title = errorType(error?.request?.status);
    return {
      status: error?.request?.status,
      title: title,
      message: `Your file might not exist anymore but should be uploaded. You can continue to play. \nError:  ${error?.message }` };
  };

};


export async function saveImageInfos({ userId, imagesInfos, context }) {
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/images`;
  const { token } = await getBackendHeaders(context);
  const headers = setHeaders({ token });
  const config = {
    headers: headers,
  };
  const requestData = {
    image: imagesInfos
  };

  const response = await axios
  .post(url, requestData, config)
  .then((response) => {
    console.log("post", response);
    return { status: 200 };
  })
  .catch((error) => {
    console.log("saveImageInfos error", error);
    return {
      status: error?.response?.status ?? error?.request?.status,
      message: error.message
    };
  });
  const title = response.status === 200 ? "" : errorType(response.status);
return { status: response.status, title: title, message: response.message };
};
