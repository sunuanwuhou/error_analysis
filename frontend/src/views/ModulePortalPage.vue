<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchMe, hasModule } from '@/api/authMe'
import { readPortalLastModule, savePortalLastModule } from '@/lib/portalPrefs'
import type { MeUser, PortalModuleKey } from '@/lib/modules'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const me = ref<MeUser | null>(null)

function can(key: PortalModuleKey) {
  return hasModule(me.value || undefined, key)
}

async function maybeAutoEnter() {
  const p = route.query.portal
  if (p === '1' || p === 'true') return
  const last = readPortalLastModule()
  if (!last || !can(last)) return
  if (last === 'xingce') {
    window.location.replace('/')
    return
  }
  if (last === 'shenlun') {
    await router.replace({ name: 'ShenlunHub' })
    return
  }
  if (last === 'xingce_suite') {
    await router.replace({ name: 'XingceSuiteBank' })
  } else if (last === 'xingce_bank_drill') {
    await router.replace({ name: 'XingceBankDrill' })
  }
}

onMounted(async () => {
  try {
    const res = await fetchMe()
    if (!res.authenticated || !res.user) {
      window.location.href = '/login.html'
      return
    }
    me.value = res.user
    await maybeAutoEnter()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="module-portal">
    <div class="module-portal-card">
      <div class="module-portal-brand">Ashore</div>
      <h1 class="module-portal-title">选择模块</h1>
      <p v-if="loading" class="module-portal-desc">正在加载权限…</p>
      <p v-else class="module-portal-desc">请先选择要进入的模块，再回到对应工作台开始学习。</p>
      <div v-if="!loading" class="module-portal-actions">
        <a
          v-if="can('xingce')"
          class="portal-tile portal-tile--xingce"
          href="/"
          @click="savePortalLastModule('xingce')"
        >
          <span class="portal-tile-label">行测</span>
          <span class="portal-tile-sub">知识树、练习与错题本（旧版工作台）</span>
        </a>
        <RouterLink
          v-if="can('xingce_suite')"
          class="portal-tile portal-tile--suite"
          :to="{ name: 'XingceSuiteBank' }"
          @click="savePortalLastModule('xingce_suite')"
        >
          <span class="portal-tile-label">套卷练习</span>
          <span class="portal-tile-sub">真题套卷、计时与交卷</span>
        </RouterLink>
        <RouterLink
          v-if="can('xingce_bank_drill')"
          class="portal-tile portal-tile--bank-drill"
          :to="{ name: 'XingceBankDrill' }"
          @click="savePortalLastModule('xingce_bank_drill')"
        >
          <span class="portal-tile-label">套卷模块练</span>
          <span class="portal-tile-sub">广东全库 · 五大模块随机抽题</span>
        </RouterLink>
        <RouterLink
          v-if="can('shenlun')"
          class="portal-tile portal-tile--shenlun"
          :to="{ name: 'ShenlunHub' }"
          @click="savePortalLastModule('shenlun')"
        >
          <span class="portal-tile-label">申论</span>
          <span class="portal-tile-sub">知识树选题、笔记与工作台</span>
        </RouterLink>
        <RouterLink
          v-if="me?.is_super_admin"
          class="portal-tile portal-tile--admin"
          :to="{ name: 'AdminUsers' }"
        >
          <span class="portal-tile-label">系统管理</span>
          <span class="portal-tile-sub">分配账号与模块权限</span>
        </RouterLink>
      </div>
      <p v-if="!loading && me && !me.modules?.length && !me.is_super_admin" class="module-portal-note module-portal-note--warn">
        当前账号尚未分配模块权限，请联系管理员。
      </p>
      <p v-else class="module-portal-note">
        会记住上次选择；需要切换模块时请打开选择页（侧栏「模块首页」，或访问
        <code>/new/?portal=1</code>、<code>/?portal=1</code>）。
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

.portal-tile:hover {
  filter: brightness(1.06);
}

.portal-tile:active {
  transform: scale(0.99);
}

.portal-tile--xingce {
  padding: 16px 18px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 52%, #1e40af 100%);
  box-shadow: 0 12px 32px rgb(37 99 235 / 0.38);
}

.portal-tile--suite {
  padding: 16px 18px;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 52%, #5b21b6 100%);
  box-shadow: 0 12px 32px rgb(124 58 237 / 0.38);
}

.portal-tile--bank-drill {
  padding: 16px 18px;
  background: linear-gradient(135deg, #db2777 0%, #be185d 52%, #9d174d 100%);
  box-shadow: 0 12px 32px rgb(219 39 119 / 0.35);
}

.portal-tile--shenlun {
  padding: 16px 18px;
  background: linear-gradient(135deg, #059669 0%, #047857 52%, #065f46 100%);
  box-shadow: 0 12px 32px rgb(5 150 105 / 0.35);
}

.portal-tile--admin {
  padding: 16px 18px;
  background: linear-gradient(135deg, #d97706 0%, #b45309 52%, #92400e 100%);
  box-shadow: 0 12px 32px rgb(217 119 6 / 0.35);
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

.module-portal-note--warn {
  color: #b45309;
}
</style>
