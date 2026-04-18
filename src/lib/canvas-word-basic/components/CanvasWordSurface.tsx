/**
 * Canvas Word 的展示型 Surface。
 *
 * 职责：
 * - 渲染编辑器外壳、toast、隐藏 textarea、ruler、scroller、canvas 和右键菜单。
 * - 把外部传入的 refs 与事件处理函数绑定到对应 DOM。
 *
 * 不直接负责：
 * - 修改编辑器状态。
 * - 计算鼠标命中位置。
 * - 处理键盘、IME、鼠标选区的业务逻辑。
 */
import type { CompositionEvent, FormEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';
import { CanvasWordContextMenu } from './CanvasWordContextMenu';
import type { ContextMenuState } from '../wordTypes';

type CanvasWordSurfaceProps = {
  editorRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  toast: string;
  contextMenu: ContextMenuState | null;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onEditorClick: () => void;
  onCompositionStart: () => void;
  onCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => void;
  onInput: (event: FormEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onCanvasContextMenu: (event: MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseDown: (event: MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseLeave: () => void;
  onCanvasMouseMove: (event: MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
};

export function CanvasWordSurface({
  editorRef,
  inputRef,
  scrollerRef,
  canvasRef,
  toast,
  contextMenu,
  canUndo,
  canRedo,
  hasSelection,
  onEditorClick,
  onCompositionStart,
  onCompositionEnd,
  onInput,
  onKeyDown,
  onCanvasContextMenu,
  onCanvasMouseDown,
  onCanvasMouseLeave,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onDelete,
}: CanvasWordSurfaceProps) {
  return (
    <div className="emr-editor" ref={editorRef} onClick={onEditorClick}>
      {toast ? <div className="emr-toast">{toast}</div> : null}
      <textarea
        ref={inputRef}
        className="emr-ime-input"
        aria-label="电子病历输入代理"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onCompositionEnd={onCompositionEnd}
        onCompositionStart={onCompositionStart}
        onInput={onInput}
        onKeyDown={onKeyDown}
      />
      <div className="emr-ruler">A4 基础版，点击文档定位光标，支持中文输入法、方向键和 Backspace。</div>
      <div className="emr-scroller" ref={scrollerRef}>
        <canvas
          ref={canvasRef}
          onContextMenu={onCanvasContextMenu}
          onMouseDown={onCanvasMouseDown}
          onMouseLeave={onCanvasMouseLeave}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          aria-label="电子病历画布编辑器"
        />
      </div>
      {contextMenu ? (
        <CanvasWordContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={hasSelection}
          onUndo={onUndo}
          onRedo={onRedo}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}
