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
