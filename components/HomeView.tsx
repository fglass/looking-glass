import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, CameraType } from "expo-camera";
import * as Location from "expo-location";
import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-root-toast";
import {
  useClientId,
  useLastSnap,
  useDisplayName,
} from "../data-access/database";
import {
  getSnapUrl,
  getSnaps,
  uploadToken,
  addSnapReactionTag,
} from "../data-access/s3";
import {
  enqueueSnapSend,
  getQueuedSnapSends,
  pendingSnapSendsQueryKey,
  processPendingSnapSends,
} from "../data-access/outbox";
import { SnapView } from "./SnapView";
import { SnapPreview } from "./SnapPreview";
import GalleryView from "./GalleryView";
import SettingsView from "./SettingsView";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import {
  EventSubscription,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  setBadgeCountAsync,
} from "expo-notifications";
import {
  registerForPushNotifications,
  sendPushNotifications,
} from "../data-access/notification";
import {
  getSnapKey,
  getTokenFromSnapKey,
  getTokenKey,
  reactionTagFromEmoji,
  SnapCaption,
  SnapLocation,
} from "../utils";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { SetupView } from "./SetupView";
import { runOnJS } from "react-native-reanimated";

type Snap = { Key: string; LastModified: Date };

const GALLERY_QUERY_KEY = "fetchGallery";

const SNAP_SEND_RETRY_INTERVAL_MS = 15_000;
const SNAP_LOCATION_MAX_AGE_MS = 10 * 60_000;
const SNAP_LOCATION_REQUIRED_ACCURACY_METERS = 500;

export default function HomeView() {
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const [cameraType, setCameraType] = useState<CameraType>("back");

  const [preview, setPreview] = useState<{
    uri: string;
  } | null>(null);
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);
  const [selfSend, setSelfSend] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const clientId = useClientId();
  const { displayName } = useDisplayName();
  const isOnboarded = Boolean(displayName);

  const { lastSnap, setLastSnap } = useLastSnap();
  const [checkForNewSnaps, setCheckForNewSnaps] = useState(true);
  const [pendingSnaps, setPendingSnaps] = useState<Snap[]>([]);

  const [pushToken, setPushToken] = useState("");
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);

  const processSnapSendOutbox = useCallback(
    async (sendingToast?: unknown) => {
      if (!clientId || !displayName) {
        return;
      }

      let sendingToastHidden = false;
      const hideSendingToast = () => {
        if (sendingToast && !sendingToastHidden) {
          Toast.hide(sendingToast);
          sendingToastHidden = true;
        }
      };

      await processPendingSnapSends({
        clientId,
        displayName,
        selfSend,
        onSent: async (item) => {
          hideSendingToast();
          Toast.show(item.hidden ? "🔒 Snap sent!" : "Snap sent!", {
            duration: Toast.durations.LONG,
            position: Toast.positions.TOP,
          });

          queryClient.resetQueries({ queryKey: [GALLERY_QUERY_KEY] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });

      hideSendingToast();

      await queryClient.invalidateQueries({
        queryKey: pendingSnapSendsQueryKey(),
      });
    },
    [clientId, displayName, queryClient, selfSend],
  );

  function goToSettings() {
    setShowSettings(true);
  }

  function goToGallery() {
    setShowGallery(true);
  }

  function toggleCameraType() {
    setCameraType((current) => (current === "back" ? "front" : "back"));
  }

  const upFling = Gesture.Fling()
    .direction(Directions.UP)
    .onStart(() => runOnJS(goToSettings)());

  const rightFling = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onStart(() => runOnJS(goToGallery)());

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => runOnJS(toggleCameraType)());

  useEffect(() => {
    if (!isOnboarded) {
      return;
    }

    const requestLocationPermission = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          await Location.requestForegroundPermissionsAsync();
        }
      } catch (error) {
        console.error("Error requesting location permission:", error);
      }
    };

    requestLocationPermission();
  }, [isOnboarded]);

  useEffect(() => {
    if (!clientId || !Device.isDevice) {
      return;
    }

    console.log("Registering for notifications...");
    registerForPushNotifications()
      .then((token) => {
        setPushToken(token ?? "");
        if (token) {
          console.log("Uploading token...");
          uploadToken(getTokenKey(clientId, token), token)
            .then(() => console.log("Token upload successful"))
            .catch((error) => console.error("Error uploading token:", error));
        }
      })
      .catch((error: any) => setPushToken(`${error}`));

    notificationListener.current = addNotificationReceivedListener((n) => {
      console.log("Notification received:", n);
      setCheckForNewSnaps(true);
      queryClient.resetQueries({ queryKey: [GALLERY_QUERY_KEY] });
    });

    responseListener.current = addNotificationResponseReceivedListener(
      (resp) => {
        console.log("Notification interacted:", resp);
        setCheckForNewSnaps(true);
        queryClient.resetQueries({ queryKey: [GALLERY_QUERY_KEY] });
      },
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [clientId, queryClient]);

  useEffect(() => {
    const fetchNewSnaps = async (
      lastSnapKey: string | undefined,
      lastOpenedDate: Date,
    ) => {
      const snaps = await getSnaps(lastSnapKey);
      if (!snaps) {
        return;
      }
      const pendingSnaps: Snap[] = snaps
        .filter(
          (item) =>
            item.Key &&
            (selfSend || !item.Key.includes(clientId)) &&
            item.LastModified &&
            item.LastModified > lastOpenedDate,
        )
        .map((item) => ({ Key: item.Key!, LastModified: item.LastModified! }));
      setPendingSnaps(pendingSnaps);
      await setBadgeCountAsync(pendingSnaps.length);
    };
    if (checkForNewSnaps && clientId && lastSnap) {
      console.log("Checking for new snaps...");
      fetchNewSnaps(lastSnap.Key, lastSnap.LastModified);
      setCheckForNewSnaps(false);
    }
  }, [checkForNewSnaps, clientId, lastSnap, selfSend]);

  useEffect(() => {
    if (!clientId || !displayName) {
      return;
    }

    processSnapSendOutbox();
    const retryInterval = setInterval(
      processSnapSendOutbox,
      SNAP_SEND_RETRY_INTERVAL_MS,
    );
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        processSnapSendOutbox();
      }
    });

    return () => {
      clearInterval(retryInterval);
      subscription.remove();
    };
  }, [clientId, displayName, processSnapSendOutbox]);

  if (displayName === undefined) {
    return null;
  }

  if (!isOnboarded) {
    return <SetupView />;
  }

  function closeGallery() {
    setShowGallery(false);
    setCheckForNewSnaps(true);
  }

  if (showSettings) {
    return (
      <SettingsView
        pushToken={pushToken}
        selfSend={selfSend}
        setSelfSend={setSelfSend}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  if (showGallery) {
    return <GalleryView onClose={closeGallery} />;
  }

  if (preview) {
    return (
      <SnapPreview uri={preview.uri} onSend={sendSnap} onClose={closePreview} />
    );
  }

  if (openedSnap) {
    return (
      <SnapView
        key={openedSnap.key}
        snap={openedSnap}
        onReaction={async (reaction) => {
          const senderToken = getTokenFromSnapKey(openedSnap.key);
          await sendPushNotifications({
            tokens: [senderToken],
            notification: { title: displayName, body: reaction },
          });
          Toast.show(`${reaction} sent!`, {
            duration: Toast.durations.LONG,
            position: Toast.positions.TOP,
          });

          const reactionKey = reactionTagFromEmoji(reaction);
          if (reactionKey) {
            await addSnapReactionTag(openedSnap.key, reactionKey);
          }
        }}
        onClose={closeOpenedSnap}
      />
    );
  }

  async function takeSnap() {
    if (!cameraRef.current) {
      console.error("No camera");
      return;
    }

    const snap = await cameraRef.current.takePictureAsync({
      quality: 0.5,
      imageType: "jpg",
      mirror: true,
    });

    if (!snap) {
      console.error("No snap taken");
      return;
    }

    setPreview({ uri: snap.uri });
  }

  async function getCurrentSnapLocation(): Promise<SnapLocation | null> {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        return null;
      }

      const recentLocation = await Location.getLastKnownPositionAsync({
        maxAge: SNAP_LOCATION_MAX_AGE_MS,
        requiredAccuracy: SNAP_LOCATION_REQUIRED_ACCURACY_METERS,
      });

      const location =
        recentLocation ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: false,
        }));

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error("Error fetching location:", error);
      return null;
    }
  }

  // Send flow:
  // - Copy the preview into the persisted outbox
  // - Close the preview after the snap is durably queued
  // - Try to upload immediately, leaving failures queued for retry
  // - Retry queued sends on app launch, foreground, and interval ticks
  async function sendSnap({
    hidden,
    caption,
  }: {
    hidden: boolean;
    caption?: SnapCaption | null;
  }) {
    if (!preview) {
      console.error("No snap to send");
      return;
    }

    const prevToast = Toast.show("Sending snap...", {
      duration: 30_000,
      position: Toast.positions.TOP,
    });

    try {
      console.log("Getting location...");
      const location = await getCurrentSnapLocation();

      console.log("Queueing snap...");
      const queuedSnap = await enqueueSnapSend({
        snapKey: getSnapKey(clientId, pushToken, hidden),
        imageUri: preview.uri,
        hidden,
        caption,
        location,
      });

      closePreview();
      await queryClient.invalidateQueries({
        queryKey: pendingSnapSendsQueryKey(),
      });

      await processSnapSendOutbox(prevToast);

      const queuedItems = await getQueuedSnapSends();
      if (queuedItems.some((item) => item.id === queuedSnap.id)) {
        Toast.show("Failed to send snap. Trying again later...", {
          duration: Toast.durations.LONG,
          position: Toast.positions.TOP,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      Toast.hide(prevToast);
      console.error("Error queueing snap:", error);
      Toast.show("Failed to send snap.", {
        duration: Toast.durations.LONG,
        position: Toast.positions.TOP,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  async function openNextSnap() {
    const snap = pendingSnaps[0];
    const url = await getSnapUrl(snap.Key);

    if (url) {
      setOpenedSnap({ key: snap.Key, uri: url });
      setPendingSnaps(pendingSnaps.slice(1));
      setLastSnap(snap);
    }
  }

  function closePreview() {
    setPreview(null);
    setCheckForNewSnaps(true);
  }

  async function closeOpenedSnap() {
    if (pendingSnaps.length > 0) {
      await openNextSnap();
    } else {
      setOpenedSnap(null);
      setCheckForNewSnaps(true);
    }
  }

  return (
    <GestureDetector gesture={Gesture.Race(rightFling, upFling, doubleTap)}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraType}
          selectedLens={cameraType === "front" ? "Front Camera" : "Back Camera"} // Force to non-wide lens
        />
        <View style={styles.overlay}>
          <View style={styles.topContainer}>
            <TouchableOpacity
              style={styles.counter}
              onPress={openNextSnap}
              disabled={pendingSnaps.length === 0}
            >
              <Text style={styles.counterText}>{pendingSnaps.length}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomContainer}>
            <TouchableOpacity style={styles.button} onPress={goToGallery}>
              <MaterialIcons name="photo-library" size={42} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={takeSnap}>
              <MaterialCommunityIcons
                name="circle-outline"
                size={90}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={toggleCameraType}>
              <MaterialIcons name="flip-camera-ios" size={42} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  topContainer: {
    flex: 1,
    alignSelf: "flex-end",
    marginTop: 50,
    marginRight: 25,
  },
  bottomContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "transparent",
    margin: 64,
  },
  camera: { flex: 1 },
  fullImage: { flex: 1 },
  button: { flex: 1, alignSelf: "flex-end", alignItems: "center" },
  counter: {
    minWidth: 37,
    padding: 5,
    borderRadius: 10,
    backgroundColor: "yellow",
  },
  counterText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
  },
});
