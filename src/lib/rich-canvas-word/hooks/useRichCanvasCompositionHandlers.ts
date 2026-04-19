import { CompositionEvent, FormEvent, RefObject, useState } from 'react';
import type { RichTextPosition, RichTextSelection } from '../richTypes';

// 输入代理 textarea 的 IME/composition 事件处理。
//
// Canvas 不能直接接收中文输入法文本，因此使用一个透明 textarea 作为输入代理。
// compositionText 会交给 renderer 生成预览 document，让拼音候选过程看起来像在正文中输入。

type UseRichCanvasCompositionHandlersOptions = {
  composingRef: RefObject<boolean>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  latestCursorRef: RefObject<RichTextPosition | null>;
  latestSelectionRef: RefObject<RichTextSelection | null>;
  onInsertText: (value: string, cursor: RichTextPosition | null, selection: RichTextSelection | null) => void;
};

export function useRichCanvasCompositionHandlers({
  composingRef,
  inputRef,
  latestCursorRef,
  latestSelectionRef,
  onInsertText,
}: UseRichCanvasCompositionHandlersOptions) {
  const [isComposing, setIsComposing] = useState(false);
  const [compositionText, setCompositionText] = useState('');

  // composition end 后必须清空 textarea，否则后续 input 会重复提交旧文本。
  const resetInputValue = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // 非 IME 普通输入直接提交 textarea 当前 value。
  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) {
      return;
    }

    const value = event.currentTarget.value;
    if (value) {
      onInsertText(value, latestCursorRef.current, latestSelectionRef.current);
      event.currentTarget.value = '';
    }
  };

  // composition 开始后，键盘快捷键应暂停处理，避免拼音输入中 Backspace/Enter 被误当编辑命令。
  const handleCompositionStart = () => {
    composingRef.current = true;
    setIsComposing(true);
    setCompositionText('');
  };

  const handleCompositionUpdate = (event: CompositionEvent<HTMLTextAreaElement>) => {
    setCompositionText(event.data || event.currentTarget.value);
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false;
    setIsComposing(false);
    const value = event.data || event.currentTarget.value;
    if (value) {
      onInsertText(value, latestCursorRef.current, latestSelectionRef.current);
    }
    setCompositionText('');
    resetInputValue();
  };

  return {
    compositionText,
    handleCompositionEnd,
    handleCompositionStart,
    handleCompositionUpdate,
    handleInput,
    isComposing,
  };
}
