import { useState, useRef, useEffect } from "react";
import { CameraView, CameraType } from "expo-camera";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  getAllTokens,
  uploadSnap,
  uploadToken,
} from "../data-access/s3";
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
import { getSnapKey, getTokenFromSnapKey, getTokenKey } from "../utils";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { SetupView } from "./SetupView";
import { runOnJS } from "react-native-reanimated";

type Snap = { Key: string; LastModified: Date };

export default function HomeView() {
  const cameraRef = useRef<CameraView>(null);
  const [cameraType, setCameraType] = useState<CameraType>("back");

  const [preview, setPreview] = useState<{ uri: string } | null>(null);
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);
  const [selfSend, setSelfSend] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const clientId = useClientId();
  const { displayName } = useDisplayName();
  const { lastSnap, setLastSnap } = useLastSnap();

  const [checkForNewSnaps, setCheckForNewSnaps] = useState(true);
  const [pendingSnaps, setPendingSnaps] = useState<Snap[]>([]);

  const [pushToken, setPushToken] = useState("");
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);

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
    if (!clientId || !Device.isDevice) {
      return;
    }

    console.log("Registering for notifications...");
    registerForPushNotifications()
      .then((token) => {
        setPushToken(token ?? "");
        if (token) {
          console.log("Uploading token...");
          uploadToken(getTokenKey(clientId, token), token).then(() =>
            console.log("Token upload successful")
          );
        }
      })
      .catch((error: any) => setPushToken(`${error}`));

    notificationListener.current = addNotificationReceivedListener((n) => {
      console.log("Notification received:", n);
      setCheckForNewSnaps(true);
    });

    responseListener.current = addNotificationResponseReceivedListener(
      (resp) => {
        console.log("Notification interacted:", resp);
        setCheckForNewSnaps(true);
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [clientId]);

  useEffect(() => {
    const fetchNewSnaps = async (
      lastSnapKey: string | undefined,
      lastOpenedDate: Date
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
            item.LastModified > lastOpenedDate
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

  if (displayName === undefined) {
    return null;
  }

  if (!displayName) {
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

  async function sendSnap({ hidden }: { hidden: boolean }) {
    if (!preview) {
      console.error("No snap to send");
      return;
    }

    console.log("Sending snap...");
    const prevToast = Toast.show("Sending snap...", {
      duration: 60_000,
      position: Toast.positions.TOP,
    });
    closePreview();

    const resp = await uploadSnap(
      getSnapKey(clientId, pushToken, hidden),
      preview.uri
    );
    console.log("Upload successful: ", resp);

    const tokens = await getAllTokens();
    if (tokens) {
      await sendPushNotifications({
        tokens,
        notification: { title: displayName, body: "New Snap 🔍", badge: 1 },
        idToIgnore: !selfSend ? clientId : "",
      });
    }

    Toast.hide(prevToast);
    Toast.show(hidden ? "🔒 Snap sent!" : "Snap sent!", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
