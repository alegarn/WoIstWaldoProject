import axios from "axios";
import * as FileSystem from 'expo-file-system';
import Image from "../models/image";
import { getBackendHeaders } from "./auth";

function setHeaders({ token, uid, expiry, access_token, client }) {
  const headers = {
    Authorization: token,
    HTTP_AUTHORIZATION: token,
    "access-token": access_token,
    client: client,
    expiry: expiry,
    uid: uid,
    "token-type": "Bearer",
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "*/*",
  };
  return headers;
};

function setAWSHeaders(fileExtension, contentLength) {

  const headers = {
    "Content-Type": "image/" + fileExtension,
    "Content-Length": contentLength
  };
  return headers;
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


export async function getUploadUrl() {
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/aws_requests/get_secure_upload_url`;
  const { token, uid, expiry, access_token, client } = await getBackendHeaders();
  const headers = setHeaders({ token, uid, expiry, access_token, client });
  const config = {
    headers: headers,
  };

  const response = await axios
    .get(url, config)
    .then((response) => {
      return response;
    }).catch((error) => {
      console.log("error getUploadUrl", error);
      return { status: error.request.status, message: error.message};
    });

  const title = errorType(response.status);

  return { status: response.status, title: title, message: response.message, data: response.data};
};



async function getImagesInfos({ config, userId }) {
  console.log("getImagesInfos");
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/get_image_batch`;
  const response = await axios.get(url, config).then((response) => {
    console.log("response getImagesInfos", response);
    return response;
  }).catch((error) => {
    console.log("error getImagesInfos", error.request);
    return null;
  });
  return response;
};

async function getNextImagesInfos({ config, userId, pictureId }){
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/serve_next_image_batch`;
  const imageData = {
    image: {
      name: pictureId
    }
  };
  const response = await axios.post(url, imageData, config )
    .then((response) => {
      console.log("response getNextImagesInfos", response);
      return response;
    }).catch((error) => {
      console.log("error getNextImagesInfos", error.request);
      return error;
    });
  return response;
};

async function getImageFromStorage({ storageUrl }) {
  console.log("getImageFromStorage");
  const imageData = await axios.get(storageUrl, {})
  .then((response) => {
    console.log("imageData response, getImageFromStorage");
    return response.data;
  }).catch((error) => console.log("error getImageFromStorage", error.request));

  return imageData;
};

function verifyItsBase64(imageData) {
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,/;

  if (base64Regex.test(imageData)) {
    // Extract the base64 data
    const base64Data = imageData.replace(base64Regex, '');
    console.log("base64Data.substring(0, 100)", base64Data.substring(0, 100));
    return base64Data;
  } else {
    console.log('The string is not a base64 image.');
    return false;
  };
};

async function ensureDirExists() {
  console.log("ensureDirExists");
  const dirPath = FileSystem.cacheDirectory //+ "/images-v1";
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    console.log("Image directory doesn't exist, creating...");
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  };
  console.log("ensureDirExists end");
};

async function extractBase64(imageData, filename) {
  console.log("extract base64");

  const base64Data = verifyItsBase64(imageData);
  if (!base64Data) {
    console.log(`${filename}: imageData is not base64`);
    return false;
  };

  const extension_matche = imageData.match(/^data:image\/(\w+);base64,/);
  const fileExtension = extension_matche[1];
  console.log("fileExtension", fileExtension);

  // Create a new file path
  const filePath = FileSystem.cacheDirectory + `${filename}.${fileExtension}`; // images-v1/ .${fetchedType} ?

  console.log("filePath", filePath);

  await ensureDirExists();

  // Write the base64 data to the file
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;

};

async function handleImagesDownload(image) {
  console.log("handleImagesDownload");
  console.log("image location", image.storage_url);
  const imageData = await getImageFromStorage({ storageUrl: image.storage_url });
  const filePath = await extractBase64(imageData, image.name);
  return filePath;
};


export async function getImages(pictureId = null) {
  console.log("getImages");
  const { token, uid, expiry, access_token, client, userId } = await getBackendHeaders();
  const headers = setHeaders({ token, uid, expiry, access_token, client });

  const config = {
    headers: headers,
  };

  let imagesInfos = {};

  if (pictureId === null) {
    imagesInfos = await getImagesInfos({ config, userId });
  };

  if (pictureId !== null) {
    imagesInfos = await getNextImagesInfos({ config, userId, pictureId })
  };

  const images = [];

  const isError = await Promise.allSettled(
    imagesInfos.data.images.map( async image => {
      const filePath = await handleImagesDownload(image);
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
    console.log("Files downloaded successfully");
    return { isError: false };
  }).catch((error) => {
    console.log("error", error.request);
    return { isError: true, error: error.request};
  });

  if (isError.isError === true ) {
    return { isError: true, title: "There is an error, please retry later", message: isError?.error };
  };


  // Now you can use the file path to display the image
  console.log('File saved to', images[0].imageFile);
  return { isErorr: false, images: images };

  /*  */

  /* file system */
  /* async function downloadImage(uri, filename) {
    let fileUri = FileSystem.cacheDirectory + filename;
    let options = {};
    await FileSystem.downloadAsync(uri, fileUri, options)
      .then(({ uri }) => {
        console.log('Finished downloading to ', uri);
      })
      .catch(error => {
        console.error(error);
      });
      return fileUri;
  }; */

  // Usage
  let fileUri = await downloadImage(response.data.url, `images-v1/${filename}`);
  console.log("fileUri", fileUri);
  /*  */



  /* Base64 reading */
  // Extract the base64 data
  /* let options = { encoding: FileSystem.EncodingType.Base64 };
  const file = FileSystem.readAsStringAsync(fileUri, options).then(data => {
              const base64 = 'data:image/jpeg;base64' + data;
              console.log("base64 done");
              return base64; // are you sure you want to resolve the data and not the base64 string?
          }).catch(err => {
              console.log("​getFile -> err", err);
              reject(err) ;
          });

  console.log("file", file); */
  /*  */

  return fileUri;
};


  /* https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/
  CORS and using pre-signed process.env.EXPO_PUBLIC_APP_BACKEND_URLs in the browser
*/

/* binary, with content-length multipart/form-data */
/* https://www.nicesnippets.com/blog/how-to-upload-image-to-server-using-axios-in-react-native */

/* https://repost.aws/knowledge-center/s3-presigned-url-signature-mismatch */

/*  How to view raw HTTP request and response in Postman
https://www.youtube.com/watch?v=eM1-YTBUFj4 */


export async function saveImageToAws({ url, filename, fileUrl, fileExtension, contentLength}) {

  const headers = setAWSHeaders(fileExtension, contentLength);
  console.log("saveImageToAws", filename);


  const config = {
    headers: headers,
  };

  console.log("fileUrl", fileUrl);

  try {

    console.log("saveImageToAws2", url);
    const base64 = await FileSystem.readAsStringAsync(fileUrl, { encoding: 'base64' });
    /* error */
    const response = await axios
      .put(url, `data:image/${fileExtension};base64,` + base64 , config )
      .then((response) => {
        if (response.status === 200) {
          console.log("post img base64 ok", response);
        };
        return response;
      })
      .catch((error) => {
        console.log("error axios img base64 upload", error);
        console.log("message", error.message);
        return error;
      });

      const title = errorType(response.status);

    return { status: response.status, title: title, message: response.message };

  } catch (error) {
    const title = errorType(error?.request?.status);
    return {
      status: error?.request?.status,
      title: title,
      message: `Your file might not exist anymore but should be uploaded. You can continue to play. \nError:  ${error?.message }` };
  };

};



export async function saveImageInfos({ userId, imagesInfos, token, uid, expiry, access_token, client }) {
  const url = `${process.env.EXPO_PUBLIC_APP_BACKEND_URL}api/v1/users/${userId}/images`;
  const headers = setHeaders({ token, uid, expiry, access_token, client });
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
    console.log("error", error);
    return {
      status: error.request.status,
      message: error.message
    };
  });
  const title = errorType(response.status);
return { status: response.status, title: title, message: response.message };
};


/* https://stackoverflow.com/questions/72020052/upload-image-with-expo-fetch */
/* const createFormData = (uri) => {
  const fileName = uri.split('/').pop();
  const fileType = fileName.split('.').pop();
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: `image/${fileType}`
  });

  return formData;
} */


/* https://nickjones.tech/buffer-blob-managed-expo/ */
