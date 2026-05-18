import { isRichTextTableBlock } from '../document/richTextBlocks';
import type {
  RichTableCellSelection,
  RichTableSelection,
  RichTextClipboardSlice,
  RichTextDocument,
  RichTextRun,
  RichTextTableBlock,
  RichTextTableCell,
  RichTextTableRow,
} from '../richTypes';
import { cloneRun, createBlockId, createRunId } from './richTextNormalization';

type TableCellEditResult = {
  document: RichTextDocument;
  selection: RichTableCellSelection;
};

function getSelectedCell(
  document: RichTextDocument,
  selection: RichTableCellSelection,
): RichTextTableCell | null {
  const block = document.blocks.find((item) => item.id === selection.tableBlockId);
  if (!block || !isRichTextTableBlock(block)) {
    return null;
  }

  return block.rows[selection.rowIndex]?.cells.find((cell) => cell.id === selection.cellId) ?? null;
}

function getSelectedTable(document: RichTextDocument, tableBlockId: string) {
  const block = document.blocks.find((item) => item.id === tableBlockId);
  return block && isRichTextTableBlock(block) ? block : null;
}

function getCellPlainText(cell: RichTextTableCell) {
  return cell.runs.map((run) => run.text).join('');
}

function getCellRange(selection: RichTableSelection & { type: 'cells' }) {
  return {
    rowStart: Math.min(selection.anchor.rowIndex, selection.focus.rowIndex),
    rowEnd: Math.max(selection.anchor.rowIndex, selection.focus.rowIndex),
    cellStart: Math.min(selection.anchor.cellIndex, selection.focus.cellIndex),
    cellEnd: Math.max(selection.anchor.cellIndex, selection.focus.cellIndex),
  };
}

function createEmptyTableCell(idSeed: string): RichTextTableCell {
  return {
    id: createBlockId(`${idSeed}-cell`),
    runs: [{ id: createRunId(`${idSeed}-run`), text: '', marks: {} }],
  };
}

function cloneTableCell(cell: RichTextTableCell): RichTextTableCell {
  return {
    ...cell,
    id: createBlockId(cell.id),
    runs: cell.runs.length > 0 ? cell.runs.map((run) => cloneRun(run)) : [createEmptyTableCell(cell.id).runs[0]],
  };
}

function cloneTableRowCells(cells: RichTextTableCell[]) {
  return cells.map((cell) => cloneTableCell(cell));
}

function getFirstTableBlock(slice: RichTextClipboardSlice | null): RichTextTableBlock | null {
  const block = slice?.blocks.find(isRichTextTableBlock);
  return block ?? null;
}

function getRunTextRange(run: RichTextRun, startOffset: number | undefined, endOffset: number | undefined) {
  const start = clampOffset(startOffset, run.text);
  const end = clampOffset(endOffset, run.text);
  return run.text.slice(Math.min(start, end), Math.max(start, end));
}

function updateSelectedCell(
  document: RichTextDocument,
  selection: RichTableCellSelection,
  updateCell: (cell: RichTextTableCell) => RichTextTableCell,
  getNextSelection: () => RichTableCellSelection = () => selection,
): TableCellEditResult | null {
  let didUpdate = false;

  const blocks = document.blocks.map((block) => {
    if (!isRichTextTableBlock(block) || block.id !== selection.tableBlockId) {
      return block;
    }

    return {
      ...block,
      rows: block.rows.map((row, rowIndex) => {
        if (rowIndex !== selection.rowIndex) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((cell) => {
            if (cell.id !== selection.cellId) {
              return cell;
            }

            didUpdate = true;
            return updateCell(cell);
          }),
        };
      }),
    };
  });

  return didUpdate ? { document: { ...document, blocks }, selection: getNextSelection() } : null;
}

function clampOffset(offset: number | undefined, text: string) {
  return Math.max(0, Math.min(offset ?? text.length, text.length));
}

function getPreviousCharacterOffset(text: string, offset: number) {
  let previousOffset = 0;
  let currentOffset = 0;

  for (const char of Array.from(text)) {
    const nextOffset = currentOffset + char.length;
    if (nextOffset >= offset) {
      return currentOffset;
    }

    previousOffset = currentOffset;
    currentOffset = nextOffset;
  }

  return previousOffset;
}

function findTargetRunIndex(runs: RichTextRun[], selection: RichTableCellSelection) {
  const selectedIndex = selection.runId ? runs.findIndex((run) => run.id === selection.runId) : -1;
  if (selectedIndex >= 0) {
    return selectedIndex;
  }

  return Math.max(0, runs.length - 1);
}

function insertTextToRuns(runs: RichTextRun[], selection: RichTableCellSelection, value: string) {
  const targetRunIndex = findTargetRunIndex(runs, selection);
  const targetRun = runs[targetRunIndex];

  if (!targetRun) {
    const run = {
      id: createRunId('table-cell-run'),
      text: value,
      marks: {},
    };
    return {
      runs: [run],
      selection: { ...selection, runId: run.id, offset: value.length },
    };
  }

  const offset = clampOffset(selection.runId === targetRun.id ? selection.offset : undefined, targetRun.text);
  const nextRuns = runs.map((run, index) =>
    index === targetRunIndex
      ? { ...run, text: `${run.text.slice(0, offset)}${value}${run.text.slice(offset)}` }
      : run,
  );

  return {
    runs: nextRuns,
    selection: { ...selection, runId: targetRun.id, offset: offset + value.length },
  };
}

function deleteCharacterBeforeSelection(runs: RichTextRun[], selection: RichTableCellSelection) {
  const nextRuns = runs.slice();
  const targetRunIndex = findTargetRunIndex(runs, selection);
  const targetRun = runs[targetRunIndex];

  if (targetRun) {
    const offset = clampOffset(selection.runId === targetRun.id ? selection.offset : undefined, targetRun.text);
    if (offset > 0) {
      const previousOffset = getPreviousCharacterOffset(targetRun.text, offset);
      nextRuns[targetRunIndex] = {
        ...targetRun,
        text: `${targetRun.text.slice(0, previousOffset)}${targetRun.text.slice(offset)}`,
      };
      return {
        runs: nextRuns,
        selection: { ...selection, runId: targetRun.id, offset: previousOffset },
      };
    }
  }

  for (let index = targetRunIndex - 1; index >= 0; index -= 1) {
    const run = nextRuns[index];
    if (!run || run.text.length === 0) {
      continue;
    }

    const previousOffset = getPreviousCharacterOffset(run.text, run.text.length);
    nextRuns[index] = { ...run, text: run.text.slice(0, previousOffset) };
    return {
      runs: nextRuns,
      selection: { ...selection, runId: run.id, offset: previousOffset },
    };
  }

  return null;
}

function replaceRunRange(
  runs: RichTextRun[],
  anchor: RichTableCellSelection,
  focus: RichTableCellSelection,
  value: string,
) {
  const targetRunIndex = anchor.runId ? runs.findIndex((run) => run.id === anchor.runId) : -1;
  const targetRun = targetRunIndex >= 0 ? runs[targetRunIndex] : null;
  if (!targetRun || anchor.runId !== focus.runId) {
    return null;
  }

  const start = Math.min(clampOffset(anchor.offset, targetRun.text), clampOffset(focus.offset, targetRun.text));
  const end = Math.max(clampOffset(anchor.offset, targetRun.text), clampOffset(focus.offset, targetRun.text));
  const nextRuns = runs.map((run, index) =>
    index === targetRunIndex ? { ...run, text: `${run.text.slice(0, start)}${value}${run.text.slice(end)}` } : run,
  );

  return {
    runs: nextRuns,
    selection: { ...focus, runId: targetRun.id, offset: start + value.length },
  };
}

export function insertTextInSelectedTableCell(
  document: RichTextDocument,
  selection: RichTableCellSelection,
  value: string,
): TableCellEditResult | null {
  if (!value || !getSelectedCell(document, selection)) {
    return null;
  }

  let nextSelection = selection;
  return updateSelectedCell(
    document,
    selection,
    (cell) => {
      const result = insertTextToRuns(cell.runs, selection, value);
      nextSelection = result.selection;
      return {
        ...cell,
        runs: result.runs,
      };
    },
    () => nextSelection,
  );
}

export function deleteBeforeSelectedTableCell(
  document: RichTextDocument,
  selection: RichTableCellSelection,
): TableCellEditResult | null {
  const selectedCell = getSelectedCell(document, selection);
  if (!selectedCell) {
    return null;
  }

  const deleteResult = deleteCharacterBeforeSelection(selectedCell.runs, selection);
  if (!deleteResult) {
    return null;
  }

  return updateSelectedCell(
    document,
    selection,
    (cell) => ({
      ...cell,
      runs: deleteResult.runs,
    }),
    () => deleteResult.selection,
  );
}

export function extractRichTableSelectionPlainText(document: RichTextDocument, selection: RichTableSelection | null) {
  if (!selection) {
    return '';
  }

  const table = getSelectedTable(document, selection.tableBlockId);
  if (!table) {
    return '';
  }

  if (selection.type === 'text') {
    const cell = table.rows[selection.rowIndex]?.cells[selection.cellIndex];
    const run = cell?.runs.find((item) => item.id === selection.anchor.runId && item.id === selection.focus.runId);
    return run ? getRunTextRange(run, selection.anchor.offset, selection.focus.offset) : '';
  }

  const { rowStart, rowEnd, cellStart, cellEnd } = getCellRange(selection);

  return table.rows
    .slice(rowStart, rowEnd + 1)
    .map((row) => row.cells.slice(cellStart, cellEnd + 1).map(getCellPlainText).join('\t'))
    .join('\n');
}

export function extractRichTableSelectionSlice(
  document: RichTextDocument,
  selection: RichTableSelection | null,
): RichTextClipboardSlice | null {
  if (!selection || selection.type !== 'cells') {
    return null;
  }

  const table = getSelectedTable(document, selection.tableBlockId);
  if (!table) {
    return null;
  }

  const { rowStart, rowEnd, cellStart, cellEnd } = getCellRange(selection);
  const rows = table.rows.slice(rowStart, rowEnd + 1).map<RichTextTableRow>((row) => ({
    ...row,
    id: createBlockId(row.id),
    cells: cloneTableRowCells(row.cells.slice(cellStart, cellEnd + 1)),
  }));

  if (rows.length === 0 || rows.every((row) => row.cells.length === 0)) {
    return null;
  }

  return {
    blocks: [
      {
        ...table,
        id: createBlockId(table.id),
        rows,
        columnWidths: table.columnWidths?.slice(cellStart, cellEnd + 1) ?? Array.from({ length: rows[0]?.cells.length ?? 0 }, () => 1),
      },
    ],
  };
}

export function deleteRichTableSelection(document: RichTextDocument, selection: RichTableSelection | null): TableCellEditResult | null {
  if (!selection) {
    return null;
  }

  const table = getSelectedTable(document, selection.tableBlockId);
  if (!table) {
    return null;
  }

  if (selection.type === 'text') {
    let nextSelection = selection.focus;
    return updateSelectedCell(
      document,
      selection.focus,
      (cell) => {
        const result = replaceRunRange(cell.runs, selection.anchor, selection.focus, '');
        if (!result) {
          return cell;
        }

        nextSelection = result.selection;
        return {
          ...cell,
          runs: result.runs,
        };
      },
      () => nextSelection,
    );
  }

  const { rowStart, rowEnd, cellStart, cellEnd } = getCellRange(selection);
  const nextSelection = selection.focus;

  const blocks = document.blocks.map((block) => {
    if (!isRichTextTableBlock(block) || block.id !== selection.tableBlockId) {
      return block;
    }

    return {
      ...block,
      rows: block.rows.map((row, rowIndex) =>
        rowIndex < rowStart || rowIndex > rowEnd
          ? row
          : {
              ...row,
              cells: row.cells.map((cell, cellIndex) =>
                cellIndex < cellStart || cellIndex > cellEnd
                  ? cell
                  : {
                      ...cell,
                      runs: cell.runs.length > 0 ? cell.runs.map((run, runIndex) => (runIndex === 0 ? { ...run, text: '' } : { ...run, text: '' })) : [],
                    },
              ),
            },
      ),
    };
  });

  return {
    document: { ...document, blocks },
    selection: nextSelection,
  };
}

export function pasteRichTableSliceIntoTable(
  document: RichTextDocument,
  target: RichTableCellSelection | null,
  slice: RichTextClipboardSlice | null,
): TableCellEditResult | null {
  const sourceTable = getFirstTableBlock(slice);
  const targetTable = target ? getSelectedTable(document, target.tableBlockId) : null;
  if (!sourceTable || !target || !targetTable) {
    return null;
  }

  const sourceColumnCount = Math.max(0, ...sourceTable.rows.map((row) => row.cells.length));
  if (sourceColumnCount === 0 || sourceTable.rows.length === 0) {
    return null;
  }

  const requiredRowCount = target.rowIndex + sourceTable.rows.length;
  const requiredColumnCount = target.cellIndex + sourceColumnCount;
  let focusSelection = target;

  const blocks = document.blocks.map((block) => {
    if (!isRichTextTableBlock(block) || block.id !== target.tableBlockId) {
      return block;
    }

    const currentColumnCount = Math.max(requiredColumnCount, ...block.rows.map((row) => row.cells.length));
    const rows: RichTextTableRow[] = Array.from({ length: Math.max(requiredRowCount, block.rows.length) }, (_, rowIndex) => {
      const existingRow = block.rows[rowIndex] ?? { id: createBlockId(`${block.id}-row`), cells: [] };
      const cells = Array.from({ length: currentColumnCount }, (_, cellIndex) => {
        const sourceRowIndex = rowIndex - target.rowIndex;
        const sourceCellIndex = cellIndex - target.cellIndex;
        const sourceCell = sourceTable.rows[sourceRowIndex]?.cells[sourceCellIndex];

        if (sourceCell) {
          const nextCell = {
            ...(existingRow.cells[cellIndex] ?? sourceCell),
            id: existingRow.cells[cellIndex]?.id ?? createBlockId(sourceCell.id),
            runs: sourceCell.runs.length > 0 ? sourceCell.runs.map((run) => cloneRun(run)) : [createEmptyTableCell(sourceCell.id).runs[0]],
          };

          if (sourceRowIndex === sourceTable.rows.length - 1 && sourceCellIndex === sourceColumnCount - 1) {
            const lastRun = nextCell.runs[nextCell.runs.length - 1];
            focusSelection = {
              tableBlockId: block.id,
              cellId: nextCell.id,
              rowIndex,
              cellIndex,
              runId: lastRun?.id,
              offset: lastRun?.text.length ?? 0,
            };
          }

          return nextCell;
        }

        return existingRow.cells[cellIndex] ?? createEmptyTableCell(`${block.id}-${rowIndex}-${cellIndex}`);
      });

      return {
        ...existingRow,
        cells,
      };
    });

    return {
      ...block,
      columnWidths: Array.from({ length: currentColumnCount }, (_, index) => block.columnWidths?.[index] ?? 1),
      rows,
    };
  });

  return {
    document: { ...document, blocks },
    selection: focusSelection,
  };
}

export function replaceRichTableTextSelection(
  document: RichTextDocument,
  selection: RichTableSelection | null,
  value: string,
): TableCellEditResult | null {
  if (!selection || selection.type !== 'text') {
    return null;
  }

  let nextSelection = selection.focus;
  return updateSelectedCell(
    document,
    selection.focus,
    (cell) => {
      const result = replaceRunRange(cell.runs, selection.anchor, selection.focus, value);
      if (!result) {
        return cell;
      }

      nextSelection = result.selection;
      return {
        ...cell,
        runs: result.runs,
      };
    },
    () => nextSelection,
  );
}
