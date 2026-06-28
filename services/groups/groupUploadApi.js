import axios from 'axios';
import { getBackendHeaders, setHeaders, mapRequestError } from '../../utils/auth';

function imagesUrl(groupId) {
  return `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/private_groups/${groupId}/images`;
}

function mapUploadKind(kind) {
  switch (kind) {
    case 'guess':
      return 'guess';
    case 'home-background':
    case 'button-background':
    case 'button-image':
    case 'category-thumbnail':
      return 'groupUi';
    default:
      return kind;
  }
}

export async function preparePrivateUpload({
  context,
  groupId,
  kind,
  fileExtension,
  contentType,
  contentLength,
  isHomeBackground,
  isButtonBackground,
  isButtonImage,
  isCategoryThumbnail,
  categoryId,
  description,
  imageHeight,
  imageWidth,
  screenHeight,
  screenWidth,
  isPortrait,
  xLocation,
  yLocation,
  language,
}) {
  const { token } = await getBackendHeaders(context);
  const config = { headers: setHeaders({ token }) };
  const privateImage = {
    kind: mapUploadKind(kind),
    file_extension: fileExtension,
    content_type: contentType,
    content_length: contentLength,
  };

  if (isHomeBackground) privateImage.is_home_background = true;
  if (isButtonBackground) privateImage.is_button_background = true;
  if (isButtonImage) privateImage.is_button_image = true;
  if (isCategoryThumbnail) privateImage.is_category_thumbnail = true;
  if (categoryId) privateImage.category_id = categoryId;
  if (description !== undefined) privateImage.description = description;
  if (imageHeight !== undefined) privateImage.image_height = imageHeight;
  if (imageWidth !== undefined) privateImage.image_width = imageWidth;
  if (screenHeight !== undefined) privateImage.screen_height = screenHeight;
  if (screenWidth !== undefined) privateImage.screen_width = screenWidth;
  if (isPortrait !== undefined) privateImage.is_portrait = isPortrait;
  if (xLocation !== undefined) privateImage.x_location = xLocation;
  if (yLocation !== undefined) privateImage.y_location = yLocation;
  if (language !== undefined) privateImage.language = language;

  const body = { private_image: privateImage };

  return axios.post(`${imagesUrl(groupId)}/presign`, body, config)
    .then((response) => {
      const payload = response.data?.data ?? {};

      return {
        status: response.status,
        data: {
          provider: payload.provider,
          method: payload.method ?? 'PUT',
          url: payload.url ?? payload.upload_url,
          headers: payload.headers ?? {},
          imageId: payload.image_id ?? payload.image?.id ?? payload.image_key,
          imageKey: payload.image_key ?? payload.image?.id ?? null,
          image: payload.image ?? null,
        },
      };
    })
    .catch(mapRequestError);
}
