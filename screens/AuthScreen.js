import React, { useState } from "react";
import LoginScreen from "./LoginScreen";
import RegisterUserScreen from "./RegisterUserScreen";
import RegisterJournalistScreen from "./RegisterJournalistScreen";
import AdminAuthScreen from "./AdminAuthScreen";

export default function AuthScreen({ onAuthSuccess }) {
  const [screen, setScreen] = useState("login");

  if (screen === "admin_auth") {
    return (
      <AdminAuthScreen
        onLoginSuccess={onAuthSuccess}
        onGoBack={() => setScreen("login")}
      />
    );
  }

  if (screen === "register_user") {
    return (
      <RegisterUserScreen
        onRegisterSuccess={onAuthSuccess}
        onGoLogin={() => setScreen("login")}
      />
    );
  }

  if (screen === "register_journalist") {
    return (
      <RegisterJournalistScreen
        onRegisterSuccess={onAuthSuccess}
        onGoLogin={() => setScreen("login")}
      />
    );
  }

  return (
    <LoginScreen
      onLoginSuccess={onAuthSuccess}
      onGoRegisterUser={() => setScreen("register_user")}
      onGoRegisterJournalist={() => setScreen("register_journalist")}
      onGoAdminAuth={() => setScreen("admin_auth")}
    />
  );
}
