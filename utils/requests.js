import axios from "axios";
import * as FileSystem from 'expo-file-system';

const URL = "https://2889-103-182-81-19.ngrok-free.app/";

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

function setAWSHeaders(fileType, contentLength) {

  const headers = {
    "Content-Type": "image/" + fileType,
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


export async function getUploadUrl({ token, uid, expiry, access_token, client }) {
  const url = `${URL}api/v1/aws_requests/get_secure_upload_url`;
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

export async function getImages({
                          token,
                          uid,
                          userId,
                          expiry,
                          access_token,
                          client,
                        }) {
  const url = `${URL}api/v1/aws_requests/get_secure_download_url`;


  const headers = setHeaders({ token, uid, expiry, access_token, client });

  const config = {
    headers: headers,
  };

  //console.log("getImages", headers);

  const response = await axios
    .get(url, config)
    .then((response) => {
/*       console.log("get", response);
 */
      return response;
    })
    .catch((error) => {
      console.log("error", error);
      return error;
    });

  const filename = response.data.filename;


  const imageData = await axios.get(response.data.url, {})
  .then((response) => {
    console.log("imageData response");
    return response.data;
  }).catch((error) => console.log("error", error));

  // extract base64

  console.log(imageData.substring(0, 100));
  const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,/;
  let base64Data = "";
  if (base64Regex.test(imageData)) {
    // Extract the base64 data
    base64Data = imageData.replace(base64Regex, '');
    console.log(base64Data.substring(0, 100));
  } else {
    console.log('The string is not a base64 image.');
    return;
  };




   // Create a new file path
  const filePath = FileSystem.cacheDirectory + `/fetched-images/${filename}`; // .${fetchedType} ?
  console.log("filePath", filePath);


  const dirPath = FileSystem.cacheDirectory + "/fetched-images" ;
  FileSystem.getInfoAsync(dirPath);

  FileSystem.makeDirectoryAsync(dirPath, true);







  // Write the base64 data to the file
  await FileSystem.writeAsStringAsync(filePath, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Now you can use the file path to display the image
  console.log('File saved to', filePath);
  return filePath;

  /*  */

  /* file system */
  async function downloadImage(uri, filename) {
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
  };

  // Usage
  let fileUri = await downloadImage(response.data.url, response.data.filename)
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
  CORS and using pre-signed URLs in the browser
*/

/* binary, with content-length multipart/form-data */
/* https://www.nicesnippets.com/blog/how-to-upload-image-to-server-using-axios-in-react-native */

/* https://repost.aws/knowledge-center/s3-presigned-url-signature-mismatch */

/*  How to view raw HTTP request and response in Postman
https://www.youtube.com/watch?v=eM1-YTBUFj4 */


export async function saveImageToAws({ url, filename, fileUrl, fileType, contentLength}) {

  const headers = setAWSHeaders(fileType, contentLength);
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
      .put(url, `data:image/${fileType};base64,` + base64 , config )
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
  const url = `${URL}api/v1/users/${userId}/images`;
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
