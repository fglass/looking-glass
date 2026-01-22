export const HIDDEN_SNAP_KEY = "hide";
export const BLUR_HASH = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

export type SnapCaption = {
  text: string;
  x: number;
  y: number;
};

export const CAPTION_TAG_KEY = "caption";
export const CAPTION_TAG_MAX = 256;

export const getTokenKey = (clientId: string, token: string) =>
  `token|${clientId}|${token}|.txt`;

export const getSnapKey = (
  clientId: string,
  token: string,
  hidden: boolean
) => {
  const now = new Date();
  return `snap|${now.toISOString()}|${clientId}|${token}|${hidden ? `|${HIDDEN_SNAP_KEY}` : ""}.jpg`;
};

export const getTokenFromSnapKey = (key: string) => {
  const parts = key.split("|");
  const clientId = parts[2];
  const token = parts[3];
  return { Key: getTokenKey(clientId, token) };
};

export const getDateTimeFromSnapKey = (key: string) => {
  const parts = key.split("|");
  return new Date(parts[1]);
};

export const serializeCaptionTag = (caption: SnapCaption) => {
  let safeText = sanitiseCaptionTextForTag(caption.text);
  if (!safeText) {
    return null;
  }

  const x = Number.isFinite(caption.x) ? caption.x : 0;
  const y = Number.isFinite(caption.y) ? caption.y : 0;
  const pack = (value: string) => `${value}:${x.toFixed(3)}:${y.toFixed(3)}`;

  let packed = pack(safeText);
  while (packed.length > CAPTION_TAG_MAX && safeText.length > 0) {
    safeText = safeText.slice(0, -1);
    packed = pack(safeText);
  }

  if (!safeText) {
    return null;
  }
  return packed;
};

const sanitiseCaptionTextForTag = (text: string) =>
  text
    .replace(/\r\n|\r/g, "\n")
    // Escape @ first so newline sentinel can't conflict with user input
    .replace(/@/g, "@@")
    // Encode newlines using only S3-allowed characters
    .replace(/\n/g, "@n@")
    .replace(/[^A-Za-z0-9 ._+=\-\/@:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parseCaptionTag = (value: string): SnapCaption | null => {
  const parts = rsplit(value, ":", 3);
  if (!parts) {
    return null;
  }

  const [text, rawX, rawY] = parts;
  if (!text || !rawX || !rawY) {
    return null;
  }

  const x = Number.parseFloat(rawX);
  const y = Number.parseFloat(rawY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { text: restoreCaptionTextFromTag(text), x, y };
};

const rsplit = (value: string, sep: string, count: number) => {
  if (count < 2) {
    return null;
  }

  const parts: string[] = [];
  let end = value.length;

  for (let idx = 0; idx < count - 1; idx += 1) {
    const next = value.lastIndexOf(sep, end - 1);
    if (next === -1) {
      return null;
    }
    parts.unshift(value.slice(next + 1, end));
    end = next;
  }

  parts.unshift(value.slice(0, end));
  return parts.length === count ? parts : null;
};

const restoreCaptionTextFromTag = (text: string) =>
  text.replace(/@n@/g, "\n").replace(/@@/g, "@");

const parseReactionMap = () => {
  const raw = process.env.EXPO_PUBLIC_REACTION_MAP;
  if (!raw) {
    return {};
  }

  const entries = raw
    .split(",")
    .map((pair: string) => pair.trim())
    .filter(Boolean)
    .map((pair: string) => {
      const [tag, emoji] = pair.split(":").map((value) => value.trim());
      if (!tag || !emoji) {
        return null;
      }
      return [tag, emoji] as const;
    })
    .filter(Boolean) as (readonly [string, string])[];

  if (!entries.length) {
    return {};
  }

  return Object.fromEntries(entries) as Record<string, string>;
};

export const TAG_TO_EMOJI: Record<string, string> = parseReactionMap();
export const REACTION_EMOJIS = Object.values(TAG_TO_EMOJI);

export const EMOJI_TO_TAG = Object.fromEntries(
  Object.entries(TAG_TO_EMOJI).map(([tag, emoji]) => [emoji, tag])
);

export const reactionTagFromEmoji = (emoji: string) => EMOJI_TO_TAG[emoji];
