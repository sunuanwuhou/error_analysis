<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MeUser } from '@/lib/modules'
import { savePortalLastModule } from '@/lib/portalPrefs'
import {
  getVisibleShellTabs,
  shellTabForRouteName,
  type ShellTabDef,
} from '@/lib/shellTabs'

const props = defineProps<{
  user: MeUser | null
}>()

const route = useRoute()
const router = useRouter()

const tabs = computed(() => getVisibleShellTabs(props.user || undefined))
const activeTabId = computed(() => shellTabForRouteName(String(route.name || '')))

function isActive(tab: ShellTabDef) {
  return activeTabId.value === tab.id
}

function selectTab(tab: ShellTabDef) {
  if (tab.portalChoice !== 'admin') {
    savePortalLastModule(tab.portalChoice)
  }
  void router.push({ name: tab.routeName })
}

function openPortal() {
  void router.push({ name: 'ModulePortal' })
}
</script>

<template>
  <header class="module-tab-bar">
    <div class="module-tab-bar__brand" @click="openPortal">
      <span class="module-tab-bar__logo">Ashore</span>
    </div>
    <nav class="module-tab-bar__nav" aria-label="模块切换">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="module-tab-bar__tab"
        :class="{ 'is-active': isActive(tab) }"
        :aria-current="isActive(tab) ? 'page' : undefined"
        @click="selectTab(tab)"
      >
        <span class="module-tab-bar__tab-label">{{ tab.shortLabel }}</span>
      </button>
    </nav>
    <div class="module-tab-bar__meta">
      <span v-if="user" class="module-tab-bar__user">{{ user.username }}</span>
    </div>
  </header>
</template>

<style scoped>
.module-tab-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0 12px 0 14px;
  border-bottom: 1px solid #e5e7eb;
  background: rgb(255 255 255 / 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 rgb(15 23 42 / 0.04);
  flex-shrink: 0;
  z-index: 40;
}

.module-tab-bar__brand {
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.module-tab-bar__logo {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #64748b;
}

.module-tab-bar__nav {
  display: flex;
  align-items: stretch;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.module-tab-bar__nav::-webkit-scrollbar {
  display: none;
}

.module-tab-bar__tab {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: #6b7280;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 14px 10px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.module-tab-bar__tab:hover {
  color: #111827;
  background: #f9fafb;
}

.module-tab-bar__tab.is-active {
  color: #1d4ed8;
  border-bottom-color: #2563eb;
}

.module-tab-bar__meta {
  flex-shrink: 0;
  padding-left: 4px;
}

.module-tab-bar__user {
  font-size: 12px;
  color: #9ca3af;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .module-tab-bar {
    gap: 8px;
    padding-inline: 8px;
  }

  .module-tab-bar__tab {
    padding-inline: 10px;
    font-size: 12px;
  }

  .module-tab-bar__user {
    display: none;
  }
}
</style>
