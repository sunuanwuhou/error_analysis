(function () {
  function buildErrorTypeMap(list) {
    var typeMap = {};
    (list || []).forEach(function (item) {
      if (!typeMap[item.type]) typeMap[item.type] = {};
      var subtype = item.subtype || "未分类";
      if (!typeMap[item.type][subtype]) typeMap[item.type][subtype] = [];
      typeMap[item.type][subtype].push(item);
    });
    return typeMap;
  }

  function buildSub2Map(cards) {
    var sub2Map = {};
    (cards || []).forEach(function (item) {
      var subSubtype = item.subSubtype || "";
      if (!sub2Map[subSubtype]) sub2Map[subSubtype] = [];
      sub2Map[subSubtype].push(item);
    });
    return sub2Map;
  }

  function renderStats(list) {
    var items = list || [];
    var focusCount = items.filter(function (item) { return item.status === "focus"; }).length;
    var reviewCount = items.filter(function (item) { return item.status === "review"; }).length;
    var masteredCount = items.filter(function (item) { return item.status === "mastered"; }).length;
    var statsBar = document.getElementById("statsBar");
    var breadcrumb = document.getElementById("breadcrumb");
    if (statsBar) {
      statsBar.innerHTML =
        '<div class="stat-item"><div class="stat-num">' + items.length + '</div><div class="stat-label">共计</div></div>' +
        '<div class="stat-item"><div class="stat-num" style="color:#e74c3c">' + focusCount + '</div><div class="stat-label">重点</div></div>' +
        '<div class="stat-item"><div class="stat-num" style="color:#fa8c16">' + reviewCount + '</div><div class="stat-label">待复习</div></div>' +
        '<div class="stat-item"><div class="stat-num" style="color:#52c41a">' + masteredCount + '</div><div class="stat-label">已掌握</div></div>';
    }

    var crumb = "全部题目";
    if (typeFilter) {
      if (typeFilter.level === "type") crumb = typeFilter.value;
      else if (typeFilter.level === "subtype") crumb = typeFilter.type + " › " + typeFilter.value;
      else if (typeFilter.level === "sub2") crumb = typeFilter.type + " › " + typeFilter.subtype + " › " + typeFilter.value;
    } else if (statusFilter !== "all") {
      crumb = ({ focus: "重点复习", review: "待复习", mastered: "已掌握" })[statusFilter] || statusFilter;
    }
    if (reasonFilter) crumb += (crumb === "全部题目" ? "" : "，") + "错因: " + reasonFilter;
    if (searchKw) crumb += ' › 搜索"' + escapeHtml(searchKw) + '"';

    if (breadcrumb) {
      breadcrumb.innerHTML = crumb === "全部题目"
        ? "全部题目"
        : '全部 › <span>' + escapeHtml(crumb) + '</span> <span style="cursor:pointer;color:#aaa;font-size:11px;margin-left:4px" onclick="clearFilter()">✕ 清除</span>';
    }
  }

  function renderAll() {
    var list = getFiltered();
    renderStats(list);
    var container = document.getElementById("errorList");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = '<div class="empty"><div class="emoji">' + (searchKw ? "🔍" : "📭") + "</div><p>" + (searchKw ? "未找到匹配题目" : '暂无错题，点击"＋ 添加"') + "</p></div>";
      return;
    }

    var typeMap = buildErrorTypeMap(list);
    var html = "";
    Object.entries(typeMap).forEach(function (typeEntry) {
      var type = typeEntry[0];
      var subMap = typeEntry[1];
      var open = expMain.has(type);
      var total = Object.values(subMap).reduce(function (sum, cards) { return sum + cards.length; }, 0);
      html += '<div class="type-group">' +
        '<div class="type-header" onclick="toggleMain(\'' + escapeHtml(type) + '\')">' +
        '<div class="type-title"><span class="type-arrow ' + (open ? "open" : "") + '">▶</span>' +
        escapeHtml(type) + '<span class="type-badge">' + total + "</span></div></div>";

      if (open) {
        Object.entries(subMap).forEach(function (subEntry) {
          var subtype = subEntry[0];
          var cards = subEntry[1];
          var subKey = "sub:" + type + "::" + subtype;
          var subOpen = expMainSub.has(subKey);
          var sub2Map = buildSub2Map(cards);
          var hasSub2 = Object.keys(sub2Map).some(function (key) { return key !== ""; });

          html += '<div class="subtype-group">' +
            '<div class="subtype-header" onclick="toggleMainSub(\'' + escapeHtml(type) + "','" + escapeHtml(subtype) + '\')">' +
            '<div class="subtype-title"><span class="subtype-arrow ' + (subOpen ? "open" : "") + '">▶</span>' +
            escapeHtml(subtype) +
            '<span style="font-size:11px;color:#aaa;background:#f0f0f0;padding:1px 6px;border-radius:8px">' + cards.length + "</span></div></div>";

          if (subOpen) {
            if (hasSub2) {
              (sub2Map[""] || []).forEach(function (item) { html += renderCard(item); });
              Object.entries(sub2Map).forEach(function (sub2Entry) {
                var sub2 = sub2Entry[0];
                var sub2Cards = sub2Entry[1];
                if (!sub2) return;
                var sub2Key = "s2:" + type + "::" + subtype + "::" + sub2;
                var sub2Open = expMainSub2.has(sub2Key);
                html += '<div class="sub2-group">' +
                  '<div class="sub2-header" onclick="toggleMainSub2(\'' + escapeHtml(type) + "','" + escapeHtml(subtype) + "','" + escapeHtml(sub2) + '\')">' +
                  '<div class="sub2-title"><span class="sub2-arrow ' + (sub2Open ? "open" : "") + '">▶</span>' +
                  escapeHtml(sub2) +
                  '<span style="font-size:10px;color:#bbb;background:#f5f5f5;padding:0 5px;border-radius:5px">' + sub2Cards.length + "</span></div></div>";
                if (sub2Open) {
                  sub2Cards.forEach(function (item) { html += renderCard(item); });
                }
                html += "</div>";
              });
            } else {
              cards.forEach(function (item) { html += renderCard(item); });
            }
          }
          html += "</div>";
        });
      }
      html += "</div>";
    });

    container.innerHTML = html;
    container.classList.toggle("batch-mode-on", batchMode);
  }

  function toggleMain(type) {
    if (expMain.has(type)) expMain.delete(type);
    else expMain.add(type);
    saveExpMain();
    renderAll();
  }

  function toggleMainSub(type, subtype) {
    var key = "sub:" + type + "::" + subtype;
    if (expMainSub.has(key)) expMainSub.delete(key);
    else expMainSub.add(key);
    saveExpMain();
    renderAll();
  }

  function toggleMainSub2(type, subtype, subSubtype) {
    var key = "s2:" + type + "::" + subtype + "::" + subSubtype;
    if (expMainSub2.has(key)) expMainSub2.delete(key);
    else expMainSub2.add(key);
    saveExpMain();
    renderAll();
  }

  function expandAll() {
    var typeMap = buildErrorTypeMap(getFiltered());
    Object.keys(typeMap).forEach(function (type) {
      expMain.add(type);
      Object.keys(typeMap[type]).forEach(function (subtype) {
        expMainSub.add("sub:" + type + "::" + subtype);
        typeMap[type][subtype].forEach(function (item) {
          if (item.subSubtype) expMainSub2.add("s2:" + type + "::" + subtype + "::" + item.subSubtype);
        });
      });
    });
    saveExpMain();
    renderAll();
  }

  function collapseAll() {
    expMain.clear();
    expMainSub.clear();
    expMainSub2.clear();
    saveExpMain();
    renderAll();
  }

  window.renderStats = renderStats;
  window.renderAll = renderAll;
  window.toggleMain = toggleMain;
  window.toggleMainSub = toggleMainSub;
  window.toggleMainSub2 = toggleMainSub2;
  window.expandAll = expandAll;
  window.collapseAll = collapseAll;
})();
