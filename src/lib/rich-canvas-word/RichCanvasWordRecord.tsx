import { forwardRef, useImperativeHandle } from 'react';
import { RichCanvasToolbar } from './components/RichCanvasToolbar';
import { RichCanvasWordSurface } from './components/RichCanvasWordSurface';
import { useRichCanvasWordEditor } from './hooks/useRichCanvasWordEditor';
import type { RichCanvasWordEditorHandle, RichTextDocument, RichTextPosition, RichTextSelection, ToolbarCommand } from './richTypes';
import './styles/RichCanvasWordRecord.scss';

// Rich Canvas Word v1 container.
// The editor state and commands live in useRichCanvasWordEditor; this component only
// assembles the toolbar, heading and canvas surface.
export type RichCanvasWordRecordProps = {
  autoSave?: boolean;
  defaultValue?: RichTextDocument;
  onChange?: (document: RichTextDocument) => void;
  onCursorChange?: (cursor: RichTextPosition | null) => void;
  onSave?: (document: RichTextDocument) => Promise<void> | void;
  onSelectionChange?: (selection: RichTextSelection | null) => void;
  placeholder?: string;
  readonly?: boolean;
  toolbarConfig?: ToolbarCommand[];
  value?: RichTextDocument;
};

export const RichCanvasWordRecord = forwardRef<RichCanvasWordEditorHandle, RichCanvasWordRecordProps>(function RichCanvasWordRecord({
  autoSave = true,
  defaultValue,
  onChange,
  onCursorChange,
  onSave,
  onSelectionChange,
  placeholder,
  readonly = false,
  toolbarConfig,
  value,
}: RichCanvasWordRecordProps, ref) {
  const editor = useRichCanvasWordEditor({
    autoSave,
    defaultValue,
    onChange,
    onCursorChange,
    onSave,
    onSelectionChange,
    readonly,
    toolbarConfig,
    value,
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: editor.focus,
      getCursor: editor.getCursor,
      getDocument: editor.getDocument,
      getSelection: editor.getSelection,
      insertBlocks: editor.insertBlocks,
      insertText: editor.insertText,
      replaceSelection: editor.replaceSelection,
      setDocument: editor.replaceDocument,
    }),
    [editor],
  );

  return (
    <section className={`rich-canvas-word${readonly ? ' is-readonly' : ''}`} aria-label="Rich Canvas Word v1">
      <div className="rich-canvas-heading">
        <div>
          <p className="eyebrow">Rich Canvas Word v1</p>
          <h2>{editor.document.title}</h2>
          <p className="subtitle">{readonly ? '阶段 9：只读预览可导出' : '阶段 9：JSON 与纯文本导出'}</p>
        </div>
        <div className="rich-canvas-heading-status">
          <span>阶段 9</span>
          <span className={editor.saveStatus === '未保存更改' ? 'is-dirty' : ''}>{editor.saveStatus}</span>
        </div>
      </div>
      <div className="rich-canvas-search" role="search" aria-label="富文本查找">
        <label htmlFor="rich-canvas-search-input">查找</label>
        <input
          id="rich-canvas-search-input"
          type="search"
          value={editor.searchQuery}
          onChange={(event) => editor.setSearchQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              editor.jumpToNextSearchMatch();
            }
          }}
          placeholder="输入关键词"
        />
        <label htmlFor="rich-canvas-replace-input">替换为</label>
        <input
          id="rich-canvas-replace-input"
          type="text"
          value={editor.searchReplacement}
          onChange={(event) => editor.setSearchReplacement(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              editor.replaceCurrentSearchMatch();
            }
          }}
          placeholder="替换文本"
          disabled={readonly}
        />
        <span className="rich-canvas-search-count">
          {editor.searchQuery.trim()
            ? editor.searchActiveIndex >= 0
              ? `${editor.searchActiveIndex + 1} / ${editor.searchMatchCount}`
              : `0 / ${editor.searchMatchCount}`
            : '0 / 0'}
        </span>
        <button type="button" className="btn btn-secondary" onClick={editor.jumpToPreviousSearchMatch}>
          上一个
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.jumpToNextSearchMatch}>
          下一个
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.replaceCurrentSearchMatch} disabled={readonly}>
          替换
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.replaceAllSearchMatches} disabled={readonly}>
          全部替换
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.exportJson}>
          导出 JSON
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.exportPlainText}>
          导出 TXT
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.openPrintPreview}>
          打印预览
        </button>
        <button type="button" className="btn btn-secondary" onClick={editor.exportPdf}>
          导出 PDF
        </button>
      </div>
      <RichCanvasToolbar items={editor.toolbarItems} onCommand={editor.handleToolbarCommand} />
      <RichCanvasWordSurface
        cursor={editor.cursor}
        document={editor.document}
        focusRequest={editor.focusRequest}
        placeholder={placeholder}
        selection={editor.selection}
        tableCellSelection={editor.tableCellSelection}
        tableSelection={editor.tableSelection}
        toast={editor.toast}
        readonly={editor.readonly}
        searchActiveIndex={editor.searchActiveIndex}
        searchMatches={editor.searchMatches}
        zoom={editor.zoom}
        onCancelSelection={editor.cancelSelection}
        onCopySelection={editor.copySelection}
        onCursorChange={editor.setCursor}
        onCutSelection={editor.cutSelection}
        onDeleteAfter={editor.deleteAfter}
        onDeleteBefore={editor.deleteBefore}
        onFormatCommand={editor.applyFormatCommand}
        onInsertText={editor.insertText}
        onPasteClipboard={editor.pasteClipboard}
        onRedo={editor.redo}
        onSelectionChange={editor.setSelection}
        onSplitBlock={editor.splitBlock}
        onTableCellSelectionChange={editor.setTableCellSelection}
        onTableSelectionChange={editor.setTableSelection}
        onUndo={editor.undo}
      />
    </section>
  );
});
