import axios from "axios";
import { File, Paths, UploadType } from 'expo-file-system';
import Image from "../models/image";
import { setHeaders, getBackendHeaders } from "./auth";
import { decodeImagePayload } from "./imageFormats";

export { getBackendHeaders };
import { saveLastImageUuid } from "./storageDatum";
import { fetchPrivateFeedPageForGame } from "../services/groups/groupFeedApi";

function isPrivateScope(scope) {
  return scope && typeof scope === 'object' && scope.kind === 'private' && !!scope.groupId;
}

const MAX_EMPTY_DOWNLOAD_BATCHES = 3;
const BINARY_UPLOAD_METHODS = ["POST", "PUT", "PATCH"];

function normalizeUploadHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([, value]) => value != null)
      .map(([name, value]) => [name, String(value)])
  );
};

function setUploadHeaders({ plan, fileExtension, contentLength, token }) {

  const headers = {
    "Content-Type": "image/" + fileExtension,
    "Content-Length": contentLength,
    ...plan?.headers,
  };

  if (plan?.provider === "local_disk") {
    headers.Authorization = token;
  };

  return normalizeUploadHeaders(headers);
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

/**
 * Classify a download failure by transport class. `true` means no HTTP
 * response at all (timeout, ERR_NETWORK, connection refused): the batch is
 * unproven. ANY HTTP status — 4xx included (e.g. the anticipated 404 "key
 * does not exist") — means the server answered, so the failure is
 * server-class. Deliberately NOT part of `classifyImagesErrorReason`: that
 * helper maps every 4xx to 'network' for the metadata path, semantics
 * consumed by `useResolveLifecycle.ts` and kept intact here.
 *
 * @param {*} error Axios-style error (or anything) from a download request.
 * @returns {boolean} Whether the failure is network-class.
 */
function isNetworkClassFailure(error) {
  return error?.response == null && !(typeof error?.request?.status === 'number' && error.request.status > 0);
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
 * Always `responseType: 'arraybuffer'` — the server serves raw bytes now;
 * pre-backfill base64 text objects arrive as an ArrayBuffer of ASCII and are
 * decoded downstream (magic-byte sniff first, legacy `data:image/` ASCII
 * prefix second). GET with `timeout: 15000`; auth headers are attached only
 * when the URL is backend-hosted (`usesBackendStorage`). Never throws. On
 * failure it `console.warn`s the URL + reason and resolves
 * `{ data: undefined, networkFailure }` where `networkFailure` is `true` only
 * when no HTTP response was received at all (`isNetworkClassFailure`); any
 * HTTP status — 4xx included — resolves `networkFailure: false` (the server
 * answered, so the failure is server-class).
 *
 * @param {Object} params
 * @param {string} params.storageUrl Absolute URL to fetch.
 * @param {string} [params.token]    Auth token, attached only for backend URLs.
 * @returns {Promise<{data: *, contentType: string|undefined, networkFailure: boolean}>}
 *   `{ data, contentType, networkFailure: false }` on success;
 *   `{ data: undefined, networkFailure }` on failure.
 */
async function getImageFromStorage({ storageUrl, token }) {
  console.log("getImageFromStorage");
  const config = usesBackendStorage(storageUrl)
    ? { headers: setStorageDownloadHeaders(token), timeout: 15000, responseType: 'arraybuffer' }
    : { timeout: 15000, responseType: 'arraybuffer' };
  const imageResult = await axios.get(storageUrl, config)
  .then((response) => {
    //console.log("imageData response, getImageFromStorage");
    return { data: response.data, contentType: response.headers?.['content-type'], networkFailure: false };
  }).catch((error) => {
    const reason = error?.response?.status ?? error?.code ?? error?.message ?? 'unknown';
    console.warn("getImageFromStorage failed", storageUrl, reason);
    // if "The specified key does not exist" -> send server image is not in aws -> error
    return { data: undefined, networkFailure: isNetworkClassFailure(error) };
  });
  return imageResult;
};

async function ensureDirExists() {
  Paths.cache.create({ idempotent: true, intermediates: true });
};

/**
 * Decode a downloaded storage payload (raw bytes, legacy base64 data-URL
 * text, or legacy `data:image/` ASCII ArrayBuffer) and persist it to the
 * cache dir as a file. Writes `<filename>.<ext>` under `Paths.cache` and
 * returns its `file://` uri. The extension comes from the response
 * `Content-Type` header when it names a known image type, otherwise from the
 * sniffed magic bytes (legacy data-URL prefix as last resort). Returns
 * `false` when the payload does not decode (caller treats falsy as "skip
 * this image"). Does not throw.
 *
 * @param {*}        imageData    Downloaded payload from `getImageFromStorage`.
 * @param {string}   [contentType] Response `Content-Type` header.
 * @param {string}   filename     Filename stem (no extension).
 * @returns {Promise<string|false>} The written file's `file://` uri, or `false`.
 */
async function extractImageFile(imageData, contentType, filename) {
  console.log("extract image file filename", filename);

  const decoded = decodeImagePayload(imageData, contentType);
  if (!decoded) {
    console.log(`${filename}: imageData did not decode`);
    // send server error
    return false;
  };

  // Create a new file path
  await ensureDirExists();
  const imageFile = new File(Paths.cache, `${filename}.${decoded.extension}`);
  imageFile.write(decoded.base64, { encoding: 'base64' });

  return imageFile.uri;

};

/**
 * Fetch one image's bytes and decode to a cached `file://` path. Composes
 * `getImageFromStorage` → `extractImageFile`. Does not throw. Resolves
 * `{ filePath, networkFailure }`: `filePath` is the cached file uri on
 * success, or `false` when the image did not decode — either the fetch
 * failed, or HTTP 200 returned a non-decodable payload (`extractImageFile`
 * false), which stays server-class because the fetch itself succeeded
 * (success path carries `networkFailure: false`). `networkFailure` is
 * meaningful only when `filePath` is falsy.
 *
 * @param {Object} image Metadata row with at least `storage_url` and `name`.
 * @param {string} token Auth token forwarded to `getImageFromStorage`.
 * @returns {Promise<{filePath: string|false, networkFailure: boolean}>}
 */
async function handleImagesDownload(image, token) {
  console.log("handleImagesDownload");
  console.log("image location", image.storage_url);
  const { data, contentType, networkFailure } = await getImageFromStorage({ storageUrl: image.storage_url, token: token });
  const filePath = await extractImageFile(data, contentType, image.name);
  return { filePath, networkFailure };
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
 * not short-circuit). Per-image failures resolve with a falsy `filePath` and
 * are dropped from `images`; `sawNetworkFailure` aggregates whether ANY
 * per-image failure was network-class (no HTTP response at all, per
 * `isNetworkClassFailure`), so the caller can distinguish a server-broken
 * batch from a dead transport.
 *
 * @param {Array<Object>} imagesInfosData Batch of metadata rows.
 * @param {string}        token           Auth token for `getImageFromStorage`.
 * @returns {Promise<{images: Array<Object>, sawNetworkFailure: boolean}>}
 *   `images` holds only the successfully built `Image` objects;
 *   `sawNetworkFailure` is `true` when at least one failed download received
 *   no HTTP response.
 */
async function downloadImageBatch(imagesInfosData, token) {
  let sawNetworkFailure = false;
  const downloadedImages = await Promise.all(
    imagesInfosData.map(async (image) => {
      const { filePath, networkFailure } = await handleImagesDownload(image, token);

      if (!filePath) {
        if (networkFailure) {
          sawNetworkFailure = true;
        }
        return null;
      }

      return buildImageObject(image, filePath);
    })
  );

  return { images: downloadedImages.filter(Boolean), sawNetworkFailure };
}


/**
 * Main feed entry. Resolves one playable batch of images for the public feed
 * (private scopes are delegated to `fetchPrivateFeedPageForGame`).
 *
 * Bounded retry loop over metadata batches. Each iteration:
 *   1. fetch metadata (`getImagesInfos` for the head / `getNextImagesInfos`
 *      for an "after cursor" batch keyed by the previous tail `name`);
 *   2. early returns: `data === null` → `{ isError: true, reason }`;
 *      `data === 401` → auth error (no 'auth' `reason`; global apiClient
 *      unauthorized handler owns logout/nav out-of-band);
 *      empty `imagesInfosData.length === 0` → `{ isError: false, reason:'empty',
 *      images: [] }` BEFORE any cursor write;
 *   3. download the batch (`downloadImageBatch`), then a three-way contract:
 *      - ≥1 image downloaded → CURSOR ADVANCE (`saveLastImageUuid`) AFTER the
 *        download, then return `{ isError: false, images }`;
 *      - 0 downloaded AND ≥1 failure network-class (no HTTP response at all:
 *        timeout, ERR_NETWORK, conn refused) → NO cursor write, NO retry —
 *        the batch is unproven so the cursor stays put for the next attempt,
 *        and retrying through the same dead transport would hammer it;
 *        return `{ isError: true, reason: 'network' }`;
 *      - 0 downloaded, all failures server-class (HTTP 4xx/5xx received, or
 *        HTTP 200 non-base64 payload) → "broken batch": CURSOR ADVANCE so the
 *        cursor never freezes on permanently missing files,
 *        `skippedBrokenBatches += 1`, loop continues (bounded: at most
 *        `MAX_EMPTY_DOWNLOAD_BATCHES` = 3 skips, then terminal
 *        `{ isError: true, reason: 'server' }`).
 *
 * @param {string|null} pictureId Cursor: `name` of the last image of the
 *   previous page, or `null` for the first page.
 * @param {Object}      context   Auth context (forwarded to `getBackendHeaders`).
 * @param {Object}      [filters] Optional `{ category_id, language, category_key, scope }`.
 * @param {Object}      [opts]    Optional `{ persistCursor }` — transport flag;
 *   `false` suppresses every `saveLastImageUuid` cursor write (head-replay
 *   guard, Fix 2a). Defaults to `true` (cursor advances as before).
 * @returns {Promise<GetImagesResult>}
 */
// SRP tradeoff (Fix 2a, plan §2.5): `persistCursor` is a transport-persistence
// concern riding this request function. Splitting cursor persistence out of
// getImages was reviewed and deferred — the flag stays until that refactor.
export async function getImages(pictureId, context, filters = {}, opts = {}) {
  console.log("getImages");
  console.log("getImages pictureId", pictureId);
  const { persistCursor = true } = opts;

  if (isPrivateScope(filters?.scope)) {
    // Private cursor namespace: PRIVATE filters carry no category_key (server
    // contract stays category_id), so derive the LOCAL cursor category segment
    // from the category id (or 'all'). cardDeck.fetchCardBatch reads the
    // cursor with the same categoryKey value, so the private cursor
    // round-trips. Persistence itself is GROUP-SCOPED (F1/F2):
    // fetchPrivateFeedPageForGame threads { kind: 'private', groupId } into
    // saveLastImageUuid, landing at `groupFeed:<gid>:game:<cat>:<lang>:cursor`
    // — never the shared public `lastImageUuid:*` namespace.
    return fetchPrivateFeedPageForGame(pictureId, context, {
      groupId: filters.scope.groupId,
      categoryId: filters?.category_id,
      language: filters?.language,
      categoryKey: filters?.category_key ?? filters?.category_id ?? 'all',
      persistCursor,
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
    const { images, sawNetworkFailure } = await downloadImageBatch(imagesInfosData, token);

    if (images.length > 0) {
      if (persistCursor) {
        await saveLastImageUuid(lastBatchPictureId, filters?.category_key, filters?.language);
      }
      return { isError: false, images: images };
    }

    if (sawNetworkFailure) {
      return {
        isError: true,
        reason: 'network',
        title: "There is an error downloading user's images.",
        message: "Please retry later..."
      };
    }

    if (persistCursor) {
      await saveLastImageUuid(lastBatchPictureId, filters?.category_key, filters?.language);
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
  const requestMethod = (plan?.method || 'PUT').toUpperCase();

  if (!BINARY_UPLOAD_METHODS.includes(requestMethod)) {
    const title = errorType(500);

    return {
      status: 500,
      title: title,
      message: `Unsupported upload method: ${plan?.method}`,
    };
  };

  const headers = setUploadHeaders({ plan, fileExtension, contentLength, token });
  console.log("performImageUpload", plan?.image_key);

  try {
    const uploadFile = new File(fileUrl);

    if (!uploadFile.exists) {
      throw new Error('Selected image file is no longer available.');
    }

    console.log("upload file bytes", plan?.image_key, uploadFile.size);

    const response = await uploadFile.upload(plan.url, {
      httpMethod: requestMethod,
      uploadType: UploadType.BINARY_CONTENT,
      headers: headers,
    })
      .then((response) => {
        if (response.status === 200) {
          console.log("binary img upload ok", plan?.image_key);
        } else {
          console.log("binary img upload non-200", plan?.image_key, response.status);
        };
        return response;
      })
      .catch((error) => {
        console.log("error binary img upload", error);
        console.log("message", error.message);
          return {
            status: error?.response?.status ?? error?.request?.status,
            message: error.message,
            data: error?.response?.data,
          };
      });

        const title = response.status === 200 ? "" : errorType(response.status);

    return { status: response.status, title: title, message: response.message ?? response.body };

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
