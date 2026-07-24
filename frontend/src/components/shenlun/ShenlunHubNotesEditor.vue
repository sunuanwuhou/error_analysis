<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const root = ref<HTMLDivElement>()
const vditorInst = shallowRef<Vditor | null>(null)
/** 程序化 setValue 时抑制 input 回写，避免与 v-model 形成同步死循环 */
let suppressInput = false

function normalizeMd(v: string): string {
  return v.replace(/\r\n/g, '\n')
}

function measureHeight() {
  const reserve = 320
  const h = typeof window !== 'undefined' ? window.innerHeight : 800
  return Math.min(Math.max(h - reserve, 360), 900)
}

function attachVditor(value: string) {
  const h = measureHeight()
  const el = root.value!
  el.innerHTML = ''
  let vd: Vditor
  vd = new Vditor(el, {
    value,
    lang: 'zh_CN',
    placeholder:
      '在此记录该知识点的申论笔记……支持标题、[toc] 目录、表格、LaTeX、代码块；图片可拖拽或点击工具栏上传。',
    height: h,
    minHeight: 360,
    theme: 'classic',
    icon: 'ant',
    mode: 'ir',
    outline: {
      enable: true,
      position: 'right',
    },
    cache: { enable: false },
    toolbarConfig: {
      pin: false,
      hide: false,
    },
    preview: {
      markdown: {
        toc: true,
        gfmAutoLink: true,
        footnotes: true,
      },
      theme: {
        current: 'light',
      },
    },
    toolbar: [
      'emoji',
      'headings',
      'bold',
      'italic',
      'strike',
      'link',
      '|',
      'list',
      'ordered-list',
      'check',
      'outdent',
      'indent',
      '|',
      'quote',
      'line',
      'code',
      'inline-code',
      'insert-before',
      'insert-after',
      '|',
      'upload',
      'table',
      '|',
      'undo',
      'redo',
      '|',
      'outline',
      'fullscreen',
      'edit-mode',
      {
        name: 'more',
        toolbar: [
          'both',
          'code-theme',
          'content-theme',
          'export',
          'preview',
          'devtools',
          'info',
          'help',
        ],
      },
    ],
    upload: {
      max: 5 * 1024 * 1024,
      accept: 'image/png, image/jpeg, image/jpg, image/gif, image/webp, image/svg+xml, image/avif',
      // Vditor 要求 upload.url 非空才会启用上传/触发 handler；真实请求仍由下方 handler 按行测同源逻辑 POST 原始 body 到 /api/images
      url: '/api/images',
      withCredentials: true,
      multiple: true,
      fieldName: 'file',
      async handler(files: File[]): Promise<null> {
        const list = [...files].filter(Boolean)
        for (let i = 0; i < list.length; i++) {
          const file = list[i]
          if (!file) continue
          if (file.size > 5 * 1024 * 1024) {
            vd.tip(`${file.name} 超过 5MB 上限`, 3000)
            continue
          }
          const ctype = file.type?.trim() || 'image/jpeg'
          const buf = await file.arrayBuffer()
          try {
            const res = await fetch('/api/images', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': ctype },
              body: buf,
            })
            if (!res.ok) {
              vd.tip(`图片上传失败：HTTP ${res.status}`, 3800)
              continue
            }
            const js = (await res.json()) as { url?: string }
            const u = typeof js.url === 'string' ? js.url.trim() : ''
            if (!u) {
              vd.tip('服务器未返回图片地址', 3000)
              continue
            }
            const resolved = /^https?:/i.test(u) ? u : new URL(u, window.location.origin).href
            const safeAlt = file.name.replace(/[\[\]\(\)\\]/g, '_')
            vd.insertValue(`![${safeAlt}](${resolved})`)
          } catch (_) {
            vd.tip('图片上传失败（网络或服务异常）', 3800)
          }
        }
        return null
      },
    },
    input(md: string) {
      if (suppressInput) return
      emit('update:modelValue', md)
    },
  })

  vditorInst.value = vd
}

function setEditorValue(next: string) {
  const vd = vditorInst.value
  if (!vd) return
  const cur = normalizeMd(vd.getValue())
  const normalized = normalizeMd(next)
  if (normalized === cur) return
  suppressInput = true
  try {
    vd.setValue(normalized)
  } finally {
    suppressInput = false
  }
}

watch(
  () => props.modelValue,
  (next) => {
    setEditorValue(next)
  },
)

function onResize() {
  const vd = vditorInst.value
  const barEl = vd?.vditor?.toolbar?.element
  const inner = vd?.vditor?.sv?.element
  const el = vd?.vditor?.element
  if (!vd || !el || !inner || !barEl) return
  const nh = measureHeight()
  const barH = barEl.offsetHeight || 42
  el.style.height = `${nh}px`
  inner.style.height = `calc(${nh}px - ${barH}px)`
}

onMounted(async () => {
  await nextTick()
  if (!root.value) return
  attachVditor(props.modelValue)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  const vd = vditorInst.value
  if (vd) {
    vd.destroy()
    vditorInst.value = null
  }
})
</script>

<template>
  <div class="sdn-wrap">
    <div ref="root" class="sdn-vditor" />
  </div>
</template>

<style scoped>
.sdn-wrap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.sdn-vditor {
  width: 100%;
  min-width: 0;
}

.sdn-vditor :deep(.vditor) {
  width: 100% !important;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border-radius: 8px;
  border-color: #e5e7eb;
}

.sdn-vditor :deep(.vditor-toolbar) {
  max-width: 100%;
  flex-wrap: wrap;
}

.sdn-vditor :deep(.vditor-content) {
  min-width: 0;
}

.sdn-vditor :deep(.vditor-outline) {
  flex-shrink: 0;
  width: min(250px, 32vw);
  box-sizing: border-box;
}

.sdn-vditor :deep(.vditor-reset) {
  font-size: 15px;
  line-height: 1.7;
}

/* 宽内容在编辑器内滚动/收缩，避免撑出整页横向滚动 */
.sdn-vditor :deep(.vditor-ir pre.vditor-reset),
.sdn-vditor :deep(.vditor-preview > .vditor-reset) {
  overflow-x: auto;
  max-width: 100%;
  box-sizing: border-box;
}

.sdn-vditor :deep(.vditor-content img:not(.emoji)) {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}

.sdn-vditor :deep(.vditor-content table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  box-sizing: border-box;
}

.sdn-vditor :deep(.vditor-content mjx-container) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.sdn-vditor :deep(.vditor-content pre),
.sdn-vditor :deep(.vditor-content .hljs) {
  max-width: 100%;
  overflow-x: auto;
  box-sizing: border-box;
}

.sdn-vditor :deep(.vditor-content a) {
  overflow-wrap: anywhere;
}
</style>
