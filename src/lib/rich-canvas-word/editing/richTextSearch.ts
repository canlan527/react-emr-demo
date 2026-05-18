import type { RichTextDocument, RichTextPosition, RichTextSearchMatch } from '../richTypes';
import { isRichTextTextBlock } from '../document/richTextBlocks';
import { insertTextAtRichPosition } from './richTextEditing';
import { compareRichTextPositions } from './richTextPosition';
import { deleteRichTextSelection, normalizeRichTextSelection } from './richTextSelection';

type IndexedCharacter = {
  char: string;
  start: RichTextPosition;
  end: RichTextPosition;
};

function getIndexedBlockText(block: RichTextDocument['blocks'][number]) {
  const characters: IndexedCharacter[] = [];

  block.runs.forEach((run) => {
    let offset = 0;
    Array.from(run.text).forEach((char) => {
      const startOffset = offset;
      offset += char.length;
      characters.push({
        char,
        start: {
          blockId: block.id,
          runId: run.id,
          offset: startOffset,
        },
        end: {
          blockId: block.id,
          runId: run.id,
          offset,
        },
      });
    });
  });

  return characters;
}

export function findRichTextMatches(document: RichTextDocument, rawQuery: string): RichTextSearchMatch[] {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const queryChars = Array.from(query.toLocaleLowerCase());
  if (queryChars.length === 0) {
    return [];
  }

  return document.blocks.flatMap((block) => {
    if (!isRichTextTextBlock(block)) {
      return [];
    }

    const characters = getIndexedBlockText(block);
    const searchableChars = characters.map((item) => item.char.toLocaleLowerCase());
    const matches: RichTextSearchMatch[] = [];

    for (let startIndex = 0; startIndex <= characters.length - queryChars.length; startIndex += 1) {
      const isMatch = queryChars.every((char, index) => searchableChars[startIndex + index] === char);
      if (!isMatch) {
        continue;
      }

      const start = characters[startIndex]?.start;
      const end = characters[startIndex + queryChars.length - 1]?.end;
      if (!start || !end) {
        continue;
      }

      matches.push({
        id: `${block.id}-${startIndex}-${queryChars.length}`,
        selection: { anchor: start, focus: end },
        text: characters
          .slice(startIndex, startIndex + queryChars.length)
          .map((item) => item.char)
          .join(''),
      });
      startIndex += queryChars.length - 1;
    }

    return matches;
  });
}

export function replaceRichTextSearchMatches(
  document: RichTextDocument,
  matches: RichTextSearchMatch[],
  replacement: string,
) {
  const orderedMatches = [...matches]
    .filter((match) => normalizeRichTextSelection(document, match.selection))
    .sort((left, right) => {
      const leftRange = normalizeRichTextSelection(document, left.selection);
      const rightRange = normalizeRichTextSelection(document, right.selection);
      if (!leftRange || !rightRange) {
        return 0;
      }

      return compareRichTextPositions(document, rightRange.start, leftRange.start);
    });

  return orderedMatches.reduce(
    (current, match) => {
      const deleted = deleteRichTextSelection(current.document, match.selection);
      const inserted = replacement ? insertTextAtRichPosition(deleted.document, deleted.cursor, replacement) : deleted;
      return {
        document: inserted.document,
        cursor: inserted.cursor,
        count: current.count + 1,
      };
    },
    { document, cursor: null as RichTextPosition | null, count: 0 },
  );
}
