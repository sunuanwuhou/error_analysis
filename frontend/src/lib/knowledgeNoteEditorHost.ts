import type { KnowledgeNode } from '@/api/xingce'
import { useXingceStore } from '@/stores/xingceStore'

type HostWindow = Window & {
  getKnowledgeNodeById?: (id: string) => KnowledgeNode | null
  getKnowledgePathTitles?: (id: string) => string[]
  collapseKnowledgePathTitles?: (titles: string[]) => string[]
  ensureKnowledgeState?: () => void
  ensureKnowledgeNoteRecord?: (node: KnowledgeNode) => void
  saveKnowledgeState?: () => void
  showToast?: (msg: string, tone?: string) => void
  closeEmbeddedKnowledgeNoteEditor?: (force?: boolean) => boolean
  requestNoteEditorClose?: (force?: boolean) => boolean
  noteImgId?: () => string
  setNoteImageRef?: (id: string, value: string) => string
  getNoteImageRef?: (id: string) => string
  resolveNoteImgs?: (text: string) => string
}

function noteImgId(): string {
  return `ni${Math.random().toString(36).slice(2, 8)}`
}

let closeHandler: ((force?: boolean) => boolean) | null = null

function collapsePathTitles(titles: string[]): string[] {
  const out: string[] = []
  for (const t of titles) {
    const s = String(t || '').trim()
    if (!s) continue
    if (out.length && out[out.length - 1] === s) continue
    out.push(s)
  }
  return out
}

export function installKnowledgeNoteEditorHost(onRequestClose?: (force?: boolean) => boolean) {
  const store = useXingceStore()
  const w = window as HostWindow
  closeHandler = onRequestClose ?? null

  w.getKnowledgeNodeById = (id: string) => {
    const n = store.knowledgeNodes.find(item => item.id === id) ?? null
    if (!n) return null
    return { ...n }
  }

  w.getKnowledgePathTitles = (id: string) => {
    const text = store.getNodePathText(id)
    return text ? text.split(' > ').map(s => s.trim()).filter(Boolean) : []
  }

  w.collapseKnowledgePathTitles = collapsePathTitles

  w.ensureKnowledgeState = () => {}

  w.ensureKnowledgeNoteRecord = (node: KnowledgeNode) => {
    if (!node?.id) return
    const md = String(node.contentMd ?? '')
    store.updateKnowledgeNode(node.id, {
      contentMd: md,
      updatedAt: node.updatedAt || new Date().toISOString(),
    })
  }

  w.saveKnowledgeState = () => {
    void store.flushSave()
  }

  w.showToast = (msg: string) => {
    window.alert(msg)
  }

  w.noteImgId = noteImgId

  w.setNoteImageRef = (id: string, value: string) => {
    const key = String(id || '').trim()
    if (!key) return ''
    store.noteImages[key] = value || ''
    void store.flushSave()
    return store.noteImages[key]
  }

  w.getNoteImageRef = (id: string) => {
    const key = String(id || '').trim()
    return key ? (store.noteImages[key] || '') : ''
  }

  w.resolveNoteImgs = (text: string) => {
    return String(text || '').replace(/noteimg:([a-z0-9-]+)/gi, (_, id) => store.noteImages[id] || '')
  }

  w.closeEmbeddedKnowledgeNoteEditor = (force?: boolean) => {
    if (closeHandler) return closeHandler(force) !== false
    return true
  }

  w.requestNoteEditorClose = (force?: boolean) => w.closeEmbeddedKnowledgeNoteEditor?.(force) ?? true
}

export function uninstallKnowledgeNoteEditorHost() {
  closeHandler = null
  const w = window as HostWindow
  delete w.getKnowledgeNodeById
  delete w.getKnowledgePathTitles
  delete w.collapseKnowledgePathTitles
  delete w.ensureKnowledgeState
  delete w.ensureKnowledgeNoteRecord
  delete w.saveKnowledgeState
  delete w.showToast
  delete w.noteImgId
  delete w.setNoteImageRef
  delete w.getNoteImageRef
  delete w.resolveNoteImgs
  delete w.closeEmbeddedKnowledgeNoteEditor
  delete w.requestNoteEditorClose
}
