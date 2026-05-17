// ============================================================
// 初始数据
// ============================================================
function getInitialData() {
  const t = today();
  return [
    {id:1,entryKind:'error',type:'言语理解与表达',subtype:'片段阅读',question:'下列句子中，意在说明"阅读不可或缺"的是哪项？',options:'A. 读书是一种习惯|B. 书籍是人类进步的阶梯|C. 阅读是精神的必需品|D. 图书馆是知识的宝库',answer:'C',myAnswer:'B',analysis:'意在说明题目找核心观点。C项"精神的必需品"直接说明阅读不可或缺。',status:'focus',addDate:t,quiz:null},
    {id:2,entryKind:'error',type:'数量关系',subtype:'数字推理',question:'2, 6, 12, 20, 30, ___',options:'A. 40|B. 42|C. 44|D. 46',answer:'B',myAnswer:'A',analysis:'差值为4,6,8,10，等差递增，下一差为12，30+12=42。',status:'review',addDate:t,quiz:null},
    {id:3,entryKind:'error',type:'判断推理',subtype:'逻辑判断',question:'所有教师是知识分子，有些知识分子是作家，能推出？',options:'A. 有些教师是作家|B. 有些作家是教师|C. 有些知识分子是教师|D. 以上都不能确定',answer:'C',myAnswer:'A',analysis:'由"所有教师是知识分子"直接推出"有些知识分子是教师"(C)。A、B不能推出。',status:'focus',addDate:t,quiz:null}
  ];
}
