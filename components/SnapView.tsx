import { Image } from "expo-image";
import {
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} from "react-native";

const EMOJI_REACTIONS = ["❤️", "👀", "😂", "🙁"];

export const SnapView = ({
  snap,
  onReaction,
  onClose,
}: {
  snap: { key: string; uri: string };
  onReaction?: (reaction: string) => void;
  onClose: () => void;
}) => (
  <View style={styles.container}>
    <View style={styles.camera}>
      <TouchableHighlight style={styles.imageContainer} onPress={onClose}>
        <Image
          source={{ uri: snap.uri, cacheKey: snap.key }}
          style={styles.fullImage}
        />
      </TouchableHighlight>
    </View>
    {onReaction && (
      <View style={styles.reactionsContainer}>
        {EMOJI_REACTIONS.map((emoji) => (
          <TouchableOpacity key={emoji} onPress={() => onReaction?.(emoji)}>
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
);

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
