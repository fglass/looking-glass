import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootSiblingParent } from "react-native-root-siblings";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initDatabase } from "./data-access/database";
import HomeView from "./components/HomeView";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    const init = async () => {
      if (await initDatabase()) {
        queryClient.invalidateQueries();
      }
    };
    init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RootSiblingParent>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <HomeView />
        </GestureHandlerRootView>
      </RootSiblingParent>
    </QueryClientProvider>
  );
}
