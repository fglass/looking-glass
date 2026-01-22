import { S3 } from "aws-sdk";
import {
  CAPTION_TAG_KEY,
  parseCaptionTag,
  serializeCaptionTag,
  SnapCaption,
} from "../utils";

const s3 = new S3({
  accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY,
  secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_KEY,
  region: process.env.EXPO_PUBLIC_S3_BUCKET_REGION,
  maxRetries: 3,
  httpOptions: { connectTimeout: 5000, timeout: 60_000 },
});

const BUCKET = process.env.EXPO_PUBLIC_S3_BUCKET_NAME ?? "";

export const getSnaps = async (startAfter?: string) => {
  const params: S3.Types.ListObjectsV2Request = {
    Bucket: BUCKET,
    Prefix: "snap",
    MaxKeys: 1000,
  };

  if (startAfter) {
    params.StartAfter = startAfter;
  }

  const snaps = [];

  while (true) {
    try {
      const data = await s3.listObjectsV2(params).promise();

      if (data.Contents) {
        snaps.push(...data.Contents);
      }

      if (!data.IsTruncated) {
        break;
      }

      params.ContinuationToken = data.NextContinuationToken;
    } catch (error) {
      console.error("Error fetching snaps:", error);
    }
  }

  return snaps;
};

export const getSnapUrl = (key: string) => {
  const params = { Bucket: BUCKET, Key: key };

  try {
    return s3.getSignedUrlPromise("getObject", params);
  } catch (error) {
    console.error("Error fetching URL:", error);
  }
};

export const uploadSnap = async (key: string, uri: string) => {
  const imgResponse = await fetch(uri);
  const imgBuffer = await imgResponse.arrayBuffer();

  const params: S3.Types.PutObjectRequest = {
    Bucket: BUCKET,
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

export const uploadSnapCaption = async (
  snapKey: string,
  caption: SnapCaption
) => {
  const captionValue = serializeCaptionTag(caption);
  if (!captionValue) {
    return;
  }

  const params: S3.Types.GetObjectTaggingRequest = {
    Bucket: BUCKET,
    Key: snapKey,
  };

  try {
    const currentTags = await s3.getObjectTagging(params).promise();
    const updatedTagSet = [
      ...(currentTags.TagSet?.filter((tag) => tag.Key !== CAPTION_TAG_KEY) ??
        []),
      { Key: CAPTION_TAG_KEY, Value: captionValue },
    ];

    await s3
      .putObjectTagging({
        Bucket: BUCKET,
        Key: snapKey,
        Tagging: { TagSet: updatedTagSet },
      })
      .promise();
  } catch (error) {
    console.error("Error uploading caption:", error);
  }
};

export const getSnapCaption = async (snapKey: string) => {
  const params: S3.Types.GetObjectTaggingRequest = {
    Bucket: BUCKET,
    Key: snapKey,
  };

  try {
    const data = await s3.getObjectTagging(params).promise();
    const captionTag = data.TagSet?.find((tag) => tag.Key === CAPTION_TAG_KEY);
    if (!captionTag?.Value) {
      return null;
    }
    return parseCaptionTag(captionTag.Value);
  } catch (error) {
    return null;
  }
};

export const getSnapReactions = async (key: string) => {
  const params: S3.Types.GetObjectTaggingRequest = {
    Bucket: BUCKET,
    Key: key,
  };

  try {
    const data = await s3.getObjectTagging(params).promise();
    const reactionTag = data.TagSet?.find((tag) => tag.Key === "reaction");
    if (!reactionTag?.Value) {
      return [];
    }

    return reactionTag.Value.split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return [];
  }
};

export const addSnapReactionTag = async (key: string, reaction: string) => {
  const params: S3.Types.GetObjectTaggingRequest = {
    Bucket: BUCKET,
    Key: key,
  };

  try {
    const currentTags = await s3.getObjectTagging(params).promise();
    const existingReactionTag = currentTags.TagSet?.find(
      (tag) => tag.Key === "reaction"
    );

    const reactions = existingReactionTag?.Value
      ? existingReactionTag.Value.split(",")
          .map((token) => token.trim())
          .filter((token) => token.length > 0)
      : [];

    let updated = false;
    if (!reactions.includes(reaction)) {
      reactions.push(reaction);
      updated = true;
    }

    if (!updated && existingReactionTag) {
      return;
    }

    const reactionValue = reactions.join(",");
    const updatedTagSet = [
      ...(currentTags.TagSet?.filter((tag) => tag.Key !== "reaction") ?? []),
      { Key: "reaction", Value: reactionValue },
    ];

    await s3
      .putObjectTagging({
        Bucket: BUCKET,
        Key: key,
        Tagging: { TagSet: updatedTagSet },
      })
      .promise();
  } catch (error) {
    console.error("Error updating reaction tag:", error);
  }
};

export const getAllTokens = async () => {
  const params: S3.Types.ListObjectsV2Request = {
    Bucket: BUCKET,
    Prefix: "token",
  };

  try {
    // TODO: paginate
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents;
  } catch (error) {
    console.error("Error fetching tokens:", error);
  }
};

export const uploadToken = async (key: string, token: string) => {
  const params: S3.Types.PutObjectRequest = {
    Bucket: BUCKET,
    Key: key,
    Body: token,
    ContentType: "text/plain",
  };

  try {
    return s3.upload(params).promise();
  } catch (error) {
    console.error("Error uploading token:", error);
  }
};
