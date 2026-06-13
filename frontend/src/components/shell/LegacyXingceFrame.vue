<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  active?: boolean
}>()

const frameRef = ref<HTMLIFrameElement | null>(null)
const booting = ref(true)
const loadedOnce = ref(false)

function notifyIframeResize() {
  const win = frameRef.value?.contentWindow
  if (!win) return
  try {
    win.dispatchEvent(new Event('resize'))
  } catch {
    /* ignore */
  }
}

function onLoad() {
  loadedOnce.value = true
  booting.value = false
  if (props.active) {
    void nextTick(() => notifyIframeResize())
  }
}

watch(
  () => props.active,
  active => {
    if (active && loadedOnce.value) {
      void nextTick(() => notifyIframeResize())
    }
  },
)

onMounted(() => {
  if (frameRef.value?.contentWindow?.document?.readyState === 'complete') {
    onLoad()
  }
})
</script>

<template>
  <div class="legacy-xingce-frame">
    <div v-if="booting && !loadedOnce" class="legacy-xingce-frame__loading">
      正在加载旧版行测…
    </div>
    <iframe
      ref="frameRef"
      class="legacy-xingce-frame__iframe"
      title="旧版行测工作台"
      src="/?embed=1"
      @load="onLoad"
    />
  </div>
</template>

<style scoped>
.legacy-xingce-frame {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #f3f4f6;
}

.legacy-xingce-frame__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.legacy-xingce-frame__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
  background: rgb(243 244 246 / 0.92);
  z-index: 1;
  pointer-events: none;
}
</style>
