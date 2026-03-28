<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ErrorCard from '@/components/errors/ErrorCard.vue'
import type { ErrorEntry } from '@/types/workspace'

const props = defineProps<{
  items: ErrorEntry[]
  title?: string
  bankMode?: boolean
}>()

type GroupLeaf = {
  key: string
  label: string
  items: ErrorEntry[]
}

type GroupNode = {
  key: string
  label: string
  count: number
  directItems: ErrorEntry[]
  children: GroupLeaf[]
}

type TypeGroup = {
  key: string
  label: string
  count: number
  directItems: ErrorEntry[]
  children: GroupNode[]
}

const openTypes = ref<Set<string>>(new Set())
const openSubtypes = ref<Set<string>>(new Set())
const openSubSubtypes = ref<Set<string>>(new Set())

function keyOf(...parts: string[]) {
  return parts.join('::')
}

const groupedItems = computed<TypeGroup[]>(() => {
  const typeMap = new Map<string, Map<string, Map<string, ErrorEntry[]>>>()

  for (const item of props.items) {
    const type = item.type || '未分类'
    const subtype = item.subtype || '未分类'
    const subSubtype = item.subSubtype || ''
    if (!typeMap.has(type)) typeMap.set(type, new Map())
    const subtypeMap = typeMap.get(type)!
    if (!subtypeMap.has(subtype)) subtypeMap.set(subtype, new Map())
    const subSubtypeMap = subtypeMap.get(subtype)!
    if (!subSubtypeMap.has(subSubtype)) subSubtypeMap.set(subSubtype, [])
    subSubtypeMap.get(subSubtype)!.push(item)
  }

  return Array.from(typeMap.entries()).map(([type, subtypeMap]) => {
    const subtypeGroups = Array.from(subtypeMap.entries()).map(([subtype, subSubtypeMap]) => {
      const children = Array.from(subSubtypeMap.entries())
        .filter(([subSubtype]) => Boolean(subSubtype))
        .map(([subSubtype, items]) => ({
          key: keyOf(type, subtype, subSubtype),
          label: subSubtype,
          items,
        }))
      const directItems = subSubtypeMap.get('') || []
      return {
        key: keyOf(type, subtype),
        label: subtype,
        count: Array.from(subSubtypeMap.values()).reduce((sum, entries) => sum + entries.length, 0),
        directItems,
        children,
      }
    })

    const directItems = subtypeGroups.flatMap((group) => group.directItems)

    return {
      key: type,
      label: type,
      count: subtypeGroups.reduce((sum, group) => sum + group.count, 0),
      directItems,
      children: subtypeGroups,
    }
  })
})

watch(
  groupedItems,
  (groups) => {
    const nextTypes = new Set(openTypes.value)
    const nextSubtypes = new Set(openSubtypes.value)
    const nextSubSubtypes = new Set(openSubSubtypes.value)

    groups.forEach((typeGroup) => {
      if (!nextTypes.has(typeGroup.key)) nextTypes.add(typeGroup.key)
      typeGroup.children.forEach((subtypeGroup) => {
        if (!nextSubtypes.has(subtypeGroup.key)) nextSubtypes.add(subtypeGroup.key)
        subtypeGroup.children.forEach((leaf) => {
          if (!nextSubSubtypes.has(leaf.key)) nextSubSubtypes.add(leaf.key)
        })
      })
    })

    openTypes.value = nextTypes
    openSubtypes.value = nextSubtypes
    openSubSubtypes.value = nextSubSubtypes
  },
  { immediate: true },
)

function toggleSet(setRef: typeof openTypes, key: string) {
  const next = new Set(setRef.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  setRef.value = next
}

function toggleType(key: string) {
  toggleSet(openTypes, key)
}

function toggleSubtype(key: string) {
  toggleSet(openSubtypes, key)
}

function toggleSubSubtype(key: string) {
  toggleSet(openSubSubtypes, key)
}

function expandAll() {
  openTypes.value = new Set(groupedItems.value.map((group) => group.key))
  openSubtypes.value = new Set(groupedItems.value.flatMap((group) => group.children.map((child) => child.key)))
  openSubSubtypes.value = new Set(
    groupedItems.value.flatMap((group) => group.children.flatMap((child) => child.children.map((leaf) => leaf.key))),
  )
}

function collapseAll() {
  openTypes.value = new Set()
  openSubtypes.value = new Set()
  openSubSubtypes.value = new Set()
}
</script>

<template>
  <section class="panel error-panel">
    <header class="panel__header">
      <h2>{{ title || '关联错题' }}</h2>
      <div class="error-list__header-actions">
        <button v-if="!bankMode && items.length" class="ghost-button ghost-button--small" type="button" @click="expandAll">展开全部</button>
        <button v-if="!bankMode && items.length" class="ghost-button ghost-button--small" type="button" @click="collapseAll">收起全部</button>
        <span class="panel__count">{{ items.length }}</span>
      </div>
    </header>

    <div v-if="items.length && !bankMode" class="error-list error-list--grouped">
      <section v-for="typeGroup in groupedItems" :key="typeGroup.key" class="error-group">
        <button class="error-group__header" type="button" @click="toggleType(typeGroup.key)">
          <span class="error-group__title">
            <span class="error-group__arrow">{{ openTypes.has(typeGroup.key) ? '▾' : '▸' }}</span>
            {{ typeGroup.label }}
          </span>
          <span class="error-group__count">{{ typeGroup.count }}</span>
        </button>

        <div v-if="openTypes.has(typeGroup.key)" class="error-group__body">
          <section v-for="subtypeGroup in typeGroup.children" :key="subtypeGroup.key" class="error-subgroup">
            <button class="error-subgroup__header" type="button" @click="toggleSubtype(subtypeGroup.key)">
              <span class="error-group__title">
                <span class="error-group__arrow">{{ openSubtypes.has(subtypeGroup.key) ? '▾' : '▸' }}</span>
                {{ subtypeGroup.label }}
              </span>
              <span class="error-group__count">{{ subtypeGroup.count }}</span>
            </button>

            <div v-if="openSubtypes.has(subtypeGroup.key)" class="error-subgroup__body">
              <div v-if="subtypeGroup.directItems.length" class="error-list__cards">
                <ErrorCard v-for="item in subtypeGroup.directItems" :key="item.id" :item="item" />
              </div>

              <section v-for="leaf in subtypeGroup.children" :key="leaf.key" class="error-leafgroup">
                <button class="error-leafgroup__header" type="button" @click="toggleSubSubtype(leaf.key)">
                  <span class="error-group__title">
                    <span class="error-group__arrow">{{ openSubSubtypes.has(leaf.key) ? '▾' : '▸' }}</span>
                    {{ leaf.label }}
                  </span>
                  <span class="error-group__count">{{ leaf.items.length }}</span>
                </button>

                <div v-if="openSubSubtypes.has(leaf.key)" class="error-list__cards">
                  <ErrorCard v-for="item in leaf.items" :key="item.id" :item="item" />
                </div>
              </section>
            </div>
          </section>
        </div>
      </section>
    </div>

    <div v-else-if="items.length" class="error-list">
      <ErrorCard v-for="item in items" :key="item.id" :item="item" :bank-mode="bankMode" />
    </div>

    <div v-else class="panel__empty">
      {{ bankMode ? '当前还没有 Claude 题库内容。' : '当前范围内还没有挂载错题。' }}
    </div>
  </section>
</template>
