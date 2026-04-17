import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function FixturesList({ fixtures, leagueName }) {
  if (!fixtures || fixtures.length === 0) return null;

  // Group fixtures by matchday
  const grouped = {};
  fixtures.forEach((item) => {
    const round = item.matchday || "Khác";
    if (!grouped[round]) grouped[round] = [];
    grouped[round].push(item);
  });
  const rounds = Object.keys(grouped).sort((a, b) => a - b);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.league}>{leagueName}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {rounds.map((round) => (
          <View style={styles.roundBlock} key={round.toString()}>
            <Text style={styles.roundTitle}>Vòng {round}</Text>
            {grouped[round].map((item) => (
              <View style={styles.row} key={item.id}>
                <Text style={styles.team}>{item.homeTeam.name}</Text>
                <Text style={styles.score}>
                  {item.score.fullTime.home ?? "-"} -{" "}
                  {item.score.fullTime.away ?? "-"}
                </Text>
                <Text style={styles.team}>{item.awayTeam.name}</Text>
                <Text style={styles.time}>{formatDate(item.utcDate)}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  roundBlock: {
    marginBottom: 12,
    backgroundColor: "#eaf6ff",
    borderRadius: 6,
    paddingBottom: 2,
  },
  roundTitle: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#1e90ff",
    marginBottom: 2,
    marginTop: 6,
    marginLeft: 4,
  },
  wrapper: {
    marginVertical: 10,
    marginHorizontal: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
    elevation: 2,
  },
  league: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 6,
    color: "#1e90ff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 4,
  },
  team: {
    flex: 2,
    fontSize: 13,
    textAlign: "center",
  },
  score: {
    flex: 1,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  time: {
    flex: 2,
    fontSize: 12,
    color: "#888",
    textAlign: "center",
  },
});
