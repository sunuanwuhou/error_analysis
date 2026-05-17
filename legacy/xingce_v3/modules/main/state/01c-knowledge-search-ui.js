// ============================================================
// 01-state knowledge tree search and UI bool utils
// ============================================================
function stReadUiBool(key, fallback){
  try{
    var raw = localStorage.getItem(key);
    if(raw === null) return !!fallback;
    return raw === 'true' || raw === '1';
  }catch(e){
    return !!fallback;
  }
}
function stWriteUiBool(key, value){
  try{ localStorage.setItem(key, value ? '1' : '0'); }catch(e){}
}
function stHasKnowledgeTreeSearch(query){
  return !!String(query || '').trim();
}
function stGetKnowledgeTreeSearchTerms(query){
  return String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
}
