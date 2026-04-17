import React, { useEffect, useMemo, useRef, useState } from "react";
import AdminDashboardScreen from "./AdminDashboardScreen";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  getCacheJson,
  setCacheJson,
  getHotNews,
  getLatestNews,
  getNewsByCategories,
  getPublishedNewsByTag,
  incrementArticleViewCount,
  getPersonalizedNews,
  recordUserRead,
  getArticleComments,
  createArticleComment,
} from "../lib/database";
import StandingsTable from "../components/StandingsTable";
import FixturesList from "../components/FixturesList";
import Header from "../components/Header";
import UserProfileScreen from "./UserProfileScreen";
import JournalistManageScreen from "./JournalistManageScreen";
import { FOOTBALL_DATA_API_KEY } from "@env";
import { WebView } from "react-native-webview";

const LEAGUES = [
  { code: "PL", name: "Premier League" },
  { code: "PD", name: "La Liga" },
  { code: "SA", name: "Serie A" },
  { code: "BL1", name: "Bundesliga" },
  { code: "FL1", name: "Ligue 1" },
];

const API_KEY = FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractImageUris(value) {
  const html = String(value || "");
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images = [];
  let match = regex.exec(html);
  while (match) {
    if (match[1]) {
      images.push(match[1]);
    }
    match = regex.exec(html);
  }
  return images;
}

function getSummaryText(item) {
  const direct = String(item?.summary || "").trim();
  if (direct) return direct;

  const source = stripHtml(item?.content || item?.content_html || "");
  if (!source) return "Bài viết chưa có tóm tắt.";
  return source.length > 140 ? `${source.slice(0, 140)}...` : source;
}

function getCardThumbnail(item) {
  if (item?.thumbnail_url) return item.thumbnail_url;
  const images = extractImageUris(item?.content_html);
  return images[0] || null;
}

function buildArticleContentHtml(item) {
  const html = String(item?.content_html || "").trim();
  if (html) return html;

  const plain = String(item?.content || "").trim();
  if (!plain) return "<p>Nội dung đang được cập nhật.</p>";

  return `<p>${escapeHtml(plain).replace(/\n/g, "<br/>")}</p>`;
}

function buildArticleHtmlDocument(htmlBody) {
  const fallbackImage = String(arguments[1] || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body {
            margin: 0;
            padding: 0;
            color: #263c54;
            line-height: 1.6;
            font-size: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            word-break: break-word;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 12px;
            margin: 8px 0;
          }
          p { margin: 0 0 12px; }
        </style>
      </head>
      <body>
        ${htmlBody}
        <script>
          (function () {
            var sent = false;
            var fallbackImage = '${fallbackImage}';

            function patchImages() {
              var imgs = Array.prototype.slice.call(document.images || []);
              imgs.forEach(function (img) {
                var src = (img.getAttribute('src') || '').trim();
                var isLocal = src.indexOf('content://') === 0 || src.indexOf('file://') === 0;

                if (isLocal && fallbackImage) {
                  img.src = fallbackImage;
                }

                img.onerror = function () {
                  if (fallbackImage && img.src !== fallbackImage) {
                    img.src = fallbackImage;
                  } else {
                    img.style.display = 'none';
                  }
                };
              });
            }

            function sendHeight() {
              if (sent) return;
              sent = true;
              var h = Math.max(
                document.body.scrollHeight || 0,
                document.documentElement.scrollHeight || 0
              );
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(String(h));
              }
            }

            function waitImagesThenSend() {
              patchImages();
              var imgs = Array.prototype.slice.call(document.images || []);
              if (!imgs.length) {
                setTimeout(sendHeight, 80);
                return;
              }

              var loaded = 0;
              function done() {
                loaded += 1;
                if (loaded >= imgs.length) {
                  setTimeout(sendHeight, 80);
                }
              }

              imgs.forEach(function (img) {
                if (img.complete) {
                  done();
                } else {
                  img.addEventListener("load", done, { once: true });
                  img.addEventListener("error", done, { once: true });
                }
              });

              setTimeout(sendHeight, 1200);
            }

            if (document.readyState === "complete") {
              waitImagesThenSend();
            } else {
              window.addEventListener("load", waitImagesThenSend, { once: true });
            }
          })();
        </script>
      </body>
    </html>
  `;
}

function NewsCard({ item, onPress, onPressTag, compact = false }) {
  const cardThumbnail = getCardThumbnail(item);
  const excerpt = getSummaryText(item);

  return (
    <Pressable style={[styles.card, compact && styles.cardCompact]} onPress={onPress}>
      {cardThumbnail ? (
        <Image source={{ uri: cardThumbnail }} style={styles.cardThumbnail} />
      ) : null}
      <Text style={styles.cardCategory}>{item.category_name || "Khác"}</Text>
      <Text style={styles.cardTitle} numberOfLines={compact ? 2 : 3}>
        {item.title}
      </Text>
      <Text style={styles.cardMeta}>
        {item.journalist_name || "Nhà báo"} · {item.view_count || 0} lượt đọc
      </Text>
      <Text style={styles.cardExcerpt} numberOfLines={compact ? 2 : 3}>
        {excerpt}
      </Text>
      {(item?.tags || []).length > 0 ? (
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <Pressable
              key={`${item.id}-${tag}`}
              style={styles.tagChipPressable}
              onPress={() => onPressTag?.(tag)}
            >
              <Text style={styles.tagChip}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function normalizeTagValue(value) {
  return String(value || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
}

export default function HomeScreen({ currentUser, onLogout }) {
  // Tất cả hook phải ở đầu!
  const [displayUser, setDisplayUser] = useState(currentUser);
  const [mainTab, setMainTab] = useState("news");
  const [selectedLeague, setSelectedLeague] = useState(LEAGUES[0].code);
  const [standings, setStandings] = useState({});
  const [fixtures, setFixtures] = useState({});
  const [footballLoading, setFootballLoading] = useState(true);
  const [footballError, setFootballError] = useState("");
  const [fixtureFilter, setFixtureFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [latestNews, setLatestNews] = useState([]);
  const [hotNews, setHotNews] = useState([]);
  const [categorySections, setCategorySections] = useState([]);
  const [personalizedNews, setPersonalizedNews] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState("");
  const [tagRelatedNews, setTagRelatedNews] = useState([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [detailHtmlHeight, setDetailHtmlHeight] = useState(360);
  const detailHeightUpdateCountRef = useRef(0);
  // Admin menu button state - PHẢI ở đầu!
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);

  useEffect(() => {
    setDisplayUser(currentUser);
  }, [currentUser]);

  function handleProfileUpdated(updatedProfile) {
    if (!updatedProfile) return;
    setDisplayUser((prev) => ({
      ...(prev || {}),
      ...updatedProfile,
      avatarUrl: updatedProfile.avatarUrl || prev?.avatarUrl || "",
    }));
  }

  const selectedSummary = useMemo(() => getSummaryText(selectedArticle), [selectedArticle]);
  const selectedContentHtml = useMemo(
    () => buildArticleContentHtml(selectedArticle),
    [selectedArticle],
  );

  useEffect(() => {
    if (selectedArticle?.id) {
      setDetailHtmlHeight(360);
      detailHeightUpdateCountRef.current = 0;
    }
  }, [selectedArticle?.id]);

  function getFilteredFixtures(items) {
    if (fixtureFilter === "ALL") return items;
    if (fixtureFilter === "SCHEDULED") {
      return items?.filter((f) => ["SCHEDULED", "TIMED"].includes(f.status));
    }
    return items?.filter((f) => f.status === fixtureFilter);
  }

  async function loadHomeData(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [latest, hot, sections] = await Promise.all([
        getLatestNews(8),
        getHotNews(5),
        getNewsByCategories({ maxCategories: 5, perCategoryLimit: 4 }),
      ]);
      setLatestNews(latest || []);
      setHotNews(hot || []);
      setCategorySections(sections || []);

      if (currentUser?.role === "user" && currentUser?.id) {
        const personalized = await getPersonalizedNews(currentUser.id, 6);
        setPersonalizedNews(personalized || []);
      } else {
        setPersonalizedNews([]);
      }
    } catch (e) {
      setError(e?.message || "Không thể tải trang tin tức.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    loadHomeData();
  }, []);

  useEffect(() => {
    async function fetchFootballData() {
      setFootballLoading(true);
      setFootballError("");

      const cachedStandings = await getCacheJson("standings_by_league", {});
      const cachedFixtures = await getCacheJson("fixtures_by_league", {});
      const hasCache =
        Object.keys(cachedStandings || {}).length > 0 ||
        Object.keys(cachedFixtures || {}).length > 0;

      if (hasCache) {
        setStandings(cachedStandings || {});
        setFixtures(cachedFixtures || {});
        setFootballLoading(false);
      }

      try {
        const standingsData = {};
        const fixturesData = {};
        await Promise.all(
          LEAGUES.map(async (league) => {
            const resStandings = await fetch(
              `${BASE_URL}/competitions/${league.code}/standings`,
              { headers: { "X-Auth-Token": API_KEY } },
            );
            const standingsJson = await resStandings.json();
            standingsData[league.code] =
              standingsJson.standings && standingsJson.standings[0]
                ? standingsJson.standings[0].table
                : [];

            const resFixtures = await fetch(
              `${BASE_URL}/competitions/${league.code}/matches?limit=100`,
              { headers: { "X-Auth-Token": API_KEY } },
            );
            const fixturesJson = await resFixtures.json();
            fixturesData[league.code] = fixturesJson.matches || [];
          }),
        );

        setStandings(standingsData);
        setFixtures(fixturesData);
        await setCacheJson("standings_by_league", standingsData);
        await setCacheJson("fixtures_by_league", fixturesData);
      } catch (e) {
        if (!hasCache) {
          setFootballError("Không thể tải dữ liệu bóng đá.");
        }
      } finally {
        if (!hasCache) {
          setFootballLoading(false);
        }
      }
    }

    fetchFootballData();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadHomeData(false);
    if (activeTagFilter) {
      await handleFilterByTag(activeTagFilter);
    }
    setRefreshing(false);
  }

  async function handleFilterByTag(tagValue) {
    const normalized = normalizeTagValue(tagValue);
    if (!normalized) {
      setActiveTagFilter("");
      setTagRelatedNews([]);
      return;
    }

    setTagLoading(true);
    try {
      const rows = await getPublishedNewsByTag(normalized, 30);
      setTagRelatedNews(rows || []);
      setActiveTagFilter(normalized);
      setSelectedArticle(null);
    } finally {
      setTagLoading(false);
    }
  }

  function clearTagFilter() {
    setActiveTagFilter("");
    setTagRelatedNews([]);
  }

  async function loadComments(articleId) {
    if (!articleId) return;
    setCommentsLoading(true);
    try {
      const rows = await getArticleComments(articleId);
      setComments(rows || []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function openArticle(item) {
    setSelectedArticle(item);
    setCommentInput("");
    await loadComments(item.id);
    try {
      await incrementArticleViewCount(item.id);
      await recordUserRead(currentUser?.id, item.id);
      setSelectedArticle((prev) =>
        prev && prev.id === item.id
          ? { ...prev, view_count: (prev.view_count || 0) + 1 }
          : prev,
      );
      setLatestNews((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, view_count: (n.view_count || 0) + 1 } : n)),
      );
      setHotNews((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, view_count: (n.view_count || 0) + 1 } : n)),
      );
      setCategorySections((prev) =>
        prev.map((section) => ({
          ...section,
          items: section.items.map((n) =>
            n.id === item.id ? { ...n, view_count: (n.view_count || 0) + 1 } : n,
          ),
        })),
      );
      setPersonalizedNews((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, view_count: (n.view_count || 0) + 1 } : n)),
      );
    } catch {
      // Fail silently; reading view should still open.
    }
  }

  async function handleSubmitComment() {
    if (!selectedArticle?.id || !currentUser?.id) {
      return;
    }

    if (!commentInput.trim()) {
      return;
    }

    try {
      setCommentSubmitting(true);
      await createArticleComment({
        articleId: selectedArticle.id,
        userId: currentUser.id,
        content: commentInput,
      });
      setCommentInput("");
      await loadComments(selectedArticle.id);
    } finally {
      setCommentSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => loadHomeData()}>
          <Text style={styles.retryText}>Tải lại</Text>
        </Pressable>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <Header
        currentUser={displayUser || currentUser}
        mainTab={mainTab}
        onChangeTab={setMainTab}
        showManageTab={currentUser?.role === "journalist"}
      />

      {/* Admin menu button, only for admin */}
      {currentUser?.role === "admin" && (
        <View style={{ alignItems: "flex-end", marginRight: 18, marginTop: 2 }}>
          <Pressable
            style={{ backgroundColor: "#1e90ff", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 16, marginBottom: 6 }}
            onPress={() => setShowAdminDashboard(true)}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Quản trị</Text>
          </Pressable>
        </View>
      )}

      {/* Admin dashboard modal */}
      {showAdminDashboard && (
        <Modal
          visible={showAdminDashboard}
          animationType="slide"
          onRequestClose={() => setShowAdminDashboard(false)}
        >
          <AdminDashboardScreen onClose={() => setShowAdminDashboard(false)} />
        </Modal>
      )}

      {mainTab === "manage" && currentUser?.role === "journalist" ? (
        <JournalistManageScreen currentUser={currentUser} onLogout={onLogout} embedded />
      ) : mainTab === "profile" ? (
        <UserProfileScreen
          currentUser={currentUser}
          onProfileUpdated={handleProfileUpdated}
          onLogout={onLogout}
        />
      ) : mainTab === "news" ? (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.pageTitle}>Trang tin tức</Text>

          {activeTagFilter ? (
            <View style={{ marginBottom: 12 }}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Bài liên quan #{activeTagFilter}</Text>
                <Pressable onPress={clearTagFilter}>
                  <Text style={styles.clearFilterText}>Xóa lọc</Text>
                </Pressable>
              </View>
              {tagLoading ? (
                <ActivityIndicator size="small" color="#1e90ff" style={{ marginVertical: 8 }} />
              ) : tagRelatedNews.length ? (
                tagRelatedNews.map((item) => (
                  <NewsCard
                    key={`tag-${activeTagFilter}-${item.id}`}
                    item={item}
                    onPress={() => openArticle(item)}
                    onPressTag={handleFilterByTag}
                  />
                ))
              ) : (
                <Text style={styles.emptyPersonalizedText}>Không có bài viết nào với tag này.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Dành cho bạn</Text>
            <Text style={styles.sectionHint}>Cá nhân hóa theo lịch sử đọc</Text>
          </View>
          {(personalizedNews || []).length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(personalizedNews || []).map((item) => (
                <View style={{ width: 290, marginRight: 10 }} key={`foryou-${item.id}`}>
                  <NewsCard
                    item={item}
                    compact
                    onPress={() => openArticle(item)}
                    onPressTag={handleFilterByTag}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyPersonalizedText}>
              Đọc vài bài để hệ thống gợi ý tin đúng sở thích của bạn.
            </Text>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tin mới nhất</Text>
            <Text style={styles.sectionHint}>Cập nhật liên tục</Text>
          </View>
          {(latestNews || []).map((item) => (
            <NewsCard
              key={`latest-${item.id}`}
              item={item}
              onPress={() => openArticle(item)}
              onPressTag={handleFilterByTag}
            />
          ))}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tin hot</Text>
            <Text style={styles.sectionHint}>Xếp theo lượt đọc</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(hotNews || []).map((item) => (
              <View style={{ width: 290, marginRight: 10 }} key={`hot-${item.id}`}>
                <NewsCard
                  item={item}
                  compact
                  onPress={() => openArticle(item)}
                  onPressTag={handleFilterByTag}
                />
              </View>
            ))}
          </ScrollView>

          {(categorySections || []).map((section) => (
            <View key={section.id} style={{ marginTop: 14 }}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>{section.name}</Text>
                <Text style={styles.sectionHint}>{section.items?.length || 0} bài</Text>
              </View>
              {(section.items || []).map((item) => (
                <NewsCard
                  key={`${section.id}-${item.id}`}
                  item={item}
                  onPress={() => openArticle(item)}
                  onPressTag={handleFilterByTag}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : mainTab === "standings" || mainTab === "fixtures" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {footballLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#1e90ff" />
            </View>
          ) : footballError ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{footballError}</Text>
            </View>
          ) : (
            <>
              <Picker
                selectedValue={selectedLeague}
                onValueChange={setSelectedLeague}
                style={{ marginHorizontal: 10, marginTop: 8 }}
              >
                {LEAGUES.map((league) => (
                  <Picker.Item label={league.name} value={league.code} key={league.code} />
                ))}
              </Picker>

              {mainTab === "standings" ? (
                <StandingsTable
                  standings={standings[selectedLeague]}
                  leagueName={LEAGUES.find((l) => l.code === selectedLeague)?.name || ""}
                />
              ) : (
                <>
                  <View style={styles.fixtureFilterRow}>
                    <Text
                      style={[
                        styles.fixtureFilterText,
                        fixtureFilter === "ALL" && styles.fixtureFilterTextActive,
                      ]}
                      onPress={() => setFixtureFilter("ALL")}
                    >
                      Tất cả
                    </Text>
                    <Text
                      style={[
                        styles.fixtureFilterText,
                        fixtureFilter === "SCHEDULED" && styles.fixtureFilterTextActive,
                      ]}
                      onPress={() => setFixtureFilter("SCHEDULED")}
                    >
                      Sắp diễn ra
                    </Text>
                    <Text
                      style={[
                        styles.fixtureFilterText,
                        fixtureFilter === "IN_PLAY" && styles.fixtureFilterTextActive,
                      ]}
                      onPress={() => setFixtureFilter("IN_PLAY")}
                    >
                      Đang diễn ra
                    </Text>
                    <Text
                      style={[
                        styles.fixtureFilterText,
                        fixtureFilter === "FINISHED" && styles.fixtureFilterTextActive,
                      ]}
                      onPress={() => setFixtureFilter("FINISHED")}
                    >
                      Đã kết thúc
                    </Text>
                  </View>
                  <FixturesList
                    fixtures={getFilteredFixtures(fixtures[selectedLeague])}
                    leagueName={LEAGUES.find((l) => l.code === selectedLeague)?.name || ""}
                  />
                </>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>Mục không hợp lệ.</Text>
        </View>
      )}

      <Modal
        visible={!!selectedArticle}
        animationType="slide"
        onRequestClose={() => setSelectedArticle(null)}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalHeaderTitle}>Chi tiết bài viết</Text>
          <Pressable onPress={() => setSelectedArticle(null)}>
            <Text style={styles.closeText}>Đóng</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {(selectedArticle?.thumbnail_url || extractImageUris(selectedArticle?.content_html)[0]) ? (
            <Image
              source={{
                uri:
                  selectedArticle?.thumbnail_url ||
                  extractImageUris(selectedArticle?.content_html)[0],
              }}
              style={styles.detailThumbnail}
            />
          ) : null}
          <Text style={styles.detailCategory}>{selectedArticle?.category_name || "Khác"}</Text>
          <Text style={styles.detailTitle}>{selectedArticle?.title || ""}</Text>
          <Text style={styles.detailMeta}>
            {selectedArticle?.journalist_name || "Nhà báo"} · {selectedArticle?.view_count || 0} lượt đọc
          </Text>
          {(selectedArticle?.tags || []).length > 0 ? (
            <View style={styles.tagRowDetail}>
              {selectedArticle.tags.map((tag) => (
                <Pressable
                  key={`detail-${selectedArticle.id}-${tag}`}
                  style={styles.tagChipPressable}
                  onPress={() => handleFilterByTag(tag)}
                >
                  <Text style={styles.tagChip}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.detailSummary}>{selectedSummary}</Text>

          <WebView
            originWhitelist={["*"]}
            source={{
              html: buildArticleHtmlDocument(
                selectedContentHtml,
                selectedArticle?.thumbnail_url || "",
              ),
            }}
            style={[styles.detailHtmlView, { height: detailHtmlHeight }]}
            scrollEnabled={false}
            onMessage={(event) => {
              const nextHeight = Number(event?.nativeEvent?.data);
              if (!Number.isFinite(nextHeight)) return;
              const safeHeight = Math.max(240, Math.min(nextHeight + 12, 6000));
              if (Math.abs(safeHeight - detailHtmlHeight) < 16) return;
              if (detailHeightUpdateCountRef.current >= 2) return;
              detailHeightUpdateCountRef.current += 1;
              setDetailHtmlHeight(safeHeight);
            }}
          />

          <Text style={styles.commentTitle}>Bình luận</Text>
          {commentsLoading ? (
            <ActivityIndicator size="small" color="#1e90ff" style={{ marginVertical: 8 }} />
          ) : comments.length ? (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <Text style={styles.commentAuthor}>
                  {comment.author_name || "Người dùng"} ({comment.author_role || "user"})
                </Text>
                <Text style={styles.commentContent}>{comment.content}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.commentEmpty}>Chưa có bình luận nào.</Text>
          )}

          <View style={styles.commentInputWrap}>
            <TextInput
              style={styles.commentInput}
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder="Nhập bình luận của bạn..."
            />
            <Pressable
              style={styles.commentSendBtn}
              onPress={handleSubmitComment}
              disabled={commentSubmitting}
            >
              <Text style={styles.commentSendText}>
                {commentSubmitting ? "Đang gửi..." : "Gửi"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f8fc",
  },
  centerBox: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: "#c03131",
    textAlign: "center",
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: "#1e90ff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
    color: "#1b2f47",
  },
  sectionHeaderRow: {
    marginTop: 10,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1a3352",
  },
  sectionHint: {
    color: "#67809c",
    fontSize: 12,
  },
  clearFilterText: {
    color: "#1e62a8",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyPersonalizedText: {
    color: "#6a7f97",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e6edf6",
  },
  cardThumbnail: {
    width: "100%",
    height: 170,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#e8edf5",
  },
  cardCompact: {
    minHeight: 170,
  },
  cardCategory: {
    color: "#3572b0",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    color: "#10253c",
    fontWeight: "700",
    lineHeight: 23,
  },
  cardMeta: {
    marginTop: 6,
    color: "#607287",
    fontSize: 12,
  },
  cardExcerpt: {
    marginTop: 8,
    color: "#33465c",
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagRowDetail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  tagChipPressable: {
    borderRadius: 999,
  },
  tagChip: {
    color: "#1e62a8",
    backgroundColor: "#eaf4ff",
    borderWidth: 1,
    borderColor: "#cfe4fb",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
  },
  modalHeader: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e7eaf1",
    backgroundColor: "#fff",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a3352",
  },
  closeText: {
    color: "#1e62a8",
    fontWeight: "700",
  },
  detailThumbnail: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: "#e8edf5",
  },
  detailCategory: {
    color: "#3572b0",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#11283f",
    lineHeight: 32,
  },
  detailMeta: {
    marginTop: 8,
    color: "#607287",
    marginBottom: 12,
  },
  detailSummary: {
    marginBottom: 12,
    fontWeight: "600",
    color: "#395068",
    lineHeight: 22,
  },
  detailHtmlView: {
    width: "100%",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  commentTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "700",
    color: "#1b3351",
  },
  commentItem: {
    backgroundColor: "#f6f8fc",
    borderWidth: 1,
    borderColor: "#e2e8f1",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  commentAuthor: {
    fontWeight: "700",
    color: "#304863",
    marginBottom: 4,
    fontSize: 12,
  },
  commentContent: {
    color: "#263c54",
    lineHeight: 20,
  },
  commentEmpty: {
    color: "#6a7f97",
    marginBottom: 8,
  },
  commentInputWrap: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d6e0ec",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  commentSendBtn: {
    backgroundColor: "#1e90ff",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  commentSendText: {
    color: "#fff",
    fontWeight: "700",
  },
  fixtureFilterRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 6,
    flexWrap: "wrap",
  },
  fixtureFilterText: {
    marginHorizontal: 6,
    marginVertical: 4,
    color: "#6f7f90",
    fontWeight: "600",
  },
  fixtureFilterTextActive: {
    color: "#1e90ff",
  },
});
