<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div class="tr-backdrop" @click.self="emit('close')">
      <div class="tr-modal" role="dialog" aria-modal="true" @keydown.escape.prevent="emit('close')">
        <div class="tr-head">
          <h2 class="tr-title">题型与识别规则</h2>
          <button type="button" class="tr-close" title="关闭" @click="emit('close')">×</button>
        </div>
        <div class="tr-body">
          <p class="tr-lead">
            公务员行政职业能力测验（行测）常见五大模块。录入或导入题目时，「题型 / 子类」用于筛选与统计；旧版支持按关键词顺序匹配自动归类，本工作台亦兼容手动维护字段。
          </p>

          <section class="tr-block">
            <h3>言语理解与表达</h3>
            <p>逻辑填空、片段阅读、语句表达等。关注上下文逻辑与词语搭配。</p>
          </section>
          <section class="tr-block">
            <h3>数量关系</h3>
            <p>数学运算、数字推理（若考纲含）。侧重建模与速算策略。</p>
          </section>
          <section class="tr-block">
            <h3>判断推理</h3>
            <p>图形推理、定义判断、类比推理、逻辑判断。强调规则提取与命题结构。</p>
          </section>
          <section class="tr-block">
            <h3>资料分析</h3>
            <p>表格与文字材料中的增长率、比重、平均数等；精读题干与单位。</p>
          </section>
          <section class="tr-block">
            <h3>常识判断</h3>
            <p>政治、法律、人文、科技等广泛常识，侧重排除法与知识储备。</p>
          </section>

          <p class="tr-note">
            旧版「题型自动识别规则」弹窗按顺序匹配自定义规则；当前 Vue 端以错题条目上的 <strong>type / subtype</strong> 字段为准，可在卡片或导入数据中维护。若需完整可编辑规则表，可在后续版本对接专用配置接口。
          </p>
        </div>
        <div class="tr-foot">
          <button type="button" class="tr-btn primary" @click="emit('close')">知道了</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.tr-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 16px;
}
.tr-modal {
  width: min(560px, 96vw);
  max-height: 88vh;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.tr-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}
.tr-close {
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: #64748b;
}
.tr-body {
  overflow-y: auto;
  padding: 14px 16px 8px;
  font-size: 13px;
  line-height: 1.55;
  color: #334155;
}
.tr-lead {
  margin: 0 0 12px;
  color: #475569;
  font-size: 13px;
}
.tr-block {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.tr-block h3 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}
.tr-block p {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}
.tr-note {
  margin: 12px 0 0;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.45;
}
.tr-foot {
  padding: 10px 16px 14px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
}
.tr-btn {
  border: 1px solid #d9dee5;
  background: #fff;
  color: #475569;
  border-radius: 8px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}
.tr-btn.primary {
  background: #4a6cf7;
  border-color: #4a6cf7;
  color: #fff;
}
</style>
