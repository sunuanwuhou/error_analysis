export type TypeRule = {
  keywords: string[]
  type: string
  subtype: string
}

export type DirTree = Record<string, Record<string, string[]>>

export const FIXED_TYPES = [
  '言语理解与表达',
  '判断推理',
  '数量关系',
  '资料分析',
  '常识判断',
  '其他',
] as const

export const DEFAULT_DIR_TREE: DirTree = {
  言语理解与表达: { 未分类: [] },
  判断推理: { 未分类: [] },
  数量关系: { 未分类: [] },
  资料分析: { 未分类: [] },
  常识判断: { 未分类: [] },
  其他: { 未分类: [] },
}

export const DEFAULT_TYPE_RULES: TypeRule[] = [
  { keywords: ['图形推理', '图推', '下列图形'], type: '判断推理', subtype: '图形推理' },
  { keywords: ['类比推理', '类比', '对于'], type: '判断推理', subtype: '类比推理' },
  { keywords: ['定义判断', '的定义是', '是指'], type: '判断推理', subtype: '定义判断' },
  { keywords: ['逻辑判断', '能推出', '可以推出', '所有', '有些', '能够推断'], type: '判断推理', subtype: '逻辑判断' },
  { keywords: ['逻辑填空', '空格处', '横线处', '填入横线', '填在横线', '最恰当的一项是', '最合适的一项'], type: '言语理解与表达', subtype: '逻辑填空' },
  { keywords: ['片段阅读', '意在说明', '作者认为', '下列说法正确', '主旨', '主要观点', '这段话', '最恰当地概括'], type: '言语理解与表达', subtype: '片段阅读' },
  { keywords: ['语句排序', '语句填空', '排序', '语段', '下列语句'], type: '言语理解与表达', subtype: '语句排序' },
  { keywords: ['数字推理', '数列', '下一项'], type: '数量关系', subtype: '数字推理' },
  { keywords: ['数学运算', '工程量', '速度', '浓度', '利润', '概率', '排列组合'], type: '数量关系', subtype: '数学运算' },
  { keywords: ['资料分析', '根据图', '根据表', '增长率', '增速'], type: '资料分析', subtype: '' },
  { keywords: ['常识判断'], type: '常识判断', subtype: '' },
]

export function cloneDefaultDirTree(): DirTree {
  return JSON.parse(JSON.stringify(DEFAULT_DIR_TREE)) as DirTree
}

export function cloneDefaultTypeRules(): TypeRule[] {
  return DEFAULT_TYPE_RULES.map(r => ({
    keywords: [...r.keywords],
    type: r.type,
    subtype: r.subtype,
  }))
}
