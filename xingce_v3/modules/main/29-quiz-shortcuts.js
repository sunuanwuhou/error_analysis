// ============================================================
// 键盘快捷键（仅答题弹窗激活时）
// ============================================================
document.addEventListener('keydown', e=>{
  if(!document.getElementById('quizModal').classList.contains('open')) return;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
  const key=e.key.toLowerCase();
  if(['a','b','c','d'].includes(key)){
    const btn=document.getElementById('qopt_'+key.toUpperCase());
    if(btn&&!btn.disabled){e.preventDefault();btn.click();}
  } else if(e.key==='Enter'){
    const nextBtn=document.getElementById('quizNextBtn');
    if(nextBtn&&nextBtn.style.display!=='none'){e.preventDefault();nextBtn.click();}
  } else if(e.key==='Escape'){
    const skipBtn=document.getElementById('quizSkipBtn');
    if(skipBtn&&skipBtn.style.display!=='none'){e.preventDefault();skipBtn.click();}
  }
});
