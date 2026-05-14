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
      url: '',
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
      emit('update:modelValue', md)
    },
  })

  vditorInst.value = vd
}

watch(
  () => props.modelValue,
  (next) => {
    const vd = vditorInst.value
    if (!vd) return
    const cur = vd.getValue()
    if (next === cur) return
    vd.setValue(next)
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
  overflow: visible;
}

.sdn-vditor :deep(.vditor) {
  border-radius: 8px;
  border-color: #e5e7eb;
}

.sdn-vditor :deep(.vditor-reset) {
  font-size: 15px;
  line-height: 1.7;
}
</style>
