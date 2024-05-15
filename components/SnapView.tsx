import { Image } from "expo-image";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";
import { BLUR_HASH, HIDDEN_SNAP_KEY } from "../constants";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

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
  const [hidden, setHidden] = useState(snap.key.includes(HIDDEN_SNAP_KEY));
  const upFling = Gesture.Fling()
    .enabled(hidden)
    .direction(Directions.UP)
    .onEnd(() => setHidden(false));

  return (
    <GestureDetector gesture={upFling}>
      <View style={styles.container}>
        <View style={styles.camera}>
          <TouchableHighlight style={styles.imageContainer} onPress={onClose}>
            {hidden ? (
              <Image style={styles.fullImage} source={{ blurhash: BLUR_HASH }}>
                <Text style={styles.revealText}>Swipe up to reveal</Text>
              </Image>
            ) : (
              <Image
                style={styles.fullImage}
                source={{ uri: snap.uri, cacheKey: snap.key }}
              />
            )}
          </TouchableHighlight>
        </View>
        {!hidden && onReaction && (
          <View style={styles.reactionsContainer}>
            {EMOJI_REACTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => onReaction?.(emoji)}>
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
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
