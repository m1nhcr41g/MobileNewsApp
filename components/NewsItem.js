import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

export default function NewsItem({
  title,
  description,
  imageUrl,
  publishedAt,
}) {
  return (
    <View style={styles.container}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : null}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc} numberOfLines={2}>
          {description}
        </Text>
        <Text style={styles.time}>{publishedAt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginVertical: 8,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 2,
    marginHorizontal: 10,
  },
  image: {
    width: 100,
    height: 80,
  },
  content: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  title: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  desc: {
    color: "#555",
    fontSize: 13,
  },
  time: {
    color: "#888",
    fontSize: 11,
    marginTop: 6,
  },
});
