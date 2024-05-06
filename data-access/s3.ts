import { S3 } from "aws-sdk";

const s3 = new S3({
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY,
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_KEY,
  region: process.env.EXPO_PUBLIC_S3_BUCKET_REGION,
});
const bucket = process.env.EXPO_PUBLIC_S3_BUCKET_NAME ?? "";

export const getSnaps = async (startAfter?: string) => {
  const params: S3.Types.ListObjectsV2Request = {
    Bucket: bucket,
  };

  if (startAfter) {
    params.StartAfter = startAfter;
  }

  try {
    // TODO: pagination
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents;
  } catch (error) {
    console.error("Error fetching snaps:", error);
  }
};

export const getSnapUrl = (key: string) => {
  const params = {
    Bucket: bucket,
    Key: key,
  };

  try {
    return s3.getSignedUrlPromise("getObject", params);
  } catch (error) {
    console.error("Error fetching URL:", error);
  }
};

export const uploadSnap = async (uri: string, key: string) => {
  const imgResponse = await fetch(uri);
  const imgBuffer = await imgResponse.arrayBuffer();

  const params: S3.Types.PutObjectRequest = {
    Bucket: bucket,
    Key: key,
    Body: new Uint8Array(imgBuffer),
    ContentType: "image/jpg",
  };

  try {
    return s3.upload(params).promise();
  } catch (error) {
    console.error("Error uploading snap:", error);
  }
};
