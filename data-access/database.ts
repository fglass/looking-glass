import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const initDatabase = async () => {
  // await AsyncStorage.clear();
  const version = await select("version");
  if (version == null) {
    console.log("Initialising database...");
    await insert("version", 1);
    await insert("clientId", generateGuid());
    await insert("lastSnap", { key: undefined, LastModified: new Date() });
  }
};

/* Hooks */

export const useClientId = (): string => {
  const { isLoading, error, data } = useSelect("clientId", "");

  if (error) {
    console.error(error);
  }

  return isLoading ? "" : data;
};

export const useLastSnap = () => {
  const { isLoading, error, data } = useSelect("lastSnap", {});

  if (error) {
    console.error(error);
  }

  const lastSnap = isLoading
    ? {}
    : {
        key: data?.key,
        LastModified: data?.LastModified
          ? new Date(data.LastModified)
          : new Date(),
      };

  const queryClient = useQueryClient();
  const setLastSnapMutation = useMutation({
    mutationFn: async (snap: { key: string; LastModified: Date }) =>
      await insert("lastSnap", snap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lastSnap"] }),
  });

  return { lastSnap, setLastSnap: setLastSnapMutation.mutate };
};

const useSelect = (key: string, defaultValue: any) => {
  return useQuery({
    queryKey: [key],
    queryFn: async () => (await select(key)) ?? defaultValue,
  });
};

/* Raw operations */

export const select = async (key: string) => {
  try {
    const jsonValue = await AsyncStorage.getItem(getPrefixedKey(key));
    return jsonValue != null ? JSON.parse(jsonValue) : undefined;
  } catch (e) {
    console.error(e);
  }
};

export const insert = async (key: string, value: unknown) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(getPrefixedKey(key), jsonValue);
  } catch (e) {
    console.error(e);
  }
};

/* Helpers */

const getPrefixedKey = (key: string) => `@lg_${key}`;

const generateGuid = (): string => {
  const S4 = () =>
    (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  return (
    S4() +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    "-" +
    S4() +
    S4() +
    S4()
  );
};
