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
import { registerAdmin } from "../lib/db/auth";

export default function AdminAuthScreen({ onLoginSuccess, onGoBack }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Đăng ký admin
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPassword2, setAdminPassword2] = useState("");

  async function handleLogin() {
    setError("");
    try {
      setSubmitting(true);
      const profile = await loginAccount({ identifier, password, role: "admin" });
      onLoginSuccess(profile);
    } catch (e) {
      setError(e?.message || "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterAdmin() {
    setError("");
    if (!adminUsername || !adminEmail || !adminPassword || !adminPassword2) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    if (adminPassword !== adminPassword2) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    try {
      setSubmitting(true);
      const profile = await registerAdmin({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
      });
      onLoginSuccess(profile);
    } catch (e) {
      setError(e?.message || "Đăng ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable style={styles.backBtn} onPress={onGoBack} hitSlop={10}>
        <Text style={styles.backBtnText}>{"<"}</Text>
      </Pressable>
      <Text style={styles.title}>{isLogin ? "Đăng nhập Admin" : "Đăng ký Admin"}</Text>
      {isLogin ? (
        <>
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
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Username"
            autoCapitalize="none"
            value={adminUsername}
            onChangeText={setAdminUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            value={adminEmail}
            onChangeText={setAdminEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu"
            secureTextEntry
            value={adminPassword}
            onChangeText={setAdminPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Nhập lại mật khẩu"
            secureTextEntry
            value={adminPassword2}
            onChangeText={setAdminPassword2}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={styles.primaryBtn}
            onPress={handleRegisterAdmin}
            disabled={submitting}
          >
            <Text style={styles.primaryBtnText}>
              {submitting ? "Đang xử lý..." : "Đăng ký"}
            </Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={() => setIsLogin((v) => !v)} style={{ marginTop: 16 }}>
        <Text style={styles.linkText}>
          {isLogin ? "Chưa có tài khoản? Đăng ký Admin" : "Đã có tài khoản? Đăng nhập Admin"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
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
  linkText: {
    textAlign: "center",
    color: "#1e90ff",
    fontWeight: "600",
    fontSize: 14,
  },
  backBtn: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    padding: 8,
  },
  backBtnText: {
    fontSize: 20,
    color: "#1e90ff",
    fontWeight: "bold",
  },
});
