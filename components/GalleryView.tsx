import { useState, useMemo, useCallback, memo } from "react";
import {
  Text,
  TouchableHighlight,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  View,
  ActivityIndicator,
  Alert,
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
import * as MediaLibrary from "expo-media-library";
import { Directory, File, Paths } from "expo-file-system";

const STREAK_START_DATE = process.env.EXPO_PUBLIC_STREAK_START_DATE;
const THUMBNAIL_HEIGHT = 200;
const MONTH_HEADER_HEIGHT = 28;
const N_COLUMNS = 2;

type GalleryRow = {
  id: string;
  header?: string;
  snaps: ({ key: string } | null)[];
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
      refetchOnMount: false,
      refetchOnReconnect: false,
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

const GalleryRowItem = memo(
  ({
    item,
    onSnapPress,
  }: {
    item: GalleryRow;
    onSnapPress: (key: string, uri: string) => void;
  }) => (
    <View style={styles.rowContainer}>
      {item.header && (
        <View style={styles.monthHeader}>
          <Text style={styles.monthHeaderText}>{item.header}</Text>
        </View>
      )}
      <View style={styles.row}>
        {item.snaps.map((snap, columnIdx) =>
          snap ? (
            <Thumbnail key={snap.key} snap={snap} onSnapPress={onSnapPress} />
          ) : (
            <View
              key={`placeholder-${item.id}-${columnIdx}`}
              style={styles.thumbnailPlaceholder}
            />
          )
        )}
      </View>
    </View>
  )
);
GalleryRowItem.displayName = "GalleryRowItem";

export default function GalleryView({ onClose }: { onClose: () => void }) {
  const leftFling = useMemo(
    () => Gesture.Fling().direction(Directions.LEFT).onStart(onClose),
    [onClose]
  );
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

      const latestSnaps = snaps.slice().reverse();
      return latestSnaps
        .filter((item) => item.Key)
        .map((item) => ({ key: item.Key! }));
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat("default", { month: "long", year: "numeric" }),
    []
  );

  const { galleryRows, rowHeights, rowOffsets } = useMemo(() => {
    if (!gallerySnaps) {
      return {
        galleryRows: [] as GalleryRow[],
        rowHeights: [] as number[],
        rowOffsets: [] as number[],
      };
    }

    const rows: GalleryRow[] = [];
    const heights: number[] = [];
    const offsets: number[] = [];

    let runningOffset = 0;
    let currentMonthKey: string | null = null;

    const monthRowCounts: Record<string, number> = {};
    let currentRow: GalleryRow | null = null;

    const pushRow = (id: string, header?: string) => {
      const height = THUMBNAIL_HEIGHT + (header ? MONTH_HEADER_HEIGHT : 0);
      const row: GalleryRow = { id, header, snaps: [] };
      rows.push(row);
      offsets.push(runningOffset);
      heights.push(height);
      runningOffset += height;
      return row;
    };

    gallerySnaps.forEach((snap) => {
      const snapDate = getDateTimeFromSnapKey(snap.key);
      const isValidDate = !Number.isNaN(snapDate.getTime());
      const monthKey = isValidDate
        ? `${snapDate.getFullYear()}-${snapDate.getMonth()}`
        : "unknown";
      const headerLabel = isValidDate
        ? monthFormatter.format(snapDate)
        : "Unknown date";

      const isNewMonth = monthKey !== currentMonthKey;
      if (isNewMonth) {
        currentMonthKey = monthKey;
        const rowIndex = monthRowCounts[monthKey] ?? 0;
        monthRowCounts[monthKey] = rowIndex;
        const rowId = `${monthKey}-${rowIndex}`;
        currentRow = pushRow(
          rowId,
          rows.length === 0 ? undefined : headerLabel
        );
        monthRowCounts[monthKey] = rowIndex + 1;
      } else if (!currentRow || currentRow.snaps.length === N_COLUMNS) {
        const rowIndex = monthRowCounts[monthKey] ?? 0;
        const rowId = `${monthKey}-${rowIndex}`;
        currentRow = pushRow(rowId);
        monthRowCounts[monthKey] = rowIndex + 1;
      }

      currentRow?.snaps.push({ key: snap.key });
    });

    rows.forEach((row) => {
      while (row.snaps.length < N_COLUMNS) {
        row.snaps.push(null);
      }
    });

    return { galleryRows: rows, rowHeights: heights, rowOffsets: offsets };
  }, [gallerySnaps, monthFormatter]);

  const streakDurationDays = useMemo(() => {
    const streakStart = STREAK_START_DATE
      ? new Date(STREAK_START_DATE)
      : new Date();
    return Math.floor(
      (Date.now() - new Date(streakStart).getTime()) / (1000 * 60 * 60 * 24)
    );
  }, []);

  const onSnapPress = useCallback((key: string, uri: string) => {
    setOpenedSnap({ key, uri });
  }, []);

  const onSnapSave = useCallback(async () => {
    if (!openedSnap) {
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission is required to save snaps."
        );
        return;
      }

      let localUri = openedSnap.uri;
      if (localUri.startsWith("http")) {
        const safeKey = openedSnap.key.replace(/[^a-z0-9]/gi, "_");
        const cacheDir = new Directory(Paths.cache, "snaps");
        if (!cacheDir.exists) {
          cacheDir.create();
        }
        const destination = new File(cacheDir, `${safeKey}.jpg`);
        const output = await File.downloadFileAsync(localUri, destination);
        localUri = output.uri;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("Success", "Snap saved!");
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save snap.");
    }
  }, [openedSnap]);

  const renderItem = useCallback(
    ({ item }: { item: GalleryRow }) => (
      <GalleryRowItem item={item} onSnapPress={onSnapPress} />
    ),
    [onSnapPress]
  );

  const keyExtractor = useCallback((item: GalleryRow) => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<GalleryRow> | null | undefined, index: number) => ({
      length: rowHeights[index] ?? THUMBNAIL_HEIGHT,
      offset: rowOffsets[index] ?? THUMBNAIL_HEIGHT * index,
      index,
    }),
    [rowHeights, rowOffsets]
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
          windowSize={5} // Current + screens above & below
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          getItemLayout={getItemLayout}
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
            <TouchableOpacity style={styles.saveButton} onPress={onSnapSave}>
              <MaterialIcons name="save-alt" size={42} color="white" />
            </TouchableOpacity>
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
    bottom: 8,
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
    top: 40,
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
  saveButton: {
    position: "absolute",
    bottom: 30,
    left: 25,
    alignItems: "center",
  },
});
