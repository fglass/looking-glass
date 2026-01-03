import { Image } from "expo-image";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";
import {
  HIDDEN_SNAP_KEY,
  getDateTimeFromSnapKey,
  REACTION_EMOJIS,
} from "../utils";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Canvas,
  Fill,
  Group,
  Path,
  Skia,
  Image as SkiaImage,
  TextBlob,
  matchFont,
  notifyChange,
  useImage,
} from "@shopify/react-native-skia";
import { scheduleOnRN } from "react-native-worklets";
import Animated, { useSharedValue } from "react-native-reanimated";

export const SnapView = ({
  snap,
  displayDate,
  onReaction,
  onClose,
}: {
  snap: { key: string; uri: string };
  displayDate?: boolean;
  onReaction?: (reaction: string) => void;
  onClose: () => void;
}) => {
  const hidden = snap.key.includes(HIDDEN_SNAP_KEY);

  const scratchPath = useSharedValue(Skia.Path.Make());
  const scratchHandler = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      scratchPath.value.moveTo(e.x, e.y);
      scratchPath.value.lineTo(e.x, e.y);
      notifyChange(scratchPath);
    })
    .onUpdate((e) => {
      "worklet";
      scratchPath.value.lineTo(e.x, e.y);
      notifyChange(scratchPath);
    });

  const ScratchCard = () => {
    const win = Dimensions.get("window");
    const image = useImage(snap.uri);

    const font = matchFont({
      fontFamily: Platform.select({ ios: "Arial", default: "serif" }),
      fontSize: 25,
      fontStyle: "normal",
      fontWeight: "bold",
    });
    const label = Skia.TextBlob.MakeFromText("scratch to reveal", font);

    return (
      <Canvas style={styles.imageContainer}>
        <SkiaImage
          image={image}
          x={0}
          y={0}
          width={win.width}
          height={win.height}
          fit={"cover"}
        />
        <Group layer>
          <Fill color="silver" />
          <TextBlob
            x={100}
            y={win.height / 2}
            blob={label}
            color="white"
            opacity={0.25}
          />
          <Path
            path={scratchPath}
            style={"stroke"}
            strokeJoin={"round"}
            strokeCap={"round"}
            strokeWidth={75}
            color={"white"}
            blendMode={"clear"}
          />
        </Group>
      </Canvas>
    );
  };

  const closeOnTap = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_event, success) => {
      "worklet";
      if (success && hidden) {
        scheduleOnRN(onClose);
      }
    });
  const scratchGesture = Gesture.Simultaneous(closeOnTap, scratchHandler);

  return (
    <Animated.View style={styles.container}>
      <View style={styles.camera}>
        {hidden ? (
          <GestureDetector gesture={scratchGesture}>
            <View style={styles.imageContainer}>
              <ScratchCard />
            </View>
          </GestureDetector>
        ) : (
          <TouchableHighlight style={styles.imageContainer} onPress={onClose}>
            <Image
              style={styles.fullImage}
              source={{ uri: snap.uri, cacheKey: snap.key }}
            />
          </TouchableHighlight>
        )}
      </View>
      {displayDate && (
        <View style={styles.dateContainer}>
          <Text style={styles.dateText}>
            {getDateTimeFromSnapKey(snap.key).toLocaleString("default", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      )}
      {onReaction && (
        <View style={styles.reactionsContainer}>
          {REACTION_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => {
                onReaction?.(emoji);
                onClose();
              }}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  camera: {
    flex: 1,
  },
  fullImage: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
  },
  revealContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  revealText: {
    fontSize: 24,
    color: "white",
    textAlign: "center",
    margin: "auto",
  },
  dateContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    paddingTop: 50,
    paddingLeft: 15,
  },
  dateText: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
    margin: "auto",
  },
  reactionsContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingTop: 50,
    paddingRight: 25,
  },
  emoji: {
    fontSize: 42,
  },
});
