import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { getUserProfile, updateUserProfile } from "../lib/database";

const FOOTBALL_TOPICS = [
  "Tin nóng bóng đá",
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Champions League",
  "Europa League",
  "Chuyển nhượng",
  "Nhận định trước trận",
  "Kết quả trận đấu",
  "Bảng xếp hạng",
];

export default function UserProfileScreen({
  currentUser,
  onProfileUpdated,
  onLogout,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [enablePush, setEnablePush] = useState(true);
  const [enableEmail, setEnableEmail] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const avatarName = useMemo(() => {
    const safe = (fullName || "").trim();
    if (!safe) return "U";
    return safe
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase() || "")
      .join("");
  }, [fullName]);

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile(currentUser.id);
        if (profile) {
          setFullName(profile.fullName || "");
          setUsername(profile.username || "");
          setEmail(profile.email || "");
          setAvatarUrl(profile.avatarUrl || "");
          setBio(profile.bio || "");
          setSelectedTopics(profile.favoriteTopics || []);
          setEnablePush(!!profile.enablePush);
          setEnableEmail(!!profile.enableEmail);
          setIsPrivate(!!profile.isPrivate);
        }
      } catch (e) {
        Alert.alert("Thông báo", e?.message || "Không thể tải hồ sơ.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [currentUser?.id]);

  function toggleTopic(topic) {
    setSelectedTopics((prev) => {
      const exists = prev.includes(topic);
      if (exists) return prev.filter((t) => t !== topic);
      return [...prev, topic];
    });
  }

  async function onSave() {
    if (!currentUser?.id) return;

    try {
      setSaving(true);
      const updatedProfile = await updateUserProfile(currentUser.id, {
        fullName,
        username,
        avatarUrl,
        bio,
        favoriteTopics: selectedTopics,
        enablePush,
        enableEmail,
        isPrivate,
      });
      if (updatedProfile) {
        onProfileUpdated?.(updatedProfile);
      }
      Alert.alert("Thành công", "Đã lưu thông tin hồ sơ.");
    } catch (e) {
      Alert.alert("Lỗi", e?.message || "Không thể lưu hồ sơ.");
    } finally {
      setSaving(false);
    }
  }

  async function onChangeAvatar() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Thông báo", "Bạn cần cấp quyền truy cập ảnh.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const mime = (file.mimeType || "image/jpeg").toLowerCase();
      const uri = String(file.uri || "");
      if (!uri) return;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setAvatarUrl(`data:${mime};base64,${base64}`);
    } catch (e) {
      Alert.alert("Lỗi", e?.message || "Không thể chọn ảnh đại diện.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <Text>Đang tải hồ sơ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Quản lý hồ sơ</Text>

        <View style={styles.card}>
          <View style={styles.avatarRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{avatarName}</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.namePreview}>{fullName || "Người dùng"}</Text>
              <Text style={styles.subtle}>@{username || "username"}</Text>

              <Pressable style={styles.outlineBtn} onPress={onChangeAvatar}>
                <Text style={styles.outlineBtnText}>Đổi ảnh đại diện</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>

          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nhập họ và tên"
            style={styles.input}
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Nhập username"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} editable={false} style={[styles.input, styles.readOnly]} />

          <Text style={styles.label}>Giới thiệu</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Giới thiệu ngắn về bạn..."
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.textArea]}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Sở thích nội dung</Text>
          <Text style={styles.subtle}>Chọn chủ đề bóng đá bạn quan tâm</Text>

          <View style={styles.topicWrap}>
            {FOOTBALL_TOPICS.map((topic) => {
              const active = selectedTopics.includes(topic);
              return (
                <Pressable
                  key={topic}
                  onPress={() => toggleTopic(topic)}
                  style={[styles.topicChip, active && styles.topicChipActive]}
                >
                  <Text style={[styles.topicText, active && styles.topicTextActive]}>{topic}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Cài đặt</Text>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Thông báo đẩy</Text>
              <Text style={styles.subtle}>Nhận thông báo tin mới</Text>
            </View>
            <Switch value={enablePush} onValueChange={setEnablePush} />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Thông báo email</Text>
              <Text style={styles.subtle}>Nhận email tổng hợp hằng tuần</Text>
            </View>
            <Switch value={enableEmail} onValueChange={setEnableEmail} />
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Tài khoản riêng tư</Text>
              <Text style={styles.subtle}>Ẩn một số hoạt động cá nhân</Text>
            </View>
            <Switch value={isPrivate} onValueChange={setIsPrivate} />
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={onSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Text>
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  container: {
    padding: 14,
    paddingBottom: 28,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#112b45",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5ecf4",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1b3a57",
    marginBottom: 8,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#1e90ff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#d9e6f5",
  },
  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  namePreview: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10263f",
  },
  subtle: {
    color: "#6c8098",
    marginTop: 2,
  },
  outlineBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#bfd8f3",
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#f3f9ff",
  },
  outlineBtnText: {
    color: "#1e62a8",
    fontWeight: "700",
  },
  label: {
    marginTop: 8,
    marginBottom: 5,
    color: "#334b64",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d7e2ee",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#1f3349",
  },
  readOnly: {
    backgroundColor: "#f2f5f8",
    color: "#6b7f95",
  },
  textArea: {
    minHeight: 110,
  },
  topicWrap: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  topicChip: {
    borderWidth: 1,
    borderColor: "#d7e2ee",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  topicChipActive: {
    borderColor: "#1e90ff",
    backgroundColor: "#eaf4ff",
  },
  topicText: {
    color: "#3f5872",
    fontWeight: "600",
  },
  topicTextActive: {
    color: "#1e62a8",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
  },
  settingTitle: {
    color: "#203950",
    fontWeight: "700",
  },
  saveBtn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#1e90ff",
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  logoutBtn: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3c8c8",
    backgroundColor: "#fff5f5",
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutBtnText: {
    color: "#c92a2a",
    fontWeight: "800",
    fontSize: 15,
  },
});
