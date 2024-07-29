import { unicodeWidth } from "@std/cli/unicode-width";
import { stripAnsiCode } from "@std/fmt/colors";

import { graphemes } from "./boundary.ts";

const { min } = Math;

export interface CursorPosition {
  row: number;
  column: number;
}

export function advanceCursor(
  pos: CursorPosition,
  columns: number,
  text: string,
): undefined {
  for (const grapheme of graphemes(stripAnsiCode(text))) {
    if (grapheme === "\n") {
      pos.row++;
      pos.column = 0;
      continue;
    }
    const width = min(unicodeWidth(grapheme), 2);
    if (pos.column + width > columns) {
      pos.row++;
      pos.column = 0;
    }
    pos.column += width;
  }
}

export function wrapCursor(pos: CursorPosition, columns: number): undefined {
  if (pos.column >= columns) {
    pos.row++;
    pos.column = 0;
  }
}
