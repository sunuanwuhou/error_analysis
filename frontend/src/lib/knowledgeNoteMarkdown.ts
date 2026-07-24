import { marked } from 'marked'
import { injectMathHtml } from '@/lib/noteMath'

export type MdHeading = {
  level: number
  text: string
  headingIndex: number
}

export function makeStableDomId(prefix: string, seed: string): string {
  const text = String(seed || '')
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  }
  return `${prefix}-${Math.abs(hash)}`
}

export function getKnowledgeNoteAnchorPrefix(nodeId: string): string {
  return makeStableDomId('knowledge-note', nodeId || 'default')
}

export function getNoteHeadingAnchorId(anchorPrefix: string, headingIndex: number): string {
  return `${anchorPrefix}-h-${headingIndex}`
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseLooseNoteHeading(line: string): { level: number; text: string } | null {
  const raw = String(line || '').trim()
  if (!raw) return null
  const markdownMatch = raw.match(/^(#{1,4})(?:\s+)?(.+?)\s*$/)
  if (!markdownMatch) return null
  return { level: markdownMatch[1].length, text: markdownMatch[2].trim() }
}

export function extractMdHeadings(content: string): MdHeading[] {
  const headings: MdHeading[] = []
  const lines = String(content || '').replace(/\r/g, '').split('\n')
  let headingIndex = 0
  for (const line of lines) {
    const parsed = parseLooseNoteHeading(line)
    if (!parsed) continue
    headings.push({ level: parsed.level, text: parsed.text, headingIndex })
    headingIndex += 1
  }
  return headings
}

function lookupNoteImage(noteImagesMap: Record<string, string>, id: string): string {
  const key = String(id || '').trim()
  if (!key) return ''
  return noteImagesMap[key] || ''
}

export function resolveNoteImagesInMarkdown(
  md: string,
  noteImagesMap: Record<string, string>,
): string {
  let text = String(md || '')
  text = text.replace(/!\[([^\]]*)\]\(noteimg:([a-z0-9-]+)\)/gi, (_, alt, id) => {
    const src = lookupNoteImage(noteImagesMap, id)
    return src ? `![${alt}](${src})` : `![${alt}](noteimg:${id})`
  })
  text = text.replace(/\(noteimg:([a-z0-9-]+)\)/gi, (_, id) => {
    const src = lookupNoteImage(noteImagesMap, id)
    return src ? `(${src})` : `(noteimg:${id})`
  })
  text = text.replace(/(?<![(\[])\bnoteimg:([a-z0-9-]+)\b/gi, (_, id) => {
    const src = lookupNoteImage(noteImagesMap, id)
    return src || `noteimg:${id}`
  })
  return text
}

function normalizeBareImageLines(text: string, noteImagesMap: Record<string, string>): string {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      const noteImgOnly = trimmed.match(/^noteimg:([a-z0-9-]+)$/i)
      if (noteImgOnly) {
        const src = lookupNoteImage(noteImagesMap, noteImgOnly[1])
        return src ? `![图片](${src})` : line
      }
      const parenNoteImg = trimmed.match(/^\(noteimg:([a-z0-9-]+)\)$/i)
      if (parenNoteImg) {
        const src = lookupNoteImage(noteImagesMap, parenNoteImg[1])
        return src ? `![图片](${src})` : line
      }
      const wecom = trimmed.match(/^~?(wecom-temp-[a-z0-9-]+)(?:\.(jpg|jpeg|png|gif|webp))?$/i)
      if (wecom) {
        const id = wecom[1]
        const src =
          lookupNoteImage(noteImagesMap, id)
          || lookupNoteImage(noteImagesMap, trimmed.replace(/^~/, ''))
          || lookupNoteImage(noteImagesMap, trimmed)
        return src ? `![图片](${src})` : line
      }
      return line
    })
    .join('\n')
}

export function normalizeNoteMarkdownForRender(
  md: string,
  noteImagesMap: Record<string, string>,
): string {
  const resolved = resolveNoteImagesInMarkdown(md, noteImagesMap)
  return normalizeBareImageLines(resolved, noteImagesMap)
}

function decorateArticleHtml(
  html: string,
  anchorPrefix: string,
  noteImagesMap: Record<string, string>,
): string {
  let headingIndex = 0
  let out = html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_, depth, attrs, inner) => {
    const anchorId = getNoteHeadingAnchorId(anchorPrefix, headingIndex)
    headingIndex += 1
    const cleanAttrs = String(attrs || '').replace(/\sid="[^"]*"/gi, '')
    return (
      `<h${depth}${cleanAttrs} id="${anchorId}" class="note-md-heading" data-heading-index="${headingIndex - 1}">` +
      `<a class="note-md-anchor" href="javascript:void(0)" title="跳转到标题">#</a>${inner}</h${depth}>`
    )
  })

  out = out.replace(/<img([^>]*?)src="noteimg:([^"]+)"([^>]*)>/gi, (_, pre, id, post) => {
    const src = lookupNoteImage(noteImagesMap, id)
    if (!src) return `<p class="note-img-missing">${escapeHtml(`noteimg:${id}`)}</p>`
    return (
      `<img${pre}src="${escapeHtml(src)}"${post} class="cuoti-img" ` +
      `onclick="this.classList.toggle('expanded')" title="点击放大/缩小">`
    )
  })

  out = out.replace(/<img\b(?![^>]*\bclass=)/gi, (tag) => {
    return tag.replace('<img', '<img class="cuoti-img" onclick="this.classList.toggle(\'expanded\')" title="点击放大/缩小"')
  })

  return out
}

export function renderKnowledgeNoteArticleHtml(
  raw: string,
  opts: { nodeId?: string; noteImages?: Record<string, string> } = {},
): string {
  const markdown = normalizeNoteMarkdownForRender(raw, opts.noteImages || {})
  if (!markdown.trim()) return ''
  const anchorPrefix = getKnowledgeNoteAnchorPrefix(opts.nodeId || 'default')
  const html = marked.parse(injectMathHtml(markdown), { gfm: true, breaks: true }) as string
  return decorateArticleHtml(html, anchorPrefix, opts.noteImages || {})
}

export function renderNoteTocHtml(headings: MdHeading[], anchorPrefix: string): string {
  if (!anchorPrefix) return ''
  if (!headings.length) {
    return (
      '<div class="note-toc note-toc-floating">' +
      '<div class="note-toc-title"><span>本页笔记目录</span><span>0</span></div>' +
      '<div class="note-toc-list"><div class="note-toc-item">还没有 Markdown 标题，使用 # 概括 或 ## 方法</div></div>' +
      '</div>'
    )
  }
  const items = headings
    .map((item) => {
      const anchorId = getNoteHeadingAnchorId(anchorPrefix, item.headingIndex)
      const level = Math.min(item.level, 4)
      return (
        `<div class="note-toc-item lv${level}" data-anchor-id="${anchorId}">` +
        `${escapeHtml(item.text)}</div>`
      )
    })
    .join('')
  return (
    '<div class="note-toc note-toc-floating">' +
    `<div class="note-toc-title"><span>本页笔记目录</span><span>${headings.length}</span></div>` +
    `<div class="note-toc-list">${items}</div>` +
    '</div>'
  )
}

export function renderNotePreviewLayout(articleHtml: string, tocHtml: string): string {
  const article =
    `<div class="note-preview-article-scroll">` +
    `<article class="note-preview-article np-md">${articleHtml || ''}</article>` +
    `</div>`
  if (!tocHtml) {
    return `<div class="note-preview-layout note-preview-layout-no-toc">${article}</div>`
  }
  return (
    `<div class="note-preview-layout">` +
    `<aside class="note-preview-toc">${tocHtml}</aside>` +
    `${article}` +
    `</div>`
  )
}

export function renderKnowledgeNotePreview(
  raw: string,
  opts: { nodeId?: string; noteImages?: Record<string, string> } = {},
): {
  articleHtml: string
  tocHtml: string
  layoutHtml: string
  headings: MdHeading[]
} {
  const markdown = normalizeNoteMarkdownForRender(raw, opts.noteImages || {})
  const headings = extractMdHeadings(markdown)
  const anchorPrefix = getKnowledgeNoteAnchorPrefix(opts.nodeId || 'default')
  const articleHtml = renderKnowledgeNoteArticleHtml(markdown, opts)
  const tocHtml = renderNoteTocHtml(headings, anchorPrefix)
  const layoutHtml = renderNotePreviewLayout(articleHtml, tocHtml)
  return { articleHtml, tocHtml, layoutHtml, headings }
}
