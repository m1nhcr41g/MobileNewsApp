import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import {
  changeJournalistArticleStatus,
  createArticleComment,
  createJournalistArticle,
  deleteJournalistArticle,
  getArticleAttachments,
  getArticleComments,
  getCategories,
  getJournalistArticles,
  getTags,
  updateJournalistArticle,
} from "../lib/database";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { WebView } from "react-native-webview";
import { WORD_IMPORT_API_URL } from "@env";
import { convertWordFileWithServer } from "../lib/wordImportService";

import { Picker } from "@react-native-picker/picker";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";

const STATUSES = ["draft", "published", "archived"];

function StatusBadge({ status }) {
  const palette =
    status === "published"
      ? { bg: "#e7f7ee", fg: "#1f8f4d" }
      : status === "archived"
        ? { bg: "#fff5e8", fg: "#a85c12" }
        : { bg: "#eef2ff", fg: "#3b5bdb" };

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{status}</Text>
    </View>
  );
}

export default function JournalistManageScreen({
  currentUser,
  onLogout,
  embedded = false,
}) {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openEditor, setOpenEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const richRef = useRef(null);
  const [summary, setSummary] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [convertingWord, setConvertingWord] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [openPreview, setOpenPreview] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((item) => {
      map[item.id] = item.name;
    });
    return map;
  }, [categories]);

  async function loadData(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [articleRows, categoryRows, tagRows] = await Promise.all([
        getJournalistArticles(currentUser?.id),
        getCategories(),
        getTags(),
      ]);
      setArticles(
        (articleRows || []).map((item) => ({
          ...item,
          tags: item.tag_names ? item.tag_names.split("||").filter(Boolean) : [],
        })),
      );
      setCategories(categoryRows || []);
      setTags(tagRows || []);
      if (!categoryId && categoryRows?.[0]?.id) {
        setCategoryId(categoryRows[0].id);
      }
    } catch (e) {
      setError(e?.message || "Khong the tai du lieu bai viet.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }

  function resetForm() {
    setTitle("");
    setSummary("");
    setContent("");
    setContentHtml("");
    setThumbnailUrl("");
    setThumbnailFile(null);
    setStatus("draft");
    setCategoryId(categories?.[0]?.id || "");
    setSelectedTags([]);
    setNewTagInput("");
    setAttachmentFiles([]);
    setComments([]);
    setCommentInput("");
    setEditingArticle(null);
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

  function mapAttachmentRows(rows) {
    return (rows || []).map((item) => ({
      id: item.id,
      fileName: item.file_name,
      fileUri: item.file_uri,
      mimeType: item.mime_type,
      fileSize: item.file_size,
      sourceType: item.source_type || "word",
      processStatus: item.process_status || "pending",
      extractedContent: item.extracted_content || "",
    }));
  }

  function openCreateModal() {
    resetForm();
    setOpenEditor(true);
  }

  async function openEditModal(article) {
    setEditingArticle(article);
    setTitle(article.title || "");
    setSummary(article.summary || "");
    setContent(article.content || "");
    setContentHtml(article.content_html || article.content || "");
    setThumbnailUrl(article.thumbnail_url || "");
    setThumbnailFile(
      article.thumbnail_url
        ? { uri: article.thumbnail_url, name: "thumbnail", mimeType: "image/*", fileSize: 0 }
        : null,
    );
    setStatus(article.status || "draft");
    setCategoryId(article.category_id || categories?.[0]?.id || "");
    setSelectedTags(Array.isArray(article.tags) ? article.tags : []);
    setNewTagInput("");
    setCommentInput("");

    try {
      const rows = await getArticleAttachments(article.id);
      setAttachmentFiles(mapAttachmentRows(rows));
    } catch {
      setAttachmentFiles([]);
    }

    await loadComments(article.id);

    setOpenEditor(true);
  }

  async function handleSubmitCommentInEditor() {
    if (!editingArticle?.id || !currentUser?.id) return;
    if (!commentInput.trim()) return;

    try {
      setCommentSubmitting(true);
      await createArticleComment({
        articleId: editingArticle.id,
        userId: currentUser.id,
        content: commentInput,
      });
      setCommentInput("");
      await loadComments(editingArticle.id);
    } catch (e) {
      Alert.alert("Thong bao", e?.message || "Khong the gui binh luan.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handlePickWordFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const picked = result.assets[0];
      const fileName = (picked.name || "").trim();
      if (!fileName) return;

      setConvertingWord(true);

      let converted = null;
      if (WORD_IMPORT_API_URL) {
        converted = await convertWordFileWithServer(picked, WORD_IMPORT_API_URL);
      }

      if (converted?.suggestedTitle && !title.trim()) {
        setTitle(converted.suggestedTitle);
      }

      if (converted?.plainText && !content.trim()) {
        setContent(converted.plainText);
      }

      if (converted?.html) {
        setPreviewHtml(converted.html);
      }

      setAttachmentFiles((prev) => {
        const existed = prev.some(
          (item) => (item.fileName || "").toLowerCase() === fileName.toLowerCase(),
        );
        if (existed) return prev;

        return [
          ...prev,
          {
            fileName,
            fileUri: picked.uri || null,
            mimeType: picked.mimeType || null,
            fileSize: picked.size ?? null,
            sourceType: "word",
            processStatus: converted?.html ? "processed" : "pending",
            extractedContent: converted?.html || "",
          },
        ];
      });
    } catch (e) {
      Alert.alert("Thông báo", e?.message || "Không thể chọn file Word.");
    } finally {
      setConvertingWord(false);
    }
  }

  function removeAttachment(fileName) {
    setAttachmentFiles((prev) =>
      prev.filter((item) => (item.fileName || "") !== fileName),
    );
  }

  function handlePreviewAttachment(file) {
    const html = file?.extractedContent || "";
    if (!html) {
      Alert.alert(
        "Thong bao",
        "File nay chua duoc convert. Hay chay word-import-server va thu lai.",
      );
      return;
    }
    setPreviewHtml(html);
    setOpenPreview(true);
  }

  function handleAddTagFromInput() {
    const clean = newTagInput.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (!selectedTags.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    setNewTagInput("");
  }

  function toggleTagSelection(tagName) {
    const exists = selectedTags.some(
      (item) => item.toLowerCase() === tagName.toLowerCase(),
    );
    if (exists) {
      setSelectedTags((prev) =>
        prev.filter((item) => item.toLowerCase() !== tagName.toLowerCase()),
      );
      return;
    }
    setSelectedTags((prev) => [...prev, tagName]);
  }

  async function handleSave() {
    try {
      const plainContent = stripHtml(contentHtml || content);

      if (!title.trim() || !summary.trim() || !plainContent.trim()) {
        Alert.alert("Thông báo", "Vui lòng nhập Tiêu đề, Tóm tắt và Nội dung.");
        return;
      }

      if (!categoryId) {
        Alert.alert("Thông báo", "Vui lòng chọn chuyên mục.");
        return;
      }

      if (!thumbnailUrl) {
        Alert.alert("Thông báo", "Vui lòng chọn ảnh thumbnail.");
        return;
      }

      setSaving(true);

      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        content: plainContent,
        contentPlain: plainContent,
        contentHtml: contentHtml || "",
        thumbnailUrl,
        status,
        categoryId,
        tags: selectedTags,
        attachments: attachmentFiles,
      };
      if (editingArticle) {
        await updateJournalistArticle(currentUser?.id, editingArticle.id, payload);
      } else {
        await createJournalistArticle(currentUser?.id, payload);
      }
      setOpenEditor(false);
      resetForm();
      await loadData(false);
    } catch (e) {
      Alert.alert("Thong bao", e?.message || "Khong the luu bai viet.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(articleId) {
    Alert.alert("Xac nhan", "Ban co chac chan muon xoa bai viet nay?", [
      { text: "Huy", style: "cancel" },
      {
        text: "Xoa",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteJournalistArticle(currentUser?.id, articleId);
            await loadData(false);
          } catch (e) {
            Alert.alert("Thong bao", e?.message || "Khong the xoa bai viet.");
          }
        },
      },
    ]);
  }

  async function toggleStatus(article) {
    const nextStatus =
      article.status === "draft"
        ? "published"
        : article.status === "published"
          ? "archived"
          : "draft";

    try {
      await changeJournalistArticleStatus(currentUser?.id, article.id, nextStatus);
      await loadData(false);
    } catch (e) {
      Alert.alert("Thong bao", e?.message || "Khong the cap nhat trang thai.");
    }
  }


  function stripHtml(value) {
    return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function inferMimeType(asset) {
    const raw = String(asset?.mimeType || "").toLowerCase();
    if (raw) return raw;

    const uri = String(asset?.uri || "").toLowerCase();
    if (uri.endsWith(".png")) return "image/png";
    if (uri.endsWith(".webp")) return "image/webp";
    if (uri.endsWith(".jpg") || uri.endsWith(".jpeg")) return "image/jpeg";
    return "image/jpeg";
  }

  async function toDataUri(asset) {
    const uri = String(asset?.uri || "");
    if (!uri) return "";
    if (uri.startsWith("data:")) return uri;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${inferMimeType(asset)};base64,${base64}`;
  }

  async function handlePickThumbnail() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Thông báo", "Bạn cần cấp quyền truy cập ảnh.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const mime = (file.mimeType || "").toLowerCase();
      const isValidType =
        mime.includes("jpeg") ||
        mime.includes("jpg") ||
        mime.includes("png") ||
        mime.includes("webp");
      if (!isValidType) {
        Alert.alert("Thông báo", "Thumbnail chỉ hỗ trợ JPG, PNG, WEBP.");
        return;
      }

      if ((file.fileSize || 0) > 4 * 1024 * 1024) {
        Alert.alert("Thông báo", "Thumbnail tối đa 4MB.");
        return;
      }

      setThumbnailFile({
        uri: file.uri,
        name: file.fileName || "thumbnail.jpg",
        mimeType: file.mimeType || "image/jpeg",
        fileSize: file.fileSize || 0,
      });

      const dataUri = await toDataUri(file);
      setThumbnailUrl(dataUri || file.uri);
    } catch (e) {
      Alert.alert("Thông báo", e?.message || "Không thể chọn thumbnail.");
    }
  }

  async function handleInsertContentImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Thông báo", "Bạn cần cấp quyền truy cập ảnh.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const imageUri = result.assets[0]?.uri;
      if (!imageUri) {
        return;
      }

      const dataUri = await toDataUri(result.assets[0]);
      richRef.current?.insertImage(dataUri || imageUri);
    } catch (e) {
      Alert.alert("Thông báo", e?.message || "Không thể chèn ảnh vào nội dung.");
    }
  }


  return (
    <View style={styles.container}>
      {!embedded ? (
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Quan ly bai bao</Text>
            <Text style={styles.subtitle}>{currentUser?.fullName || currentUser?.username}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutText}>Dang xuat</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Pressable style={styles.primaryButton} onPress={openCreateModal}>
          <Text style={styles.primaryButtonText}>+ Bai viet moi</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <Text>Dang tai bai viet...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Chua co bai viet nao. Tao bai moi de bat dau.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <StatusBadge status={item.status} />
              </View>

              <Text style={styles.metaLine}>
                Danh muc: {item.category_name || categoryMap[item.category_id] || "N/A"}
              </Text>
              <Text style={styles.metaLine}>Cap nhat: {item.updated_at || "-"}</Text>
              <Text style={styles.metaLine}>
                Tep Word: {item.attachment_count || 0}
              </Text>
              {item.tags?.length ? (
                <View style={styles.tagRow}>
                  {item.tags.map((tag) => (
                    <View key={`${item.id}-${tag}`} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text numberOfLines={3} style={styles.excerpt}>
                {item.content}
              </Text>

              <View style={styles.cardActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => openEditModal(item)}>
                  <Text style={styles.secondaryBtnText}>Sua</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={() => toggleStatus(item)}>
                  <Text style={styles.secondaryBtnText}>Doi trang thai</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryBtn, styles.dangerBtn]}
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={[styles.secondaryBtnText, styles.dangerText]}>Xoa</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={openEditor} animationType="slide" onRequestClose={() => setOpenEditor(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.modalTitle}>{editingArticle ? "Sua bai viet" : "Tao bai viet"}</Text>

          <Text style={styles.label}>Tieu de</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Nhap tieu de"
          />

          <Text style={styles.label}>Tom tat</Text>
          <TextInput
            style={[styles.input, styles.summaryInput]}
            value={summary}
            onChangeText={setSummary}
            placeholder="Mo ta ngan gon noi dung bai viet"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Danh muc</Text>
          <View style={styles.pickerBox}>
            <Picker selectedValue={categoryId} onValueChange={setCategoryId}>
              <Picker.Item label="Khong chon" value="" />
              {categories.map((cat) => (
                <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Anh thumbnail</Text>
          <Pressable style={styles.thumbnailBtn} onPress={handlePickThumbnail}>
            <Text style={styles.pickFileBtnText}>Chon anh (JPG, PNG, WEBP, toi da 4MB)</Text>
          </Pressable>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.thumbnailPreview} />
          ) : null}

          <Text style={styles.label}>Noi dung</Text>
          <View style={styles.richEditorWrap}>
            <RichToolbar
              editor={richRef}
              actions={[
                actions.setBold,
                actions.setItalic,
                actions.setUnderline,
                actions.insertBulletsList,
                actions.insertOrderedList,
                actions.insertLink,
                actions.insertImage,
              ]}
              onPressAddImage={handleInsertContentImage}
            />
            <RichEditor
              ref={richRef}
              initialContentHTML={contentHtml}
              placeholder="Nhap noi dung bai viet..."
              onChange={setContentHtml}
              style={styles.richEditor}
            />
          </View>

          <Text style={styles.label}>Trang thai</Text>
          <View style={styles.statusRow}>
            {STATUSES.map((item) => (
              <Pressable
                key={item}
                style={[styles.statusPill, status === item && styles.statusPillActive]}
                onPress={() => setStatus(item)}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    status === item && styles.statusPillTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Tag da chon</Text>
          <View style={styles.tagRow}>
            {selectedTags.length ? (
              selectedTags.map((tag) => (
                <Pressable
                  key={`selected-${tag}`}
                  style={[styles.tagPill, styles.tagPillSelected]}
                  onPress={() => toggleTagSelection(tag)}
                >
                  <Text style={[styles.tagPillText, styles.tagPillSelectedText]}>
                    #{tag} x
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.helperText}>Chua chon tag nao.</Text>
            )}
          </View>

          <Text style={styles.label}>Chon tag co san</Text>
          <View style={styles.tagRow}>
            {tags.length ? (
              tags.map((tag) => {
                const active = selectedTags.some(
                  (item) => item.toLowerCase() === tag.name.toLowerCase(),
                );
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.tagPill, active && styles.tagPillSelected]}
                    onPress={() => toggleTagSelection(tag.name)}
                  >
                    <Text
                      style={[styles.tagPillText, active && styles.tagPillSelectedText]}
                    >
                      #{tag.name}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.helperText}>Chua co tag trong he thong.</Text>
            )}
          </View>

          <Text style={styles.label}>Them tag moi</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, styles.tagInput]}
              value={newTagInput}
              onChangeText={setNewTagInput}
              placeholder="Nhap ten tag..."
            />
            <Pressable style={styles.addTagBtn} onPress={handleAddTagFromInput}>
              <Text style={styles.addTagBtnText}>Them</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>File Word đính kèm</Text>
          <Pressable style={styles.pickFileBtn} onPress={handlePickWordFile}>
            <Text style={styles.pickFileBtnText}>+ Chọn file .doc/.docx</Text>
          </Pressable>
          <Text style={styles.helperText}>
            {WORD_IMPORT_API_URL
              ? `Dang ket noi convert server: ${WORD_IMPORT_API_URL}`
              : "Chua cau hinh WORD_IMPORT_API_URL, file se luu dang pending."}
          </Text>
          {convertingWord ? (
            <View style={styles.convertingBox}>
              <ActivityIndicator size="small" color="#1e90ff" />
              <Text style={styles.helperText}>Dang convert file Word...</Text>
            </View>
          ) : null}

          <View style={styles.attachmentList}>
            {attachmentFiles.length ? (
              attachmentFiles.map((file) => (
                <View key={file.fileName} style={styles.attachmentItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {file.fileName}
                    </Text>
                    <Text style={styles.attachmentMeta}>
                      {(file.fileSize || 0) > 0
                        ? `${Math.ceil(file.fileSize / 1024)} KB`
                        : "Dung luong khong ro"}
                    </Text>
                    <Text style={styles.attachmentMeta}>
                      Trang thai: {file.processStatus || "pending"}
                    </Text>
                  </View>
                  <View style={styles.attachmentActions}>
                    <Pressable onPress={() => handlePreviewAttachment(file)}>
                      <Text style={styles.previewAttachmentText}>Xem</Text>
                    </Pressable>
                    <Pressable onPress={() => removeAttachment(file.fileName)}>
                      <Text style={styles.removeAttachmentText}>Xoa</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.helperText}>Chua co file Word nao.</Text>
            )}
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.secondaryBtn, { flex: 1 }]}
              onPress={() => setOpenEditor(false)}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Huy</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, { flex: 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? "Dang luu..." : "Luu bai viet"}
              </Text>
            </Pressable>
          </View>

          {editingArticle ? (
            <>
              <Text style={styles.commentTitle}>Binh luan</Text>
              {commentsLoading ? (
                <ActivityIndicator size="small" color="#1e90ff" style={{ marginBottom: 8 }} />
              ) : comments.length ? (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <Text style={styles.commentAuthor}>
                      {comment.author_name || "Nguoi dung"} ({comment.author_role || "user"})
                    </Text>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.helperText}>Chua co binh luan nao.</Text>
              )}

              <View style={styles.commentInputWrap}>
                <TextInput
                  style={styles.commentInput}
                  value={commentInput}
                  onChangeText={setCommentInput}
                  placeholder="Nhap binh luan..."
                />
                <Pressable
                  style={styles.commentSendBtn}
                  onPress={handleSubmitCommentInEditor}
                  disabled={commentSubmitting}
                >
                  <Text style={styles.commentSendText}>
                    {commentSubmitting ? "Dang gui..." : "Gui"}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </Modal>

      <Modal
        visible={openPreview}
        animationType="slide"
        onRequestClose={() => setOpenPreview(false)}
      >
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Preview Word Layout</Text>
          <Pressable onPress={() => setOpenPreview(false)}>
            <Text style={styles.previewClose}>Dong</Text>
          </Pressable>
        </View>
        {previewHtml ? (
          <WebView source={{ html: previewHtml }} style={{ flex: 1 }} />
        ) : (
          <View style={styles.centerBox}>
            <Text>Khong co noi dung de preview.</Text>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    marginTop: 4,
    color: "#5f6b7a",
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f3f7",
  },
  logoutText: {
    color: "#1b3d6d",
    fontWeight: "600",
  },
  toolbar: {
    padding: 12,
  },
  primaryButton: {
    backgroundColor: "#1e90ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: "#cc3434",
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#67768a",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#edf0f5",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metaLine: {
    marginTop: 6,
    color: "#5f6b7a",
    fontSize: 12,
  },
  excerpt: {
    marginTop: 8,
    color: "#2d3640",
    lineHeight: 20,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d0d9e5",
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryBtnText: {
    color: "#244467",
    fontWeight: "600",
  },
  dangerBtn: {
    borderColor: "#f1cbcb",
    backgroundColor: "#fff5f5",
  },
  dangerText: {
    color: "#c03131",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    color: "#445468",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8dee8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 140,
  },
  summaryInput: {
    minHeight: 88,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: "#d8dee8",
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  thumbnailBtn: {
    borderWidth: 1,
    borderColor: "#bfd9ff",
    backgroundColor: "#f2f8ff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  thumbnailPreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginTop: 2,
    marginBottom: 12,
    backgroundColor: "#f3f6fb",
  },
  richEditorWrap: {
    borderWidth: 1,
    borderColor: "#d8dee8",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  richEditor: {
    minHeight: 220,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  statusPill: {
    borderWidth: 1,
    borderColor: "#d8dee8",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillActive: {
    borderColor: "#1e90ff",
    backgroundColor: "#eaf4ff",
  },
  statusPillText: {
    color: "#445468",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  statusPillTextActive: {
    color: "#1e62a8",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tagPill: {
    borderWidth: 1,
    borderColor: "#d8dee8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f7f9fc",
  },
  tagPillSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eaf3ff",
  },
  tagPillText: {
    color: "#445468",
    fontWeight: "600",
  },
  tagPillSelectedText: {
    color: "#1e62a8",
  },
  tagInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  tagInput: {
    flex: 1,
    marginBottom: 0,
  },
  addTagBtn: {
    backgroundColor: "#1e90ff",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addTagBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  helperText: {
    color: "#6a7788",
  },
  pickFileBtn: {
    borderWidth: 1,
    borderColor: "#bfd9ff",
    backgroundColor: "#f2f8ff",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  pickFileBtnText: {
    color: "#1e62a8",
    fontWeight: "700",
  },
  attachmentList: {
    marginTop: 8,
    marginBottom: 14,
    gap: 8,
  },
  attachmentItem: {
    borderWidth: 1,
    borderColor: "#dbe4ef",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attachmentName: {
    color: "#233243",
    fontWeight: "600",
  },
  attachmentMeta: {
    color: "#66788a",
    fontSize: 12,
    marginTop: 2,
  },
  removeAttachmentText: {
    color: "#c03131",
    fontWeight: "700",
  },
  previewAttachmentText: {
    color: "#1e62a8",
    fontWeight: "700",
    marginRight: 10,
  },
  attachmentActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  convertingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  previewHeader: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  previewClose: {
    color: "#1e62a8",
    fontWeight: "700",
  },
  commentTitle: {
    marginTop: 14,
    marginBottom: 8,
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
  commentInputWrap: {
    marginTop: 8,
    marginBottom: 8,
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
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 24,
  },
});
