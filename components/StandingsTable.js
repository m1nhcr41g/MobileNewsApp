import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";

// Xác định nhóm dựa trên vị trí (áp dụng cho La Liga, EPL, Serie A, Bundesliga, Ligue 1)
function getGroup(idx, totalTeams) {
  if (typeof totalTeams === "number" && totalTeams >= 3 && idx >= totalTeams - 3) {
    return { label: "Xuống hạng", color: "#e03131" };
  }
  if (idx < 4) return { label: "Champions League", color: "#2ecc40" };
  if (idx === 4) return { label: "Europa League", color: "#0074D9" };
  if (idx === 5) return { label: "Conference League", color: "#B10DC9" };
  return null;
}

export default function StandingsTable({ standings, leagueName }) {
  if (!standings || standings.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.league}>{leagueName}</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.cell, styles.headerCell, styles.rankCol]}>#</Text>
          <Text style={[styles.cell, styles.headerCell, styles.logoCol]}></Text>
          <Text style={[styles.cell, styles.headerCell, styles.teamCol]}>Đội</Text>
          <Text style={[styles.cell, styles.headerCell]}>ST</Text>
          <Text style={[styles.cell, styles.headerCell]}>T</Text>
          <Text style={[styles.cell, styles.headerCell]}>H</Text>
          <Text style={[styles.cell, styles.headerCell]}>B</Text>
          <Text style={[styles.cell, styles.headerCell]}>+/-</Text>
          <Text style={[styles.cell, styles.headerCell]}>Đ</Text>
        </View>

        {standings.map((team, idx) => {
          const group = getGroup(idx, standings.length);
          const prevGroup = idx > 0 ? getGroup(idx - 1, standings.length) : null;
          const showGroupLabel =
            group && (!prevGroup || group.label !== prevGroup.label);

          return (
            <React.Fragment key={team.team.id}>
              {showGroupLabel ? (
                <View style={[styles.groupRow, { borderLeftColor: group.color }]}>
                  <Text style={[styles.groupLabel, { color: group.color }]}>{group.label}</Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.row,
                  group ? { borderLeftColor: group.color, borderLeftWidth: 3 } : null,
                ]}
              >
                <Text style={[styles.cell, styles.rankCol]}>{idx + 1}</Text>
                <View style={[styles.cell, styles.logoCol, styles.logoWrap]}>
                  {team.team.crest ? (
                    <Image
                      source={{ uri: team.team.crest }}
                      style={styles.logoImg}
                      resizeMode="contain"
                    />
                  ) : null}
                </View>
                <Text
                  style={[styles.cell, styles.teamCol, styles.teamName]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {team.team.name}
                </Text>
                <Text style={styles.cell}>{team.playedGames}</Text>
                <Text style={styles.cell}>{team.won}</Text>
                <Text style={styles.cell}>{team.draw}</Text>
                <Text style={styles.cell}>{team.lost}</Text>
                <Text style={styles.cell}>
                  {team.goalDifference ?? team.goalsFor - team.goalsAgainst}
                </Text>
                <Text style={styles.cell}>{team.points}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
    marginHorizontal: 8,
    backgroundColor: "#f5f7fb",
    borderRadius: 10,
    padding: 8,
  },
  league: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 6,
    color: "#1e90ff",
  },
  table: {
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#e8edf4",
    borderRadius: 6,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 5,
    alignItems: "center",
    minHeight: 36,
  },
  cell: {
    flex: 0.55,
    paddingHorizontal: 2,
    paddingVertical: 2,
    fontSize: 11,
    textAlign: "center",
    color: "#1f3348",
  },
  rankCol: {
    flex: 0.45,
    textAlign: "center",
    color: "#888",
  },
  logoCol: {
    flex: 0.65,
  },
  logoWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  logoImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  teamCol: {
    flex: 2.2,
    textAlign: "left",
    paddingLeft: 6,
  },
  teamName: {
    textAlign: "left",
    fontSize: 11,
    fontWeight: "600",
  },
  headerCell: {
    fontWeight: "700",
    color: "#333",
    fontSize: 10,
  },
  groupRow: {
    backgroundColor: "#f0f8ff",
    paddingVertical: 4,
    paddingLeft: 8,
    borderLeftWidth: 3,
    marginTop: 6,
    marginBottom: 2,
  },
  groupLabel: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
