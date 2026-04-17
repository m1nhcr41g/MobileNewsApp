import React from "react";
import { FlatList } from "react-native";
import NewsItem from "./NewsItem";

export default function NewsList({ data }) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item, idx) =>
        item.id ? item.id.toString() : idx.toString()
      }
      renderItem={({ item }) => (
        <NewsItem
          title={item.title}
          description={item.description}
          imageUrl={item.imageUrl}
          publishedAt={item.publishedAt}
        />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}
