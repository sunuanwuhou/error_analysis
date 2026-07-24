function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CODE_PREFIX = '\uE000CODE'
const CODE_SUFFIX = '\uE001'

function protectCodeSegments(raw: string): { text: string; segments: string[] } {
  const segments: string[] = []
  const text = String(raw || '').replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    segments.push(match)
    return `${CODE_PREFIX}${segments.length - 1}${CODE_SUFFIX}`
  })
  return { text, segments }
}

function restoreCodeSegments(text: string, segments: string[]): string {
  if (!segments.length) return text
  return text.replace(new RegExp(`${CODE_PREFIX}(\\d+)${CODE_SUFFIX}`, 'g'), (_, idx) => segments[Number(idx)] ?? '')
}

export function injectMathHtml(raw: string): string {
  const { text: protectedText, segments } = protectCodeSegments(raw)
  let text = protectedText

  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) =>
    `\n<div class="note-math-block">\\[${escapeHtml(String(expr).trim())}\\]</div>\n`,
  )
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) =>
    `\n<div class="note-math-block">\\[${escapeHtml(String(expr).trim())}\\]</div>\n`,
  )
  text = text.replace(/\\\((.+?)\\\)/g, (_, expr) =>
    `<span class="note-math-inline">\\(${escapeHtml(expr)}\\)</span>`,
  )
  text = text.replace(/(?<![\\$])\$([^$\n]+?)\$/g, (_, expr) =>
    `<span class="note-math-inline">\\(${escapeHtml(String(expr).trim())}\\)</span>`,
  )

  return restoreCodeSegments(text, segments)
}

type MathJaxWindow = Window & {
  MathJax?: {
    typesetPromise?: (elements: HTMLElement[]) => Promise<unknown>
    typesetClear?: (elements: HTMLElement[]) => void
  }
}

export function typesetMathInElement(element: HTMLElement | null | undefined): void {
  if (!element) return
  const mathJax = (window as MathJaxWindow).MathJax
  if (!mathJax || typeof mathJax.typesetPromise !== 'function') {
    const retryCount = Number(element.dataset.mathRetryCount || '0')
    if (retryCount < 40) {
      element.dataset.mathRetryCount = String(retryCount + 1)
      window.setTimeout(() => typesetMathInElement(element), 180)
    }
    return
  }
  element.dataset.mathRetryCount = '0'
  if (typeof mathJax.typesetClear === 'function') {
    mathJax.typesetClear([element])
  }
  mathJax.typesetPromise([element]).catch((err) => {
    console.warn('MathJax typeset failed', err)
  })
}
