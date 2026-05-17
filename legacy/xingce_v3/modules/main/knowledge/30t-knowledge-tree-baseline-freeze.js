// ============================================================
// Knowledge tree baseline freeze
// ============================================================
// Disabled by default: forcing baseline remap during restore can
// overwrite user-restored tree structure and make nodes appear missing.
const KNOWLEDGE_TREE_BASELINE_FREEZE_ENABLED = false;
const KNOWLEDGE_TREE_BASELINE_EXPORTED_AT = '2026-05-08T13:50:00.698Z';
const KNOWLEDGE_TREE_BASELINE_NODES = [
  {"id":"kn_d96e4b7ddaa5","parentId":"","level":1,"title":"言语理解与表达","path":"言语理解与表达"},
  {"id":"kn_905b8a71e57e","parentId":"kn_d96e4b7ddaa5","level":2,"title":"片段阅读","path":"言语理解与表达 > 片段阅读"},
  {"id":"kn_fa22e3e22c3e","parentId":"kn_d96e4b7ddaa5","level":2,"title":"标题题","path":"言语理解与表达 > 标题题"},
  {"id":"kn_7f762976b05b","parentId":"kn_d96e4b7ddaa5","level":2,"title":"逻辑填空","path":"言语理解与表达 > 逻辑填空"},
  {"id":"kn_fdde52c62229","parentId":"kn_7f762976b05b","level":3,"title":"语境分析","path":"言语理解与表达 > 逻辑填空 > 语境分析"},
  {"id":"kn_58ae9ffc7245","parentId":"kn_7f762976b05b","level":3,"title":"成语辨析","path":"言语理解与表达 > 逻辑填空 > 成语辨析"},
  {"id":"kn_33cd0c1636bc","parentId":"kn_7f762976b05b","level":3,"title":"近义词辨析","path":"言语理解与表达 > 逻辑填空 > 近义词辨析"},
  {"id":"kn_9983f88f0a0b","parentId":"kn_d96e4b7ddaa5","level":2,"title":"主旨概括","path":"言语理解与表达 > 主旨概括"},
  {"id":"kn_e4b461e4f188","parentId":"kn_d96e4b7ddaa5","level":2,"title":"语句填充题","path":"言语理解与表达 > 语句填充题"},
  {"id":"kn_ff3cf389a770","parentId":"kn_d96e4b7ddaa5","level":2,"title":"语句排列","path":"言语理解与表达 > 语句排列"},
  {"id":"kn_10620035789e","parentId":"kn_d96e4b7ddaa5","level":2,"title":"意图判断","path":"言语理解与表达 > 意图判断"},
  {"id":"kn_24e1f24ac3aa","parentId":"kn_d96e4b7ddaa5","level":2,"title":"细节判断","path":"言语理解与表达 > 细节判断"},
  {"id":"kn_413c1a6ef7ca","parentId":"kn_d96e4b7ddaa5","level":2,"title":"推断下文","path":"言语理解与表达 > 推断下文"},
  {"id":"kn_1f5499ae34a4","parentId":"kn_d96e4b7ddaa5","level":2,"title":"局部作用题","path":"言语理解与表达 > 局部作用题"},
  {"id":"kn_dedadc4164f6","parentId":"","level":1,"title":"判断推理","path":"判断推理"},
  {"id":"kn_e0867871b26f","parentId":"kn_dedadc4164f6","level":2,"title":"图形推理","path":"判断推理 > 图形推理"},
  {"id":"kn_vfdmg6lf","parentId":"kn_e0867871b26f","level":3,"title":"组成相同","path":"判断推理 > 图形推理 > 组成相同"},
  {"id":"kn_ec436b25ce30","parentId":"kn_vfdmg6lf","level":4,"title":"位置类","path":"判断推理 > 图形推理 > 组成相同 > 位置类"},
  {"id":"kn_10a37ff14f6a","parentId":"kn_vfdmg6lf","level":4,"title":"样式平移类","path":"判断推理 > 图形推理 > 组成相同 > 样式平移类"},
  {"id":"kn_vpe33kha","parentId":"kn_e0867871b26f","level":3,"title":"组成相似","path":"判断推理 > 图形推理 > 组成相似"},
  {"id":"kn_ff299e62fc06","parentId":"kn_vpe33kha","level":4,"title":"加减同异","path":"判断推理 > 图形推理 > 组成相似 > 加减同异"},
  {"id":"kn_h2bkjobj","parentId":"kn_e0867871b26f","level":3,"title":"组成不同","path":"判断推理 > 图形推理 > 组成不同"},
  {"id":"kn_bk39hj87","parentId":"kn_h2bkjobj","level":4,"title":"线","path":"判断推理 > 图形推理 > 组成不同 > 线"},
  {"id":"kn_a9ec39eb90d2","parentId":"kn_e0867871b26f","level":3,"title":"拼合类","path":"判断推理 > 图形推理 > 拼合类"},
  {"id":"kn_df074c24702d","parentId":"kn_e0867871b26f","level":3,"title":"旋转轨迹","path":"判断推理 > 图形推理 > 旋转轨迹"},
  {"id":"kn_4dc41858efaa","parentId":"kn_e0867871b26f","level":3,"title":"六面体","path":"判断推理 > 图形推理 > 六面体"},
  {"id":"kn_c932e9224ab0","parentId":"kn_e0867871b26f","level":3,"title":"截面类","path":"判断推理 > 图形推理 > 截面类"},
  {"id":"kn_9v31wooi","parentId":"kn_e0867871b26f","level":3,"title":"三视图","path":"判断推理 > 图形推理 > 三视图"},
  {"id":"kn_wg6cn0qg","parentId":"kn_e0867871b26f","level":3,"title":"功能元素","path":"判断推理 > 图形推理 > 功能元素"},
  {"id":"kn_zchwpvuj","parentId":"kn_dedadc4164f6","level":2,"title":"加强削弱","path":"判断推理 > 加强削弱"},
  {"id":"kn_xtgv78uz","parentId":"kn_zchwpvuj","level":3,"title":"削弱","path":"判断推理 > 加强削弱 > 削弱"},
  {"id":"kn_9f354b74eb74","parentId":"kn_xtgv78uz","level":4,"title":"他因削弱","path":"判断推理 > 加强削弱 > 削弱 > 他因削弱"},
  {"id":"kn_iwzm3eop","parentId":"kn_xtgv78uz","level":4,"title":"拆桥","path":"判断推理 > 加强削弱 > 削弱 > 拆桥"},
  {"id":"kn_ntwgj6r2","parentId":"kn_iwzm3eop","level":5,"title":"方法不可行","path":"判断推理 > 加强削弱 > 削弱 > 拆桥 > 方法不可行"},
  {"id":"kn_6izf6gu3","parentId":"kn_xtgv78uz","level":4,"title":"论据","path":"判断推理 > 加强削弱 > 削弱 > 论据"},
  {"id":"kn_f90d1cad24d8","parentId":"kn_6izf6gu3","level":5,"title":"釜底抽薪","path":"判断推理 > 加强削弱 > 削弱 > 论据 > 釜底抽薪"},
  {"id":"kn_u00kjfmg","parentId":"kn_xtgv78uz","level":4,"title":"论点","path":"判断推理 > 加强削弱 > 削弱 > 论点"},
  {"id":"kn_fd8zxdhk","parentId":"kn_xtgv78uz","level":4,"title":"陷阱题","path":"判断推理 > 加强削弱 > 削弱 > 陷阱题"},
  {"id":"kn_saumim1l","parentId":"kn_xtgv78uz","level":4,"title":"实验","path":"判断推理 > 加强削弱 > 削弱 > 实验"},
  {"id":"kn_u23dvngz","parentId":"kn_zchwpvuj","level":3,"title":"前提假设","path":"判断推理 > 加强削弱 > 前提假设"},
  {"id":"kn_kuyao91v","parentId":"kn_zchwpvuj","level":3,"title":"论证缺陷","path":"判断推理 > 加强削弱 > 论证缺陷"},
  {"id":"kn_f64f6067d802","parentId":"kn_zchwpvuj","level":3,"title":"加强","path":"判断推理 > 加强削弱 > 加强"},
  {"id":"kn_dbdiw630","parentId":"kn_zchwpvuj","level":3,"title":"最不能支持题","path":"判断推理 > 加强削弱 > 最不能支持题"},
  {"id":"kn_f8ab9092c837","parentId":"kn_dedadc4164f6","level":2,"title":"逻辑判断","path":"判断推理 > 逻辑判断"},
  {"id":"kn_84c53e930093","parentId":"kn_f8ab9092c837","level":3,"title":"翻译推理","path":"判断推理 > 逻辑判断 > 翻译推理"},
  {"id":"kn_3f8f5f95702c","parentId":"kn_f8ab9092c837","level":3,"title":"4321","path":"判断推理 > 逻辑判断 > 4321"},
  {"id":"kn_ebc9f5508b66","parentId":"kn_f8ab9092c837","level":3,"title":"真假推理","path":"判断推理 > 逻辑判断 > 真假推理"},
  {"id":"kn_ee813f2d9d30","parentId":"kn_f8ab9092c837","level":3,"title":"串串","path":"判断推理 > 逻辑判断 > 串串"},
  {"id":"kn_03fa079efa85","parentId":"kn_f8ab9092c837","level":3,"title":"大大则大/条件补充","path":"判断推理 > 逻辑判断 > 大大则大/条件补充"},
  {"id":"kn_8d1b2e97a04d","parentId":"kn_f8ab9092c837","level":3,"title":"分配限制","path":"判断推理 > 逻辑判断 > 分配限制"},
  {"id":"kn_12285cc529c6","parentId":"kn_f8ab9092c837","level":3,"title":"条件推理","path":"判断推理 > 逻辑判断 > 条件推理"},
  {"id":"kn_1lcxnx3f","parentId":"kn_f8ab9092c837","level":3,"title":"一半一半","path":"判断推理 > 逻辑判断 > 一半一半"},
  {"id":"kn_0c80e4975476","parentId":"kn_f8ab9092c837","level":3,"title":"最大信息法","path":"判断推理 > 逻辑判断 > 最大信息法"},
  {"id":"kn_c9ptvwv9","parentId":"kn_f8ab9092c837","level":3,"title":"前提假设题","path":"判断推理 > 逻辑判断 > 前提假设题"},
  {"id":"kn_bb2f1965bc65","parentId":"kn_dedadc4164f6","level":2,"title":"科推","path":"判断推理 > 科推"},
  {"id":"kn_2581020a6064","parentId":"kn_bb2f1965bc65","level":3,"title":"物理","path":"判断推理 > 科推 > 物理"},
  {"id":"kn_xcgcy9d4","parentId":"kn_2581020a6064","level":4,"title":"浮力","path":"判断推理 > 科推 > 物理 > 浮力"},
  {"id":"kn_u422t6wo","parentId":"kn_bb2f1965bc65","level":3,"title":"生物","path":"判断推理 > 科推 > 生物"},
  {"id":"kn_7im0n63y","parentId":"kn_bb2f1965bc65","level":3,"title":"地理","path":"判断推理 > 科推 > 地理"},
  {"id":"kn_5fa9d3106eff","parentId":"kn_dedadc4164f6","level":2,"title":"类比推理","path":"判断推理 > 类比推理"},
  {"id":"kn_90f7ef1de379","parentId":"kn_5fa9d3106eff","level":3,"title":"场所与标志物关系","path":"判断推理 > 类比推理 > 场所与标志物关系"},
  {"id":"kn_41a76d15752d","parentId":"kn_dedadc4164f6","level":2,"title":"逻辑结构类比","path":"判断推理 > 逻辑结构类比"},
  {"id":"kn_bb9be240957b","parentId":"kn_dedadc4164f6","level":2,"title":"原因解释","path":"判断推理 > 原因解释"},
  {"id":"kn_6d58c95cebda","parentId":"","level":1,"title":"数量关系","path":"数量关系"},
  {"id":"kn_t5inkcdl","parentId":"kn_6d58c95cebda","level":2,"title":"和差倍比","path":"数量关系 > 和差倍比"},
  {"id":"kn_dnajg3ke","parentId":"kn_6d58c95cebda","level":2,"title":"比例法","path":"数量关系 > 比例法"},
  {"id":"kn_5qi0c8am","parentId":"kn_6d58c95cebda","level":2,"title":"混合","path":"数量关系 > 混合"},
  {"id":"kn_31dec584eb2d","parentId":"kn_5qi0c8am","level":3,"title":"未细分","path":"数量关系 > 混合 > 未细分"},
  {"id":"kn_y6pp0w5v","parentId":"kn_6d58c95cebda","level":2,"title":"鸡兔","path":"数量关系 > 鸡兔"},
  {"id":"kn_vr1hmey9","parentId":"kn_6d58c95cebda","level":2,"title":"年龄问题","path":"数量关系 > 年龄问题"},
  {"id":"kn_1tdj6wjl","parentId":"kn_6d58c95cebda","level":2,"title":"容斥","path":"数量关系 > 容斥"},
  {"id":"kn_gpgrp9i8","parentId":"kn_6d58c95cebda","level":2,"title":"数列","path":"数量关系 > 数列"},
  {"id":"kn_376131d0dd59","parentId":"kn_gpgrp9i8","level":3,"title":"递推数列","path":"数量关系 > 数列 > 递推数列"},
  {"id":"kn_ed154a6cf772","parentId":"kn_gpgrp9i8","level":3,"title":"多级数列","path":"数量关系 > 数列 > 多级数列"},
  {"id":"kn_94baec188a9f","parentId":"kn_gpgrp9i8","level":3,"title":"分数数列","path":"数量关系 > 数列 > 分数数列"},
  {"id":"kn_84ee1325846a","parentId":"kn_gpgrp9i8","level":3,"title":"图表","path":"数量关系 > 数列 > 图表"},
  {"id":"kn_ndpzbi6r","parentId":"kn_6d58c95cebda","level":2,"title":"数推","path":"数量关系 > 数推"},
  {"id":"kn_bcc730fa54c2","parentId":"kn_ndpzbi6r","level":3,"title":"幂次","path":"数量关系 > 数推 > 幂次"},
  {"id":"kn_91cc4d853b98","parentId":"kn_ndpzbi6r","level":3,"title":"递推","path":"数量关系 > 数推 > 递推"},
  {"id":"kn_f71e97dc66cc","parentId":"kn_ndpzbi6r","level":3,"title":"分组","path":"数量关系 > 数推 > 分组"},
  {"id":"kn_537e2df405ed","parentId":"kn_ndpzbi6r","level":3,"title":"分数","path":"数量关系 > 数推 > 分数"},
  {"id":"kn_42703c995ace","parentId":"kn_ndpzbi6r","level":3,"title":"小数","path":"数量关系 > 数推 > 小数"},
  {"id":"kn_ubs5o4b7","parentId":"kn_6d58c95cebda","level":2,"title":"植树问题","path":"数量关系 > 植树问题"},
  {"id":"kn_8que21bx","parentId":"kn_6d58c95cebda","level":2,"title":"最不利","path":"数量关系 > 最不利"},
  {"id":"kn_r9bnaaah","parentId":"kn_6d58c95cebda","level":2,"title":"核心思维-纯笔记","path":"数量关系 > 核心思维-纯笔记"},
  {"id":"kn_d68b183a248f","parentId":"kn_6d58c95cebda","level":2,"title":"方程列式","path":"数量关系 > 方程列式"},
  {"id":"kn_5a8b8aef89a7","parentId":"kn_6d58c95cebda","level":2,"title":"概率","path":"数量关系 > 概率"},
  {"id":"kn_972ce968ace7","parentId":"kn_6d58c95cebda","level":2,"title":"行程问题","path":"数量关系 > 行程问题"},
  {"id":"kn_1efbabadc749","parentId":"kn_6d58c95cebda","level":2,"title":"星期日期","path":"数量关系 > 星期日期"},
  {"id":"kn_38e6eb5959bd","parentId":"kn_6d58c95cebda","level":2,"title":"溶液浓度","path":"数量关系 > 溶液浓度"},
  {"id":"kn_8c1so8xw","parentId":"","level":1,"title":"资料分析","path":"资料分析"},
  {"id":"kn_9a5bf254cb74","parentId":"kn_8c1so8xw","level":2,"title":"比重平均数专题","path":"资料分析 > 比重平均数专题"},
  {"id":"kn_71ed59c13c75","parentId":"kn_9a5bf254cb74","level":3,"title":"未细分","path":"资料分析 > 比重平均数专题 > 未细分"},
  {"id":"kn_beb54f913253","parentId":"kn_8c1so8xw","level":2,"title":"计算","path":"资料分析 > 计算"},
  {"id":"kn_249df2fdb6f3","parentId":"kn_beb54f913253","level":3,"title":"基期还原","path":"资料分析 > 计算 > 基期还原"},
  {"id":"kn_f2601e52abb8","parentId":"kn_beb54f913253","level":3,"title":"比值计算","path":"资料分析 > 计算 > 比值计算"},
  {"id":"kn_a34d715a4aab","parentId":"kn_beb54f913253","level":3,"title":"同比增速区间判断","path":"资料分析 > 计算 > 同比增速区间判断"},
  {"id":"kn_06e10dc063f8","parentId":"kn_beb54f913253","level":3,"title":"现期量推算","path":"资料分析 > 计算 > 现期量推算"},
  {"id":"kn_316d22e249f4","parentId":"kn_beb54f913253","level":3,"title":"同比增长率","path":"资料分析 > 计算 > 同比增长率"},
  {"id":"kn_622f73851916","parentId":"kn_beb54f913253","level":3,"title":"增长量比较","path":"资料分析 > 计算 > 增长量比较"},
  {"id":"kn_9af6c00bace2","parentId":"kn_beb54f913253","level":3,"title":"平均数增长量","path":"资料分析 > 计算 > 平均数增长量"},
  {"id":"kn_90193efd4c1c","parentId":"kn_beb54f913253","level":3,"title":"比重差逆运用","path":"资料分析 > 计算 > 比重差逆运用"},
  {"id":"kn_9871b8386f87","parentId":"kn_beb54f913253","level":3,"title":"年均增长量","path":"资料分析 > 计算 > 年均增长量"},
  {"id":"kn_a4cb4a98fa54","parentId":"kn_8c1so8xw","level":2,"title":"计算问题","path":"资料分析 > 计算问题"},
  {"id":"kn_085ef7df904b","parentId":"kn_a4cb4a98fa54","level":3,"title":"未细分","path":"资料分析 > 计算问题 > 未细分"},
  {"id":"kn_b6384cf52ad1","parentId":"kn_8c1so8xw","level":2,"title":"年均相关专题","path":"资料分析 > 年均相关专题"},
  {"id":"kn_4a1208c20edb","parentId":"kn_b6384cf52ad1","level":3,"title":"未细分","path":"资料分析 > 年均相关专题 > 未细分"},
  {"id":"kn_3cbe0109fed7","parentId":"kn_8c1so8xw","level":2,"title":"间隔增长率","path":"资料分析 > 间隔增长率"},
  {"id":"kn_c2356ed4f75e","parentId":"kn_3cbe0109fed7","level":3,"title":"未细分","path":"资料分析 > 间隔增长率 > 未细分"},
  {"id":"kn_d94a05d60017","parentId":"kn_8c1so8xw","level":2,"title":"增长量","path":"资料分析 > 增长量"},
  {"id":"kn_39cf142b6dd1","parentId":"kn_d94a05d60017","level":3,"title":"未细分","path":"资料分析 > 增长量 > 未细分"},
  {"id":"kn_ff343915b0a0","parentId":"kn_39cf142b6dd1","level":4,"title":"综合分析","path":"资料分析 > 增长量 > 未细分 > 综合分析"},
  {"id":"kn_b17856c66d6e","parentId":"kn_ff343915b0a0","level":5,"title":"多项判断","path":"资料分析 > 增长量 > 未细分 > 综合分析 > 多项判断"},
  {"id":"kn_6d43eae72464","parentId":"kn_ff343915b0a0","level":5,"title":"均值比较","path":"资料分析 > 增长量 > 未细分 > 综合分析 > 均值比较"},
  {"id":"kn_c59b0ef3d9a8","parentId":"kn_8c1so8xw","level":2,"title":"月均速算","path":"资料分析 > 月均速算"},
  {"id":"kn_13ce693e7b27","parentId":"kn_c59b0ef3d9a8","level":3,"title":"未细分","path":"资料分析 > 月均速算 > 未细分"},
  {"id":"kn_395p1811","parentId":"","level":1,"title":"常识判断","path":"常识判断"},
  {"id":"kn_10cfa0200098","parentId":"kn_395p1811","level":2,"title":"政治法律","path":"常识判断 > 政治法律"},
  {"id":"kn_2fc34a866942","parentId":"kn_10cfa0200098","level":3,"title":"宪法","path":"常识判断 > 政治法律 > 宪法"}
];

function getEffectiveKnowledgeBaselineNodes() {
  if (Array.isArray(knowledgeBaselineNodes) && knowledgeBaselineNodes.length) {
    return knowledgeBaselineNodes;
  }
  return KNOWLEDGE_TREE_BASELINE_NODES;
}

function persistKnowledgeBaselineSnapshot(nodes, version) {
  if (!Array.isArray(nodes) || !nodes.length) return false;
  knowledgeBaselineNodes = nodes;
  knowledgeBaselineVersion = String(version || KNOWLEDGE_TREE_BASELINE_EXPORTED_AT || '');
  if (typeof queuePersist === 'function') {
    queuePersist(KEY_KNOWLEDGE_BASELINE_NODES, knowledgeBaselineNodes);
    queuePersist(KEY_KNOWLEDGE_BASELINE_VERSION, knowledgeBaselineVersion);
  } else if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function') {
    DB.set(KEY_KNOWLEDGE_BASELINE_NODES, JSON.stringify(knowledgeBaselineNodes));
    DB.set(KEY_KNOWLEDGE_BASELINE_VERSION, knowledgeBaselineVersion);
  }
  return true;
}

function snapshotKnowledgeTreeNodes(nodes) {
  const output = [];
  const walk = (list, parentId, level, trail) => {
    (list || []).forEach(node => {
      if (!node || !node.id) return;
      const title = normalizeKnowledgeTitle(node.title, level === 1 ? '未分类' : `知识点${String(node.id || '').slice(-4)}`);
      const nextTrail = collapseKnowledgePathTitles((trail || []).concat(title));
      output.push({
        id: String(node.id || ''),
        parentId: String(parentId || ''),
        level: Number(level || 1),
        title,
        path: nextTrail.join(' > ')
      });
      walk(node.children || [], String(node.id || ''), Number(level || 1) + 1, nextTrail);
    });
  };
  walk(nodes || [], '', 1, []);
  return output;
}

function freezeKnowledgeTreeBaselineToCurrentState(versionTag) {
  const nodes = snapshotKnowledgeTreeNodes(getKnowledgeRootNodes());
  return persistKnowledgeBaselineSnapshot(nodes, versionTag || new Date().toISOString());
}

function normalizeBaselinePathKeyFromTitles(titles) {
  return (titles || [])
    .map(item => normalizeKnowledgeTitle(String(item || ''), ''))
    .filter(Boolean)
    .join('>');
}

function normalizeBaselinePathKey(pathText) {
  if (!pathText) return '';
  return normalizeBaselinePathKeyFromTitles(String(pathText || '').split('>'));
}

function buildKnowledgeTreeFromBaselineSnapshot(baselineNodes) {
  const source = Array.isArray(baselineNodes) ? baselineNodes : [];
  const map = new Map();
  const roots = [];
  source.forEach(node => {
    const id = String(node.id || '').trim();
    if (!id) return;
    map.set(id, {
      id,
      title: normalizeKnowledgeTitle(node.title, '未分类'),
      level: Number(node.level || 1),
      contentMd: '',
      updatedAt: '',
      isLeaf: true,
      children: []
    });
  });
  source.forEach(node => {
    const id = String(node.id || '').trim();
    const parentId = String(node.parentId || '').trim();
    const current = map.get(id);
    if (!current) return;
    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(current);
    } else {
      roots.push(current);
    }
  });
  const applyMeta = (nodes, level) => {
    (nodes || []).forEach(node => {
      node.level = level;
      applyMeta(node.children || [], level + 1);
      node.isLeaf = (node.children || []).length === 0;
    });
  };
  applyMeta(roots, 1);
  return { version: 1, roots };
}

function applyKnowledgeTreeBaselineFreeze() {
  if (!KNOWLEDGE_TREE_BASELINE_FREEZE_ENABLED) return false;
  const oldTreeRoots = getKnowledgeRootNodes();
  if ((!Array.isArray(knowledgeBaselineNodes) || !knowledgeBaselineNodes.length) && Array.isArray(oldTreeRoots) && oldTreeRoots.length) {
    // First run: lock the user's current tree as runtime baseline.
    freezeKnowledgeTreeBaselineToCurrentState(new Date().toISOString());
  }
  const baselineNodes = getEffectiveKnowledgeBaselineNodes();
  if (!Array.isArray(baselineNodes) || !baselineNodes.length) return false;

  const oldPathToNode = new Map();
  const oldIdToPath = new Map();
  const oldParentById = new Map();
  const oldNodeById = new Map();
  const walkOld = (nodes, trail) => {
    (nodes || []).forEach(node => {
      const nodeId = String(node.id || '');
      const titles = collapseKnowledgePathTitles((trail || []).concat(node.title || ''));
      const key = normalizeBaselinePathKeyFromTitles(titles);
      if (key && !oldPathToNode.has(key)) oldPathToNode.set(key, node);
      oldIdToPath.set(nodeId, key);
      oldNodeById.set(nodeId, node);
      (node.children || []).forEach(child => {
        oldParentById.set(String(child && child.id || ''), nodeId);
      });
      walkOld(node.children || [], titles);
    });
  };
  walkOld(oldTreeRoots, []);

  const baselineTree = buildKnowledgeTreeFromBaselineSnapshot(baselineNodes);
  const baselineNodeById = new Map();
  const baselinePathToNodeId = new Map();
  const baselineRootByTitle = new Map();
  const walkBaseline = (nodes, trail) => {
    (nodes || []).forEach(node => {
      baselineNodeById.set(String(node.id || ''), node);
      const titles = collapseKnowledgePathTitles((trail || []).concat(node.title || ''));
      const key = normalizeBaselinePathKeyFromTitles(titles);
      if (key) baselinePathToNodeId.set(key, String(node.id || ''));
      if (Number(node.level || 0) === 1) baselineRootByTitle.set(normalizeKnowledgeTitle(node.title, ''), String(node.id || ''));
      walkBaseline(node.children || [], titles);
    });
  };
  walkBaseline(baselineTree.roots, []);

  // Keep user-created nodes that are not in baseline, while fixing misplaced L1 aliases.
  const baselineIdSet = new Set((baselineNodes || []).map(node => String(node.id || '')).filter(Boolean));
  const extraNodes = new Map();
  oldNodeById.forEach((node, id) => {
    if (!id || baselineIdSet.has(id)) return;
    extraNodes.set(id, {
      id,
      title: normalizeKnowledgeTitle(node.title, '未分类'),
      level: Number(node.level || 1),
      contentMd: typeof node.contentMd === 'string' ? node.contentMd : '',
      updatedAt: typeof node.updatedAt === 'string' ? node.updatedAt : '',
      isLeaf: true,
      children: []
    });
  });
  extraNodes.forEach((node, id) => {
    const oldParentId = String(oldParentById.get(id) || '');
    if (oldParentId && extraNodes.has(oldParentId)) {
      extraNodes.get(oldParentId).children.push(node);
      return;
    }
    if (oldParentId && baselineNodeById.has(oldParentId)) {
      baselineNodeById.get(oldParentId).children.push(node);
      return;
    }
    const aliasRoot = resolveLegacyKnowledgeRootAlias(node.title);
    const aliasRootNode = aliasRoot ? baselineTree.roots.find(root => normalizeKnowledgeTitle(root.title, '') === aliasRoot) : null;
    if (aliasRootNode) {
      aliasRootNode.children.push(node);
      return;
    }
    const uncategorizedRoot = baselineTree.roots.find(root => normalizeKnowledgeTitle(root.title, '') === '常识判断') || baselineTree.roots[0];
    if (uncategorizedRoot) uncategorizedRoot.children.push(node);
  });

  const syncNotes = (nodes, trail) => {
    (nodes || []).forEach(node => {
      const titles = collapseKnowledgePathTitles((trail || []).concat(node.title || ''));
      const key = normalizeBaselinePathKeyFromTitles(titles);
      const oldNode = oldPathToNode.get(key);
      const oldId = String(oldNode && oldNode.id || '');
      const oldNote = oldId ? (knowledgeNotes[oldId] || null) : null;
      node.contentMd = oldNode && typeof oldNode.contentMd === 'string'
        ? oldNode.contentMd
        : (oldNote && typeof oldNote.content === 'string' ? oldNote.content : '');
      node.updatedAt = oldNode && typeof oldNode.updatedAt === 'string'
        ? oldNode.updatedAt
        : (oldNote && typeof oldNote.updatedAt === 'string' ? oldNote.updatedAt : '');
      syncNotes(node.children || [], titles);
    });
  };
  syncNotes(baselineTree.roots, []);
  knowledgeTree = baselineTree;
  syncKnowledgeNotesFromTree();

  (errors || []).forEach(item => {
    if (!item) return;
    let targetId = '';
    const titles = Array.isArray(item.knowledgePathTitles) ? item.knowledgePathTitles : [];
    if (titles.length) {
      for (let i = titles.length; i >= 1; i -= 1) {
        const key = normalizeBaselinePathKeyFromTitles(titles.slice(0, i));
        if (baselinePathToNodeId.has(key)) {
          targetId = baselinePathToNodeId.get(key);
          break;
        }
      }
    }
    if (!targetId && item.knowledgePath) {
      const key = normalizeBaselinePathKey(item.knowledgePath);
      if (baselinePathToNodeId.has(key)) targetId = baselinePathToNodeId.get(key);
    }
    if (!targetId && item.noteNodeId) {
      const oldKey = oldIdToPath.get(String(item.noteNodeId || '')) || '';
      if (oldKey && baselinePathToNodeId.has(oldKey)) targetId = baselinePathToNodeId.get(oldKey);
    }
    if (!targetId) {
      const rootTitle = normalizeKnowledgeTitle(item.type, '');
      targetId = baselineRootByTitle.get(rootTitle) || '';
    }
    if (!targetId) targetId = baselineTree.roots[0] ? String(baselineTree.roots[0].id || '') : '';
    if (!targetId) return;
    if (typeof rebindErrorToKnowledgeNodeId === 'function') {
      rebindErrorToKnowledgeNodeId(item, targetId);
    } else {
      item.noteNodeId = targetId;
    }
  });

  if (!selectedKnowledgeNodeId || !getKnowledgeNodeById(selectedKnowledgeNodeId)) {
    selectedKnowledgeNodeId = baselineTree.roots[0] ? String(baselineTree.roots[0].id || '') : null;
  }
  if (knowledgeNodeFilter && !getKnowledgeNodeById(knowledgeNodeFilter)) {
    knowledgeNodeFilter = '';
  }
  knowledgeErrorCountCacheVersion += 1;
  return true;
}

window.freezeKnowledgeTreeBaselineToCurrentState = freezeKnowledgeTreeBaselineToCurrentState;
