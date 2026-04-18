/**
 * Canvas Word 的右键菜单组件。
 *
 * 职责：
 * - 渲染撤销、重做、复制、剪切、粘贴、删除菜单项。
 * - 根据外部传入的 canUndo/canRedo/hasSelection 控制按钮可用状态。
 *
 * 不直接负责：
 * - 判断当前是否有选区。
 * - 操作编辑器状态、剪贴板或历史栈。
 */
type CanvasWordContextMenuProps = {
  x: number;
  y: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
};

export function CanvasWordContextMenu({
  x,
  y,
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onCopy,
  onCut,
  onPaste,
  onDelete,
}: CanvasWordContextMenuProps) {
  return (
    <div className="emr-context-menu" style={{ left: x, top: y }} onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        撤销 <span>Ctrl/Cmd+Z</span>
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>
        重做 <span>Ctrl/Cmd+Shift+Z</span>
      </button>
      <button type="button" onClick={onCopy} disabled={!hasSelection}>
        复制 <span>Ctrl/Cmd+C</span>
      </button>
      <button type="button" onClick={onCut} disabled={!hasSelection}>
        剪切 <span>Ctrl/Cmd+X</span>
      </button>
      <button type="button" onClick={onPaste}>
        粘贴 <span>Ctrl/Cmd+V</span>
      </button>
      <button type="button" onClick={onDelete} disabled={!hasSelection}>
        删除 <span>Del/Backspace</span>
      </button>
    </div>
  );
}
