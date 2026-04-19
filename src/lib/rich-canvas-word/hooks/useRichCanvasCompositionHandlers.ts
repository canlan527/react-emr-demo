import { CompositionEvent, FormEvent, RefObject, useState } from 'react';
import type { RichTextPosition, RichTextSelection } from '../richTypes';

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

  const resetInputValue = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

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
