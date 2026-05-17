(function () {
  var TEXT = {
    noteTitle: "\u77e5\u8bc6\u70b9\u7b14\u8bb0",
    waiting: "\u6b63\u5728\u7b49\u5f85\u9884\u89c8\u5185\u5bb9...",
    empty: "\u5f53\u524d\u8282\u70b9\u8fd8\u6ca1\u6709\u7b14\u8bb0\uff0c\u53ef\u4ee5\u4ece\u72ec\u7acb\u7f16\u8f91\u5668\u5f00\u59cb\u64b0\u5199\u3002",
    tocTitle: "\u672c\u9875\u76ee\u5f55",
    noToc: "\u8fd8\u6ca1\u6709 Markdown \u6807\u9898\uff0c\u4f7f\u7528 # \u6216 ## \u5c31\u4f1a\u5728\u8fd9\u91cc\u751f\u6210\u76ee\u5f55\u3002",
    viewerFailed: "\u9884\u89c8\u8d44\u6e90\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u91cd\u8bd5\u3002"
  };

  var state = {
    viewer: null,
    nodeId: "",
    embed: false,
    role: "preview",
    title: "",
    pathText: "",
    markdown: "",
    headings: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getHostWindow() {
    if (window.parent && window.parent !== window) return window.parent;
    if (window.opener && !window.opener.closed) return window.opener;
    return null;
  }

  function destroyViewer() {
    if (!state.viewer || typeof state.viewer.destroy !== "function") {
      state.viewer = null;
      return;
    }
    try {
      state.viewer.destroy();
    } catch (error) {
      console.warn("destroy viewer failed", error);
    }
    state.viewer = null;
  }

  function normalizeHeadingText(raw) {
    return String(raw || "")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/[*_`~>#-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractHeadings(markdown) {
    return String(markdown || "")
      .split(/\r?\n/)
      .map(function (line) {
        var match = /^(#{1,6})\s+(.*)$/.exec(line);
        if (!match) return null;
        var text = normalizeHeadingText(match[2]);
        if (!text) return null;
        return {
          level: match[1].length,
          text: text
        };
      })
      .filter(Boolean);
  }

  function getHeadingId(index) {
    return "note-viewer-heading-" + (index + 1);
  }

  function syncHeader() {
    var titleEl = byId("viewerTitle");
    var pathEl = byId("viewerPath");
    if (titleEl) titleEl.textContent = state.title || TEXT.noteTitle;
    if (pathEl) pathEl.textContent = state.pathText || TEXT.waiting;
  }

  function notifyHost(message) {
    var host = getHostWindow();
    if (!host) return;
    try {
      host.postMessage(message, window.location.origin);
    } catch (error) {
      console.warn("notify host failed", error);
    }
  }

  function resolveNoteImages(markdown) {
    var host = getHostWindow();
    if (host && typeof host.resolveNoteImgs === "function") {
      try {
        return host.resolveNoteImgs(markdown || "");
      } catch (error) {
        console.warn("resolve note images failed", error);
      }
    }
    return String(markdown || "");
  }

  function setEmbeddedMode() {
    if (state.embed) {
      document.body.classList.add("is-embedded");
    } else {
      document.body.classList.remove("is-embedded");
    }
    document.body.classList.remove("role-noteReadPreview", "role-noteSplitPreview", "role-preview");
    document.body.classList.add("role-" + state.role);
  }

  function renderToc() {
    var layout = byId("viewerLayout");
    var toc = byId("viewerToc");
    var list = byId("viewerTocList");
    if (!layout || !toc || !list) return;

    if (!state.headings.length) {
      toc.hidden = true;
      layout.classList.add("no-toc");
      list.innerHTML = "";
      return;
    }

    toc.hidden = false;
    layout.classList.remove("no-toc");
    list.innerHTML = state.headings.map(function (heading, index) {
      var level = heading.level > 4 ? 4 : heading.level;
      return "" +
        "<button class=\"viewer-toc-item level-" + level + "\" data-heading-id=\"" + getHeadingId(index) + "\" type=\"button\">" +
          escapeHtml(heading.text) +
        "</button>";
    }).join("");
  }

  function bindTocClicks() {
    var list = byId("viewerTocList");
    if (!list || list.dataset.bound === "1") return;
    list.dataset.bound = "1";
    list.addEventListener("click", function (event) {
      var button = event.target.closest("[data-heading-id]");
      if (!button) return;
      var target = document.getElementById(button.getAttribute("data-heading-id"));
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderEmpty(message) {
    destroyViewer();
    var empty = byId("viewerEmpty");
    var host = byId("viewerHost");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
    if (empty) {
      empty.hidden = false;
      empty.className = "viewer-empty";
      empty.innerHTML = escapeHtml(message || TEXT.empty);
    }
    reportSize();
  }

  function renderError(message) {
    destroyViewer();
    var empty = byId("viewerEmpty");
    var host = byId("viewerHost");
    if (host) {
      host.hidden = true;
      host.innerHTML = "";
    }
    if (empty) {
      empty.hidden = false;
      empty.className = "viewer-error";
      empty.innerHTML = escapeHtml(message || TEXT.viewerFailed);
    }
    reportSize();
  }

  function applyHeadingIds() {
    var host = byId("viewerHost");
    if (!host) return;
    var headings = host.querySelectorAll(
      ".toastui-editor-contents h1, .toastui-editor-contents h2, .toastui-editor-contents h3, .toastui-editor-contents h4, .toastui-editor-contents h5, .toastui-editor-contents h6"
    );
    headings.forEach(function (heading, index) {
      heading.id = getHeadingId(index);
    });
  }

  function typesetMath() {
    var host = byId("viewerHost");
    if (!host || !window.MathJax || typeof window.MathJax.typesetPromise !== "function") return;
    window.MathJax.typesetPromise([host]).catch(function (error) {
      console.warn("viewer math typeset failed", error);
    }).finally(function () {
      reportSize();
    });
  }

  function reportSize() {
    if (!state.embed) return;
    var card = document.querySelector(".viewer-content-card");
    var height = card ? Math.ceil(card.scrollHeight + 4) : Math.ceil(document.body.scrollHeight || 0);
    notifyHost({
      type: "knowledge-note-viewer-size",
      nodeId: state.nodeId,
      role: state.role,
      height: height
    });
  }

  function renderMarkdown(markdown) {
    if (!markdown) {
      renderEmpty(state.emptyText || TEXT.empty);
      return;
    }

    if (!window.toastui || !window.toastui.Editor || typeof window.toastui.Editor.factory !== "function") {
      renderError(TEXT.viewerFailed);
      return;
    }

    var empty = byId("viewerEmpty");
    var host = byId("viewerHost");
    if (!host) return;

    destroyViewer();
    host.hidden = false;
    host.innerHTML = "";
    if (empty) empty.hidden = true;

    var resolvedMarkdown = resolveNoteImages(markdown);

    state.viewer = window.toastui.Editor.factory({
      el: host,
      viewer: true,
      initialValue: resolvedMarkdown,
      usageStatistics: false
    });

    applyHeadingIds();
    typesetMath();
    requestAnimationFrame(reportSize);
  }

  function applyPayload(payload) {
    state.nodeId = String((payload && payload.nodeId) || state.nodeId || "");
    state.title = String((payload && payload.title) || "");
    state.pathText = String((payload && payload.pathText) || "");
    state.markdown = String((payload && payload.markdown) || "");
    state.emptyText = String((payload && payload.emptyText) || TEXT.empty);
    state.headings = extractHeadings(state.markdown);

    syncHeader();
    renderToc();
    renderMarkdown(state.markdown);
  }

  function syncFromHost() {
    var host = getHostWindow();
    if (!host || typeof host.getKnowledgeNodeById !== "function" || !state.nodeId) return;
    var node = host.getKnowledgeNodeById(state.nodeId);
    if (!node) return;
    var pathText = "";
    if (
      typeof host.getKnowledgePathTitles === "function" &&
      typeof host.collapseKnowledgePathTitles === "function"
    ) {
      pathText = host.collapseKnowledgePathTitles(host.getKnowledgePathTitles(state.nodeId)).join(" > ");
    }
    applyPayload({
      nodeId: node.id,
      title: node.title || "",
      pathText: pathText,
      markdown: node.contentMd || "",
      emptyText: TEXT.empty
    });
  }

  function notifyReady() {
    notifyHost({
      type: "knowledge-note-viewer-ready",
      nodeId: state.nodeId,
      role: state.role
    });
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    state.nodeId = params.get("nodeId") || "";
    state.embed = params.get("embed") === "1";
    state.role = params.get("role") || "preview";

    setEmbeddedMode();
    syncHeader();
    bindTocClicks();

    window.addEventListener("message", function (event) {
      if (!event || event.origin !== window.location.origin) return;
      var data = event.data || {};
      if (data.type !== "knowledge-note-viewer-sync") return;
      applyPayload(data.payload || {});
    });
    window.addEventListener("resize", reportSize);

    syncFromHost();
    notifyReady();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
