import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";
import { HIDDEN_SNAP_KEY } from "../constants";
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
import Animated, { useSharedValue } from "react-native-reanimated";

const EMOJI_REACTIONS = ["❤️", "👀", "😂", "🙁"];

export const SnapView = ({
  snap,
  onReaction,
  onClose,
}: {
  snap: { key: string; uri: string };
  onReaction?: (reaction: string) => void;
  onClose: () => void;
}) => {
  const hidden = snap.key.includes(HIDDEN_SNAP_KEY);

  const scratchPath = useSharedValue(Skia.Path.Make());
  const scratchHandler = Gesture.Pan()
    .onBegin((e) => {
      scratchPath.value.moveTo(e.x, e.y);
      scratchPath.value.lineTo(e.x, e.y);
      notifyChange(scratchPath);
    })
    .onUpdate((e) => {
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
          <TextBlob x={100} y={win.height / 2} blob={label} color="lightgrey" />
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

  return (
    <GestureDetector gesture={scratchHandler}>
      <Animated.View style={styles.container}>
        <View style={styles.camera}>
          <TouchableHighlight style={styles.imageContainer} onPress={onClose}>
            {hidden ? (
              <ScratchCard />
            ) : (
              <Image
                style={styles.fullImage}
                source={{ uri: snap.uri, cacheKey: snap.key }}
              />
            )}
          </TouchableHighlight>
        </View>
        {onReaction && (
          <View style={styles.reactionsContainer}>
            {EMOJI_REACTIONS.map((emoji) => (
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
    </GestureDetector>
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
