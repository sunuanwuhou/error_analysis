<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  getKnowledgeNoteAnchorPrefix,
  renderKnowledgeNotePreview,
} from '@/lib/knowledgeNoteMarkdown'
import { typesetMathInElement } from '@/lib/noteMath'

const props = defineProps<{
  markdown: string
  nodeId?: string
  noteImages?: Record<string, string>
}>()

const rootRef = ref<HTMLElement | null>(null)
const activeAnchorId = ref('')

const preview = computed(() =>
  renderKnowledgeNotePreview(props.markdown, {
    nodeId: props.nodeId,
    noteImages: props.noteImages,
  }),
)

const layoutHtml = computed(() => preview.value.layoutHtml)

function findHeading(anchorId: string): HTMLElement | null {
  const root = rootRef.value
  if (!root || !anchorId) return null
  return root.querySelector<HTMLElement>(`#${CSS.escape(anchorId)}`)
}

function resolveScrollContainer(target: HTMLElement): HTMLElement {
  const root = rootRef.value
  const seen = new Set<HTMLElement>()
  const candidates: HTMLElement[] = []

  for (const el of [
    target.closest('.note-preview-article-scroll'),
    root?.querySelector<HTMLElement>('.note-preview-article-scroll'),
    target.closest('.note-preview-scroll'),
    root?.closest<HTMLElement>('.note-preview-scroll'),
    root?.closest<HTMLElement>('#notesContent'),
    document.getElementById('notesContent'),
  ]) {
    if (!(el instanceof HTMLElement) || seen.has(el)) continue
    seen.add(el)
    candidates.push(el)
  }

  for (const el of candidates) {
    if (el.scrollHeight > el.clientHeight + 4) return el
  }
  return candidates[0] || document.documentElement
}

function scrollToAnchor(anchorId: string) {
  const target = findHeading(anchorId)
  if (!target) return
  const scroller = resolveScrollContainer(target)
  if (scroller === document.documentElement) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12
    scroller.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' })
  }
  activeAnchorId.value = anchorId
  target.style.background = '#fff3cd'
  window.setTimeout(() => {
    target.style.background = ''
  }, 1800)
}

function syncActiveToc() {
  const root = rootRef.value
  if (!root) return
  const headings = Array.from(root.querySelectorAll<HTMLElement>('.note-md-heading[id]'))
  if (!headings.length) return
  const scroller = resolveScrollContainer(headings[0])
  const markerTop = scroller.getBoundingClientRect().top + 24
  const current = headings.reduce<HTMLElement | null>((found, heading) => {
    return heading.getBoundingClientRect().top <= markerTop ? heading : found
  }, headings[0])
  if (current?.id) activeAnchorId.value = current.id
}

function bindTocClicks() {
  const root = rootRef.value
  if (!root || root.dataset.tocBound === '1') return
  root.dataset.tocBound = '1'
  root.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.note-toc-item[data-anchor-id]')
    if (!item) return
    event.preventDefault()
    scrollToAnchor(item.getAttribute('data-anchor-id') || '')
  })
}

function bindHeadingClicks() {
  const root = rootRef.value
  if (!root || root.dataset.headingBound === '1') return
  root.dataset.headingBound = '1'
  root.addEventListener('click', (event) => {
    const heading = (event.target as HTMLElement | null)?.closest<HTMLElement>('.note-md-heading[id]')
    if (!heading?.id) return
    event.preventDefault()
    scrollToAnchor(heading.id)
  })
}

function paintActiveTocItems() {
  const root = rootRef.value
  if (!root) return
  root.querySelectorAll<HTMLElement>('.note-toc-item[data-anchor-id]').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-anchor-id') === activeAnchorId.value)
  })
}

function hydratePreview() {
  const root = rootRef.value
  if (!root) return
  bindTocClicks()
  bindHeadingClicks()
  paintActiveTocItems()
  syncActiveToc()
  paintActiveTocItems()
  requestAnimationFrame(() => {
    typesetMathInElement(root)
  })
}

const scrollListeners = new Map<HTMLElement, () => void>()

function bindScrollListeners() {
  const root = rootRef.value
  if (!root) return

  for (const [el, handler] of scrollListeners) {
    el.removeEventListener('scroll', handler)
  }
  scrollListeners.clear()

  const heading = root.querySelector<HTMLElement>('.note-md-heading[id]')
  const primary = heading ? resolveScrollContainer(heading) : null
  const extras = [
    root.querySelector<HTMLElement>('.note-preview-article-scroll'),
    root.closest<HTMLElement>('.note-preview-scroll'),
    document.getElementById('notesContent'),
  ].filter((el): el is HTMLElement => el instanceof HTMLElement)

  const bound = new Set<HTMLElement>()
  for (const el of [primary, ...extras]) {
    if (!el || bound.has(el)) continue
    bound.add(el)
    const handler = () => {
      syncActiveToc()
      paintActiveTocItems()
    }
    scrollListeners.set(el, handler)
    el.addEventListener('scroll', handler, { passive: true })
  }
}

watch(
  () => [props.markdown, props.nodeId, props.noteImages, layoutHtml.value] as const,
  async () => {
    activeAnchorId.value = ''
    await nextTick()
    hydratePreview()
    bindScrollListeners()
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  for (const [el, handler] of scrollListeners) {
    el.removeEventListener('scroll', handler)
  }
  scrollListeners.clear()
})

defineExpose({ anchorPrefix: computed(() => getKnowledgeNoteAnchorPrefix(props.nodeId || 'default')) })
</script>

<template>
  <div
    ref="rootRef"
    class="knowledge-inline-preview knowledge-note-preview-host"
    v-html="layoutHtml"
  />
</template>
