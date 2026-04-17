import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions, Pressable } from "react-native";
import { PieChart, BarChart } from "react-native-chart-kit";
import AdminUserManageScreen from "./AdminUserManageScreen";
import AdminApproveArticlesScreen from "./AdminApproveArticlesScreen";
import { getDb } from "../lib/db/core";

export default function AdminDashboardScreen({ onClose }) {
  const [screen, setScreen] = useState("dashboard"); // dashboard | stats | users | articles
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Chỉ fetch thống kê khi vào stats
  useEffect(() => {
    if (screen === "stats") {
      setLoading(true);
      getDb().then(async (db) => {
        try {
          const articlesByStatus = await db.getAllAsync(
            `SELECT status, COUNT(*) as count FROM articles GROUP BY status`
          );
          const usersByRole = await db.getAllAsync(
            `SELECT role, COUNT(*) as count FROM users GROUP BY role`
          );
          const articlesByDay = await db.getAllAsync(
            `SELECT substr(created_at, 1, 10) as day, COUNT(*) as count FROM articles
             WHERE created_at >= date('now', '-6 days')
             GROUP BY day ORDER BY day ASC`
          );
          setStats({ articlesByStatus, usersByRole, articlesByDay });
        } catch {
          setStats(null);
        } finally {
          setLoading(false);
        }
      });
    }
  }, [screen]);

  const chartWidth = Math.min(Dimensions.get('window').width - 32, 400);

  // Dashboard chọn chức năng
  if (screen === "dashboard") {
    return (
      <View style={{ flex: 1, backgroundColor: '#f6faff', paddingTop: 32, paddingHorizontal: 0 }}>
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1e90ff', marginBottom: 18 }}>Trang quản lý</Text>
        </View>
        <View style={{ gap: 18, marginHorizontal: 16 }}>
          <Pressable style={styles.adminMenuBtn} onPress={() => setScreen("stats")}> 
            <View style={styles.adminMenuIconWrap}>
              <Text style={{ fontSize: 38 }}>📊</Text>
            </View>
            <Text style={styles.adminMenuBtnText}>Thống kê</Text>
          </Pressable>
          <Pressable style={styles.adminMenuBtn} onPress={() => setScreen("articles")}> 
            <View style={styles.adminMenuIconWrap}>
              <Text style={{ fontSize: 34 }}>📰</Text>
            </View>
            <Text style={styles.adminMenuBtnText}>Duyệt bài viết</Text>
          </Pressable>
          <Pressable style={styles.adminMenuBtn} onPress={() => setScreen("users")}> 
            <View style={styles.adminMenuIconWrap}>
              <Text style={{ fontSize: 34 }}>👤</Text>
            </View>
            <Text style={styles.adminMenuBtnText}>Quản lý tài khoản</Text>
          </Pressable>
        </View>
        <Pressable style={{ marginTop: 32, alignSelf: 'center', backgroundColor: '#1e90ff', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 12 }} onPress={onClose}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Thoát</Text>
        </Pressable>
      </View>
    );
  }

  // Thống kê
  if (screen === "stats") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable style={styles.backBtn} onPress={() => setScreen("dashboard")}> 
          <Text style={styles.backBtnText}>{"< Quay lại"}</Text>
        </Pressable>
        <Text style={[styles.header, { marginBottom: 10 }]}>Thống kê hệ thống</Text>
        {loading || !stats ? (
          <ActivityIndicator size="large" color="#1e90ff" style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Bài viết theo trạng thái</Text>
            <PieChart
              data={stats.articlesByStatus.map((item, idx) => ({
                name: item.status,
                population: item.count,
                color: ["#f1c40f", "#2ecc40", "#d62828", "#888"][idx % 4],
                legendFontColor: "#333",
                legendFontSize: 14,
              }))}
              width={chartWidth}
              height={180}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"10"}
              absolute
            />

            <Text style={styles.sectionTitle}>Tài khoản theo vai trò</Text>
            <PieChart
              data={stats.usersByRole.map((item, idx) => ({
                name: item.role,
                population: item.count,
                color: ["#1e90ff", "#f39c12", "#888"][idx % 3],
                legendFontColor: "#333",
                legendFontSize: 14,
              }))}
              width={chartWidth}
              height={180}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"10"}
              absolute
            />

            <Text style={styles.sectionTitle}>Bài viết theo ngày (7 ngày gần nhất)</Text>
            <BarChart
              data={{
                labels: stats.articlesByDay.map(item => item.day.slice(5)),
                datasets: [{ data: stats.articlesByDay.map(item => item.count) }],
              }}
              width={chartWidth}
              height={200}
              chartConfig={chartConfig}
              style={{ borderRadius: 12 }}
            />
          </>
        )}
      </ScrollView>
    );
  }

  // Quản lý tài khoản
  if (screen === "users") {
    return <AdminUserManageScreen onGoBack={() => setScreen("dashboard")} />;
  }
  // Duyệt bài viết
  if (screen === "articles") {
    return <AdminApproveArticlesScreen onGoBack={() => setScreen("dashboard")} />;
  }
  return null;
}

const chartConfig = {
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  color: (opacity = 1) => `rgba(30, 144, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
  barPercentage: 0.7,
  useShadowColorFromDataset: false,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6faff', paddingTop: 32, paddingHorizontal: 16 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 18 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginTop: 18, marginBottom: 8, color: '#1e90ff' },
  adminMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    marginBottom: 0,
  },
  adminMenuIconWrap: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  adminMenuBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a3352',
  },
  backBtn: { position: 'absolute', top: 10, left: 10, zIndex: 10, padding: 8 },
  backBtnText: { fontSize: 16, color: '#1e90ff', fontWeight: 'bold' },
});
