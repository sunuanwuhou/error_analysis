/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
const props = defineProps();
const emit = defineEmits();
const root = ref();
const vditorInst = shallowRef(null);
function measureHeight() {
    const reserve = 320;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return Math.min(Math.max(h - reserve, 360), 900);
}
function attachVditor(value) {
    const h = measureHeight();
    const el = root.value;
    el.innerHTML = '';
    let vd;
    vd = new Vditor(el, {
        value,
        lang: 'zh_CN',
        placeholder: '在此记录该知识点的申论笔记……支持标题、[toc] 目录、表格、LaTeX、代码块；图片可拖拽或点击工具栏上传。',
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
            async handler(files) {
                const list = [...files].filter(Boolean);
                for (let i = 0; i < list.length; i++) {
                    const file = list[i];
                    if (!file)
                        continue;
                    if (file.size > 5 * 1024 * 1024) {
                        vd.tip(`${file.name} 超过 5MB 上限`, 3000);
                        continue;
                    }
                    const ctype = file.type?.trim() || 'image/jpeg';
                    const buf = await file.arrayBuffer();
                    try {
                        const res = await fetch('/api/images', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': ctype },
                            body: buf,
                        });
                        if (!res.ok) {
                            vd.tip(`图片上传失败：HTTP ${res.status}`, 3800);
                            continue;
                        }
                        const js = (await res.json());
                        const u = typeof js.url === 'string' ? js.url.trim() : '';
                        if (!u) {
                            vd.tip('服务器未返回图片地址', 3000);
                            continue;
                        }
                        const resolved = /^https?:/i.test(u) ? u : new URL(u, window.location.origin).href;
                        const safeAlt = file.name.replace(/[\[\]\(\)\\]/g, '_');
                        vd.insertValue(`![${safeAlt}](${resolved})`);
                    }
                    catch (_) {
                        vd.tip('图片上传失败（网络或服务异常）', 3800);
                    }
                }
                return null;
            },
        },
        input(md) {
            emit('update:modelValue', md);
        },
    });
    vditorInst.value = vd;
}
watch(() => props.modelValue, (next) => {
    const vd = vditorInst.value;
    if (!vd)
        return;
    const cur = vd.getValue();
    if (next === cur)
        return;
    vd.setValue(next);
});
function onResize() {
    const vd = vditorInst.value;
    const barEl = vd?.vditor?.toolbar?.element;
    const inner = vd?.vditor?.sv?.element;
    const el = vd?.vditor?.element;
    if (!vd || !el || !inner || !barEl)
        return;
    const nh = measureHeight();
    const barH = barEl.offsetHeight || 42;
    el.style.height = `${nh}px`;
    inner.style.height = `calc(${nh}px - ${barH}px)`;
}
onMounted(async () => {
    await nextTick();
    if (!root.value)
        return;
    attachVditor(props.modelValue);
    window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    const vd = vditorInst.value;
    if (vd) {
        vd.destroy();
        vditorInst.value = null;
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-reset']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-reset']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-content']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-content']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-content']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-content']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-content']} */ ;
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
/** @type {__VLS_StyleScopedClasses['vditor-content']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sdn-wrap" },
});
/** @type {__VLS_StyleScopedClasses['sdn-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "root",
    ...{ class: "sdn-vditor" },
});
/** @type {__VLS_StyleScopedClasses['sdn-vditor']} */ ;
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
