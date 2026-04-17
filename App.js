import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import HomeScreen from "./screens/HomeScreen";
import AuthScreen from "./screens/AuthScreen";
import { getCurrentUser, initAuthSchema, logout } from "./lib/database";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        await initAuthSchema();
        const user = await getCurrentUser();
        setCurrentUser(user);
      } finally {
        setBooting(false);
      }
    }

    bootstrap();
  }, []);

  async function handleLogout() {
    await logout();
    setCurrentUser(null);
  }

  if (booting) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={setCurrentUser} />;
  }

  return <HomeScreen currentUser={currentUser} onLogout={handleLogout} />;
}
