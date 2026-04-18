/**
 * Clipboard API 封装。
 *
 * 职责：
 * - 读写系统剪贴板文本。
 * - 在权限受限、嵌入式浏览器或非安全上下文失败时保持无副作用。
 *
 * 不直接负责：
 * - 更新编辑器文本。
 * - 展示 toast。
 */
export async function writeClipboardText(value: string) {
  if (!value) {
    return;
  }

  try {
    await navigator.clipboard?.writeText(value);
  } catch {
    // Clipboard permissions can be denied by the embedded browser; keep editor state unchanged.
  }
}

export async function readClipboardText() {
  try {
    return (await navigator.clipboard?.readText?.()) ?? '';
  } catch {
    return '';
  }
}
