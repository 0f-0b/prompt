import type { TextBuffer, TextBufferState } from "./buffer.ts";
import { escapeControlChars } from "./control.ts";
import { advanceCursor, wrapCursor } from "./cursor.ts";

export class Renderer {
  #lastLeadingText = "";
  #lastPrompt?: string;
  #lastState?: TextBufferState;
  #resetSequence: string | undefined;

  setResetSequence(sequence: string): undefined {
    this.#resetSequence = sequence;
  }

  update(buf: TextBuffer, columns: number): string {
    const { prompt, state } = buf;
    if (
      this.#lastPrompt === prompt && this.#lastState === state &&
      this.#resetSequence === undefined
    ) {
      return "";
    }
    const reset = this.#resetSequence ?? this.#reset(columns);
    this.#resetSequence = undefined;
    const render = this.#render(prompt, state, columns);
    return reset + render;
  }

  #reset(columns: number): string {
    const pos = { row: 0, column: 0 };
    advanceCursor(pos, columns, this.#lastLeadingText);
    wrapCursor(pos, columns);
    const lines = pos.row;
    switch (lines) {
      case 0:
        return "\x1b[G";
      case 1:
        return "\x1b[F";
      default:
        return `\x1b[${lines}F`;
    }
  }

  #render(prompt: string, state: TextBufferState, columns: number): string {
    const { text, cursor } = state;
    const leadingText = prompt + escapeControlChars(text.substring(0, cursor));
    const trailingText = escapeControlChars(text.substring(cursor));
    const pos = { row: 0, column: 0 };
    advanceCursor(pos, columns, leadingText);
    const target = { row: pos.row, column: pos.column };
    wrapCursor(target, columns);
    advanceCursor(pos, columns, trailingText);
    let sequence = (leadingText + trailingText)
      .replaceAll("\n", "\x1b[K\n") + "\x1b[J";
    const lines = pos.row - target.row;
    let column = pos.column;
    switch (lines) {
      case -1:
        sequence += "\n";
        column = 0;
        break;
      case 0:
        break;
      case 1:
        sequence += "\x1b[F";
        column = 0;
        break;
      default:
        sequence += `\x1b[${lines}F`;
        column = 0;
        break;
    }
    if (column !== target.column) {
      sequence += `\x1b[${target.column + 1}G`;
    }
    this.#lastLeadingText = leadingText;
    this.#lastPrompt = prompt;
    this.#lastState = state;
    return sequence;
  }
}
