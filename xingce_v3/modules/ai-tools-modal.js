(function () {
  function getAiPanel(id) {
    return document.getElementById(id);
  }

  function openAIToolsModal() {
    openModal("aiToolsModal");
    var defaults = [
      ["aiDiagnoseOutput", "点击“刷新诊断”生成当前阶段诊断。"],
      ["aiPatternsOutput", "点击“生成”查找跨题型、跨章节的共性错误模式。"],
      ["aiChatOutput", "在上方输入你的问题，AI 会结合当前账号数据回答。"],
      ["aiGenerateOutput", "选中一个知识点后，可为当前知识点生成 3 道相似题。"],
      ["aiDistillOutput", "选中知识点后点击“AI提炼”，把当前节点错题沉淀成可复用规则。"],
      ["aiRestructureOutput", "点击“生成”检查当前知识树是否值得拆分、合并或改名。"]
    ];
    defaults.forEach(function (item) {
      var el = getAiPanel(item[0]);
      if (el && !String(el.textContent || el.value || "").trim()) {
        if ("value" in el && el.tagName === "TEXTAREA") el.value = item[1];
        else el.textContent = item[1];
      }
    });
    var summary = getAiPanel("aiModuleSummaryOutput");
    if (summary && !String(summary.value || "").trim()) {
      summary.value = "点击“生成”后，这里会产出可以直接发给 Claude 的摘要。";
    }
  }

  async function runAIDiagnosis() {
    var output = getAiPanel("aiDiagnoseOutput");
    if (output) output.textContent = "诊断生成中...";
    try {
      var data = await fetchJsonWithAuth("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errors: getFiltered().slice(0, 120) })
      });
      var result = data.result || {};
      var weakPoints = (result.weakPoints || []).map(function (item, idx) {
        return (idx + 1) + ". " + (item.area || "未命名") + " [" + (item.priority || "normal") + "]\n" +
          (item.description || "") + "\n建议：" + (item.suggestion || "");
      }).join("\n\n");
      if (output) output.textContent = ((result.summary || "暂无总结") + (weakPoints ? "\n\n" + weakPoints : "")).trim();
    } catch (e) {
      if (output) output.textContent = e.message || "AI 诊断失败";
      showToast(e.message || "AI 诊断失败", "error");
    }
  }

  async function runDiscoverPatterns() {
    var output = getAiPanel("aiPatternsOutput");
    if (output) output.textContent = "模式分析中...";
    try {
      var data = await fetchJsonWithAuth("/api/ai/discover-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errors: getFiltered().slice(0, 120) })
      });
      var result = data.result || {};
      var items = Array.isArray(result.patterns) ? result.patterns.map(function (item, idx) {
        return (idx + 1) + ". " + (item.theme || "未命名模式") +
          "\n证据：" + (item.evidence || "") +
          "\n影响：" + (item.impact || "") +
          "\n建议：" + (item.suggestion || "");
      }).join("\n\n") : "";
      if (output) output.textContent = ((result.summary || "暂无总结") + (items ? "\n\n" + items : "")).trim();
    } catch (e) {
      if (output) output.textContent = e.message || "模式分析失败";
      showToast(e.message || "模式分析失败", "error");
    }
  }

  function appendRuleToCurrentNode(rule, reason) {
    var node = getCurrentKnowledgeNode();
    if (!node || !rule) return false;
    if (String(node.contentMd || "").indexOf(rule) >= 0) return false;
    var header = node.contentMd && node.contentMd.trim() ? "\n\n" : "";
    var block = "## AI提炼\n- 规则：" + rule + (reason ? "\n- 说明：" + reason : "");
    node.contentMd = String(node.contentMd || "") + header + block;
    node.updatedAt = new Date().toISOString();
    saveKnowledgeState();
    renderNotesByType();
    return true;
  }

  async function distillCurrentNodeRule() {
    var output = getAiPanel("aiDistillOutput");
    var node = getCurrentKnowledgeNodeSummary();
    if (!node) {
      showToast("请先选中一个知识点", "warning");
      return;
    }
    var referenceError = (node.linkedErrors || [])[0];
    if (!referenceError) {
      if (output) output.textContent = "当前知识点还没有关联错题，先挂一题再提炼。";
      showToast("当前知识点还没有关联错题", "warning");
      return;
    }
    if (output) output.textContent = "AI提炼中...";
    try {
      var data = await fetchJsonWithAuth("/api/ai/distill-to-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeTitle: node.title,
          nodeContent: node.contentMd || "",
          error: referenceError
        })
      });
      var result = data.result || {};
      var appended = result.rule ? appendRuleToCurrentNode(result.rule, result.reason || "") : false;
      if (output) {
        output.textContent = [
          result.rule ? "规则：" + result.rule : "未提炼出规则",
          result.reason ? "说明：" + result.reason : "",
          appended ? "已自动插入当前知识点笔记。" : (result.rule ? "规则已生成，如需再次插入请调整后重试。" : "")
        ].filter(Boolean).join("\n\n");
      }
      if (appended) showToast("AI提炼已写入当前知识点笔记", "success");
    } catch (e) {
      if (output) output.textContent = e.message || "AI提炼失败";
      showToast(e.message || "AI提炼失败", "error");
    }
  }

  async function runSuggestRestructure() {
    var output = getAiPanel("aiRestructureOutput");
    if (output) output.textContent = "知识树检查中...";
    try {
      var data = await fetchJsonWithAuth("/api/ai/suggest-restructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tree: knowledgeTree, notes: knowledgeNotes || {} })
      });
      var result = data.result || {};
      var items = Array.isArray(result.suggestions) ? result.suggestions.map(function (item, idx) {
        return (idx + 1) + ". " + (item.action || "调整") + " -> " + (item.target || "未指明目标") +
          "\n原因：" + (item.reason || "");
      }).join("\n\n") : "";
      if (output) output.textContent = ((result.summary || "暂无总结") + (items ? "\n\n" + items : "")).trim();
    } catch (e) {
      if (output) output.textContent = e.message || "知识树建议生成失败";
      showToast(e.message || "知识树建议生成失败", "error");
    }
  }

  window.openAIToolsModal = openAIToolsModal;
  window.runAIDiagnosis = runAIDiagnosis;
  window.runDiscoverPatterns = runDiscoverPatterns;
  window.appendRuleToCurrentNode = appendRuleToCurrentNode;
  window.distillCurrentNodeRule = distillCurrentNodeRule;
  window.runSuggestRestructure = runSuggestRestructure;
})();
