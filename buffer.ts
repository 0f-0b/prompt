import {
  getGraphemeRange,
  getNextWordRange,
  getPreviousWordRange,
  nextGraphemeBoundary,
} from "./boundary.ts";
import { escapeControlCharacters } from "./control.ts";
import { advanceCursor, wrapCursor } from "./cursor.ts";

export class TextBuffer {
  #prompt: string;
  #state = { text: "", cursor: 0 };
  #history: readonly string[];
  #position: number;
  #stash = "";

  constructor(prompt: string, history: readonly string[]) {
    this.#prompt = prompt;
    this.#history = history;
    this.#position = history.length;
  }

  get text(): string {
    return this.#state.text;
  }

  initialize(columns: number): string {
    const render = this.#render(columns);
    return "\x1b[G" + render;
  }

  finish(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    const text = state.text + "\n";
    this.#state = { text, cursor: text.length };
    const render = this.#render(columns);
    this.#state = state;
    return reset + render;
  }

  insertText(insertion: string, columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (insertion) {
      const text = state.text.substring(0, state.cursor) +
        insertion + state.text.substring(state.cursor);
      this.#state = {
        text,
        cursor: nextGraphemeBoundary(text, state.cursor + insertion.length),
      };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  deleteBackward(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== 0) {
      const { start, end } = getGraphemeRange(state.text, state.cursor - 1);
      const text = state.text.substring(0, start) + state.text.substring(end);
      this.#state = { text, cursor: nextGraphemeBoundary(text, start) };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  deleteForward(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== state.text.length) {
      const { start, end } = getGraphemeRange(state.text, state.cursor);
      const text = state.text.substring(0, start) + state.text.substring(end);
      this.#state = { text, cursor: nextGraphemeBoundary(text, start) };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  cutToStart(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== 0) {
      const text = state.text.substring(state.cursor);
      this.#state = { text, cursor: 0 };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  cutToEnd(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== state.text.length) {
      const text = state.text.substring(0, state.cursor);
      this.#state = { text, cursor: state.cursor };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  cutPreviousWord(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== 0) {
      const { start } = getPreviousWordRange(state.text, state.cursor);
      const text = state.text.substring(0, start) +
        state.text.substring(state.cursor);
      this.#state = { text, cursor: nextGraphemeBoundary(text, start) };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  cutNextWord(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== state.text.length) {
      const { end } = getNextWordRange(state.text, state.cursor);
      const text = state.text.substring(0, state.cursor) +
        state.text.substring(end);
      this.#state = { text, cursor: nextGraphemeBoundary(text, state.cursor) };
    }
    const render = this.#render(columns);
    return reset + render;
  }

  moveToStart(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    state.cursor = 0;
    const render = this.#render(columns);
    return reset + render;
  }

  moveToEnd(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    state.cursor = state.text.length;
    const render = this.#render(columns);
    return reset + render;
  }

  moveBackward(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== 0) {
      const { start } = getGraphemeRange(state.text, state.cursor - 1);
      state.cursor = start;
    }
    const render = this.#render(columns);
    return reset + render;
  }

  moveForward(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== state.text.length) {
      const { end } = getGraphemeRange(state.text, state.cursor);
      state.cursor = end;
    }
    const render = this.#render(columns);
    return reset + render;
  }

  moveBackwardWord(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== 0) {
      const { start } = getPreviousWordRange(state.text, state.cursor);
      state.cursor = start;
    }
    const render = this.#render(columns);
    return reset + render;
  }

  moveForwardWord(columns: number): string {
    const reset = this.#reset(columns);
    const state = this.#state;
    if (state.cursor !== state.text.length) {
      const { end } = getNextWordRange(state.text, state.cursor);
      state.cursor = end;
    }
    const render = this.#render(columns);
    return reset + render;
  }

  clearScreen(columns: number): string {
    const render = this.#render(columns);
    return "\x1b[H" + render;
  }

  clearDisplay(columns: number): string {
    const render = this.#render(columns);
    return "\x1b[H\x1b[3J" + render;
  }

  nextHistory(columns: number): string {
    const reset = this.#reset(columns);
    if (this.#position !== this.#history.length) {
      this.#navigate(this.#position + 1);
    }
    const render = this.#render(columns);
    return reset + render;
  }

  previousHistory(columns: number): string {
    const reset = this.#reset(columns);
    if (this.#position !== 0) {
      this.#navigate(this.#position - 1);
    }
    const render = this.#render(columns);
    return reset + render;
  }

  #navigate(target: number): undefined {
    if (this.#position === target) {
      return;
    }
    if (this.#position === this.#history.length) {
      this.#stash = this.#state.text;
    }
    this.#position = target;
    let text: string;
    if (this.#position === this.#history.length) {
      text = this.#stash;
      this.#stash = "";
    } else {
      text = this.#history[this.#position]!;
    }
    this.#state = { text, cursor: text.length };
  }

  #reset(columns: number): string {
    const prompt = this.#prompt;
    const { text, cursor } = this.#state;
    const leadingText = `${prompt}${text.substring(0, cursor)}`;
    const pos = { row: 0, column: 0 };
    advanceCursor(pos, columns, leadingText);
    wrapCursor(pos, columns);
    const lines = pos.row;
    switch (lines) {
      case 0:
        return "\r";
      case 1:
        return "\x1b[F";
      default:
        return `\x1b[${lines}F`;
    }
  }

  #render(columns: number): string {
    const prompt = this.#prompt;
    const { text, cursor } = this.#state;
    const leadingText = `${prompt}${text.substring(0, cursor)}`;
    const trailingText = text.substring(cursor);
    const pos = { row: 0, column: 0 };
    advanceCursor(pos, columns, leadingText);
    const target = { row: pos.row, column: pos.column };
    wrapCursor(target, columns);
    advanceCursor(pos, columns, trailingText);
    const escaped = escapeControlCharacters(text, true);
    let sequence = `${prompt}${escaped.replaceAll("\n", "\x1b[K\n")}\x1b[J`;
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
    return sequence;
  }
}
