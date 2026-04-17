import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Alert, Image, SafeAreaView, ScrollView
} from "react-native";
import {
  getArticles,
  approveArticle as backendApprove,
  rejectArticle as backendReject,
  unpublishArticle as backendUnpublish,
  resetArticleToPending as backendReset,
} from "../lib/db/articleAdmin";

const FILTERS = [
  { label: "Tất cả",    value: "all" },
  { label: "Chờ duyệt", value: "pending" },
  { label: "Đã duyệt",  value: "approved" },
  { label: "Từ chối",   value: "rejected" },
];

const STATUS_CONFIG = {
  published: { label: "Đã duyệt",  bg: "#D1FAE5", color: "#065F46" },
  archived:  { label: "Từ chối",   bg: "#FEE2E2", color: "#991B1B" },
  draft:     { label: "Chờ duyệt", bg: "#FFF3CD", color: "#856404" },
  pending:   { label: "Chờ duyệt", bg: "#FFF3CD", color: "#856404" },
};

// Định nghĩa các action có thể thực hiện theo từng trạng thái
const ACTIONS_CONFIG = {
  draft:     ["approve", "reject"],
  pending:   ["approve", "reject"],
  published: ["unpublish", "reset"],
  archived:  ["approve", "reset"],
};

const ACTION_DEF = {
  approve:   { label: "Duyệt",           style: "primary",     confirm: "Duyệt bài viết này?" },
  reject:    { label: "Từ chối",          style: "danger",      confirm: "Từ chối bài viết này?" },
  unpublish: { label: "Gỡ bài",           style: "warning",     confirm: "Gỡ bài viết này khỏi mục đã duyệt?" },
  reset:     { label: "Về chờ duyệt",    style: "secondary",   confirm: "Chuyển bài về trạng thái chờ duyệt?" },
};

export default function AdminApproveArticlesScreen({ onGoBack }) {
  const [articles, setArticles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  async function fetchArticles() {
    setLoading(true);
    try {
      const rows = await getArticles({ status: statusFilter });
      setArticles(rows);
    } catch (e) {
      Alert.alert("Lỗi", e?.message || "Không tải được danh sách bài viết.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchArticles(); }, [statusFilter]);

  function handleAction(actionKey, articleId) {
    const def = ACTION_DEF[actionKey];
    Alert.alert("Xác nhận", def.confirm, [
      { text: "Hủy", style: "cancel" },
      {
        text: def.label,
        style: actionKey === "reject" || actionKey === "unpublish" ? "destructive" : "default",
        onPress: async () => {
          try {
            if (actionKey === "approve")   await backendApprove(articleId);
            if (actionKey === "reject")    await backendReject(articleId);
            if (actionKey === "unpublish") await backendUnpublish(articleId);
            if (actionKey === "reset")     await backendReset(articleId);
            fetchArticles();
          } catch (e) {
            Alert.alert("Lỗi", e?.message);
          }
        },
      },
    ]);
  }

  function renderItem({ item }) {
    const cfg     = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const actions = ACTIONS_CONFIG[item.status] || [];

    return (
      <View style={s.card}>
        {item.thumbnail_url
          ? <Image source={{ uri: item.thumbnail_url }} style={s.thumb} />
          : <View style={s.thumbPlaceholder}>
              <Text style={s.thumbIcon}>🖼</Text>
            </View>
        }

        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.cardSummary} numberOfLines={2}>{item.summary}</Text>

          <View style={s.metaRow}>
            <Text style={s.metaItem}>👤 {item.author || "Ẩn danh"}</Text>
            <Text style={s.metaItem}>📂 {item.category_name || "—"}</Text>
          </View>

          <View style={s.cardFooter}>
            <View style={[s.badge, { backgroundColor: cfg.bg }]}>
              <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>

            {actions.length > 0 && (
              <View style={s.actions}>
                {actions.map(actionKey => (
                  <Pressable
                    key={actionKey}
                    style={[s.btn, s[`btn_${ACTION_DEF[actionKey].style}`]]}
                    onPress={() => handleAction(actionKey, item.id)}
                  >
                    <Text style={[s.btnText, s[`btnText_${ACTION_DEF[actionKey].style}`]]}>
                      {ACTION_DEF[actionKey].label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={onGoBack} hitSlop={8}>
          <Text style={s.backArrow}>‹</Text>
        </Pressable>
        <Text style={s.headerTitle}>Kiểm duyệt bài viết</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.filterBar} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => (
          <Pressable
            key={f.value}
            style={[s.chip, statusFilter === f.value && s.chipActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[s.chipText, statusFilter === f.value && s.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {!loading && (
        <Text style={s.countText}>{articles.length} bài viết</Text>
      )}

      {loading
        ? <ActivityIndicator size="large" color="#1e90ff" style={{ marginTop: 48 }} />
        : <FlatList
            data={articles}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchArticles(); }}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>Không có bài viết nào.</Text>
              </View>
            }
          />
      }
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 12,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center",
  },
  backArrow: { fontSize: 24, color: "#1e90ff", lineHeight: 28, marginTop: -2 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "600", color: "#1A202C" },

  filterBar: { backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E2E8F0", maxHeight: 52 },
  filterContent: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    borderWidth: 0.5, borderColor: "#CBD5E0", backgroundColor: "transparent",
  },
  chipActive: { backgroundColor: "#1e90ff", borderColor: "#1e90ff" },
  chipText: { fontSize: 13, color: "#64748B" },
  chipTextActive: { color: "#fff", fontWeight: "600" },

  countText: { fontSize: 12, color: "#94A3B8", paddingHorizontal: 14, paddingVertical: 8 },

  card: {
    backgroundColor: "#fff", borderRadius: 12,
    marginBottom: 10, overflow: "hidden",
    borderWidth: 0.5, borderColor: "#E2E8F0",
  },
  thumb: { width: "100%", height: 150 },
  thumbPlaceholder: {
    width: "100%", height: 150,
    backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center",
  },
  thumbIcon: { fontSize: 32 },

  cardBody: { padding: 12 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1A202C", marginBottom: 4, lineHeight: 21 },
  cardSummary: { fontSize: 13, color: "#64748B", lineHeight: 19, marginBottom: 10 },

  metaRow: { flexDirection: "row", gap: 14, marginBottom: 12 },
  metaItem: { fontSize: 12, color: "#94A3B8" },

  cardFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 0.5, borderTopColor: "#F1F5F9", paddingTop: 10, flexWrap: "wrap", gap: 8,
  },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5 },
  btn_primary:   { backgroundColor: "#1e90ff", borderColor: "#1e90ff" },
  btn_danger:    { backgroundColor: "transparent", borderColor: "#DC2626" },
  btn_warning:   { backgroundColor: "transparent", borderColor: "#D97706" },
  btn_secondary: { backgroundColor: "transparent", borderColor: "#94A3B8" },

  btnText: { fontSize: 12, fontWeight: "600" },
  btnText_primary:   { color: "#fff" },
  btnText_danger:    { color: "#DC2626" },
  btnText_warning:   { color: "#D97706" },
  btnText_secondary: { color: "#64748B" },

  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 14, color: "#94A3B8" },
});