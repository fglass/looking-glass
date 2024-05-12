import { useState, useRef, useEffect } from "react";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Button, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { manipulateAsync, FlipType, SaveFormat } from "expo-image-manipulator";
import Toast from "react-native-root-toast";
import { useClientId, useLastSnap } from "../data-access/database";
import { getSnapUrl, getSnaps, uploadSnap } from "../data-access/s3";
import { SnapView } from "./SnapView";
import { SnapPreview } from "./SnapPreview";
import GalleryView from "./GalleryView";
import AdminView from "./AdminView";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

type Snap = { key: string; LastModified: Date };

export default function HomeView() {
  const cameraRef = useRef<CameraView>(null);
  const [cameraType, setCameraType] = useState<CameraType>("back");
  const [cameraPerms, requestCameraPerms] = useCameraPermissions();

  const [preview, setPreview] = useState<{ uri: string } | null>(null);
  const [openedSnap, setOpenedSnap] = useState<{ uri: string } | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const clientId = useClientId();
  const { lastSnap, setLastSnap } = useLastSnap();

  const [checkForNewSnaps, setCheckForNewSnaps] = useState(true);
  const [pendingSnaps, setPendingSnaps] = useState<Snap[]>([]);

  const upFling = Gesture.Fling()
    .direction(Directions.UP)
    .onStart(() => setShowAdmin(true));

  const rightFling = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onStart(goToGallery);

  const doubleTap = Gesture.Tap().numberOfTaps(2).onStart(toggleCameraType);

  // TODO: set interval
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
            !item.Key.includes(clientId) &&
            (lastSnap.LastModified === undefined ||
              item.LastModified > lastSnap.LastModified)
        )
        .map((item) => ({
          // TODO: refactor (Key)
          key: item.Key!,
          LastModified: item.LastModified!,
        }));
      setPendingSnaps(pendingSnaps);
    };
    if (clientId && checkForNewSnaps) {
      console.log("Checking for new snaps...");
      fetchNewSnaps();
      setCheckForNewSnaps(false);
    }
  }, [clientId, checkForNewSnaps, lastSnap.key, lastSnap.LastModified]);

  function goToGallery() {
    setShowGallery(true);
  }

  function closeGallery() {
    setCheckForNewSnaps(true);
    setShowGallery(false);
  }

  if (showAdmin) {
    return <AdminView onClose={() => setShowAdmin(false)} />;
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
    return <SnapView uri={openedSnap.uri} onClose={closeOpenedSnap} />;
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

    if (cameraType === "back") {
      setPreview(picture);
      return;
    }

    const flippedPicture = await manipulateAsync(
      picture.uri,
      [{ rotate: 180 }, { flip: FlipType.Vertical }],
      { compress: 1, format: SaveFormat.JPEG }
    );

    setPreview(flippedPicture);
  }

  async function sendSnap() {
    if (!preview) {
      console.error("No snap to send");
      return;
    }

    const prevToast = Toast.show("Sending snap...", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
    closePreview();

    const now = new Date();
    const key = `snap-${now.toISOString()}-${clientId}.jpg`;
    const resp = await uploadSnap(preview.uri, key);
    console.log("Upload successful: ", resp);

    Toast.hide(prevToast);
    Toast.show("Snap sent!", {
      duration: Toast.durations.LONG,
      position: Toast.positions.TOP,
    });
  }

  async function openNextSnap() {
    const snap = pendingSnaps[0];
    const url = await getSnapUrl(snap.key);

    if (url) {
      setOpenedSnap({ uri: url });
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
