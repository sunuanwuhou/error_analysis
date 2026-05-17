// ============================================================
// Knowledge node modal open/close/basic target rendering
// ============================================================
function knmOpenKnowledgeNodeModal(mode, opts, deps) {
  var d = deps || {};
  if (typeof d.ensureKnowledgeState === "function") d.ensureKnowledgeState();
  var state = Object.assign({
    mode: mode,
    nodeId: null,
    parentId: null,
    targetId: null,
    fallbackTitle: "",
    afterSubmit: null
  }, opts || {});

  var titleEl = document.getElementById("knowledgeNodeModalTitle");
  var subtitleEl = document.getElementById("knowledgeNodeModalSubtitle");
  var titleGroup = document.getElementById("knowledgeNodeTitleGroup");
  var titleLabel = document.getElementById("knowledgeNodeTitleLabel");
  var titleInput = document.getElementById("knowledgeNodeTitleInput");
  var targetGroup = document.getElementById("knowledgeNodeTargetGroup");
  var searchInput = document.getElementById("knowledgeNodeTargetSearch");
  if (!titleEl || !subtitleEl || !titleGroup || !titleLabel || !titleInput || !targetGroup || !searchInput) {
    return state;
  }

  var node = state.nodeId && typeof d.getKnowledgeNodeById === "function" ? d.getKnowledgeNodeById(state.nodeId) : null;
  var parent = state.parentId && typeof d.getKnowledgeNodeById === "function" ? d.getKnowledgeNodeById(state.parentId) : null;
  var toPathText = d.toPathText || function () { return ""; };

  if (mode === "rename") {
    if (!node) return state;
    titleEl.textContent = "重命名知识点";
    subtitleEl.textContent = "当前节点：" + toPathText(node.id);
    titleLabel.textContent = "新的节点名称";
    titleInput.value = node.title || "";
    titleGroup.style.display = "";
    targetGroup.style.display = "none";
  } else if (mode === "move") {
    if (!node) return state;
    titleEl.textContent = "移动知识点";
    subtitleEl.textContent = "当前节点：" + toPathText(node.id) + "。请选择新的父节点。";
    titleGroup.style.display = "none";
    targetGroup.style.display = "";
    searchInput.value = "";
    state.targetId = null;
    if (typeof d.renderKnowledgeNodeTargetOptions === "function") d.renderKnowledgeNodeTargetOptions();
  } else {
    if (!parent) return state;
    titleEl.textContent = "新建下级知识点";
    subtitleEl.textContent = "父节点：" + toPathText(parent.id);
    titleLabel.textContent = "知识点名称";
    titleInput.value = state.fallbackTitle || "";
    titleGroup.style.display = "";
    targetGroup.style.display = "none";
  }

  if (typeof d.openModal === "function") d.openModal("knowledgeNodeModal");
  setTimeout(function () {
    if (mode === "move") searchInput.focus();
    else titleInput.focus();
    if (mode !== "move") titleInput.select();
  }, 10);
  return state;
}

function knmCloseKnowledgeNodeModal(closeModalFn) {
  if (typeof closeModalFn === "function") closeModalFn("knowledgeNodeModal");
  return { mode: "", nodeId: null, parentId: null, targetId: null, fallbackTitle: "" };
}

function knmHandleKnowledgeNodeTitleKeydown(event, submitFn) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (typeof submitFn === "function") submitFn();
  }
}

function knmRenderKnowledgeNodeTargetOptions(state, deps) {
  var d = deps || {};
  var list = document.getElementById("knowledgeNodeTargetList");
  var searchInput = document.getElementById("knowledgeNodeTargetSearch");
  if (!list || !searchInput || !state || state.mode !== "move") return;

  var keyword = searchInput.value.trim().toLowerCase();
  var options = (typeof d.getTargetOptions === "function" ? d.getTargetOptions(state.nodeId) : []).slice();
  var filtered = options.filter(function (item) {
    if (!keyword) return true;
    return item.label.toLowerCase().includes(keyword) || item.node.title.toLowerCase().includes(keyword);
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="knowledge-move-empty">没有匹配的目标知识点</div>';
    return;
  }

  var escape = d.escapeHtml || function (v) { return String(v || ""); };
  list.innerHTML = filtered.map(function (item) {
    var active = state.targetId === item.id ? " active" : "";
    return "<div class=\"knowledge-move-item" + active + "\" onclick=\"selectKnowledgeNodeModalTarget('" + item.id + "')\">" +
      "<div class=\"knowledge-move-item-title\">" + escape(item.node.title) + "</div>" +
      "<div class=\"knowledge-move-item-path\">" + escape(item.label) + "</div>" +
    "</div>";
  }).join("");
}

function knmSelectKnowledgeNodeModalTarget(state, nodeId, renderFn) {
  if (!state) return state;
  state.targetId = nodeId;
  if (typeof renderFn === "function") renderFn();
  return state;
}
