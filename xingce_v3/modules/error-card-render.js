(function () {
  function renderCard(errorItem) {
    var e = errorItem || {};
    var statusMap = { focus: "重点复习", review: "待复习", mastered: "已掌握" };
    var optionsHtml = e.options
      ? e.options.split(/\n|\|/).map(function (option) {
          return "<p>" + hl(option.trim(), searchKw) + "</p>";
        }).join("")
      : "";
    var isRevealed = revealed.has(e.id);
    var idLit = idArg(e.id);
    var noteNodeLit = noteNodeArg(e.noteNodeId || "");
    var notePath = e.noteNodeId
      ? collapseKnowledgePathTitles(getKnowledgePathTitles(e.noteNodeId)).join(" > ")
      : "未关联知识点";

    var quizInfo = "";
    if (e.quiz && e.quiz.reviewCount > 0) {
      var days = daysBetween(e.quiz.lastReview, today());
      quizInfo = "复习" + e.quiz.reviewCount + "次 · 上次" + (days === 0 ? "今天" : days + "天前") + " · 错" + (e.quiz.wrongCount || 0) + "次";
      if (e.quiz.nextReview) quizInfo += " · 下次：" + e.quiz.nextReview;
    }

    var detailHtml = "";
    if (isRevealed) {
      var pills = [];
      if (e.myAnswer) pills.push('<span class="detail-pill wrong-pill">我选 ' + escapeHtml(e.myAnswer) + " ✗</span>");
      pills.push('<span class="detail-pill correct-pill">正确答案 ' + escapeHtml(e.answer || "-") + " ✓</span>");
      if (e.rootReason) {
        pills.push('<span class="detail-pill" style="background:#fff0f6;color:#c41d7f;border:1px solid #ffadd2;font-size:11px">根本主因：' + escapeHtml(e.rootReason) + "</span>");
      }
      if (e.errorReason) {
        var reasonGroup = getReasonGroup(e.errorReason);
        var reasonDesc = getReasonDesc(e.errorReason);
        var categoryBadge = reasonGroup
          ? '<span style="background:' + reasonGroup.color + '22;color:' + reasonGroup.color + ';border:1px solid ' + reasonGroup.color + '44;border-radius:4px;padding:0 4px;font-size:10px;margin-right:3px">' + escapeHtml(reasonGroup.label) + "</span>"
          : "";
        var descTip = reasonDesc ? '<span style="color:#aaa;font-size:11px"> · ' + escapeHtml(reasonDesc) + "</span>" : "";
        pills.push('<span class="detail-pill reason-pill">直接原因：' + categoryBadge + escapeHtml(e.errorReason) + descTip + "</span>");
      }
      if (quizInfo) pills.push('<span class="detail-pill meta-pill">' + escapeHtml(quizInfo) + "</span>");
      detailHtml = '<div class="card-detail">' +
        '<div class="detail-meta-row">' + pills.join("") + "</div>" +
        (e.analysis ? '<div class="detail-analysis">' + hl(e.analysis, searchKw) + "</div>" : "") +
        (e.analysisImgData ? '<img src="' + escapeHtml(e.analysisImgData) + '" class="cuoti-img" onclick="this.classList.toggle(\'expanded\')" title="点击放大/缩小" style="border:1px solid #e0e4ff;margin-top:6px">' : "") +
        "</div>";
    }

    var imageHtml = e.imgData
      ? '<img src="' + escapeHtml(e.imgData) + '" class="cuoti-img" onclick="this.classList.toggle(\'expanded\')" title="点击放大/缩小">'
      : "";
    var noteArea = isRevealed
      ? '<div class="card-note-area"><div class="card-note-label">我的笔记</div><textarea class="card-note-ta" placeholder="添加笔记..." onblur="saveCardNote(' + idLit + ',this.value)">' + escapeHtml(e.note || "") + "</textarea></div>"
      : "";

    var inlineQuiz = inlineQuizState[e.id];
    var inlineQuizHtml = "";
    if (inlineQuiz) {
      var optionList = e.options ? e.options.split(/\n|\|/).map(function (item) { return item.trim(); }).filter(Boolean) : [];
      if (!inlineQuiz.answered) {
        var buttons = optionList.length
          ? optionList.map(function (option, index) {
              var letter = String.fromCharCode(65 + index);
              return '<button class="iq-opt" id="iqopt_' + e.id + "_" + letter + '" onclick="selectInlineAnswer(' + idLit + ',\'' + letter + '\')">' + escapeHtml(option) + "</button>";
            }).join("")
          : ["A", "B", "C", "D"].map(function (letter) {
              return '<button class="iq-opt" id="iqopt_' + e.id + "_" + letter + '" onclick="selectInlineAnswer(' + idLit + ',\'' + letter + '\')" style="text-align:center;font-weight:700">' + letter + "</button>";
            }).join("");
        inlineQuizHtml = '<div class="iq-area"><div class="iq-hint">选择你的答案：</div><div class="iq-opts">' + buttons + '</div><div class="iq-actions"><button class="btn btn-sm btn-secondary" onclick="closeInlineQuiz(' + idLit + ')">取消</button></div></div>';
      } else {
        var resultClass = inlineQuiz.correct ? "ok" : "fail";
        var icon = inlineQuiz.correct ? "✓" : "✗";
        var analysisHtml = e.analysis
          ? '<div style="margin-top:6px;font-size:12px;color:#555;padding:6px 10px;background:#f6f8ff;border-radius:6px;border-left:3px solid #4e8ef7">' + escapeHtml(e.analysis) + "</div>"
          : "";
        inlineQuizHtml = '<div class="iq-area"><div class="iq-result ' + resultClass + '">' + icon + " 你选了 <strong>" + escapeHtml(inlineQuiz.userAnswer) + "</strong>，正确答案 <strong>" + escapeHtml(e.answer || "-") + "</strong></div>" + analysisHtml + '<div class="iq-actions" style="margin-top:8px"><button class="btn btn-sm btn-primary" onclick="saveInlineResult(' + idLit + ')">保存记录</button><button class="btn btn-sm btn-secondary" onclick="closeInlineQuiz(' + idLit + ')">关闭</button></div></div>';
      }
    }

    var difficulty = e.difficulty || 0;
    var starHtml = '<span class="star-disp" title="点击修改难度">' + [1, 2, 3].map(function (idx) {
      return '<span class="s' + (idx <= difficulty ? " on" : "") + '" onclick="setCardDifficulty(' + idLit + "," + idx + ',event)">★</span>';
    }).join("") + "</span>";
    var batchHtml = batchMode
      ? '<input type="checkbox" class="batch-cb" id="bcb_' + e.id + '" ' + (batchSelected.has(e.id) ? "checked" : "") + ' onclick="toggleBatchSelect(' + idLit + ',event)">'
      : "";

    var masteryButton = (function () {
      var masteryLevel = e.masteryLevel || "not_mastered";
      var config = {
        not_mastered: { label: "未掌握", color: "#ff7875", bg: "#fff2f0", border: "#ffa39e" },
        fuzzy: { label: "模糊", color: "#fa8c16", bg: "#fff7e6", border: "#ffd591" },
        mastered: { label: "已掌握", color: "#52c41a", bg: "#f6ffed", border: "#b7eb8f" }
      };
      var current = config[masteryLevel] || config.not_mastered;
      return '<button class="btn btn-sm" style="color:' + current.color + ";background:" + current.bg + ";border:1px solid " + current.border + '" onclick="cyclemastery(' + idLit + ')" title="点击切换掌握状态">◎ ' + current.label + "</button>";
    })();

    return '<div class="error-card" id="card-' + e.id + '" draggable="true" ondragstart="startErrorDrag(' + idLit + ', event)" ondragend="endErrorDrag()" ' + (isRevealed ? 'onmouseleave="collapseCard(' + idLit + ')"' : "") + ">" +
      batchHtml +
      '<div class="card-top">' +
      '<span class="card-num">#' + e.id + "</span>" +
      '<span class="status-tag ' + escapeHtml(e.status || "focus") + '">' + escapeHtml(statusMap[e.status] || e.status || "重点复习") + "</span>" +
      (e.subSubtype ? '<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f0f5ff;color:#4e8ef7">' + escapeHtml(e.subSubtype) + "</span>" : "") +
      starHtml +
      ((e.srcYear || e.srcProvince || e.srcOrigin) ? '<span style="font-size:11px;padding:1px 7px;border-radius:8px;background:#f6ffed;color:#52c41a;border:1px solid #b7eb8f" title="出处">来源 ' + escapeHtml([e.srcYear, e.srcProvince, e.srcOrigin].filter(Boolean).join(" · ")) + "</span>" : "") +
      (e.addDate ? '<span style="font-size:11px;color:#999">' + escapeHtml(e.addDate) + "</span>" : "") +
      "</div>" +
      '<div class="card-question">' + hl(e.question, searchKw) + "</div>" +
      '<div style="font-size:11px;color:#888;line-height:1.6;margin-bottom:8px">知识点：' + escapeHtml(notePath) + "</div>" +
      imageHtml +
      (optionsHtml ? '<div class="card-options">' + optionsHtml + "</div>" : "") +
      (isRevealed ? detailHtml + noteArea : "") +
      '<button class="card-reveal-btn" onclick="revealCard(' + idLit + ')" style="' + (isRevealed ? "color:#bbb;border-color:#eee;font-size:11px;margin-top:6px" : "") + '">' + (isRevealed ? "▲ 收起" : "查看答案与解析") + "</button>" +
      inlineQuizHtml +
      '<div class="card-actions">' +
      '<button class="btn btn-sm btn-secondary" onclick="openKnowledgeForError(' + idLit + ')">知识点</button>' +
      '<button class="btn btn-sm btn-secondary" onclick="moveErrorToKnowledgeNode(' + idLit + ", " + noteNodeLit + ')">改挂载</button>' +
      '<select class="status-select" onchange="updateStatus(' + idLit + ',this.value)">' +
      '<option value="focus" ' + (e.status === "focus" ? "selected" : "") + ">重点复习</option>" +
      '<option value="review" ' + (e.status === "review" ? "selected" : "") + ">待复习</option>" +
      '<option value="mastered" ' + (e.status === "mastered" ? "selected" : "") + ">已掌握</option>" +
      "</select>" +
      masteryButton +
      '<button class="btn btn-sm btn-secondary" onclick="openEditModal(' + idLit + ')">编辑</button>' +
      '<button class="btn btn-sm btn-secondary" style="color:#4e8ef7;border-color:#adc6ff" onclick="startInlineQuiz(' + idLit + ')">做题</button>' +
      '<button class="del-btn" onclick="deleteError(' + idLit + ')">删除</button>' +
      "</div></div>";
  }

  window.renderCard = renderCard;
})();
