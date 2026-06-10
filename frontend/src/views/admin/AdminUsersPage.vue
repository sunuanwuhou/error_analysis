<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { adminApi, type ModuleCatalogItem } from '@/api/admin'
import { DEFAULT_NEW_USER_MODULES, type MeUser, type PortalModuleKey } from '@/lib/modules'

const loading = ref(true)
const savingId = ref('')
const error = ref('')
const users = ref<MeUser[]>([])
const catalog = ref<ModuleCatalogItem[]>([])

const createForm = reactive({
  username: '',
  password: '',
  modules: [...DEFAULT_NEW_USER_MODULES] as PortalModuleKey[],
})

const moduleDrafts = ref<Record<string, PortalModuleKey[]>>({})

const managedUsers = computed(() => users.value.filter((u) => !u.is_super_admin))

function syncDrafts() {
  const next: Record<string, PortalModuleKey[]> = {}
  for (const u of managedUsers.value) {
    next[u.id] = [...(u.modules || [])]
  }
  moduleDrafts.value = next
}

function toggleCreateModule(key: PortalModuleKey) {
  const set = new Set(createForm.modules)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  createForm.modules = [...set]
}

function toggleDraft(userId: string, key: PortalModuleKey) {
  const cur = new Set(moduleDrafts.value[userId] || [])
  if (cur.has(key)) cur.delete(key)
  else cur.add(key)
  moduleDrafts.value[userId] = [...cur]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await adminApi.listUsers()
    users.value = data.users
    catalog.value = data.module_catalog
    syncDrafts()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function createUser() {
  error.value = ''
  const modules = createForm.modules.length ? createForm.modules : [...DEFAULT_NEW_USER_MODULES]
  try {
    await adminApi.createUser({
      username: createForm.username.trim(),
      password: createForm.password,
      modules,
    })
    createForm.username = ''
    createForm.password = ''
    createForm.modules = [...DEFAULT_NEW_USER_MODULES]
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function saveModules(userId: string) {
  savingId.value = userId
  error.value = ''
  try {
    await adminApi.updateUserModules(userId, moduleDrafts.value[userId] || [])
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingId.value = ''
  }
}

async function resetPassword(user: MeUser) {
  const pwd = window.prompt(`为 ${user.username} 设置新密码（至少 6 位）`)
  if (!pwd) return
  error.value = ''
  try {
    await adminApi.resetPassword(user.id, pwd)
    window.alert('密码已更新')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function toggleActive(user: MeUser) {
  error.value = ''
  try {
    await adminApi.setActive(user.id, !user.is_active)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="admin-page">
    <header class="admin-header">
      <RouterLink class="admin-back" to="/">← 模块首页</RouterLink>
      <h1>系统管理</h1>
      <p>分配账号与模块权限（仅超级管理员）</p>
    </header>

    <p v-if="error" class="admin-error">{{ error }}</p>
    <p v-if="loading" class="admin-muted">加载中…</p>

    <section v-if="!loading" class="admin-card">
      <h2>新建账号</h2>
      <p class="admin-muted">默认仅开通「套卷练习」；可按需勾选其他模块。</p>
      <div class="admin-form-row">
        <input v-model="createForm.username" type="text" placeholder="用户名" maxlength="32" />
        <input v-model="createForm.password" type="password" placeholder="密码（≥6位）" />
        <button type="button" class="admin-btn admin-btn--primary" @click="createUser">创建</button>
      </div>
      <div class="admin-module-picks">
        <label v-for="item in catalog" :key="item.key" class="admin-check">
          <input
            type="checkbox"
            :checked="createForm.modules.includes(item.key)"
            @change="toggleCreateModule(item.key)"
          />
          {{ item.label }}
        </label>
      </div>
    </section>

    <section v-if="!loading" class="admin-card">
      <h2>账号与权限</h2>
      <div v-if="!managedUsers.length" class="admin-muted">暂无普通账号</div>
      <article v-for="user in managedUsers" :key="user.id" class="admin-user-row">
        <div class="admin-user-head">
          <strong>{{ user.username }}</strong>
          <span :class="user.is_active ? 'tag tag--ok' : 'tag tag--off'">
            {{ user.is_active ? '启用' : '已禁用' }}
          </span>
          <button type="button" class="admin-btn admin-btn--ghost" @click="resetPassword(user)">重置密码</button>
          <button type="button" class="admin-btn admin-btn--ghost" @click="toggleActive(user)">
            {{ user.is_active ? '禁用' : '启用' }}
          </button>
        </div>
        <div class="admin-module-picks">
          <label v-for="item in catalog" :key="item.key" class="admin-check">
            <input
              type="checkbox"
              :checked="(moduleDrafts[user.id] || []).includes(item.key)"
              @change="toggleDraft(user.id, item.key)"
            />
            {{ item.label }}
          </label>
        </div>
        <button
          type="button"
          class="admin-btn admin-btn--primary"
          :disabled="savingId === user.id"
          @click="saveModules(user.id)"
        >
          {{ savingId === user.id ? '保存中…' : '保存模块权限' }}
        </button>
      </article>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  background: #f3f4f6;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}

.admin-header h1 {
  margin: 8px 0 0;
  font-size: 24px;
}

.admin-header p {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.admin-back {
  color: #2563eb;
  text-decoration: none;
  font-size: 13px;
}

.admin-card {
  margin-top: 18px;
  padding: 18px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.06);
}

.admin-card h2 {
  margin: 0 0 8px;
  font-size: 17px;
}

.admin-muted {
  color: #9ca3af;
  font-size: 13px;
}

.admin-error {
  margin-top: 12px;
  color: #b91c1c;
  font-size: 13px;
}

.admin-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.admin-form-row input {
  flex: 1 1 160px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.admin-module-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin: 12px 0;
}

.admin-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.admin-user-row {
  padding: 14px 0;
  border-top: 1px solid #f3f4f6;
}

.admin-user-row:first-of-type {
  border-top: none;
}

.admin-user-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
}

.tag--ok {
  background: #dcfce7;
  color: #166534;
}

.tag--off {
  background: #fee2e2;
  color: #991b1b;
}

.admin-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}

.admin-btn--primary {
  background: #2563eb;
  color: #fff;
}

.admin-btn--ghost {
  background: #f3f4f6;
  color: #374151;
}

.admin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
