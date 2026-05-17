<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { readPortalLastModule, savePortalLastModule } from '@/lib/portalPrefs'

const router = useRouter()
const route = useRoute()

onBeforeMount(() => {
  const p = route.query.portal
  if (p === '1' || p === 'true') return
  const last = readPortalLastModule()
  if (last === 'xingce') {
    void router.replace({ name: 'XingceWorkspace' })
  } else if (last === 'shenlun') {
    void router.replace({ name: 'ShenlunHub' })
  }
})
</script>

<template>
  <div class="module-portal">
    <div class="module-portal-card">
      <div class="module-portal-brand">Ashore</div>
      <h1 class="module-portal-title">选择模块</h1>
      <p class="module-portal-desc">请先选择要进入的模块，再回到对应工作台开始学习。</p>
      <div class="module-portal-actions">
        <div class="portal-tile portal-tile--xingce">
          <RouterLink
            class="portal-tile-main"
            :to="{ name: 'XingceWorkspace' }"
            @click="savePortalLastModule('xingce')"
          >
            <span class="portal-tile-label">行测</span>
            <span class="portal-tile-sub">知识树、练习与错题本</span>
          </RouterLink>
          <RouterLink
            class="portal-inline-link"
            :to="{ name: 'XingceSuiteBank' }"
            @click="savePortalLastModule('xingce')"
          >套卷题库</RouterLink>
        </div>
        <RouterLink
          class="portal-tile portal-tile--shenlun"
          :to="{ name: 'ShenlunHub' }"
          @click="savePortalLastModule('shenlun')"
        >
          <span class="portal-tile-label">申论</span>
          <span class="portal-tile-sub">知识树选题、笔记与工作台</span>
        </RouterLink>
      </div>
      <p class="module-portal-note">
        会记住上次选择；需要切换模块时请打开选择页（例如 legacy 侧栏「模块首页」，或访问
        <code>/new/?portal=1</code>）。
      </p>
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
  padding: 0;
  border: none;
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

.portal-tile-main {
  display: block;
  padding: 16px 18px 12px;
  color: inherit;
  text-decoration: none;
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
  padding: 16px 18px;
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

.portal-inline-link {
  display: block;
  padding: 12px 18px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 3px;
  border-top: 1px solid rgba(255, 255, 255, 0.25);
}

.module-portal-note {
  margin: 20px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.55;
}
</style>
