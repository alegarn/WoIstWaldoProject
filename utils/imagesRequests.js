import axios from "axios";
import * as FileSystem from 'expo-file-system';
import Image from "../models/image";
import { setHeaders, getBackendHeaders } from "./auth";
import { saveLastImageUuid } from "./storageDatum";

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

function setStorageDownloadHeaders(token) {
  return {
    Authorization: token,
    HTTP_AUTHORIZATION: token,
  };
};

function usesBackendStorage(storageUrl) {
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



async function getImagesInfos({ config, userId }) {
  //console.log("getImagesInfos");
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_image_batch`;
  const response = await axios.get(url, config).then((response) => {
    //console.log("response getImagesInfos", response);
    return response;
  }).catch((error) => {
    //console.log("error getImagesInfos", error.request);
    if (error.request.status === 401) {
      return { data: 401 };
    };
    return { data: null };
  });
  return response;
};

async function getNextImagesInfos({ config, userId, pictureId }){
  //console.log("getNextImagesInfos");
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/next_image_batch`;
  const imageData = {
    image: {
      name: pictureId
    }
  };
  const response = await axios.post(url, imageData, config )
    .then((response) => {
      //console.log("response getNextImagesInfos", response);
      return response;
    }).catch((error) => {
      console.log("error getNextImagesInfos", error.request);
      return error;
    });
  return response;
};

async function getImageFromStorage({ storageUrl, token }) {
  console.log("getImageFromStorage");
  const config = usesBackendStorage(storageUrl) ? { headers: setStorageDownloadHeaders(token) } : {};
  const imageData = await axios.get(storageUrl, config)
  .then((response) => {
    //console.log("imageData response, getImageFromStorage");
    return response.data;
  }).catch((error) => console.log("error getImageFromStorage", error.request));
  // if "The specified key does not exist" -> send server image is not in aws -> error
  return imageData;
};

function verifyItsBase64(imageData) {
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
  //console.log("ensureDirExists");
  const dirPath = FileSystem.cacheDirectory //+ "/images-v1";
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    console.log("Image directory doesn't exist, creating...");
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  };
  //console.log("ensureDirExists end");
};

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
  const filePath = FileSystem.cacheDirectory + `${filename}.${fileExtension}`; // images-v1/ .${fetchedType} ?

  //console.log("filePath", filePath);

  await ensureDirExists();

  // Write the base64 data to the file
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;

};

async function handleImagesDownload(image, token) {
  console.log("handleImagesDownload");
  console.log("image location", image.storage_url);
  const imageData = await getImageFromStorage({ storageUrl: image.storage_url, token: token });
  const filePath = await extractBase64(imageData, image.name);
  return filePath;
};


export async function getImages(pictureId, context) {
  console.log("getImages");
  console.log("getImages pictureId", pictureId);

  const { token, userId } = await getBackendHeaders(context);
  const headers = setHeaders({ token });

  const config = {
    headers: headers,
  };

  // let imagesInfos = handleGetImagesInfos(pictureId, config, userId )
  // return { images: imagesInfos, isError: false, title: "", message: "" };
  let imagesInfos = {};

  if (pictureId === null) {
    imagesInfos = await getImagesInfos({ config, userId });
  };

  if (pictureId !== null) {
    imagesInfos = await getNextImagesInfos({ config, userId, pictureId })
  };

  if (imagesInfos?.data === null) {
    return { isError: true, title: "There is an error downloading user's images.", message: "Please retry later..." };
  };

  if (imagesInfos?.data === 401) {
    return { isError: true, title: "There is an authentication error.", message: "Please reconnect" };
  };

  if (imagesInfos.data?.data?.length === 0) {
    return { isError: false, images: [] };
  };

  const images = [];

  const isError = await Promise.allSettled(
    // create an array [Image object, ] 
    // the Image object contains the path, with the informations, to the image 
    imagesInfos?.data?.data?.map( async image => {
      const filePath = await handleImagesDownload(image, token);
      if (filePath !== false) {
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
        images.push(imageObject);
      };
      if (filePath === false) {
        throw new Error({request: "Their is an error downloading user's images."});
      };
    }
  )).then(() => {
    //console.log("Files downloaded successfully");
    return { isError: false };
  }).catch((error) => {
    console.log("isError catch error", error.request);
    return { isError: true, error: error.request };
  });

  const imagesInfosData = imagesInfos?.data?.data;
  await saveLastImageUuid(imagesInfosData[imagesInfosData.length - 1].name);

  if (isError.isError === true ) {
    console.log("isError.isError", isError);
    return { isError: true, title: "There is an error, please retry later", message: isError?.error };
  };

  // Now you can use the file path to display the image
  //console.log('File saved to', images[0].imageFile);
  return { isError: false, images: images };
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

    const base64 = await FileSystem.readAsStringAsync(fileUrl, { encoding: 'base64' });
    const response = await requestWithMethod(plan.url, `data:image/${fileExtension};base64,` + base64, config)
      .then((response) => {
        if (response.status === 200) {
          console.log("post img base64 ok", response);
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
