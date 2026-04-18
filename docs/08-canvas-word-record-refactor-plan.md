# CanvasWordRecord 拆分计划

## 目标

`CanvasWordRecord.tsx` 是 v0 Canvas Word 的主组件，目前同时承担编辑状态、Canvas 绘制、输入代理、键盘事件、鼠标选区、右键菜单、剪贴板、撤销重做和页面组装等职责。

本文档记录后续拆分计划，目标是在不改变 v0 行为的前提下，让主组件逐步变薄，为 v1 `rich-canvas-word` 做准备。

核心原则：

- 小步拆分，每一步都保持页面可运行。
- 优先拆类型、纯函数和独立 JSX。
- 暂不引入状态管理库，先用模块拆分和自定义 hook 降复杂度。
- 每一步完成后都要跑构建，并尽量手动回归编辑器基础交互。

## 为什么暂不引入状态管理库

当前复杂度主要来自编辑器内部行为，而不是跨页面共享状态。

例如：

- Canvas 命中测试。
- 隐藏 textarea 输入代理。
- 中文 IME。
- 鼠标拖拽选区。
- 剪贴板权限。
- 撤销重做历史。
- Canvas 重绘。

状态管理库可以改变 state 存放位置，但不能自动简化这些编辑器行为。过早引入 Zustand、Jotai 或 Redux 可能增加依赖和理解成本。

当前阶段优先采用：

- 文件拆分。
- 纯函数提取。
- 独立组件提取。
- 自定义 hook。

等编辑器状态边界稳定后，再评估是否需要状态管理库。

## 当前职责

`CanvasWordRecord.tsx` 当前负责：

- 创建病历文档。
- 将病历文档转换为纯文本。
- 管理 `text`。
- 管理 `cursor`。
- 管理 `layout`。
- 管理 `selection`。
- 管理 `contextMenu`。
- 管理 `toast`。
- 管理撤销/重做历史栈。
- 同步隐藏 textarea 位置。
- 将鼠标坐标转换为文档光标位置。
- 绘制 Canvas 页面、文字、选区和光标。
- 处理滚动和 resize。
- 处理键盘快捷键。
- 处理 Backspace/Delete/Enter/方向键。
- 处理中文输入法 composition。
- 处理鼠标拖拽选区。
- 处理右键菜单。
- 处理复制、剪切、粘贴。
- 重新加载病历文档。
- 渲染编辑器标题栏、Canvas、textarea、右键菜单和 toast。

## 目标结构

阶段完成后的目标结构：

```txt
src/lib/canvas-word-basic/
  CanvasWordRecord.tsx
  wordTypes.ts
  components/
    CanvasWordContextMenu.tsx
    CanvasWordSurface.tsx
  hooks/
    useCanvasWordEditor.ts
    useCanvasWordKeyboard.ts
    useCanvasWordMouseSelection.ts
    useImeAnchor.ts
  layout/
    canvasTextLayout.ts
    canvasWordRenderer.ts
  editing/
    textEditing.ts
    textSelection.ts
    wordClipboard.ts
    wordHistory.ts
```

职责说明：

- `CanvasWordRecord.tsx`
  - v0 基础版容器。
  - 负责组装病历文档、header 和 `CanvasWordSurface`。
  - 持有 DOM refs、layout、右键菜单位置和加载时间等容器级状态。
  - 协调 renderer、editor hook、keyboard hook、mouse selection hook 和 IME hook。
- `components/CanvasWordContextMenu.tsx`
  - 右键菜单 JSX。
  - 只接收状态和回调，不直接操作编辑器状态。
- `components/CanvasWordSurface.tsx`
  - 展示型 Surface。
  - 渲染编辑器外壳、toast、隐藏 textarea、ruler、scroller、canvas 和右键菜单。
  - 把外部传入的 refs 与事件处理函数绑定到对应 DOM。
- `layout/canvasTextLayout.ts`
  - 纯文本排版模块。
  - 负责自动换行、分页、行坐标、标题字体、字间距和避头标点。
  - 提供光标索引、视觉 offset 和 Canvas x 坐标之间的转换工具。
- `layout/canvasWordRenderer.ts`
  - Canvas 页面、选区、文字、光标绘制。
  - 返回最新 layout。
- `editing/textEditing.ts`
  - 纯文本插入、删除、范围删除、范围替换工具函数。
  - 保持无副作用。
- `editing/textSelection.ts`
  - 选区归一化。
  - 根据 layout 视觉行生成 Canvas 选区高亮矩形。
- `hooks/useCanvasWordEditor.ts`
  - 管理文本、光标、选区、历史、toast 和编辑命令。
  - 提供插入、删除、全选、复制、剪切、粘贴、撤销、重做、重置文档等命令。
- `hooks/useCanvasWordKeyboard.ts`
  - 处理快捷键和编辑键。
  - 在 IME composition 期间跳过普通按键处理。
  - 通过回调调用外部编辑命令，不直接修改编辑器状态。
- `hooks/useCanvasWordMouseSelection.ts`
  - 处理 canvas mouse down/move/up 和 context menu。
  - 管理拖拽选区状态。
  - 调用外部 hit test，把鼠标位置转换为 cursor/selection 更新。
- `hooks/useImeAnchor.ts`
  - 管理隐藏 textarea 的屏幕位置。
  - 管理 composition 状态。
  - 处理 textarea input/composition 事件。
- `editing/wordClipboard.ts`
  - Clipboard API 读写封装。
  - 权限失败时保持无副作用。
- `editing/wordHistory.ts`
  - 撤销/重做历史纯函数。
- `wordTypes.ts`
  - 公共类型。

## 当前拆分结果

截至当前版本，`canvas-word-basic` 已经拆成以下文件：

```txt
src/lib/canvas-word-basic/
  CanvasWordRecord.tsx
  wordTypes.ts
  components/
    CanvasWordContextMenu.tsx
    CanvasWordSurface.tsx
  hooks/
    useCanvasWordEditor.ts
    useCanvasWordKeyboard.ts
    useCanvasWordMouseSelection.ts
    useImeAnchor.ts
  layout/
    canvasTextLayout.ts
    canvasWordRenderer.ts
  editing/
    textEditing.ts
    textSelection.ts
    wordClipboard.ts
    wordHistory.ts
```

当前职责边界：

- 容器层：`CanvasWordRecord.tsx`
- 展示层：`components/CanvasWordSurface.tsx`、`components/CanvasWordContextMenu.tsx`
- 绘制层：`layout/canvasWordRenderer.ts`
- 排版层：`layout/canvasTextLayout.ts`
- 编辑命令层：`hooks/useCanvasWordEditor.ts`、`editing/textEditing.ts`
- 事件协调层：`hooks/useCanvasWordKeyboard.ts`、`hooks/useCanvasWordMouseSelection.ts`、`hooks/useImeAnchor.ts`
- 状态辅助层：`editing/wordHistory.ts`、`editing/wordClipboard.ts`、`wordTypes.ts`

## 拆分阶段

### 阶段 1：抽出 wordTypes.ts

目标：

- 从 `CanvasWordRecord.tsx` 中移出通用类型。

候选类型：

```ts
type CanvasWordRecordProps = {
  patient: PatientInfo;
};

type ContextMenuState = {
  x: number;
  y: number;
};

type CursorHitMode = 'caret' | 'selection';

type HistoryState = {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
};

type HistorySnapshot = {
  text: string;
  cursor: number;
};
```

注意事项：

- `CanvasWordRecordProps` 如果只在主组件使用，也可以暂时留在主组件。
- 优先抽 `ContextMenuState`、`CursorHitMode`、`HistoryState`、`HistorySnapshot`。

验收：

- 类型引用清晰。
- `pnpm run build` 通过。
- 页面行为不变。

### 阶段 2：抽出 components/CanvasWordContextMenu.tsx

目标：

- 把右键菜单 JSX 从主组件中移出。
- 降低 `CanvasWordRecord.tsx` 的 JSX 噪音。

建议 props：

```ts
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
```

主组件中使用：

```tsx
{contextMenu ? (
  <CanvasWordContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    canUndo={history.past.length > 0}
    canRedo={history.future.length > 0}
    hasSelection={Boolean(normalizeSelection(selection))}
    onUndo={undoFromMenu}
    onRedo={redoFromMenu}
    onCopy={copySelection}
    onCut={cutSelection}
    onPaste={pasteClipboard}
    onDelete={deleteSelectionFromMenu}
  />
) : null}
```

注意事项：

- `CanvasWordContextMenu` 不应 import 编辑器状态。
- `CanvasWordContextMenu` 不应调用 `normalizeSelection()`。
- `onClick={(event) => event.stopPropagation()}` 应保留在菜单组件内部。

验收：

- 右键菜单仍显示在鼠标位置。
- 撤销、重做、复制、剪切、粘贴、删除按钮状态和行为不变。
- `pnpm run build` 通过。

### 阶段 3：抽出 editing/wordClipboard.ts

目标：

- 把 Clipboard API 读写封装从主组件中移出。

候选函数：

```ts
export async function writeClipboardText(value: string): Promise<void>;
export async function readClipboardText(): Promise<string>;
```

注意事项：

- 写入空字符串时可以直接返回。
- Clipboard API 失败时不要抛出错误。
- 读取失败时返回空字符串。

验收：

- 复制、剪切、粘贴行为不变。
- 剪贴板权限失败时编辑器不崩溃。
- `pnpm run build` 通过。

### 阶段 4：抽出 editing/wordHistory.ts

目标：

- 把撤销/重做历史的纯数据变换沉淀出来。

候选函数：

```ts
export function pushHistorySnapshot(
  history: HistoryState,
  snapshot: HistorySnapshot,
  maxSize: number,
): HistoryState;

export function createUndoHistory(
  history: HistoryState,
  current: HistorySnapshot,
  maxSize: number,
): { history: HistoryState; snapshot: HistorySnapshot | null };

export function createRedoHistory(
  history: HistoryState,
  current: HistorySnapshot,
  maxSize: number,
): { history: HistoryState; snapshot: HistorySnapshot | null };
```

注意事项：

- React `setState` 可以暂时继续留在主组件。
- 先抽纯函数，不急着抽 hook。
- 保持 `maxHistorySize` 规则不变。

验收：

- 输入后撤销可恢复旧文本。
- 撤销后重做可恢复新文本。
- 新输入后 redo 栈清空。
- `pnpm run build` 通过。

### 阶段 5：抽出 layout/canvasWordRenderer.ts

目标：

- 把 Canvas 绘制逻辑从 React effect 中移出。
- 让主组件只负责调用 renderer 和同步 layout。

候选接口：

```ts
type RenderCanvasWordInput = {
  canvas: HTMLCanvasElement | null;
  text: string;
  cursor: number;
  selection: TextSelection | null;
};

type RenderCanvasWordResult = {
  layout: TextLayoutResult;
};

export function renderCanvasWord(input: RenderCanvasWordInput): RenderCanvasWordResult | null;
```

renderer 负责：

- 获取 2D context。
- 计算 DPR。
- 调用 `layoutCanvasText()`。
- 设置 Canvas bitmap backing store。
- 绘制编辑器背景。
- 绘制页面白纸、阴影、页码。
- 绘制选区矩形。
- 绘制文本。
- 绘制光标。

主组件保留：

- `setLayout(result.layout)`。
- `syncInputPosition(result.layout, cursor)`。

注意事项：

- renderer 不应直接操作 React state。
- renderer 不应读取组件 refs。
- renderer 不应处理事件。

验收：

- Canvas 绘制结果不变。
- 光标位置不变。
- 选区高亮不变。
- 页面分页和页码不变。
- `pnpm run build` 通过。

### 阶段 6：抽出 hooks/useCanvasWordEditor.ts

目标：

- 把文本、光标、选区、历史、toast 和编辑命令收敛到自定义 hook。

候选状态：

- `text`
- `cursor`
- `selection`
- `toast`
- `history`

候选命令：

- `commitTextChange`
- `replaceSelectionOrInsert`
- `deleteSelection`
- `selectAllText`
- `undo`
- `redo`
- `copySelection`
- `cutSelection`
- `pasteClipboard`
- `resetInputValue` 是否保留在主组件需再评估。

注意事项：

- 这一步风险比前面更高，不应过早做。
- 先完成类型、菜单、剪贴板、历史、renderer 后再做。
- hook 不应直接依赖 Canvas DOM。
- hook 可以依赖纯文本 layout 结果，但要谨慎。

验收：

- 主组件明显变薄。
- 输入、删除、选区、撤销重做、复制粘贴行为不变。
- `pnpm run build` 通过。

### 阶段 7：评估 components/CanvasWordSurface.tsx

目标：

- 评估是否把 canvas、textarea 和事件绑定抽成 `components/CanvasWordSurface.tsx`。
- 第一版建议只抽展示型 Surface，负责 JSX 外壳，不接管事件逻辑。

它可能负责：

- 渲染隐藏 textarea。
- 渲染 ruler。
- 渲染 scroller。
- 渲染 canvas。
- 绑定输入法事件。
- 绑定键盘事件。
- 绑定鼠标事件。

注意事项：

- 这部分和 refs、IME、selection、scroll 交织紧密。
- 不建议第一时间把事件逻辑也拆进去。
- 如果前面阶段已经让主组件足够清晰，可以暂缓。
- 如果执行拆分，优先让主组件继续创建 refs 和 handlers，再把它们作为 props 传给 `CanvasWordSurface`。

验收：

- 中文输入法候选框仍跟随光标。
- 鼠标选区仍正常。
- 滚动后输入代理位置仍正常。
- 右键菜单不受影响。
- `pnpm run build` 通过。

### 后续候选：继续拆事件 hooks

如果 `components/CanvasWordSurface.tsx` 抽出后，主组件仍然承担过多事件协调逻辑，可以继续评估：

```txt
hooks/useCanvasWordKeyboard.ts
hooks/useCanvasWordMouseSelection.ts
hooks/useImeAnchor.ts
```

候选职责：

- `hooks/useCanvasWordKeyboard.ts`
  - 处理快捷键。
  - 处理 Backspace/Delete/Enter。
  - 处理方向键。
  - 调用编辑器命令，但不直接绘制 Canvas。
- `hooks/useCanvasWordMouseSelection.ts`
  - 处理鼠标按下、拖动、松开。
  - 管理拖拽选区状态。
  - 依赖 hit test 结果更新 cursor 和 selection。
- `hooks/useImeAnchor.ts`
  - 管理隐藏 textarea 的位置同步。
  - 处理 composition 状态。
  - 让中文输入法候选框跟随 Canvas 光标。

这些 hook 不应急着做。建议先完成展示型 `components/CanvasWordSurface.tsx`，确认 refs、IME 和鼠标选区仍稳定，再继续评估。

## 重构后问题记录

以下问题是在 v0 拆分和目录重组后，通过页面回归暴露出来的。它们都属于编辑器基础体验问题，后续继续拆分或升级 v1 时应作为重点回归项。

### 1. IME 拼音预编辑串不可见、字号异常或覆盖正文

现象：

- 中文输入法候选框能显示，也能跟随 Canvas 光标。
- 但输入过程中的拼音预编辑串不可见。
- 修复为可见后，曾出现拼音串字号明显大于当前正文行的问题。
- 在富文本 v1 回归中进一步发现，如果直接显示 textarea 的 composition 文本，拼音串会覆盖后面的 Canvas 正文，而不是像普通输入框一样把后续文字临时推开。

原因：

- `textarea` 作为 IME 输入代理时，原本被设置为完全透明、文字透明且宽度很窄。
- 这种写法能让候选框借助 textarea 定位，但也会把输入法预编辑串一起隐藏。
- 后续临时显示 composition 文本时，如果字号没有和 Canvas 正文字号保持一致，就会产生视觉错位。
- 更根本的问题是：Canvas 正文不是 DOM 文本，浏览器不会自动把 composition 预编辑串排进 Canvas 文本流，也不会自动把后面的 Canvas 内容向后推。
- 所以基础版和富文本版都不能依赖 textarea 可见文本来承担最终视觉表现。

修复原则：

- `textarea` 只负责承接浏览器 IME 事件和提供候选框锚点，不负责展示正文。
- composition 期间保存 `compositionText`，用它生成一份临时预览文档。
- 临时预览文档仍走 Canvas layout 和 renderer，让拼音预编辑串像真实文本一样参与排版，并自然推开后续文字。
- composition 期间隐藏 textarea 文本，避免 textarea 预编辑串和 Canvas 预览文字重叠。
- composition 结束后，把最终文本提交到真实文档，再清空预览状态。
- 后续进入富文本后，同样应把 composition 预编辑串插入到当前 block/run 的预览模型中，而不是显示 textarea 文本。

涉及文件：

- `hooks/useImeAnchor.ts`
- `components/CanvasWordSurface.tsx`
- `CanvasWordRecord.tsx`
- `src/styles/index.scss`

回归重点：

- 中文拼音输入时能看到预编辑串，且预编辑串由 Canvas 绘制。
- 候选框仍跟随 Canvas 光标。
- 预编辑串字号、位置接近当前行文字。
- 预编辑串后面的正文会临时后移，不应被拼音串覆盖。
- composition 结束后不残留 textarea 内容。

### 2. 旧空格断点导致长文本整段换行

现象：

- 当前行已经存在部分文字。
- 在该行继续输入较长文本时，已有文字和新输入文字一起被搬到下一行。
- 当前行没有从真正接近行尾的位置自然截断，出现较大的行尾空白。

原因：

- `layout/canvasTextLayout.ts` 的自动换行会记录最近的空格或标点作为断行候选。
- 之前空格断点优先级过高，只要后续文字溢出，就回到最近空格处断行。
- 当这个空格离行尾很远时，就会把空格后的整段文字都移动到下一行。

修复原则：

- 空格断点不能绝对优先。
- 只有当空格距离行尾足够近时，才使用空格作为自然断词位置。
- 如果空格离行尾太远，应退回到字符级自然截断。
- 标点断点也应保留类似保护，避免旧标点把大段新输入搬走。

涉及文件：

- `layout/canvasTextLayout.ts`

回归重点：

- 在已有文字后继续输入长中文，当前行应先填满再换行。
- 中英文混排、有空格的句子不应过早换行。
- 标点避头规则仍正常。
- 光标、选区和 IME 锚点在换行后仍定位正确。

## 每阶段回归清单

每个阶段完成后至少检查：

- `pnpm run build` 通过。
- `/medical-record` 页面可以打开。
- 文档可以绘制。
- 点击文档可以定位光标。
- 可以输入中文。
- 中文输入法拼音预编辑串可见，字号接近当前行。
- 中文输入法候选框跟随 Canvas 光标。
- Backspace/Delete 正常。
- Enter 换行正常。
- 方向键正常。
- 在已有文字后继续输入长文本时，当前行能自然填满并换行。
- 鼠标拖拽选区正常。
- 复制、剪切、粘贴正常。
- 撤销、重做正常。
- 右键菜单正常。
- 加载病历文档正常。

## 推荐执行顺序

1. 阶段 1：抽出 `wordTypes.ts`。
2. 阶段 2：抽出 `components/CanvasWordContextMenu.tsx`。
3. 阶段 3：抽出 `editing/wordClipboard.ts`。
4. 阶段 4：抽出 `editing/wordHistory.ts`。
5. 阶段 5：抽出 `layout/canvasWordRenderer.ts`。
6. 阶段 6：抽出 `hooks/useCanvasWordEditor.ts`。
7. 阶段 7：评估 `components/CanvasWordSurface.tsx`。

## 和版本路线图的关系

[07-canvas-word-version-roadmap.md](./07-canvas-word-version-roadmap.md) 记录 v0/v1/v2/medical-record 的整体演进路线。

本文档专注于 v0 主组件拆分。

完成本文档前几个阶段后，`canvas-word-basic` 会更适合作为 `rich-canvas-word` 的基础参考，也更容易把通用编辑命令、renderer 和选区逻辑迁移到 v1 富文本模型。
