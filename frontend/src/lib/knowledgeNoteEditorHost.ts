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

  w.getKnowledgeNodeById = (id: string) =>
    store.knowledgeNodes.find(n => n.id === id) ?? null

  w.getKnowledgePathTitles = (id: string) => {
    const text = store.getNodePathText(id)
    return text ? text.split(' > ').map(s => s.trim()).filter(Boolean) : []
  }

  w.collapseKnowledgePathTitles = collapsePathTitles

  w.ensureKnowledgeState = () => {}

  w.ensureKnowledgeNoteRecord = () => {}

  w.saveKnowledgeState = () => {
    void store.flushSave()
  }

  w.showToast = (msg: string) => {
    window.alert(msg)
  }

  w.closeEmbeddedKnowledgeNoteEditor = (force?: boolean) => {
    if (closeHandler) return closeHandler(force) !== false
    return true
  }

  w.requestNoteEditorClose = (force?: boolean) => w.closeEmbeddedKnowledgeNoteEditor?.(force)
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
  delete w.closeEmbeddedKnowledgeNoteEditor
  delete w.requestNoteEditorClose
}
