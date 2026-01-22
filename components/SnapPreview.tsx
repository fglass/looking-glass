import { Image } from "expo-image";
import { useState } from "react";
import {
  Alert,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { SnapCaption } from "../utils";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

const MAX_CAPTION_CHARS = 120;
const MAX_CAPTION_LINES = 5;
const BASE_CAPTION_Y = 0.55;

export const SnapPreview = ({
  uri,
  onSend,
  onClose,
}: {
  uri: string;
  onSend: ({
    hidden,
    caption,
  }: {
    hidden: boolean;
    caption?: SnapCaption | null;
  }) => void;
  onClose: () => void;
}) => {
  const [captionText, setCaptionText] = useState("");
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

  const baseTop = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const maxY = useSharedValue(0);
  const startY = useSharedValue(0);

  const trimmedCaption = captionText.trim();
  const hasCaption = trimmedCaption.length > 0;
  const showCaption = isEditingCaption || hasCaption;

  const clampWorklet = (value: number, min: number, max: number) => {
    "worklet";
    return Math.max(min, Math.min(value, max));
  };

  const panGesture = Gesture.Pan()
    .enabled(!isEditingCaption && hasCaption)
    .onBegin(() => {
      "worklet";
      startY.value = offsetY.value;
    })
    .onUpdate((event) => {
      "worklet";
      const minOffset = -baseTop.value;
      const maxOffset = maxY.value - baseTop.value;
      offsetY.value = clampWorklet(
        startY.value + event.translationY,
        minOffset,
        maxOffset
      );
    });

  const captionStyle = useAnimatedStyle(() => ({
    top: baseTop.value,
    transform: [{ translateY: offsetY.value }],
  }));

  const onImageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setImageLayout({ width, height });
    if (width > 0 && height > 0) {
      maxY.value = Math.max(0, height - 40);
      baseTop.value = height * BASE_CAPTION_Y;
      const minOffset = -baseTop.value;
      const maxOffset = maxY.value - baseTop.value;
      offsetY.value = clampWorklet(offsetY.value, minOffset, maxOffset);
    }
  };

  const captionPayload = (): SnapCaption | null => {
    if (!hasCaption || imageLayout.width === 0 || imageLayout.height === 0) {
      return null;
    }
    return {
      text: trimmedCaption,
      x: 0,
      y:
        (imageLayout.height * BASE_CAPTION_Y + offsetY.value) /
        imageLayout.height,
    };
  };

  const clampCaptionLines = (value: string) => {
    const lines = value.split(/\r\n|\r|\n/);
    if (lines.length <= MAX_CAPTION_LINES) {
      return value;
    }
    return lines.slice(0, MAX_CAPTION_LINES).join("\n");
  };
  
  const onSave = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission is required to save snaps."
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Success", "Snap saved!");
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save snap.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.camera} onLayout={onImageLayout}>
        <Image source={{ uri }} style={styles.fullImage} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setIsEditingCaption((prev) => !prev)}
        />
        {showCaption && (
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.captionContainer,
                styles.captionPill,
                captionStyle,
                { width: imageLayout.width },
              ]}
            >
              {isEditingCaption ? (
                <TextInput
                  value={captionText}
                  onChangeText={(value) =>
                    setCaptionText(clampCaptionLines(value))
                  }
                  autoFocus
                  multiline
                  maxLength={MAX_CAPTION_CHARS}
                  placeholder="Add a caption"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={[styles.captionText, styles.captionInput]}
                />
              ) : (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setIsEditingCaption(true)}
                >
                  <TextInput
                    value={captionText}
                    editable={false}
                    multiline
                    pointerEvents="none"
                    style={[styles.captionText, styles.captionInput]}
                  />
                </TouchableOpacity>
              )}
            </Animated.View>
          </GestureDetector>
        )}
        <View style={styles.overlayTopContainer}>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <MaterialIcons name="close" size={42} color="white" />
          </TouchableOpacity>
        </View>
        {isEditingCaption && (
          <View style={styles.charCountContainer}>
            <Text style={[styles.captionText, styles.charCountText]}>
              {captionText.length} / {MAX_CAPTION_CHARS}
            </Text>
          </View>
        )}
        <View style={styles.overlayBottomContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => onSend({ hidden: false, caption: captionPayload() })}
            onLongPress={() =>
              onSend({ hidden: true, caption: captionPayload() })
            }
          >
            <MaterialIcons name="send" size={42} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.overlayBottomLeftContainer}>
          <TouchableOpacity style={styles.button} onPress={onSave}>
            <MaterialIcons name="save-alt" size={42} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  camera: { flex: 1 },
  fullImage: { flex: 1 },
  overlayTopContainer: { position: "absolute", top: 50, left: 25 },
  overlayBottomContainer: { position: "absolute", bottom: 30, right: 25 },
  overlayBottomLeftContainer: { position: "absolute", bottom: 30, left: 25 },
  button: { flex: 1, alignSelf: "flex-end", alignItems: "center" },
  charCountContainer: { position: "absolute", top: 54, right: 20 },
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
  charCountText: {
    textAlign: "right",
  },
});
