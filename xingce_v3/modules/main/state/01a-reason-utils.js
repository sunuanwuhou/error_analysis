// ============================================================
// 01-state reason helper utils
// ============================================================
function stGetReasonGroup(reason, groups) {
  return (groups || []).find(function (g) {
    return (g.reasons || []).some(function (r) { return r.v === reason; });
  }) || null;
}

function stGetReasonDesc(reason, groups) {
  for (var i = 0; i < (groups || []).length; i += 1) {
    var g = groups[i];
    var reasons = g && g.reasons ? g.reasons : [];
    for (var j = 0; j < reasons.length; j += 1) {
      if (reasons[j].v === reason) return reasons[j].d;
    }
  }
  return "";
}

function stEscapeAttrStr(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
