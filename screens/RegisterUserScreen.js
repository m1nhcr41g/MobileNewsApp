import React, { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { registerUser } from "../lib/database";

export default function RegisterUserScreen({ onRegisterSuccess, onGoLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    setError("");

    if (password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }

    try {
      setSubmitting(true);
      const profile = await registerUser({ username, email, password });
      onRegisterSuccess(profile);
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
      <Text style={styles.title}>Đăng ký Người dùng</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Mật khẩu"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Nhập lại mật khẩu"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.primaryBtn}
        onPress={handleRegister}
        disabled={submitting}
      >
        <Text style={styles.primaryBtnText}>
          {submitting ? "Đang xử lý..." : "Đăng ký"}
        </Text>
      </Pressable>

      <Pressable onPress={onGoLogin}>
        <Text style={styles.linkText}>Đã có tài khoản? Đăng nhập</Text>
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
    marginBottom: 12,
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
  },
});
