// rich-canvas-word 的公共类型集中放在这里，避免 document、layout、editing、
// toolbar 之间互相 import 具体实现文件。整体模型分三层：
// 1. RichTextDocument：可编辑的富文本文档数据。
// 2. RichTextLayoutResult：Canvas 排版后的视觉数据。
// 3. ToolbarItem：Canvas 工具栏的配置和布局数据。

export type RichTextAlign = 'left' | 'center' | 'right';
export type RichTextTextBlockType = 'heading' | 'paragraph';
export type RichTextBlockType = RichTextTextBlockType | 'table';

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

export type RichTextBaseBlock<TType extends RichTextBlockType = RichTextBlockType> = {
  id: string;
  type: TType;
};

// text block 表示当前可编辑的正文流块。V2 会在 RichTextBlock union 中继续加入 table/image/comment 等对象块。
export type RichTextTextBlock<TType extends RichTextTextBlockType = RichTextTextBlockType> = RichTextBaseBlock<TType> & {
  align: RichTextAlign;
  runs: RichTextRun[];
};

export type RichTextHeadingBlock = RichTextTextBlock<'heading'>;
export type RichTextParagraphBlock = RichTextTextBlock<'paragraph'>;

export type RichTextTableCell = {
  id: string;
  align?: RichTextAlign;
  runs: RichTextRun[];
};

export type RichTextTableRow = {
  id: string;
  cells: RichTextTableCell[];
};

export type RichTextTableBlock = RichTextBaseBlock<'table'> & {
  align: RichTextAlign;
  runs: RichTextRun[];
  rows: RichTextTableRow[];
  columnWidths?: number[];
};

// block 表示文档流中的顶层结构。V2 从 text block 扩展到 table block。
export type RichTextBlock = RichTextHeadingBlock | RichTextParagraphBlock | RichTextTableBlock;

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

export type RichTableCellSelection = {
  tableBlockId: string;
  cellId: string;
  rowIndex: number;
  cellIndex: number;
  runId?: string;
  offset?: number;
};

export type RichTableSelection =
  | {
      type: 'cells';
      tableBlockId: string;
      anchor: RichTableCellSelection;
      focus: RichTableCellSelection;
    }
  | {
      type: 'text';
      tableBlockId: string;
      cellId: string;
      rowIndex: number;
      cellIndex: number;
      anchor: RichTableCellSelection;
      focus: RichTableCellSelection;
    };

export type RichCanvasWordEditorHandle = {
  focus: () => void;
  getDocument: () => RichTextDocument;
  getCursor: () => RichTextPosition | null;
  getSelection: () => RichTextSelection | null;
  insertText: (text: string) => void;
  insertBlocks: (blocks: RichTextBlock[]) => void;
  replaceSelection: (content: string | RichTextBlock[]) => void;
  setDocument: (document: RichTextDocument) => void;
};

export type RichTextSearchMatch = {
  id: string;
  selection: RichTextSelection;
  text: string;
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

export type RichLayoutTableTextFragment = {
  cellId: string;
  runId: string;
  text: string;
  marks: RichTextMarks;
  startOffset: number;
  endOffset: number;
  font: string;
  x: number;
  width: number;
  baseline: number;
};

export type RichLayoutTableCell = {
  cellIndex: number;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fragments: RichLayoutTableTextFragment[];
};

export type RichLayoutTable = {
  blockId: string;
  cells: RichLayoutTableCell[];
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  rowIndex: number;
};

export type RichTextLayoutResult = {
  lines: RichLayoutLine[];
  tables: RichLayoutTable[];
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
  | 'copy'
  | 'exportJson'
  | 'exportPlainText'
  | 'exportPdf'
  | 'printPreview'
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
