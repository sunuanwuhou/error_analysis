(function () {
  function setKnowledgeRelatedMode(mode) {
    if (mode !== "direct" && mode !== "all") return;
    knowledgeRelatedMode = mode;
    if (typeof renderNotesByType === "function") {
      renderNotesByType();
    }
  }

  function updateKnowledgeWorkspaceChrome() {
    return;
  }

  function renderKnowledgeNotesPanelRight() {
    var body = document.getElementById("notesPanelRightBody");
    if (body) body.innerHTML = "";
  }

  if (typeof window.renderSidebarKnowledgeTreeV2 !== "function") {
    window.renderSidebarKnowledgeTreeV2 = function () { return ""; };
  }
  window.setKnowledgeRelatedMode = setKnowledgeRelatedMode;
  window.updateKnowledgeWorkspaceChrome = updateKnowledgeWorkspaceChrome;
  window.renderKnowledgeNotesPanelRight = renderKnowledgeNotesPanelRight;
  window.renderNotesPanelRight = function () {
    renderKnowledgeNotesPanelRight();
  };
})();
