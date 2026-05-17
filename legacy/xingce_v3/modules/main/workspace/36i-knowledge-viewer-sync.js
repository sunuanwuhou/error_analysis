// ============================================================
// Embedded note viewer sync helpers
// ============================================================
function kwBuildViewerPayload(currentNode, markdown, emptyText) {
  if (!currentNode) return null;
  return {
    nodeId: currentNode.id,
    title: currentNode.title || "",
    pathText: collapseKnowledgePathTitles(getKnowledgePathTitles(currentNode.id)).join(" > "),
    markdown: markdown || "",
    emptyText: emptyText || ""
  };
}

function kwPostViewerPayload(frame, payload) {
  if (!frame || !frame.contentWindow || !payload) return;
  try {
    frame.contentWindow.postMessage(
      { type: "knowledge-note-viewer-sync", payload: payload },
      window.location.origin
    );
  } catch (error) {
    console.warn("post viewer payload failed", error);
  }
}

function kwBindViewerFrame(frame, getPayload) {
  if (!frame || frame.dataset.viewerBound === "1") return;
  frame.dataset.viewerBound = "1";
  frame.addEventListener("load", function () {
    var payload = typeof getPayload === "function" ? getPayload() : null;
    kwPostViewerPayload(frame, payload);
  });
}
