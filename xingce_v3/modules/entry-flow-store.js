(function () {
  function saveCardNote(id, val) {
    var item = errors.find(function (entry) { return entry.id === id; });
    if (!item) return;
    item.note = val;
    item.updatedAt = new Date().toISOString();
    recordErrorUpsert(item);
    saveData();
  }

  async function saveError(opts) {
    var saveOpts = opts || {};
    var keepOpen = Boolean(saveOpts.keepOpen);
    var type = document.getElementById("editType").value;
    var subtype = document.getElementById("editSubtype").value.trim();
    var subSubtype = document.getElementById("editSubSubtype").value.trim();
    var question = document.getElementById("editQuestion").value.trim();
    var optionText = document.getElementById("editOptions").value.trim();
    var answer = document.getElementById("editAnswer").value.trim();
    var myAnswer = document.getElementById("editMyAnswer").value.trim();
    var rootReason = document.getElementById("editRootReason").value.trim();
    var errorReason = document.getElementById("editErrorReason").value.trim();
    var analysis = document.getElementById("editAnalysis").value.trim();
    var status = document.getElementById("editStatus").value;
    var difficulty = _modalDiff || 0;
    var srcYear = document.getElementById("editSrcYear").value;
    var srcProvince = document.getElementById("editSrcProvince").value;
    var srcOrigin = document.getElementById("editSrcOrigin").value.trim();
    var noteNodeId = resolveKnowledgeNodeIdForSave(type, subtype, subSubtype);

    if (!question && !editImgBase64) {
      showToast("题目不能为空", "warning");
      return;
    }
    if (!subtype) {
      showToast("子类型不能为空", "warning");
      document.getElementById("editSubtype").focus();
      return;
    }
    if (!answer) {
      showToast("正确答案不能为空", "warning");
      document.getElementById("editAnswer").focus();
      return;
    }

    var id = editingId;
    var existing = id ? errors.find(function (item) { return item.id === id; }) : null;
    var prevImgData = existing && existing.imgData ? existing.imgData : null;
    var prevAnalysisImgData = existing && existing.analysisImgData ? existing.analysisImgData : null;

    var imgData;
    if (editImgDeleted) {
      imgData = null;
      await unrefImageValue(prevImgData);
    } else if (editImgBase64) {
      imgData = await uploadImageValue(editImgBase64);
      if (prevImgData && prevImgData !== imgData) await unrefImageValue(prevImgData);
    } else {
      imgData = prevImgData;
    }

    var analysisImgData;
    if (editAnalysisImgDeleted) {
      analysisImgData = null;
      await unrefImageValue(prevAnalysisImgData);
    } else if (editAnalysisImgBase64) {
      analysisImgData = await uploadImageValue(editAnalysisImgBase64);
      if (prevAnalysisImgData && prevAnalysisImgData !== analysisImgData) await unrefImageValue(prevAnalysisImgData);
    } else {
      analysisImgData = prevAnalysisImgData;
    }

    var data = {
      type: type,
      subtype: subtype,
      subSubtype: subSubtype,
      question: question,
      options: optionText,
      answer: answer,
      myAnswer: myAnswer,
      rootReason: rootReason,
      errorReason: errorReason,
      analysis: analysis,
      status: status,
      difficulty: difficulty,
      imgData: imgData,
      analysisImgData: analysisImgData,
      srcYear: srcYear,
      srcProvince: srcProvince,
      srcOrigin: srcOrigin,
      noteNodeId: noteNodeId
    };

    var savedId = id;
    if (id) {
      var old = errors.find(function (item) { return item.id === id; });
      var oldType = old ? old.type : null;
      Object.assign(old, data);
      old.updatedAt = new Date().toISOString();
      if (oldType && oldType !== type && notesByType[oldType] !== undefined) {
        if (!notesByType[type]) notesByType[type] = notesByType[oldType];
        if (!errors.some(function (item) { return item.type === oldType && item.id !== id; })) {
          delete notesByType[oldType];
        }
        saveNotesByType();
      }
      recordErrorUpsert(old);
      showToast("修改成功", "success");
    } else {
      var newErr = Object.assign({
        id: newId(),
        addDate: today(),
        updatedAt: new Date().toISOString(),
        masteryLevel: "not_mastered",
        masteryUpdatedAt: null,
        lastPracticedAt: null
      }, data);
      errors.push(newErr);
      recordErrorUpsert(newErr);
      savedId = newErr.id;
      editingId = newErr.id;
      document.getElementById("addModalTitle").textContent = "编辑错题";
      showToast("添加成功", "success");
    }

    expMain.add(type);
    expMainSub.add("sub:" + type + "::" + (subtype || "未分类"));
    if (subSubtype) expMainSub2.add("s2:" + type + "::" + (subtype || "未分类") + "::" + subSubtype);
    saveExpMain();
    saveData();
    syncNotesWithErrors();
    saveKnowledgeState();
    renderSidebar();
    renderAll();
    renderNotesByType();

    if (keepOpen) {
      setEntryAnalysisOpen(true);
      setEntryAdvancedOpen(true);
      updateEntryFlowBanner(getKnowledgeContextForEntry(resolveKnowledgeNodeIdForSave(type, subtype, subSubtype)));
      var focusTarget = document.getElementById("editRootReason") || document.getElementById("editAnalysis");
      if (focusTarget) focusTarget.focus();
      showToast(id ? "已保存，可继续补充细节" : "已保存，继续完善这道题", "success");
      return savedId;
    }

    closeModal("addModal");
    return savedId;
  }

  window.saveCardNote = saveCardNote;
  window.saveError = saveError;
})();
