import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, Alert, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { getUsers, deleteUser as backendDeleteUser, toggleLockUser as backendToggleLockUser, changeUserRole } from "../lib/db/userAdmin";

export default function AdminUserManageScreen({ onGoBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    try {
      const rows = await getUsers({ search, role: roleFilter });
      setUsers(rows);
    } catch (e) {
      Alert.alert("Lỗi", e?.message || "Không tải được danh sách tài khoản.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  async function deleteUser(userId) {
    Alert.alert("Xác nhận", "Bạn có chắc muốn xóa tài khoản này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa", style: "destructive", onPress: async () => {
          try {
            await backendDeleteUser(userId);
            fetchUsers();
          } catch (e) {
            Alert.alert("Lỗi", e?.message || "Không xóa được tài khoản.");
          }
        }
      }
    ]);
  }

  async function toggleLockUser(userId, isLocked) {
    try {
      await backendToggleLockUser(userId, isLocked);
      fetchUsers();
    } catch (e) {
      Alert.alert("Lỗi", e?.message || "Không cập nhật trạng thái khóa.");
    }
  }

  async function changeRole(userId, currentRole) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    Alert.alert(
      "Xác nhận",
      `Bạn có chắc muốn chuyển quyền thành ${newRole}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý", onPress: async () => {
            try {
              await changeUserRole(userId, newRole);
              fetchUsers();
            } catch (e) {
              Alert.alert("Lỗi", e?.message || "Không đổi được quyền.");
            }
          }
        }
      ]
    );
  }

  function renderItem({ item }) {
    return (
      <View style={styles.userCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.username}>{item.username} ({item.role})</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#1e90ff' }]} onPress={() => changeRole(item.id, item.role)}>
            <Text style={styles.actionText}>Phân quyền</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#d62828' }]} onPress={() => deleteUser(item.id)}>
            <Text style={styles.actionText}>Xóa</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.backBtn} onPress={onGoBack}>
        <Text style={styles.backBtnText}>{"< Quay lại"}</Text>
      </Pressable>
      <Text style={styles.header}>Quản lý tài khoản</Text>
      <View style={styles.filterRow}>
        <TextInput
          style={styles.input}
          placeholder="Tìm username..."
          value={search}
          onChangeText={setSearch}
        />
        <Picker
          selectedValue={roleFilter}
          style={styles.picker}
          onValueChange={setRoleFilter}
        >
          <Picker.Item label="Tất cả" value="all" />
          <Picker.Item label="Admin" value="admin" />
          <Picker.Item label="User" value="user" />
        </Picker>
        <Pressable style={styles.searchBtn} onPress={fetchUsers}>
          <Text style={styles.searchBtnText}>🔍 Tìm kiếm</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#1e90ff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchUsers(); }}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40 }}>Không có tài khoản nào.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6faff', paddingTop: 32 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10 },
  input: { flex: 2, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8, backgroundColor: '#fff' },
  picker: { flex: 1, height: 40 },
  searchBtn: { backgroundColor: '#1e90ff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, marginLeft: 8 },
  searchBtnText: { color: '#fff', fontWeight: 'bold' },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, elevation: 2 },
  username: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  email: { color: '#444', marginBottom: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginHorizontal: 2 },
  actionText: { color: '#fff', fontWeight: 'bold' },
  backBtn: { position: 'absolute', top: 10, left: 10, zIndex: 10, padding: 8 },
  backBtnText: { fontSize: 16, color: '#1e90ff', fontWeight: 'bold' },
});
