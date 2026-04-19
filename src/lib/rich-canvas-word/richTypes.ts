// rich-canvas-word 的公共类型集中放在这里，避免 document、layout、editing、
// toolbar 之间互相 import 具体实现文件。整体模型分三层：
// 1. RichTextDocument：可编辑的富文本文档数据。
// 2. RichTextLayoutResult：Canvas 排版后的视觉数据。
// 3. ToolbarItem：Canvas 工具栏的配置和布局数据。

export type RichTextAlign = 'left' | 'center' | 'right';

// marks 是字符级样式。相邻 run 如果 marks 完全一致，可以安全合并。
export type RichTextMarks = {
  bold?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
};

// run 表示一段连续拥有相同 marks 的文本，是富文本编辑的最小样式片段。
export type RichTextRun = {
  id: string;
  text: string;
  marks: RichTextMarks;
};

// block 表示段落级结构。当前 v1 只支持标题和段落，表格/图片等留给后续阶段。
export type RichTextBlock = {
  id: string;
  type: 'heading' | 'paragraph';
  align: RichTextAlign;
  runs: RichTextRun[];
};

export type RichTextDocument = {
  id: string;
  title: string;
  blocks: RichTextBlock[];
};

// 剪贴板片段使用和 document 相同的 block/run 结构，但只保存选区范围。
// 粘贴时会重新生成 id，避免和当前 document 中已有 block/run 冲突。
export type RichTextClipboardSlice = {
  blocks: RichTextBlock[];
};

// position 使用 blockId + runId + offset，而不是全局字符串索引。
// 这样 run 拆分、合并、段落移动时更容易保持编辑语义。
export type RichTextPosition = {
  blockId: string;
  runId: string;
  offset: number;
};

// selection 保存 anchor/focus 原始方向。需要比较先后顺序时使用 normalizeRichTextSelection。
export type RichTextSelection = {
  anchor: RichTextPosition;
  focus: RichTextPosition;
};

export type RichTextFormatCommand = 'bold' | 'underline' | 'fontSize' | 'textColor' | 'backgroundColor' | 'clearFormat';

// fragment 是 layout 阶段生成的可绘制片段，通常对应某个 run 在某一视觉行上的一部分。
export type RichLayoutFragment = {
  blockId: string;
  runId: string;
  text: string;
  marks: RichTextMarks;
  startOffset: number;
  endOffset: number;
  font: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// line 是 Canvas 上的一条视觉行。一个 block 可能因为自动换行拆成多条 line。
export type RichLayoutLine = {
  blockId: string;
  align: RichTextAlign;
  fragments: RichLayoutFragment[];
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  page: number;
  lineIndex: number;
};

export type RichTextLayoutResult = {
  lines: RichLayoutLine[];
  pages: number;
  width: number;
  height: number;
};

export type RichCursorRect = {
  x: number;
  y: number;
  height: number;
};

export type ToolbarCommand =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'underline'
  | 'fontSize'
  | 'textColor'
  | 'backgroundColor'
  | 'clearFormat'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'resetDocument'
  | 'save'
  | 'zoom';

export type ToolbarItem =
  | {
      id: string;
      type: 'button';
      command: ToolbarCommand;
      label: string;
      color?: string;
      active?: boolean;
      disabled?: boolean;
    }
  | {
      id: string;
      type: 'separator';
    };

export type ToolbarItemLayout = {
  id: string;
  type: ToolbarItem['type'];
  command?: ToolbarCommand;
  label?: string;
  color?: string;
  active: boolean;
  disabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};
