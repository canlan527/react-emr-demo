/**
 * Canvas Word 的 IME 输入代理 hook。
 *
 * 职责：
 * - 管理隐藏 textarea 的屏幕位置，让输入法候选框跟随 Canvas 光标。
 * - 管理 composition 状态，避免提交中文输入法中间态。
 * - 处理 textarea input/composition 事件，并把最终文本提交给编辑器命令层。
 *
 * 不直接负责：
 * - Canvas 绘制。
 * - 键盘快捷键分发。
 * - 文本编辑历史栈。
 */
import { useRef, useState } from 'react';
import { canvasWordLayout } from '../../medical-record/medicalRecordDocument';
import { findCursorLine, measureLinePrefix, visualOffsetForSourceCursor } from '../layout/canvasTextLayout';
import type { CompositionEvent, FormEvent, RefObject } from 'react';
import type { LayoutLine } from '../layout/canvasTextLayout';

type UseImeAnchorOptions = {
  editorRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  layout: { lines: LayoutLine[] };
  cursor: number;
  commitInput: (value: string) => void;
  resetInputValue: () => void;
};

export function useImeAnchor({ editorRef, canvasRef, inputRef, layout, cursor, commitInput, resetInputValue }: UseImeAnchorOptions) {
  // 中文输入法 composition 期间不要把中间态文本提交进编辑器。
  const composingRef = useRef(false);
  // React state 只用于切换 textarea 的可见样式，让用户能看到拼音预编辑串。
  const [isComposingActive, setIsComposingActive] = useState(false);

  // The hidden textarea is only an IME anchor; Canvas remains the visual source of truth.
  const syncInputPosition = (nextLayout = layout, nextCursor = cursor) => {
    const editor = editorRef.current;
    const canvas = canvasRef.current;
    const input = inputRef.current;
    const context = canvas?.getContext('2d');
    const cursorLine = findCursorLine(nextLayout.lines, nextCursor);

    if (!editor || !canvas || !input || !context || !cursorLine) {
      return;
    }

    const cursorOffset = visualOffsetForSourceCursor(cursorLine, nextCursor);
    const canvasRect = canvas.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const cursorX = cursorLine.x + measureLinePrefix(context, cursorLine, cursorOffset);
    const cursorY = cursorLine.y - canvasWordLayout.lineHeight + 7;

    input.style.left = `${canvasRect.left - editorRect.left + cursorX}px`;
    input.style.top = `${canvasRect.top - editorRect.top + cursorY}px`;
  };

  const focusInput = () => {
    // 所有点击 Canvas 的交互最终都要重新聚焦隐藏 textarea，键盘和 IME 才能继续输入。
    syncInputPosition();
    inputRef.current?.focus({ preventScroll: true });
  };

  // 普通键盘输入会出现在隐藏 textarea 中；读取后立即提交到 Canvas 文本模型。
  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) {
      return;
    }

    const value = event.currentTarget.value;
    commitInput(value);
    event.currentTarget.value = '';
  };

  // 中文输入法开始组合时，暂停普通 input 提交，等待 compositionEnd 一次性提交最终文本。
  const handleCompositionStart = () => {
    composingRef.current = true;
    setIsComposingActive(true);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false;
    setIsComposingActive(false);
    commitInput(event.data || event.currentTarget.value);
    resetInputValue();
  };

  return {
    focusInput,
    handleCompositionEnd,
    handleCompositionStart,
    handleInput,
    isComposing: () => composingRef.current,
    isComposingActive,
    syncInputPosition,
  };
}
