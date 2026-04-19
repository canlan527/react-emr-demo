import { RichCanvasToolbar } from './components/RichCanvasToolbar';
import { RichCanvasWordSurface } from './components/RichCanvasWordSurface';
import { useRichCanvasWordEditor } from './hooks/useRichCanvasWordEditor';

// Rich Canvas Word v1 container.
// The editor state and commands live in useRichCanvasWordEditor; this component only
// assembles the toolbar, heading and canvas surface.
export function RichCanvasWordRecord() {
  const editor = useRichCanvasWordEditor();

  return (
    <section className="rich-canvas-word" aria-label="Rich Canvas Word v1">
      <div className="rich-canvas-heading">
        <div>
          <p className="eyebrow">Rich Canvas Word v1</p>
          <h2>{editor.document.title}</h2>
          <p className="subtitle">阶段 6.3：未保存状态和最近保存时间</p>
        </div>
        <div className="rich-canvas-heading-status">
          <span>阶段 6.3</span>
          <span className={editor.saveStatus === '未保存更改' ? 'is-dirty' : ''}>{editor.saveStatus}</span>
        </div>
      </div>
      <RichCanvasToolbar items={editor.toolbarItems} onCommand={editor.handleToolbarCommand} />
      <RichCanvasWordSurface
        cursor={editor.cursor}
        document={editor.document}
        focusRequest={editor.focusRequest}
        selection={editor.selection}
        toast={editor.toast}
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
        onUndo={editor.undo}
      />
    </section>
  );
}
