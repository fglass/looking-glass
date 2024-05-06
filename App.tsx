import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootSiblingParent } from "react-native-root-siblings";
import { initDatabase } from "./data-access/database";
import HomeView from "./components/HomeView";

// Run during module initialisation, before view renders
if (typeof window !== "undefined") {
  initDatabase();
}

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootSiblingParent>
        <HomeView />
      </RootSiblingParent>
    </QueryClientProvider>
  );
}
