// ============================================================
// 题型自动识别
// ============================================================
let _typeRules = null;
function loadTypeRules() { return _typeRules || DEFAULT_TYPE_RULES; }
function _saveTypeRules(rules) { _typeRules = rules; syncWorkspaceOpsFromSnapshot(); queuePersist(KEY_TYPE_RULES, rules, 220); markIncrementalWorkspaceChange(); }
function autoDetectType(text) {
  if (!text || text.length < 5) return;
  const rules = loadTypeRules();
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        const typeEl = document.getElementById('editType');
        const subEl  = document.getElementById('editSubtype');
        if (typeEl) typeEl.value = rule.type;
        if (subEl && rule.subtype && !subEl.value) subEl.value = rule.subtype;
        refreshKnowledgePicker();
        return;
      }
    }
  }
}
function openTypeRulesModal() {
  renderTypeRulesList();
  openModal('typeRulesModal');
}
function renderTypeRulesList() {
  const rules = loadTypeRules();
  const typeOpts = ['言语理解与表达','数量关系','判断推理','资料分析','常识判断','其他']
    .map(t => `<option>${escapeHtml(t)}</option>`).join('');
  const html = rules.map((r, i) => `
    <div class="rule-row">
      <div style="flex:2;min-width:0">
        <div style="font-size:10px;color:#999;margin-bottom:3px">关键词（逗号分隔）</div>
        <input type="text" id="rule_kw_${i}" value="${escapeHtml(r.keywords.join(','))}" style="width:100%">
      </div>
      <div style="width:130px">
        <div style="font-size:10px;color:#999;margin-bottom:3px">题型</div>
        <select id="rule_type_${i}" style="width:100%">
          ${['言语理解与表达','数量关系','判断推理','资料分析','常识判断','其他'].map(t=>`<option ${r.type===t?'selected':''}>${escapeHtml(t)}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1;min-width:80px">
        <div style="font-size:10px;color:#999;margin-bottom:3px">子类型（可空）</div>
        <input type="text" id="rule_sub_${i}" value="${escapeHtml(r.subtype||'')}" style="width:100%">
      </div>
      <button onclick="removeTypeRule(${i})" style="margin-top:16px;background:none;border:none;color:#ccc;cursor:pointer;font-size:16px;flex-shrink:0;padding:0 4px" title="删除">✕</button>
    </div>`).join('');
  document.getElementById('typeRulesList').innerHTML = html || '<div style="color:#ccc;text-align:center;padding:20px">暂无规则</div>';
}
function addTypeRule() {
  const rules = loadTypeRules();
  rules.push({keywords:['关键词'], type:'判断推理', subtype:''});
  _saveTypeRules(rules);
  renderTypeRulesList();
}
function removeTypeRule(i) {
  const rules = loadTypeRules();
  rules.splice(i, 1);
  _saveTypeRules(rules);
  renderTypeRulesList();
}
function saveTypeRules() {
  const rules = loadTypeRules();
  const newRules = rules.map((r, i) => {
    const kwEl = document.getElementById('rule_kw_'+i);
    const tyEl = document.getElementById('rule_type_'+i);
    const suEl = document.getElementById('rule_sub_'+i);
    if (!kwEl) return null;
    return {
      keywords: kwEl.value.split(',').map(k=>k.trim()).filter(Boolean),
      type: tyEl ? tyEl.value : r.type,
      subtype: suEl ? suEl.value.trim() : '',
    };
  }).filter(r => r && r.keywords.length);
  _saveTypeRules(newRules);
  closeModal('typeRulesModal');
  showToast('规则已保存（共 ' + newRules.length + ' 条）', 'success');
}
function resetTypeRules() {
  if (!confirm('恢复默认规则？当前自定义规则将被清除')) return;
  _saveTypeRules(DEFAULT_TYPE_RULES);
  renderTypeRulesList();
}
