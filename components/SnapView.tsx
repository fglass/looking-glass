import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";
import {
  HIDDEN_SNAP_KEY,
  getDateTimeFromSnapKey,
  REACTION_EMOJIS,
  SnapCaption,
} from "../utils";
import { getSnapCaption } from "../data-access/s3";
import { useQuery } from "@tanstack/react-query";
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
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const { data: caption } = useQuery<SnapCaption | null>({
    queryKey: ["fetchSnapCaption", snap.key],
    queryFn: async () => await getSnapCaption(snap.key),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

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
      <View
        style={styles.camera}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setImageLayout({ width, height });
        }}
      >
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
        {!hidden && caption && imageLayout.width > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.captionContainer,
              styles.captionPill,
              {
                top: caption.y * imageLayout.height,
                width: imageLayout.width,
              },
            ]}
          >
            <TextInput
              value={caption.text}
              editable={false}
              multiline
              pointerEvents="none"
              style={[styles.captionText, styles.captionInput]}
            />
          </View>
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
  captionContainer: {
    position: "absolute",
    left: 0,
  },
  captionPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-start",
    minHeight: 34,
    maxHeight: 120,
  },
  captionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "400",
    fontFamily: Platform.select({
      ios: "Avenir-Book",
      android: "sans-serif",
      default: "System",
    }),
    letterSpacing: 0.1,
    textAlign: "center",
  },
  captionInput: {
    padding: 0,
    margin: 0,
    lineHeight: 20,
    textAlignVertical: Platform.select({ android: "top", default: "auto" }),
    includeFontPadding: false,
    paddingTop: Platform.select({ ios: 1, default: 0 }),
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
