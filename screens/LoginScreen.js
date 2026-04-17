import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { loginAccount } from "../lib/database";

export default function LoginScreen({
  onLoginSuccess,
  onGoRegisterUser,
  onGoRegisterJournalist,
  onGoAdminAuth,
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError("");
    try {
      setSubmitting(true);
      const profile = await loginAccount({ identifier, password, role });
      onLoginSuccess(profile);
    } catch (e) {
      setError(e?.message || "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        style={styles.adminBtn}
        onPress={onGoAdminAuth}
        hitSlop={10}
      >
        <Text style={styles.adminIcon}>🛡️</Text>
      </Pressable>
      <Text style={styles.title}>Đăng nhập</Text>

      <View style={styles.roleRow}>
        <Pressable
          style={[styles.roleBtn, role === "user" && styles.roleBtnActive]}
          onPress={() => setRole("user")}
        >
          <Text style={[styles.roleText, role === "user" && styles.roleTextActive]}>
            Người dùng
          </Text>
        </Pressable>
        <Pressable
          style={[styles.roleBtn, role === "journalist" && styles.roleBtnActive]}
          onPress={() => setRole("journalist")}
        >
          <Text style={[styles.roleText, role === "journalist" && styles.roleTextActive]}>
            Nhà báo
          </Text>
        </Pressable>

      </View>

      <TextInput
        style={styles.input}
        placeholder="Email hoặc username"
        autoCapitalize="none"
        value={identifier}
        onChangeText={setIdentifier}
      />

      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.primaryBtn}
        onPress={handleLogin}
        disabled={submitting}
      >
        <Text style={styles.primaryBtnText}>
          {submitting ? "Đang xử lý..." : "Đăng nhập"}
        </Text>
      </Pressable>

      <View style={styles.links}>
        <Pressable onPress={onGoRegisterUser}>
          <Text style={styles.linkText}>Đăng ký Người dùng</Text>
        </Pressable>
        <Pressable onPress={onGoRegisterJournalist}>
          <Text style={styles.linkText}>Đăng ký Nhà báo</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
    adminBtn: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#e3f0ff',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 5,
      shadowColor: '#1e90ff',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      zIndex: 30,
    },
    adminIcon: {
      fontSize: 26,
      color: '#1e90ff',
      fontWeight: 'bold',
    },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  roleRow: {
    flexDirection: "row",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#d7d7d7",
    borderRadius: 12,
    overflow: "hidden",
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#f4f4f4",
  },
  roleBtnActive: {
    backgroundColor: "#1e90ff",
  },
  roleText: {
    textAlign: "center",
    color: "#4b4b4b",
    fontWeight: "600",
  },
  roleTextActive: {
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 12,
  },
  error: {
    color: "#d62828",
    textAlign: "center",
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: "#1e90ff",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },
  links: {
    marginTop: 14,
    gap: 10,
  },
  linkText: {
    textAlign: "center",
    color: "#1e90ff",
    fontWeight: "600",
  },
});
