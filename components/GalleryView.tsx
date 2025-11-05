import { useState, useMemo, useCallback, memo } from "react";
import {
  Text,
  TouchableHighlight,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { SnapView } from "./SnapView";
import { getSnapUrl, getSnaps, getSnapReactions } from "../data-access/s3";
import { TAG_TO_EMOJI, getDateTimeFromSnapKey } from "../utils";
import {
  Directions,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { BLUR_HASH, HIDDEN_SNAP_KEY } from "../utils";

const STREAK_START_DATE = process.env.EXPO_PUBLIC_STREAK_START_DATE;
const THUMBNAIL_HEIGHT = 200;
const N_COLUMNS = 2;

type GalleryRow = {
  header?: string;
  snaps: Array<{ key: string }>;
};

const Thumbnail = memo(
  ({
    snap,
    onSnapPress,
  }: {
    snap: { key: string };
    onSnapPress: (key: string, uri: string) => void;
  }) => {
    const {
      isLoading,
      error,
      data: snapUri,
    } = useQuery({
      queryKey: ["fetchSnapUri", snap.key],
      queryFn: async () => await getSnapUrl(snap.key ?? ""),
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
    const { data: reactions } = useQuery({
      queryKey: ["fetchSnapReactions", snap.key],
      queryFn: async () => await getSnapReactions(snap.key ?? ""),
      staleTime: 60_000,
      gcTime: 60_000,
      refetchOnWindowFocus: false,
    });

    const reactionEmojis = useMemo(() => {
      if (!reactions) {
        return [];
      }
      const seen = new Set<string>();
      return reactions
        .map((tag) => TAG_TO_EMOJI[tag] ?? tag)
        .filter((emoji) => {
          if (!emoji || seen.has(emoji)) {
            return false;
          }
          seen.add(emoji);
          return true;
        });
    }, [reactions]);

    if (isLoading || error || !snapUri) {
      return (
        <View style={styles.thumbnailContainer}>
          <ActivityIndicator style={styles.thumbnail} />
        </View>
      );
    }

    const isHidden = snap.key.includes(HIDDEN_SNAP_KEY);

    return (
      <TouchableHighlight
        style={styles.thumbnailContainer}
        onPress={() => onSnapPress(snap.key, snapUri)}
      >
        <View style={styles.thumbnail}>
          {isHidden ? (
            <>
              <Image
                style={styles.thumbnail}
                source={{ blurhash: BLUR_HASH }}
              />
              <View style={styles.iconOverlay}>
                <MaterialCommunityIcons
                  name="eye-off-outline"
                  size={70}
                  color="yellow"
                />
              </View>
            </>
          ) : (
            <Image
              style={styles.thumbnail}
              source={{ uri: snapUri, cacheKey: snap.key }}
              cachePolicy="memory-disk"
            />
          )}
          {reactionEmojis.length > 0 && (
            <View pointerEvents="none" style={styles.reactionOverlay}>
              {reactionEmojis.map((emoji) => (
                <Text style={styles.reactionEmoji} key={emoji}>
                  {emoji}
                </Text>
              ))}
            </View>
          )}
        </View>
      </TouchableHighlight>
    );
  }
);
Thumbnail.displayName = "Thumbnail";

export default function GalleryView({ onClose }: { onClose: () => void }) {
  const leftFling = Gesture.Fling().direction(Directions.LEFT).onStart(onClose);
  const [openedSnap, setOpenedSnap] = useState<{
    key: string;
    uri: string;
  } | null>(null);
  const {
    isLoading,
    error,
    data: gallerySnaps,
  } = useQuery({
    queryKey: ["fetchGallery"],
    queryFn: async () => {
      console.log("Fetching gallery...");
      const snaps = await getSnaps();

      if (!snaps) {
        return [];
      }

      const latestSnaps = snaps.reverse();
      return latestSnaps
        .filter((item) => item.Key)
        .map((item) => ({ key: item.Key! }));
    },
  });

  const galleryRows = useMemo(() => {
    if (!gallerySnaps) {
      return [];
    }

    const rows: GalleryRow[] = [];
    let currentMonthKey: string | null = null;
    let currentRow: GalleryRow | null = null;

    gallerySnaps.forEach((snap) => {
      const snapDate = getDateTimeFromSnapKey(snap.key);
      const monthKey = `${snapDate.getFullYear()}-${snapDate.getMonth()}`;
      const headerLabel = snapDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      const isNewMonth = monthKey !== currentMonthKey;
      if (isNewMonth) {
        currentMonthKey = monthKey;
        currentRow = {
          header: rows.length === 0 ? undefined : headerLabel,
          snaps: [],
        };
        rows.push(currentRow);
      }

      if (!currentRow || currentRow.snaps.length === N_COLUMNS) {
        currentRow = { header: undefined, snaps: [] };
        rows.push(currentRow);
      }

      currentRow.snaps.push({ key: snap.key });
    });

    return rows;
  }, [gallerySnaps]);

  const streakDurationDays = useMemo(() => {
    const streakStart = STREAK_START_DATE
      ? new Date(STREAK_START_DATE)
      : new Date();
    return Math.floor(
      (Date.now() - new Date(streakStart).getTime()) / (1000 * 60 * 60 * 24)
    );
  }, []);

  const handleSnapPress = useCallback((key: string, uri: string) => {
    setOpenedSnap({ key, uri });
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: GalleryRow; index: number }) => {
      const snapsWithPlaceholders: Array<{ key: string } | null> = [
        ...item.snaps,
      ];
      while (snapsWithPlaceholders.length < N_COLUMNS) {
        snapsWithPlaceholders.push(null);
      }

      return (
        <View style={styles.rowContainer}>
          {item.header && (
            <View style={styles.monthHeader}>
              <Text style={styles.monthHeaderText}>{item.header}</Text>
            </View>
          )}
          <View style={styles.row}>
            {snapsWithPlaceholders.map((snap, columnIdx) =>
              snap ? (
                <Thumbnail
                  key={snap.key}
                  snap={snap}
                  onSnapPress={handleSnapPress}
                />
              ) : (
                <View
                  key={`placeholder-${index}-${columnIdx}`}
                  style={[
                    styles.thumbnailContainer,
                    styles.thumbnailPlaceholder,
                  ]}
                />
              )
            )}
          </View>
        </View>
      );
    },
    [handleSnapPress]
  );

  const keyExtractor = useCallback(
    (_item: GalleryRow, index: number) => `row-${index}`,
    []
  );

  if (isLoading || error) {
    return <View />;
  }

  return (
    <GestureDetector gesture={leftFling}>
      <View style={styles.container}>
        <FlatList
          data={galleryRows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          windowSize={3} // Current + screens above & below
          initialNumToRender={10}
          maxToRenderPerBatch={10}
        />
        <View style={styles.navbar}>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="arrow-back-ios" size={36} color="yellow" />
          </TouchableOpacity>
          {streakDurationDays > 0 && (
            <View style={styles.streakContainer}>
              <Text style={styles.text}>
                {streakDurationDays.toLocaleString()} 🔥
              </Text>
            </View>
          )}
        </View>
        {openedSnap && (
          <View style={styles.snapOverlay}>
            <SnapView
              key={openedSnap.key}
              snap={openedSnap}
              displayDate={true}
              onClose={() => setOpenedSnap(null)}
            />
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#242424" },
  rowContainer: {
    width: "100%",
  },
  monthHeader: {
    backgroundColor: "yellow",
    paddingVertical: 3,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    marginBottom: 0,
  },
  monthHeaderText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
  },
  thumbnailContainer: { flex: 1 },
  thumbnail: {
    aspectRatio: 1,
    height: THUMBNAIL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  iconOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  reactionEmoji: {
    fontSize: 32,
    marginRight: 4,
  },
  thumbnailPlaceholder: {
    flex: 1,
    height: THUMBNAIL_HEIGHT,
    backgroundColor: "transparent",
  },
  navbar: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    position: "absolute",
    top: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  streakContainer: {
    backgroundColor: "yellow",
    paddingTop: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#242424",
    textAlign: "center",
  },
  snapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
