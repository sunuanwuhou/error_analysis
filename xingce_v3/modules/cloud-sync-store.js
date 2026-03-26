(function () {
  function renderCloudUi() {
    var badge = document.getElementById("cloudUserBadge");
    var syncBadge = document.getElementById("cloudSyncBadge");
    var syncHint = document.getElementById("cloudSyncHint");
    var originStatus = document.getElementById("cloudOriginStatus");
    var detailsToggle = document.getElementById("cloudDetailsToggle");
    var logoutBtn = document.getElementById("cloudLogoutBtn");
    if (!badge || !logoutBtn || !syncBadge || !syncHint || !originStatus || !detailsToggle) return;

    if (cloudUser) {
      badge.textContent = "Cloud: " + cloudUser.username;
      logoutBtn.style.display = "";
    } else {
      badge.textContent = "Cloud: offline";
      logoutBtn.style.display = "";
    }

    syncBadge.className = "cloud-status-badge " + cloudSyncState;
    syncBadge.textContent = ({
      idle: "空闲",
      dirty: "待同步",
      saving: "同步中",
      synced: "已同步",
      error: "同步失败"
    })[cloudSyncState] || cloudSyncState;

    var currentOrigin = mergeCurrentOriginStatus();
    var originText = currentOrigin.origin || getCloudOriginKey();
    var timeText = formatCloudTime(cloudSyncUpdatedAt || cloudMeta.lastSavedAt || cloudMeta.lastLoadedAt || "");
    var cloudUpdatedText = formatCloudTime(cloudMeta.lastSeenBackupAt || currentOrigin.lastBackupUpdatedAt || "");
    var localUpdatedText = formatCloudTime(currentOrigin.lastLocalChangeAt || currentOrigin.lastSavedAt || currentOrigin.lastLoadedAt || "");

    syncHint.textContent = [
      cloudSyncMessage || "",
      timeText ? "最后同步: " + timeText : "",
      cloudUpdatedText ? "云端备份: " + cloudUpdatedText : ""
    ].filter(Boolean).join(" | ") || "本地缓存按访问入口分别存放。";

    var currentMs = toCloudTimeMs(getOriginDisplayTime(currentOrigin));
    var newerOrigins = (cloudOriginStatuses || [])
      .filter(function (item) { return item.origin !== originText; })
      .filter(function (item) { return currentMs && currentMs > toCloudTimeMs(getOriginDisplayTime(item)); });

    var lines = [];
    if (newerOrigins.length) {
      lines.push('<div class="cloud-origin-alert">当前入口比另外 ' + newerOrigins.length + " 个入口更新</div>");
    }
    lines.push("<div>当前入口: " + escapeHtml(originText) + "</div>");
    if (localUpdatedText) lines.push("<div>本地更新时间: " + escapeHtml(localUpdatedText) + "</div>");
    if (cloudUpdatedText) lines.push("<div>云端更新时间: " + escapeHtml(cloudUpdatedText) + "</div>");

    var mergedItems = [currentOrigin].concat((cloudOriginStatuses || []).filter(function (item) { return item.origin !== originText; }));
    mergedItems.forEach(function (item) {
      var label = item.origin === originText ? "当前" : "其他";
      var localText = formatCloudTime(item.lastLocalChangeAt || item.lastSavedAt || item.lastLoadedAt || "");
      var cloudText = formatCloudTime(item.lastBackupUpdatedAt || "");
      var suffix = [
        localText ? "本地: " + localText : "",
        cloudText ? "云端: " + cloudText : ""
      ].filter(Boolean).join(" | ");
      lines.push("<div>" + escapeHtml(label) + " " + escapeHtml(item.origin) + (suffix ? " | " + escapeHtml(suffix) : "") + "</div>");
    });

    detailsToggle.textContent = cloudDetailsExpanded ? "收起" : "详情";
    originStatus.classList.toggle("expanded", cloudDetailsExpanded);
    originStatus.innerHTML = lines.join("");
  }

  function toggleCloudDetails() {
    cloudDetailsExpanded = !cloudDetailsExpanded;
    renderCloudUi();
  }

  async function refreshCloudSession() {
    try {
      var res = await fetch("/api/me", { credentials: "include" });
      var data = await res.json();
      cloudUser = data && data.authenticated ? data.user : null;
    } catch (e) {
      cloudUser = null;
    }
    renderCloudUi();
    if (!cloudUser) {
      window.location.replace("/login");
      return;
    }
    setCloudSyncState("idle", "Logged in. Waiting for local/cloud actions.", "");
    await maybeRestoreCloudBackup();
    await syncWithServer();
    renderCloudUi();
    if (pendingCloudSave) {
      pendingCloudSave = false;
      scheduleCloudSave();
    }
  }

  async function loadCloudBackup(opts) {
    opts = opts || {};
    if (!cloudUser) {
      window.location.replace("/login");
      return;
    }
    if (cloudBusy) return;
    cloudBusy = true;
    setCloudSyncState("saving", "Loading cloud backup", "");
    try {
      var data = await fetchCloudBackupData();
      if (!data.exists || !data.backup) {
        if (!opts.silent) showToast("Cloud backup is empty", "warning");
        return;
      }
      var updatedAt = data.updatedAt || data.backup.exportTime || "";
      var hasLocalData = (errors && errors.length) || Object.keys(notesByType || {}).length || Object.keys(knowledgeNotes || {}).length;
      if (opts.askBeforeRestore && hasLocalData) {
        if (!confirm("Cloud backup found. Restore it to current device?")) return;
      }
      await applyCloudBackup(data.backup, updatedAt, Object.assign({}, opts, { forceOverwriteLocal: true }));
    } catch (e) {
      setCloudSyncState("error", e.message || "Cloud load failed", "");
      if (!opts.silent) showToast(e.message || "Cloud load failed", "error");
    } finally {
      cloudBusy = false;
    }
  }

  async function saveCloudBackup(opts) {
    opts = opts || {};
    if (!cloudUser) {
      if (!opts.silent) window.location.replace("/login");
      return;
    }
    if (cloudBusy) return;
    cloudBusy = true;
    var controller = new AbortController();
    var busyTimer = setTimeout(function () {
      cloudBusy = false;
      controller.abort();
    }, 30000);
    setCloudSyncState("saving", "Saving local changes to cloud", "");
    try {
      var res = await fetch("/api/backup", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, getFullBackupPayload(), {
          forceOverwrite: Boolean(opts.forceOverwrite)
        })),
        signal: controller.signal
      });
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 409) {
        updateCloudOriginStatuses(data.origins);
        if (!cloudMeta || typeof cloudMeta !== "object") cloudMeta = getDefaultCloudMeta();
        if (data.currentUpdatedAt) {
          cloudMeta.lastSeenBackupAt = data.currentUpdatedAt;
          saveCloudMeta();
        }
        setCloudSyncState("dirty", "Cloud backup is newer; local save paused", data.currentUpdatedAt || "");
        if (!opts.silent) {
          var shouldLoadLatest = confirm("云端备份比当前本地基线更新，已暂停保存，避免覆盖其他入口的新数据。\n\n点击“确定”加载最新云端备份。\n点击“取消”后，将继续询问是否用当前本地数据强制覆盖云端。");
          if (shouldLoadLatest) {
            await loadCloudBackup({ silent: false, askBeforeRestore: true });
          } else {
            var shouldForceOverwrite = confirm("确认要用当前页面这份本地数据强制覆盖云端吗？\n\n这会把云端现有数据替换成你当前看到的内容。");
            if (shouldForceOverwrite) {
              await saveCloudBackup({ silent: false, forceOverwrite: true });
            } else {
              showToast("已保留当前本地数据，未覆盖云端", "warning");
            }
          }
        }
        return;
      }
      if (!res.ok) throw new Error(data.detail || data.error || "save failed");
      updateCloudOriginStatuses(data.origins);
      rememberCloudDecision(data.updatedAt || "", "saved");
      await syncWithServer();
      setCloudSyncState("synced", "Local changes saved to cloud", data.updatedAt || "");
      if (!opts.silent) showToast("Cloud backup saved", "success");
    } catch (e) {
      if (e.name === "AbortError") {
        setCloudSyncState("error", "Cloud save timed out (30s)", "");
      } else {
        setCloudSyncState("error", e.message || "Cloud save failed", "");
        if (!opts.silent) showToast(e.message || "Cloud save failed", "error");
      }
    } finally {
      clearTimeout(busyTimer);
      cloudBusy = false;
    }
  }

  function scheduleCloudSave() {
    if (suppressCloudAutoSave > 0) return;
    markLocalChange();
    if (!cloudUser) {
      setCloudSyncState("dirty", "Local changes pending until login", "");
      pendingCloudSave = true;
      return;
    }
    clearTimeout(cloudSaveTimer);
    pendingCloudSave = false;
    setCloudSyncState("dirty", "Waiting 2.5s before auto-save", "");
    cloudSaveTimer = setTimeout(function () {
      saveCloudBackup({ silent: true });
    }, 2500);
  }

  window.renderCloudUi = renderCloudUi;
  window.toggleCloudDetails = toggleCloudDetails;
  window.refreshCloudSession = refreshCloudSession;
  window.loadCloudBackup = loadCloudBackup;
  window.saveCloudBackup = saveCloudBackup;
  window.scheduleCloudSave = scheduleCloudSave;
})();
