import { useState, useRef, useEffect } from "react";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Button, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { manipulateAsync, FlipType, SaveFormat } from "expo-image-manipulator";
import Toast from "react-native-root-toast";
import { useClientId, useLastSnap } from "../data-access/database";
import {
  getSnapUrl,
  getSnaps,
  getTokens,
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
  Subscription,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
  setBadgeCountAsync,
} from "expo-notifications";
import {
  registerForPushNotifications,
  sendPushNotifications,
} from "../data-access/notification";
import { HIDDEN_SNAP_KEY } from "../constants";

type Snap = { key: string; LastModified: Date };

export default function HomeView() {
  // TODO: refactor
  const cameraRef = useRef<CameraView>(null);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [cameraPerms, requestCameraPerms] = useCameraPermissions();

  const [preview, setPreview] = useState<{ uri: string } | null>(null);
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);
  const [selfSend, setSelfSend] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const clientId = useClientId();
  const { lastSnap, setLastSnap } = useLastSnap();

  const [checkForNewSnaps, setCheckForNewSnaps] = useState(true);
  const [pendingSnaps, setPendingSnaps] = useState<Snap[]>([]);

  const upFling = Gesture.Fling()
    .direction(Directions.UP)
    .onStart(goToSettings);
  const rightFling = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onStart(goToGallery);
  const doubleTap = Gesture.Tap().numberOfTaps(2).onStart(toggleCameraType);

  const [expoPushToken, setExpoPushToken] = useState("");
  const notificationListener = useRef<Subscription>();
  const responseListener = useRef<Subscription>();

  useEffect(() => {
    if (!clientId) {
      return;
    }

    console.log("Registering for notifications...");
    registerForPushNotifications()
      .then((token) => {
        setExpoPushToken(token ?? "");
        if (token) {
          console.log("Uploading token...");
          uploadToken(`token|${clientId}|${token}|.txt`, token).then(() =>
            console.log("Token upload successful")
          );
        }
      })
      .catch((error: any) => setExpoPushToken(`${error}`));

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
      notificationListener.current &&
        removeNotificationSubscription(notificationListener.current);
      responseListener.current &&
        removeNotificationSubscription(responseListener.current);
    };
  }, [clientId]);

  useEffect(() => {
    const fetchNewSnaps = async () => {
      const snaps = await getSnaps(lastSnap.key);
      if (!snaps) {
        return;
      }
      const pendingSnaps: Snap[] = snaps
        .filter(
          (item) =>
            item.Key &&
            item.LastModified &&
            (selfSend || !item.Key.includes(clientId)) &&
            (lastSnap.LastModified === undefined ||
              item.LastModified > lastSnap.LastModified)
        )
        .map((item) => ({
          // TODO: refactor -> Key?
          key: item.Key!,
          LastModified: item.LastModified!,
        }));
      setPendingSnaps(pendingSnaps);
      await setBadgeCountAsync(pendingSnaps.length);
    };
    if (clientId && checkForNewSnaps) {
      console.log("Checking for new snaps...");
      fetchNewSnaps();
      setCheckForNewSnaps(false);
    }
  }, [
    clientId,
    selfSend,
    checkForNewSnaps,
    lastSnap.key,
    lastSnap.LastModified,
  ]);

  function goToSettings() {
    setShowSettings(true);
  }

  function goToGallery() {
    setShowGallery(true);
  }

  function closeGallery() {
    setShowGallery(false);
    setCheckForNewSnaps(true);
  }

  if (showSettings) {
    return (
      <SettingsView
        pushToken={expoPushToken}
        selfSend={selfSend}
        setSelfSend={setSelfSend}
        onClose={() => setShowSettings(false)}
      />
    );
  }

  if (showGallery) {
    return <GalleryView onClose={closeGallery} />;
  }

  // Camera permissions are still loading
  if (!cameraPerms) {
    return <View />;
  }

  if (!cameraPerms.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center" }}>
          I need your permission to show the 📷
        </Text>
        <Button onPress={requestCameraPerms} title="Grant" />
      </View>
    );
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
          const tokens = await getTokens();
          if (tokens) {
            // TODO: only to sender
            await sendPushNotifications({
              tokens,
              idToIgnore: !selfSend ? clientId : "",
              notification: { title: reaction },
            });
            Toast.show(`${reaction} sent!`, {
              duration: Toast.durations.LONG,
              position: Toast.positions.TOP,
            });
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

    const picture = await cameraRef.current.takePictureAsync();

    if (!picture) {
      console.error("No snap taken");
      return;
    }

    const transformedPicture = await manipulateAsync(
      picture.uri,
      cameraType === "front"
        ? [{ rotate: 180 }, { flip: FlipType.Vertical }]
        : [],
      { compress: 0.5, format: SaveFormat.JPEG }
    );

    setPreview(transformedPicture);
  }

  async function sendSnap({ hidden }: { hidden: boolean }) {
    if (!preview) {
      console.error("No snap to send");
      return;
    }

    console.log("Sending snap...");
    const prevToast = Toast.show("Sending snap...", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
    closePreview();

    // Upload snap
    const now = new Date();
    const key = `snap|${now.toISOString()}|${clientId}${hidden ? `|${HIDDEN_SNAP_KEY}` : ""}.jpg`;
    const resp = await uploadSnap(preview.uri, key);
    console.log("Upload successful: ", resp);

    // Send push notifications
    const tokens = await getTokens();
    if (tokens) {
      await sendPushNotifications({
        tokens,
        idToIgnore: !selfSend ? clientId : "",
        notification: {
          title: hidden ? " New Snap 🔒" : "New Snap 🔍",
          badge: 1,
        },
      });
    }

    Toast.hide(prevToast);
    Toast.show(hidden ? "🔒 Snap sent!" : "Snap sent!", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
  }

  async function openNextSnap() {
    const snap = pendingSnaps[0];
    const url = await getSnapUrl(snap.key);

    if (url) {
      setOpenedSnap({ key: snap.key, uri: url });
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

  function toggleCameraType() {
    setCameraType((current) => (current === "back" ? "front" : "back"));
  }

  return (
    <GestureDetector gesture={Gesture.Race(rightFling, upFling, doubleTap)}>
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing={cameraType}>
          <View style={styles.topContainer}>
            <TouchableOpacity
              style={styles.counter}
              onPress={openNextSnap}
              disabled={pendingSnaps.length === 0}
            >
              <Text style={styles.text}>{pendingSnaps.length}</Text>
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
        </CameraView>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
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
  camera: {
    flex: 1,
  },
  fullImage: {
    flex: 1,
  },
  button: {
    flex: 1,
    alignSelf: "flex-end",
    alignItems: "center",
  },
  counter: {
    minWidth: 37,
    padding: 5,
    borderRadius: 10,
    backgroundColor: "yellow",
  },
  text: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "black",
  },
});
