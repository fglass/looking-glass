export const HIDDEN_SNAP_KEY = "hide";
export const BLUR_HASH = "LEHV6nWB2yk8pyo0adR*.7kCMdnj";

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
