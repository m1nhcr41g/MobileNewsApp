export async function convertWordFileWithServer(fileAsset, baseUrl) {
  const cleanBaseUrl = (baseUrl || "").trim().replace(/\/$/, "");
  if (!cleanBaseUrl) {
    return null;
  }

  const formData = new FormData();
  formData.append("file", {
    uri: fileAsset.uri,
    name: fileAsset.name || "document.docx",
    type:
      fileAsset.mimeType ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const response = await fetch(`${cleanBaseUrl}/api/word/convert`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.message || "Không thể xử lý file Word.");
  }

  return await response.json();
}
