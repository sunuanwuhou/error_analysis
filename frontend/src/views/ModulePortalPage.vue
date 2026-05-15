<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="module-portal">
    <div class="module-portal-card">
      <div class="module-portal-brand">Ashore</div>
      <h1 class="module-portal-title">选择模块</h1>
      <p class="module-portal-desc">请先选择要进入的模块，再回到对应工作台开始学习。</p>
      <div class="module-portal-actions">
        <RouterLink class="portal-tile portal-tile--xingce" :to="{ name: 'XingceWorkspace' }">
          <span class="portal-tile-label">行测</span>
          <span class="portal-tile-sub">知识树、练习与错题本</span>
        </RouterLink>
        <RouterLink class="portal-tile portal-tile--shenlun" :to="{ name: 'ShenlunHub' }">
          <span class="portal-tile-label">申论</span>
          <span class="portal-tile-sub">知识树选题、笔记与工作台</span>
        </RouterLink>
      </div>
      <p class="module-portal-note">工作台内可随时切换到另一个模块。</p>
    </div>
  </div>
</template>

<style scoped>
.module-portal {
  min-height: 100vh;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f5f7fb 0%, #eef3f9 100%);
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.module-portal-card {
  width: min(440px, 100%);
  padding: 32px 28px 28px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 18px 50px rgb(15 23 42 / 0.12),
    0 0 0 1px rgb(255 255 255 / 0.85) inset;
  text-align: center;
}

.module-portal-brand {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 8px;
}

.module-portal-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.02em;
}

.module-portal-desc {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: #6b7280;
}

.module-portal-actions {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.portal-tile {
  display: block;
  padding: 16px 18px;
  border-radius: 16px;
  text-decoration: none;
  color: #fff;
  text-align: left;
  transition:
    transform 0.14s ease,
    filter 0.14s ease,
    box-shadow 0.14s ease;
  box-sizing: border-box;
}

.portal-tile:hover {
  filter: brightness(1.06);
}

.portal-tile:active {
  transform: scale(0.99);
}

.portal-tile--xingce {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 52%, #1e40af 100%);
  box-shadow: 0 12px 32px rgb(37 99 235 / 0.38);
}

.portal-tile--shenlun {
  background: linear-gradient(135deg, #059669 0%, #047857 52%, #065f46 100%);
  box-shadow: 0 12px 32px rgb(5 150 105 / 0.35);
}

.portal-tile-label {
  display: block;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.portal-tile-sub {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.92;
  line-height: 1.5;
}

.module-portal-note {
  margin: 20px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.55;
}
</style>
