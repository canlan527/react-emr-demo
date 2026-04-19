import { Dispatch, SetStateAction, useMemo } from 'react';
import {
  applyRichTextAlignToSelection,
  applyRichTextMarksToSelection,
  clearCurrentRichTextFormatting,
  getRichTextAlignAtPosition,
  getRichTextMarksAtPosition,
  normalizeRichTextSelection,
} from '../editing/richTextEditing';
import { richFontSizeOptions, richHighlightColorOptions, richTextColorOptions } from '../toolbar/formatOptions';
import { richToolbarItems } from '../toolbar/toolbarConfig';
import type {
  RichTextAlign,
  RichTextDocument,
  RichTextFormatCommand,
  RichTextMarks,
  RichTextPosition,
  RichTextSelection,
} from '../richTypes';

function getNextOptionValue<T>(options: Array<{ value: T | undefined }>, currentValue: T | undefined) {
  const currentIndex = options.findIndex((item) => item.value === currentValue);
  return options[(currentIndex + 1) % options.length]?.value;
}

function getNextFontSize(currentFontSize: number | undefined) {
  const currentIndex = richFontSizeOptions.findIndex((item) => item === currentFontSize);
  return richFontSizeOptions[(currentIndex + 1) % richFontSizeOptions.length] ?? 16;
}

type UseRichCanvasFormatCommandsOptions = {
  activeMarks: RichTextMarks;
  canRedo: boolean;
  canUndo: boolean;
  commitEdit: (nextDocument: RichTextDocument, nextCursor: RichTextPosition | null, nextSelection?: RichTextSelection | null) => void;
  cursor: RichTextPosition | null;
  document: RichTextDocument;
  selection: RichTextSelection | null;
  setActiveMarks: Dispatch<SetStateAction<RichTextMarks>>;
  setToast: Dispatch<SetStateAction<string>>;
  zoom: number;
};

export function useRichCanvasFormatCommands({
  activeMarks,
  canRedo,
  canUndo,
  commitEdit,
  cursor,
  document,
  selection,
  setActiveMarks,
  setToast,
  zoom,
}: UseRichCanvasFormatCommandsOptions) {
  const selectionRange = useMemo(() => normalizeRichTextSelection(document, selection), [document, selection]);
  const currentPosition = selectionRange?.start ?? cursor;
  const currentMarks = useMemo(
    () => (selectionRange ? getRichTextMarksAtPosition(document, currentPosition) : { ...getRichTextMarksAtPosition(document, cursor), ...activeMarks }),
    [activeMarks, cursor, currentPosition, document, selectionRange],
  );
  const currentAlign = useMemo(() => getRichTextAlignAtPosition(document, currentPosition), [currentPosition, document]);

  const hasActiveMark = (command: RichTextFormatCommand) => {
    if (command === 'bold') {
      return Boolean(currentMarks.bold);
    }

    if (command === 'underline') {
      return Boolean(currentMarks.underline);
    }

    if (command === 'fontSize') {
      return Boolean(currentMarks.fontSize);
    }

    if (command === 'textColor') {
      return Boolean(currentMarks.color);
    }

    if (command === 'backgroundColor') {
      return Boolean(currentMarks.backgroundColor);
    }

    return false;
  };

  const toolbarItems = useMemo(
    () =>
      richToolbarItems.map((item) => {
        if (item.type === 'separator') {
          return item;
        }

        const active =
          item.command === 'bold' ||
          item.command === 'underline' ||
          item.command === 'fontSize' ||
          item.command === 'textColor' ||
          item.command === 'backgroundColor'
            ? hasActiveMark(item.command)
            : item.command === 'alignLeft'
              ? currentAlign === 'left'
              : item.command === 'alignCenter'
                ? currentAlign === 'center'
                : item.command === 'alignRight'
                  ? currentAlign === 'right'
                  : item.command === 'zoom'
                    ? true
                    : false;

        return {
          ...item,
          label:
            item.command === 'zoom'
              ? `${Math.round(zoom * 100)}%`
              : item.command === 'fontSize'
                ? `${currentMarks.fontSize ?? 16}`
                : item.label,
          color: item.command === 'textColor' ? currentMarks.color : item.command === 'backgroundColor' ? currentMarks.backgroundColor : undefined,
          active,
          disabled:
            (item.command === 'undo' && !canUndo) ||
            (item.command === 'redo' && !canRedo),
        };
      }),
    [canRedo, canUndo, currentAlign, currentMarks, zoom],
  );

  const updateActiveMark = (command: RichTextFormatCommand) => {
    setActiveMarks((current) => {
      const next = { ...current };

      if (command === 'clearFormat') {
        return {};
      }

      if (command === 'bold') {
        next.bold = !hasActiveMark('bold');
      }

      if (command === 'underline') {
        next.underline = !hasActiveMark('underline');
      }

      if (command === 'fontSize') {
        next.fontSize = getNextFontSize(currentMarks.fontSize ?? 16);
      }

      if (command === 'textColor') {
        next.color = getNextOptionValue(richTextColorOptions, currentMarks.color);
      }

      if (command === 'backgroundColor') {
        next.backgroundColor = getNextOptionValue(richHighlightColorOptions, currentMarks.backgroundColor);
      }

      return next;
    });
  };

  const getFormatUpdater = (command: RichTextFormatCommand) => (marks: RichTextMarks): RichTextMarks => {
    if (command === 'clearFormat') {
      return {};
    }

    if (command === 'bold') {
      return { ...marks, bold: !hasActiveMark('bold') };
    }

    if (command === 'underline') {
      return { ...marks, underline: !hasActiveMark('underline') };
    }

    if (command === 'fontSize') {
      return { ...marks, fontSize: getNextFontSize(currentMarks.fontSize ?? marks.fontSize ?? 16) };
    }

    if (command === 'textColor') {
      return { ...marks, color: getNextOptionValue(richTextColorOptions, currentMarks.color ?? marks.color) };
    }

    return { ...marks, backgroundColor: getNextOptionValue(richHighlightColorOptions, currentMarks.backgroundColor ?? marks.backgroundColor) };
  };

  const getFormatToast = (command: RichTextFormatCommand, hasSelection: boolean) => {
    const target = hasSelection ? '选区' : '后续输入';
    if (command === 'bold') {
      return hasActiveMark('bold') ? `已取消${target}加粗` : `已启用${target}加粗`;
    }

    if (command === 'underline') {
      return hasActiveMark('underline') ? `已取消${target}下划线` : `已启用${target}下划线`;
    }

    if (command === 'fontSize') {
      return `已切换${target}字号`;
    }

    if (command === 'textColor') {
      return `已切换${target}文字颜色`;
    }

    if (command === 'backgroundColor') {
      return `已切换${target}高亮`;
    }

    return `已清除${target}格式`;
  };

  const applyFormatCommand = (command: RichTextFormatCommand) => {
    if (!selection) {
      if (command === 'clearFormat') {
        const result = clearCurrentRichTextFormatting(document, cursor);
        if (result) {
          setActiveMarks({});
          commitEdit(result.document, result.cursor);
          setToast('已恢复当前空段落为默认纯文本');
          return;
        }
      }

      const message = getFormatToast(command, false);
      updateActiveMark(command);
      setToast(message);
      return;
    }

    const result = applyRichTextMarksToSelection(document, selection, getFormatUpdater(command));
    if (!result) {
      return;
    }

    commitEdit(result.document, result.cursor, result.selection);
    setToast(getFormatToast(command, true));
  };

  const applyAlignCommand = (align: RichTextAlign) => {
    const nextDocument = applyRichTextAlignToSelection(document, selection, cursor, align);
    commitEdit(nextDocument, cursor, selection);
    setToast(`已${align === 'left' ? '左' : align === 'center' ? '居中' : '右'}对齐段落`);
  };

  return {
    applyAlignCommand,
    applyFormatCommand,
    toolbarItems,
  };
}
