(function () {
  var TEXT = {
    loading: "\u6b63\u5728\u52a0\u8f7d\u8fc7\u7a0b\u56fe\u4e0a\u4e0b\u6587...",
    noHost: "\u5f53\u524d\u9875\u9762\u7f3a\u5c11\u4e3b\u9875\u9762\u4e0a\u4e0b\u6587\u3002",
    noQuestion: "\u672a\u627e\u5230\u5bf9\u5e94\u9898\u76ee\u3002",
    ready: "\u5df2\u8fde\u63a5\u5230\u4e3b\u9875\u9762\uff0c\u652f\u6301\u7c98\u8d34\u56fe\u7247\u3002",
    changed: "\u5df2\u66f4\u65b0\u5f85\u4fdd\u5b58\u7684\u8fc7\u7a0b\u56fe\u3002",
    removed: "\u5df2\u6e05\u7a7a\u5f53\u524d\u8fc7\u7a0b\u56fe\uff0c\u4fdd\u5b58\u540e\u4f1a\u4ece\u9898\u76ee\u4e0b\u79fb\u9664\u3002",
    pasteSuccess: "\u5df2\u4ece\u526a\u8d34\u677f\u8bfb\u53d6\u56fe\u7247\u3002",
    unsupportedPaste: "\u526a\u8d34\u677f\u91cc\u6ca1\u6709\u53ef\u7528\u7684\u56fe\u7247\u3002",
    saving: "\u6b63\u5728\u4fdd\u5b58\u8fc7\u7a0b\u56fe...",
    saveSuccess: "\u8fc7\u7a0b\u56fe\u5df2\u4fdd\u5b58\u3002",
    saveRemoved: "\u8fc7\u7a0b\u56fe\u5df2\u79fb\u9664\u3002",
    saveFailed: "\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u8fd4\u56de\u5de5\u4f5c\u53f0\u91cd\u8bd5\u3002",
    refreshConfirm: "\u5f53\u524d\u8fd8\u6709\u672a\u4fdd\u5b58\u7684\u66f4\u6539\uff0c\u786e\u5b9a\u4ece\u4e3b\u9875\u9762\u91cd\u65b0\u52a0\u8f7d\u5417\uff1f",
    closeConfirm: "\u5f53\u524d\u8fd8\u6709\u672a\u4fdd\u5b58\u7684\u8fc7\u7a0b\u56fe\uff0c\u786e\u5b9a\u76f4\u63a5\u5173\u95ed\u5417\uff1f",
    sourceCard: "\u6765\u81ea\u9898\u76ee\u5361\u7247",
    sourceQuiz: "\u6765\u81ea\u7ec3\u4e60\u5f39\u7a97",
    sourceOther: "\u6765\u81ea\u5de5\u4f5c\u53f0"
  };

  var state = {
    host: null,
    errorId: "",
    source: "card",
    embed: false,
    lastSavedValue: "",
    workingValue: "",
    dirty: false
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(message, tone) {
    var status = byId("processStatus");
    if (!status) return;
    status.textContent = message || "";
    status.className = "process-status" + (tone ? " is-" + tone : "");
  }

  function setDirty(nextDirty) {
    state.dirty = !!nextDirty;
  }

  function getHostWindow() {
    if (window.parent && window.parent !== window) return window.parent;
    if (window.opener && !window.opener.closed) return window.opener;
    return null;
  }

  function getSourceLabel(source) {
    if (source === "quiz") return TEXT.sourceQuiz;
    if (source === "card") return TEXT.sourceCard;
    return TEXT.sourceOther;
  }

  function applyPreview() {
    var img = byId("processPreviewImage");
    var empty = byId("processEmpty");
    var meta = byId("processMeta");
    if (!img || !empty || !meta) return;
    if (state.workingValue) {
      img.hidden = false;
      img.src = state.workingValue;
      empty.hidden = true;
    } else {
      img.hidden = true;
      img.removeAttribute("src");
      empty.hidden = false;
    }
    meta.textContent = state.dirty ? TEXT.changed : getSourceLabel(state.source);
  }

  function syncHeader(payload) {
    var title = byId("processTitle");
    var path = byId("processPath");
    var question = byId("processQuestion");
    if (title) title.textContent = (payload && payload.title) || TEXT.loading;
    if (path) path.textContent = getSourceLabel(state.source);
    if (question) question.textContent = (payload && payload.question) || "";
  }

  function applyPayload(payload) {
    syncHeader(payload);
    state.lastSavedValue = payload && payload.imageUrl ? String(payload.imageUrl) : "";
    state.workingValue = state.lastSavedValue;
    setDirty(false);
    applyPreview();
  }

  function readImageFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error("empty file"));
      var reader = new FileReader();
      reader.onload = function (event) {
        resolve(String((event && event.target && event.target.result) || ""));
      };
      reader.onerror = function () {
        reject(new Error("read failed"));
      };
      reader.readAsDataURL(file);
    });
  }

  function updateWorkingValue(nextValue, message) {
    state.workingValue = String(nextValue || "");
    setDirty(state.workingValue !== state.lastSavedValue);
    applyPreview();
    setStatus(message || (state.dirty ? TEXT.changed : TEXT.ready), state.dirty ? "warning" : "success");
  }

  function bindPaste() {
    window.addEventListener("paste", function (event) {
      var items = event && event.clipboardData && event.clipboardData.items;
      if (!items || !items.length) return;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item || item.kind !== "file") continue;
        var file = item.getAsFile();
        if (!file || String(file.type || "").indexOf("image/") !== 0) continue;
        event.preventDefault();
        readImageFile(file).then(function (result) {
          updateWorkingValue(result, TEXT.pasteSuccess);
        }).catch(function (error) {
          setStatus(error && error.message ? error.message : TEXT.unsupportedPaste, "error");
        });
        return;
      }
    });
  }

  function bindActions() {
    var fileInput = byId("processFileInput");
    var dropzone = byId("processDropzone");
    var refreshBtn = byId("refreshBtn");
    var clearBtn = byId("clearBtn");
    var saveBtn = byId("saveBtn");
    var saveCloseBtn = byId("saveCloseBtn");
    var closeBtn = byId("closeBtn");

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", function () {
        fileInput.click();
      });
      dropzone.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInput.click();
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        readImageFile(file).then(function (result) {
          updateWorkingValue(result, TEXT.changed);
          fileInput.value = "";
        }).catch(function () {
          setStatus(TEXT.unsupportedPaste, "error");
        });
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        if (state.dirty && !window.confirm(TEXT.refreshConfirm)) return;
        var payload = state.host && typeof state.host.getProcessImagePayload === "function"
          ? state.host.getProcessImagePayload(state.errorId)
          : null;
        if (!payload) {
          setStatus(TEXT.noQuestion, "error");
          return;
        }
        applyPayload(payload);
        setStatus(TEXT.ready, "success");
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        updateWorkingValue("", TEXT.removed);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        saveToHost(false);
      });
    }
    if (saveCloseBtn) {
      saveCloseBtn.addEventListener("click", function () {
        saveToHost(true);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        requestProcessImageEditorClose(false);
      });
    }
  }

  function saveToHost(closeAfterSave) {
    if (!state.host || typeof state.host.saveProcessImageValue !== "function") {
      setStatus(TEXT.saveFailed, "error");
      return;
    }
    setStatus(TEXT.saving, "warning");
    Promise.resolve(state.host.saveProcessImageValue(state.errorId, state.workingValue || null)).then(function (nextProcessImage) {
      state.lastSavedValue = nextProcessImage && nextProcessImage.imageUrl ? String(nextProcessImage.imageUrl) : "";
      state.workingValue = state.lastSavedValue;
      setDirty(false);
      applyPreview();
      setStatus(state.lastSavedValue ? TEXT.saveSuccess : TEXT.saveRemoved, "success");
      if (closeAfterSave) requestProcessImageEditorClose(true);
    }).catch(function (error) {
      setStatus((error && error.message) || TEXT.saveFailed, "error");
    });
  }

  function exposeTestApi() {
    window.__processImageEditorTest = {
      getValue: function () {
        return state.workingValue;
      },
      setValue: function (value) {
        updateWorkingValue(String(value || ""), TEXT.changed);
        return true;
      },
      save: function (closeAfterSave) {
        saveToHost(!!closeAfterSave);
        return true;
      }
    };
  }

  function requestProcessImageEditorClose(force) {
    if (state.dirty && !force) {
      var ok = window.confirm(TEXT.closeConfirm);
      if (!ok) return false;
    }
    if (state.host && typeof state.host.closeProcessImageEditorModal === "function") {
      state.host.closeProcessImageEditorModal(true);
      return true;
    }
    window.close();
    return true;
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    state.errorId = params.get("errorId") || "";
    state.source = params.get("source") || "card";
    state.embed = params.get("embed") === "1";
    state.host = getHostWindow();

    if (state.embed) document.body.classList.add("is-embedded");
    if (!state.host) {
      syncHeader(null);
      setStatus(TEXT.noHost, "error");
      return;
    }
    if (!state.errorId || typeof state.host.getProcessImagePayload !== "function") {
      syncHeader(null);
      setStatus(TEXT.noQuestion, "error");
      return;
    }

    var payload = state.host.getProcessImagePayload(state.errorId);
    if (!payload) {
      syncHeader(null);
      setStatus(TEXT.noQuestion, "error");
      return;
    }

    applyPayload(payload);
    bindActions();
    bindPaste();
    exposeTestApi();
    setStatus(TEXT.ready, "success");
  }

  window.requestProcessImageEditorClose = requestProcessImageEditorClose;
  document.addEventListener("DOMContentLoaded", init);
})();
