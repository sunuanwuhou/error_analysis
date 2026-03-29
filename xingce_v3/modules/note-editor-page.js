(function () {
  var TEXT = {
    dirty: "\u672a\u4fdd\u5b58",
    synced: "\u5df2\u540c\u6b65",
    noteTitle: "\u77e5\u8bc6\u70b9\u7b14\u8bb0",
    openFromHost: "\u8bf7\u4ece\u4e3b\u9875\u9762\u6253\u5f00",
    saveSuccessToast: "\u7b14\u8bb0\u5df2\u4fdd\u5b58",
    saveFailed: "\u4fdd\u5b58\u5931\u8d25\uff1a\u4e3b\u9875\u9762\u5df2\u4e0d\u53ef\u7528\uff0c\u8bf7\u8fd4\u56de\u5de5\u4f5c\u53f0\u91cd\u8bd5\u3002",
    savedToHost: "\u5df2\u4fdd\u5b58\u5230\u4e3b\u5de5\u4f5c\u53f0\u3002",
    refreshFailed: "\u65e0\u6cd5\u8bfb\u53d6\u4e3b\u9875\u9762\u4e2d\u7684\u77e5\u8bc6\u70b9\uff0c\u8bf7\u91cd\u65b0\u4ece\u5de5\u4f5c\u53f0\u6253\u5f00\u3002",
    confirmRefresh: "\u5f53\u524d\u7f16\u8f91\u5668\u6709\u672a\u4fdd\u5b58\u5185\u5bb9\uff0c\u786e\u5b9a\u4ece\u4e3b\u9875\u9762\u91cd\u65b0\u52a0\u8f7d\u5417\uff1f",
    refreshed: "\u5df2\u4ece\u4e3b\u5de5\u4f5c\u53f0\u5237\u65b0\u3002",
    confirmClose: "\u5f53\u524d\u8fd8\u6709\u672a\u4fdd\u5b58\u5185\u5bb9\uff0c\u786e\u5b9a\u76f4\u63a5\u5173\u95ed\u5417\uff1f",
    unavailableTitle: "\u65e0\u6cd5\u6253\u5f00\u7b14\u8bb0\u7f16\u8f91\u5668",
    unavailableHint: "\u8bf7\u4ece\u4e3b\u5de5\u4f5c\u53f0\u7684\u77e5\u8bc6\u70b9\u9875\u9762\u70b9\u51fb\u201c\u72ec\u7acb\u7f16\u8f91\u201d\u3002",
    editorLoadFailed: "\u6210\u719f\u7f16\u8f91\u5668\u8d44\u6e90\u52a0\u8f7d\u5931\u8d25\u3002",
    editorPlaceholder: "# \u89c4\u5219\u603b\u7ed3\n## \u6613\u9519\u70b9\n- ...\n\n## \u4e0b\u4e00\u6b65\u52a8\u4f5c\n- ...",
    editing: "\u6b63\u5728\u7f16\u8f91\uff0c\u8bb0\u5f97\u4fdd\u5b58\u3002",
    syncedStatus: "\u5185\u5bb9\u5df2\u4e0e\u4e3b\u5de5\u4f5c\u53f0\u540c\u6b65\u3002",
    noHostContext: "\u5f53\u524d\u9875\u9762\u7f3a\u5c11\u4e3b\u5de5\u4f5c\u53f0\u4e0a\u4e0b\u6587\u3002",
    nodeMissing: "\u76ee\u6807\u77e5\u8bc6\u70b9\u4e0d\u5b58\u5728\uff0c\u53ef\u80fd\u5df2\u7ecf\u88ab\u5220\u9664\u3002",
    connected: "\u5df2\u8fde\u63a5\u5230\u4e3b\u5de5\u4f5c\u53f0\uff0c\u652f\u6301 Ctrl+S \u4fdd\u5b58\u3002",
    imageUploading: "\u6b63\u5728\u4e0a\u4f20\u56fe\u7247...",
    imageInserted: "\u5df2\u63d2\u5165\u56fe\u7247\u5f15\u7528\u3002",
    imageUploadFailed: "\u56fe\u7247\u4e0a\u4f20\u5931\u8d25\uff0c\u672a\u63d2\u5165\u5185\u5bb9\u3002",
    imageBridgeMissing: "\u4e3b\u9875\u9762\u7f3a\u5c11\u56fe\u7247\u5b58\u50a8\u80fd\u529b\uff0c\u8bf7\u5237\u65b0\u5de5\u4f5c\u53f0\u540e\u91cd\u8bd5\u3002"
  };

  var state = {
    host: null,
    nodeId: "",
    editor: null,
    lastSavedValue: "",
    dirty: false,
    embed: false,
    previewObserver: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message, tone) {
    var status = byId("saveStatus");
    if (!status) return;
    status.textContent = message || "";
    status.className = "editor-status" + (tone ? " is-" + tone : "");
  }

  function setDirty(nextDirty) {
    state.dirty = !!nextDirty;
    var flag = byId("dirtyFlag");
    if (flag) flag.textContent = state.dirty ? TEXT.dirty : TEXT.synced;
  }

  function getHostWindow() {
    if (window.opener && !window.opener.closed) return window.opener;
    if (window.parent && window.parent !== window) return window.parent;
    return null;
  }

  function notifyHost(message) {
    if (!state.host || typeof state.host.postMessage !== "function") return;
    try {
      state.host.postMessage(message, window.location.origin);
    } catch (error) {
      console.warn("notify host failed", error);
    }
  }

  function getCurrentNode() {
    if (!state.host || typeof state.host.getKnowledgeNodeById !== "function" || !state.nodeId) return null;
    return state.host.getKnowledgeNodeById(state.nodeId);
  }

  function getPathText() {
    if (!state.host) return "";
    if (
      typeof state.host.getKnowledgePathTitles === "function" &&
      typeof state.host.collapseKnowledgePathTitles === "function"
    ) {
      return state.host.collapseKnowledgePathTitles(state.host.getKnowledgePathTitles(state.nodeId)).join(" > ");
    }
    var node = getCurrentNode();
    return node ? (node.title || "") : "";
  }

  function syncHeader() {
    var node = getCurrentNode();
    var titleEl = byId("noteTitle");
    var pathEl = byId("notePath");
    if (titleEl) titleEl.textContent = node ? (node.title || TEXT.noteTitle) : TEXT.noteTitle;
    if (pathEl) pathEl.textContent = getPathText() || TEXT.openFromHost;
  }

  function updateHostAfterSave(markdown) {
    var node = getCurrentNode();
    if (!state.host || !node) return false;
    if (typeof state.host.ensureKnowledgeState === "function") state.host.ensureKnowledgeState();
    node.contentMd = markdown;
    node.updatedAt = new Date().toISOString();
    if (typeof state.host.ensureKnowledgeNoteRecord === "function") {
      try {
        state.host.ensureKnowledgeNoteRecord(node);
      } catch (error) {
        console.warn("ensureKnowledgeNoteRecord failed", error);
      }
    }
    if (typeof state.host.saveKnowledgeState === "function") state.host.saveKnowledgeState();
    if ("noteEditing" in state.host) state.host.noteEditing = false;
    if ("selectedKnowledgeNodeId" in state.host) state.host.selectedKnowledgeNodeId = node.id;
    if (typeof state.host.renderSidebar === "function") state.host.renderSidebar();
    if (typeof state.host.renderAll === "function") state.host.renderAll();
    if (typeof state.host.renderNotesByType === "function") state.host.renderNotesByType();
    if (typeof state.host.renderNotesPanelRight === "function") state.host.renderNotesPanelRight();
    if (typeof state.host.showToast === "function") state.host.showToast(TEXT.saveSuccessToast, "success");
    return true;
  }

  function saveNote(closeAfterSave) {
    if (!state.editor) return;
    var markdown = state.editor.getMarkdown();
    var updated = updateHostAfterSave(markdown);
    if (!updated) {
      setStatus(TEXT.saveFailed, "error");
      return;
    }
    state.lastSavedValue = markdown;
    setDirty(false);
    syncHeader();
    setStatus(TEXT.savedToHost, "success");
    notifyHost({ type: "knowledge-note-saved", nodeId: state.nodeId });
    if (closeAfterSave) requestNoteEditorClose(true);
  }

  function refreshFromHost(force) {
    var node = getCurrentNode();
    if (!node) {
      setStatus(TEXT.refreshFailed, "error");
      return;
    }
    if (state.dirty && !force) {
      var confirmed = window.confirm(TEXT.confirmRefresh);
      if (!confirmed) return;
    }
    var markdown = node.contentMd || "";
    if (state.editor) state.editor.setMarkdown(markdown, false);
    state.lastSavedValue = markdown;
    setDirty(false);
    syncHeader();
    setStatus(TEXT.refreshed, "info");
  }

  function bindShortcuts() {
    window.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "s") {
        event.preventDefault();
        saveNote(false);
      }
    });
    window.addEventListener("beforeunload", function (event) {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  function bindActions() {
    var saveBtn = byId("saveBtn");
    var saveCloseBtn = byId("saveCloseBtn");
    var refreshBtn = byId("refreshBtn");
    var focusBtn = byId("focusWorkbenchBtn");
    var closeBtn = byId("closeBtn");

    if (saveBtn) saveBtn.addEventListener("click", function () { saveNote(false); });
    if (saveCloseBtn) saveCloseBtn.addEventListener("click", function () { saveNote(true); });
    if (refreshBtn) refreshBtn.addEventListener("click", function () { refreshFromHost(false); });
    if (focusBtn) {
      focusBtn.addEventListener("click", function () {
        if (state.host && typeof state.host.focus === "function") state.host.focus();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        requestNoteEditorClose(false);
      });
    }
  }

  function requestNoteEditorClose(force) {
    if (state.dirty && !force) {
      var confirmed = window.confirm(TEXT.confirmClose);
      if (!confirmed) return false;
    }
    if (state.embed) {
      notifyHost({ type: "knowledge-note-editor-close", nodeId: state.nodeId });
      return true;
    }
    window.close();
    return true;
  }

  function exposeTestApi() {
    window.__knowledgeNoteEditorTest = {
      getMarkdown: function () {
        return state.editor ? state.editor.getMarkdown() : "";
      },
      setMarkdown: function (markdown) {
        if (!state.editor) return false;
        state.editor.setMarkdown(String(markdown || ""), false);
        schedulePatchEditorPreviewImages();
        return true;
      },
      save: function (closeAfterSave) {
        saveNote(!!closeAfterSave);
        return true;
      }
    };
  }

  function applyEmbedMode() {
    document.body.classList.toggle("is-embedded", state.embed);
    var focusBtn = byId("focusWorkbenchBtn");
    if (focusBtn) focusBtn.style.display = state.embed ? "none" : "";
  }

  function resolveNoteImageUrl(value) {
    var ref = String(value || "");
    if (ref.indexOf("noteimg:") !== 0) return ref;
    var imageId = ref.slice(8);
    if (state.host && typeof state.host.getNoteImageRef === "function") {
      try {
        return state.host.getNoteImageRef(imageId) || ref;
      } catch (error) {
        console.warn("getNoteImageRef failed", error);
      }
    }
    if (state.host && typeof state.host.resolveNoteImgs === "function") {
      try {
        return state.host.resolveNoteImgs(ref) || ref;
      } catch (error) {
        console.warn("resolveNoteImgs failed", error);
      }
    }
    return ref;
  }

  function extractMarkdownImageRefs(markdown) {
    var refs = [];
    String(markdown || "").replace(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, function (_, ref) {
      refs.push(String(ref || ""));
      return _;
    });
    return refs;
  }

  function patchEditorPreviewImages() {
    var root = byId("editor");
    if (!root || !state.editor) return;
    var refs = extractMarkdownImageRefs(state.editor.getMarkdown());
    var refIndex = 0;
    root.querySelectorAll(".toastui-editor-md-preview img").forEach(function (img) {
      var raw = img.getAttribute("src") || "";
      var ref = raw;
      if (!ref) {
        ref = refs[refIndex] || "";
      }
      refIndex += 1;
      if (ref.indexOf("noteimg:") !== 0) return;
      var resolved = resolveNoteImageUrl(ref);
      if (!resolved || resolved === raw) return;
      img.setAttribute("src", resolved);
    });
  }

  function schedulePatchEditorPreviewImages() {
    requestAnimationFrame(function () {
      requestAnimationFrame(patchEditorPreviewImages);
    });
  }

  function bindPreviewImageResolver() {
    var root = byId("editor");
    if (!root) return;
    var previewHost = root.querySelector(".toastui-editor-md-preview");
    if (!previewHost) return;

    if (state.previewObserver) {
      state.previewObserver.disconnect();
      state.previewObserver = null;
    }

    state.previewObserver = new MutationObserver(function () {
      patchEditorPreviewImages();
    });
    state.previewObserver.observe(previewHost, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"]
    });
    schedulePatchEditorPreviewImages();
  }

  function getNoteImageId() {
    if (state.host && typeof state.host.noteImgId === "function") {
      return state.host.noteImgId();
    }
    return "ni" + Math.random().toString(36).slice(2, 8);
  }

  function uploadImageBlob(blob) {
    return fetch("/api/images", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": blob && blob.type ? blob.type : "application/octet-stream"
      },
      body: blob
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) {
          throw new Error(data.detail || data.error || TEXT.imageUploadFailed);
        }
        if (!data || !data.url || String(data.url).indexOf("/api/images/") !== 0) {
          throw new Error(TEXT.imageUploadFailed);
        }
        return data.url;
      });
    });
  }

  function insertUploadedImage(blob, callback) {
    if (
      !state.host ||
      typeof state.host.setNoteImageRef !== "function"
    ) {
      setStatus(TEXT.imageBridgeMissing, "error");
      return Promise.reject(new Error(TEXT.imageBridgeMissing));
    }

    setStatus(TEXT.imageUploading, "info");
    return uploadImageBlob(blob).then(function (url) {
      var imageId = getNoteImageId();
      state.host.setNoteImageRef(imageId, url);
      callback("noteimg:" + imageId, blob && blob.name ? blob.name : "image");
      setStatus(TEXT.imageInserted, "success");
      return imageId;
    }).catch(function (error) {
      console.warn("note image upload failed", error);
      setStatus(TEXT.imageUploadFailed, "error");
      if (state.host && typeof state.host.showToast === "function") {
        state.host.showToast(TEXT.imageUploadFailed, "warning");
      }
      throw error;
    });
  }

  function renderUnavailable(message) {
    var shell = byId("editorShell");
    if (!shell) return;
    shell.innerHTML =
      "<div class=\"editor-empty\">" +
      "<h1>" + TEXT.unavailableTitle + "</h1>" +
      "<p>" + message + "</p>" +
      "<p>" + TEXT.unavailableHint + "</p>" +
      "</div>";
  }

  function initEditor(markdown) {
    if (!window.toastui || !window.toastui.Editor) {
      renderUnavailable(TEXT.editorLoadFailed);
      return;
    }
    state.editor = new window.toastui.Editor({
      el: byId("editor"),
      initialValue: markdown || "",
      initialEditType: "markdown",
      previewStyle: "vertical",
      height: "100%",
      usageStatistics: false,
      hideModeSwitch: false,
      placeholder: TEXT.editorPlaceholder,
      hooks: {
        addImageBlobHook: function (blob, callback) {
          insertUploadedImage(blob, callback).catch(function () {});
          return false;
        }
      }
    });
    state.lastSavedValue = markdown || "";
    setDirty(false);
    state.editor.on("change", function () {
      var current = state.editor.getMarkdown();
      setDirty(current !== state.lastSavedValue);
      if (state.dirty) {
        setStatus(TEXT.editing, "warning");
      } else {
        setStatus(TEXT.syncedStatus, "success");
      }
      schedulePatchEditorPreviewImages();
    });
    bindPreviewImageResolver();
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    state.nodeId = params.get("nodeId") || "";
    state.embed = params.get("embed") === "1";
    state.host = getHostWindow();

    if (!state.host || !state.nodeId || typeof state.host.getKnowledgeNodeById !== "function") {
      renderUnavailable(TEXT.noHostContext);
      return;
    }

    var node = getCurrentNode();
    if (!node) {
      renderUnavailable(TEXT.nodeMissing);
      return;
    }

    applyEmbedMode();
    syncHeader();
    initEditor(node.contentMd || "");
    exposeTestApi();
    bindShortcuts();
    bindActions();
    setStatus(TEXT.connected, "info");
  }

  window.requestNoteEditorClose = requestNoteEditorClose;
  document.addEventListener("DOMContentLoaded", init);
})();
