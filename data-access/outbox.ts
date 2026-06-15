import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import {
  getAllTokens,
  uploadSnap,
  uploadSnapCaption,
  uploadSnapLocation,
} from "./s3";
import { sendPushNotifications } from "./notification";
import { SnapCaption, SnapLocation } from "../utils";

const OUTBOX_STORAGE_KEY = "@lg_snap_send_outbox";
const OUTBOX_DIR_NAME = "snap-send-outbox";
const PENDING_SNAP_SENDS_QUERY_KEY = "pendingSnapSends";
const SNAP_UPLOAD_TIMEOUT_MS = 15_000;

export type QueuedSnapStatus = "pending" | "uploading" | "failed" | "sent";

export type QueuedSnap = {
  id: string;
  snapKey: string;
  localImageUri: string;
  hidden: boolean;
  caption?: SnapCaption | null;
  location?: SnapLocation | null;
  status: QueuedSnapStatus;
  attemptCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueSnapSendInput = {
  snapKey: string;
  imageUri: string;
  hidden: boolean;
  caption?: SnapCaption | null;
  location?: SnapLocation | null;
};

type OutboxStorageAdapter = {
  read: () => Promise<QueuedSnap[]>;
  write: (items: QueuedSnap[]) => Promise<void>;
  copyImage: (sourceUri: string, id: string) => Promise<string>;
  deleteImage: (uri: string) => Promise<void>;
};

export type ProcessPendingSnapSendsContext = {
  clientId: string;
  displayName: string;
  selfSend: boolean;
  onSent?: (item: QueuedSnap) => void | Promise<void>;
};

const defaultStorageAdapter: OutboxStorageAdapter = {
  read: async () => {
    const rawItems = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
    return rawItems ? JSON.parse(rawItems) : [];
  },
  write: async (items) => {
    await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
  },
  copyImage: async (sourceUri, id) => {
    const outboxDir = new Directory(Paths.document, OUTBOX_DIR_NAME);
    outboxDir.create({ intermediates: true, idempotent: true });

    const extension = Paths.extname(sourceUri) || ".jpg";
    const destination = new File(outboxDir, `${id}${extension}`);
    new File(sourceUri).copy(destination);
    return destination.uri;
  },
  deleteImage: async (uri) => {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      console.error("Error deleting queued snap image:", error);
    }
  },
};

let isProcessing = false;

export const pendingSnapSendsQueryKey = () => [PENDING_SNAP_SENDS_QUERY_KEY];

export const enqueueSnapSend = async (
  input: EnqueueSnapSendInput,
): Promise<QueuedSnap> => {
  const queuedId = generateQueuedSnapId();
  const localImageUri = await defaultStorageAdapter.copyImage(
    input.imageUri,
    queuedId,
  );
  const now = new Date().toISOString();
  const item: QueuedSnap = {
    id: queuedId,
    snapKey: input.snapKey,
    localImageUri,
    hidden: input.hidden,
    caption: input.caption ?? null,
    location: input.location ?? null,
    status: "pending",
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const items = await defaultStorageAdapter.read();
  await defaultStorageAdapter.write([...items, item]);
  return item;
};

export const processPendingSnapSends = async (
  context: ProcessPendingSnapSendsContext,
): Promise<void> => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const items = await defaultStorageAdapter.read();
    for (const item of items) {
      if (item.status === "sent") {
        continue;
      }
      await processQueuedSnapSend(item, context);
    }
  } finally {
    isProcessing = false;
  }
};

export const getQueuedSnapSends = async (): Promise<QueuedSnap[]> =>
  defaultStorageAdapter.read();

export const usePendingSnapSends = (): {
  pendingCount: number;
  failedCount: number;
} => {
  const { data } = useQuery({
    queryKey: pendingSnapSendsQueryKey(),
    queryFn: getQueuedSnapSends,
  });

  const items = data ?? [];
  return {
    pendingCount: items.filter(
      (item) => item.status === "pending" || item.status === "uploading",
    ).length,
    failedCount: items.filter((item) => item.status === "failed").length,
  };
};

const processQueuedSnapSend = async (
  item: QueuedSnap,
  context: ProcessPendingSnapSendsContext,
) => {
  const startedItem = await updateQueuedSnap(item.id, {
    status: "uploading",
    attemptCount: item.attemptCount + 1,
    lastError: undefined,
  });

  if (!startedItem) {
    return;
  }

  try {
    await withTimeout(
      uploadSnap(startedItem.snapKey, startedItem.localImageUri),
      SNAP_UPLOAD_TIMEOUT_MS,
      "Snap upload timed out",
    );

    // Once the snap is uploaded, metadata and notifications are best effort.
    await uploadMetadata(startedItem);
    await sendNotifications(startedItem, context);

    const sentItem =
      (await updateQueuedSnap(startedItem.id, {
        status: "sent",
        lastError: undefined,
      })) ?? startedItem;

    await removeQueuedSnap(sentItem.id);
    await defaultStorageAdapter.deleteImage(sentItem.localImageUri);
    await context.onSent?.(sentItem);
  } catch (error) {
    await updateQueuedSnap(item.id, {
      status: "failed",
      lastError: errorToMessage(error),
    });
  }
};

const uploadMetadata = async (item: QueuedSnap) => {
  try {
    if (item.location) {
      await uploadSnapLocation(item.snapKey, item.location);
    }
    if (item.caption?.text) {
      await uploadSnapCaption(item.snapKey, item.caption);
    }
  } catch (error) {
    console.error("Error uploading snap metadata:", error);
  }
};

const sendNotifications = async (
  item: QueuedSnap,
  context: ProcessPendingSnapSendsContext,
) => {
  try {
    const tokens = await getAllTokens();
    if (tokens.length === 0) {
      return;
    }

    await sendPushNotifications({
      tokens,
      notification: {
        title: context.displayName,
        body: "New Snap 🔍",
        badge: 1,
      },
      idToIgnore: !context.selfSend ? context.clientId : "",
    });
  } catch (error) {
    console.error("Error sending snap notifications:", error);
  }
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const updateQueuedSnap = async (
  id: string,
  patch: Partial<QueuedSnap>,
): Promise<QueuedSnap | undefined> => {
  const items = await defaultStorageAdapter.read();
  const itemIndex = items.findIndex((item) => item.id === id);
  if (itemIndex === -1) {
    return undefined;
  }

  const updatedItem = {
    ...items[itemIndex],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const nextItems = items.slice();
  nextItems[itemIndex] = updatedItem;
  await defaultStorageAdapter.write(nextItems);
  return updatedItem;
};

const removeQueuedSnap = async (id: string) => {
  const items = await defaultStorageAdapter.read();
  await defaultStorageAdapter.write(items.filter((item) => item.id !== id));
};

const generateQueuedSnapId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const errorToMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return `${error}`;
};
