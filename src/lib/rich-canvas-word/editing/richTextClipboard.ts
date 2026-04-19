import type { RichTextAlign, RichTextBlock, RichTextClipboardSlice, RichTextMarks, RichTextRun } from '../richTypes';
import { richTextSliceToPlainText } from './richTextEditing';

// 富文本系统剪贴板工具。
//
// 内部复制粘贴使用 RichTextClipboardSlice 保留结构；写入系统剪贴板时，
// 同时提供 text/plain 和 text/html，让外部富文本编辑器尽量保留基础样式。

// 手写 HTML 序列化时必须转义用户文本，避免复制出的 HTML 破坏结构或引入脚本片段。
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function alignToCss(align: RichTextAlign) {
  return align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
}

// 将 run marks 映射成内联 CSS。系统剪贴板中的 text/html 需要自包含样式。
function marksToCss(marks: RichTextMarks) {
  const styles: string[] = [];

  if (marks.bold) {
    styles.push('font-weight: 700');
  }

  if (marks.underline) {
    styles.push('text-decoration: underline');
  }

  if (marks.color) {
    styles.push(`color: ${marks.color}`);
  }

  if (marks.backgroundColor) {
    styles.push(`background-color: ${marks.backgroundColor}`);
  }

  if (marks.fontSize) {
    styles.push(`font-size: ${marks.fontSize}px`);
  }

  if (marks.fontFamily) {
    styles.push(`font-family: ${marks.fontFamily}`);
  }

  return styles.join('; ');
}

// 把内部 slice 序列化成简化 HTML。
// 外层 data-rich-canvas-word 标记用于调试和未来识别本编辑器来源。
export function serializeRichTextSliceToHtml(slice: RichTextClipboardSlice | null) {
  if (!slice) {
    return '';
  }

  const blocks = slice.blocks
    .map((block) => {
      const tag = block.type === 'heading' ? 'h1' : 'p';
      const blockStyle = `text-align: ${alignToCss(block.align)}; margin: 0 0 8px 0`;
      const runs = block.runs
        .map((run) => {
          const text = escapeHtml(run.text).replace(/\n/g, '<br>');
          const style = marksToCss(run.marks);
          return style ? `<span style="${style}">${text}</span>` : `<span>${text}</span>`;
        })
        .join('');

      return `<${tag} style="${blockStyle}">${runs || '<br>'}</${tag}>`;
    })
    .join('');

  return `<div data-rich-canvas-word="true">${blocks}</div>`;
}

// 写入系统剪贴板时优先使用 ClipboardItem 同时写 text/html 和 text/plain。
// 浏览器不支持时降级为纯文本，保证复制至少可用。
export async function writeRichTextClipboard(slice: RichTextClipboardSlice | null, plainText?: string) {
  const text = plainText ?? richTextSliceToPlainText(slice);
  if (!text) {
    return;
  }

  const html = serializeRichTextSliceToHtml(slice);
  const clipboardItem = typeof ClipboardItem === 'undefined' || !html
    ? null
    : new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });

  if (clipboardItem && navigator.clipboard.write) {
    await navigator.clipboard.write([clipboardItem]);
    return;
  }

  await navigator.clipboard.writeText(text);
}

let parsedBlockId = 0;
let parsedRunId = 0;

function createParsedBlockId() {
  parsedBlockId += 1;
  return `clipboard-block-${parsedBlockId}`;
}

function createParsedRunId() {
  parsedRunId += 1;
  return `clipboard-run-${parsedRunId}`;
}

function readCssColor(value: string) {
  return value.trim() || undefined;
}

function readFontSize(value: string) {
  const match = value.match(/([\d.]+)px/);
  return match ? Number(match[1]) : undefined;
}

function readAlign(value: string): RichTextAlign {
  return value === 'center' || value === 'right' ? value : 'left';
}

// HTML 粘贴解析采用“继承 marks”模型：父节点样式向子节点传递，子节点样式覆盖或补充。
function mergeMarks(parentMarks: RichTextMarks, element: Element): RichTextMarks {
  const next: RichTextMarks = { ...parentMarks };
  const tagName = element.tagName.toLowerCase();
  const style = element instanceof HTMLElement ? element.style : null;

  if (tagName === 'strong' || tagName === 'b') {
    next.bold = true;
  }

  if (tagName === 'u') {
    next.underline = true;
  }

  if (style) {
    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) {
      next.bold = true;
    }

    if (style.textDecoration.includes('underline') || style.textDecorationLine.includes('underline')) {
      next.underline = true;
    }

    if (style.color) {
      next.color = readCssColor(style.color);
    }

    if (style.backgroundColor) {
      next.backgroundColor = readCssColor(style.backgroundColor);
    }

    if (style.fontSize) {
      next.fontSize = readFontSize(style.fontSize);
    }

    if (style.fontFamily) {
      next.fontFamily = style.fontFamily;
    }
  }

  return next;
}

// 深度遍历 DOM，把文本节点收集为 run；br 映射为换行 run。
function collectRuns(node: Node, marks: RichTextMarks, runs: RichTextRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) {
      runs.push({
        id: createParsedRunId(),
        text,
        marks,
      });
    }
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  if (node.tagName.toLowerCase() === 'br') {
    runs.push({ id: createParsedRunId(), text: '\n', marks });
    return;
  }

  const nextMarks = mergeMarks(marks, node);
  node.childNodes.forEach((child) => collectRuns(child, nextMarks, runs));
}

// 将外部 HTML 的块级元素转换成内部 block。无法提取有效文本时丢弃。
function elementToBlock(element: Element): RichTextBlock | null {
  const tagName = element.tagName.toLowerCase();
  const isHeading = /^h[1-6]$/.test(tagName);
  const style = element instanceof HTMLElement ? element.style : null;
  const runs: RichTextRun[] = [];

  collectRuns(element, isHeading ? { bold: true, fontSize: 26 } : {}, runs);

  const text = runs.map((run) => run.text).join('');
  if (!text.trim()) {
    return null;
  }

  return {
    id: createParsedBlockId(),
    type: isHeading ? 'heading' : 'paragraph',
    align: readAlign(style?.textAlign ?? ''),
    runs,
  };
}

// 将系统剪贴板 HTML 转换成内部富文本 slice。
// 只解析基础块元素和常用内联样式，复杂 Word/网页 HTML 会被降级为可编辑的简单结构。
export function parseHtmlToRichTextSlice(html: string): RichTextClipboardSlice | null {
  if (!html.trim()) {
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blockElements = Array.from(doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div,li'));
  const sourceElements = blockElements.length > 0 ? blockElements : Array.from(doc.body.children);
  const blocks = sourceElements
    .map((element) => elementToBlock(element))
    .filter((block): block is RichTextBlock => Boolean(block));

  return blocks.length > 0 ? { blocks } : null;
}

// 读取系统剪贴板中的 text/html。权限或浏览器能力不足时静默返回空串，调用方再走纯文本粘贴。
export async function readClipboardHtml() {
  if (!navigator.clipboard.read) {
    return '';
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (!item.types.includes('text/html')) {
        continue;
      }

      const blob = await item.getType('text/html');
      return await blob.text();
    }
  } catch {
    return '';
  }

  return '';
}
