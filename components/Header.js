import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

function getDisplayName(currentUser) {
  if (!currentUser) return "Bạn";
  return currentUser.fullName || currentUser.username || "Bạn";
}

function getDateLabel() {
  return new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Header({
  currentUser,
  mainTab,
  onChangeTab,
  showManageTab = false,
}) {
  const greetingName = useMemo(() => getDisplayName(currentUser), [currentUser]);
  const dateLabel = useMemo(() => getDateLabel(), []);
  const avatarUrl = currentUser?.avatarUrl || "";
  const avatarFallback = (greetingName || "B").trim().charAt(0).toUpperCase();

  return (
    <View style={styles.wrapper}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.brand}>TRUST ME BRO</Text>
          <Pressable
            style={[
              styles.avatarBtn,
              mainTab === "profile" && styles.tabBtnActive,
            ]}
            onPress={() => onChangeTab?.("profile")}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallback}>{avatarFallback}</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.headline}>Tin chuẩn 24/24</Text>
        <Text style={styles.meta}>{dateLabel}</Text>
        <Text style={styles.meta}>Xin chào, {greetingName}</Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, mainTab === "news" && styles.tabBtnActive]}
            onPress={() => onChangeTab?.("news")}
          >
            <Text style={[styles.tabText, mainTab === "news" && styles.tabTextActive]}>
              Tin tức
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, mainTab === "standings" && styles.tabBtnActive]}
            onPress={() => onChangeTab?.("standings")}
          >
            <Text style={[styles.tabText, mainTab === "standings" && styles.tabTextActive]}>
              Bảng xếp hạng
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, mainTab === "fixtures" && styles.tabBtnActive]}
            onPress={() => onChangeTab?.("fixtures")}
          >
            <Text style={[styles.tabText, mainTab === "fixtures" && styles.tabTextActive]}>
              Lịch thi đấu
            </Text>
          </Pressable>
          {showManageTab ? (
            <Pressable
              style={[styles.tabBtn, mainTab === "manage" && styles.tabBtnActive]}
              onPress={() => onChangeTab?.("manage")}
            >
              <Text style={[styles.tabText, mainTab === "manage" && styles.tabTextActive]}>
                Quản lý
              </Text>
            </Pressable>
          ) : null}

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingTop: 30,
    paddingBottom: 10,
    backgroundColor: "#f6f8fc",
  },
  heroCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#13293d",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: "#9dd1ff",
    fontWeight: "800",
    letterSpacing: 1.2,
    fontSize: 12,
  },
  headline: {
    marginTop: 4,
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 20,
  },
  meta: {
    marginTop: 4,
    color: "#c9d8e8",
    fontSize: 12,
  },
  tabRow: {
    marginTop: 12,
    backgroundColor: "rgba(233, 238, 247, 0.12)",
    borderRadius: 10,
    padding: 5,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tabBtn: {
    minWidth: "28%",
    flexGrow: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#1e90ff",
  },
  tabText: {
    color: "#cfe1f6",
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#fff",
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#76a9dc",
    backgroundColor: "#0f2235",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    color: "#d8ebff",
    fontWeight: "800",
  },
});
