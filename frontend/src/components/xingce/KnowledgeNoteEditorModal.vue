<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  installKnowledgeNoteEditorHost,
  uninstallKnowledgeNoteEditorHost,
} from '@/lib/knowledgeNoteEditorHost'

const props = defineProps<{ nodeId: string }>()
const emit = defineEmits<{ close: [] }>()

const frameRef = ref<HTMLIFrameElement | null>(null)
const open = ref(true)

const frameSrc = computed(
  () => `/assets/note_editor.html?nodeId=${encodeURIComponent(props.nodeId)}&embed=1`,
)

function requestClose(force?: boolean): boolean {
  if (!force && frameRef.value?.contentWindow) {
    const w = frameRef.value.contentWindow as Window & {
      requestNoteEditorClose?: (f?: boolean) => boolean
    }
    if (typeof w.requestNoteEditorClose === 'function') {
      if (w.requestNoteEditorClose(false) === false) return false
    }
  }
  open.value = false
  document.body.classList.remove('note-editor-modal-open')
  emit('close')
  return true
}

onMounted(() => {
  installKnowledgeNoteEditorHost(requestClose)
  document.body.classList.add('note-editor-modal-open')
})

onBeforeUnmount(() => {
  uninstallKnowledgeNoteEditorHost()
  document.body.classList.remove('note-editor-modal-open')
})

watch(open, (v) => {
  if (!v) emit('close')
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="note-editor-modal-mask"
      @click.self="requestClose(false)"
    >
      <div class="note-editor-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          class="note-editor-modal-close"
          aria-label="关闭"
          @click="requestClose(false)"
        >
          ×
        </button>
        <iframe
          ref="frameRef"
          class="note-editor-modal-frame"
          :src="frameSrc"
          title="知识笔记编辑器"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.note-editor-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1400;
  padding: 18px;
  background: rgba(0, 0, 0, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.note-editor-modal {
  position: relative;
  width: min(1520px, 96vw);
  height: min(940px, 92vh);
  background: linear-gradient(180deg, #fffaf4 0%, #f8fafc 100%);
  border-radius: 26px;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24);
  padding: 14px;
  overflow: hidden;
  box-sizing: border-box;
}
.note-editor-modal-close {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 2;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}
.note-editor-modal-close:hover {
  background: rgba(15, 23, 42, 0.14);
}
.note-editor-modal-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 20px;
  background: transparent;
}
</style>

<style>
body.note-editor-modal-open {
  overflow: hidden;
}
</style>
