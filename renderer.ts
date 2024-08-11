import type { TextBufferState } from "./buffer.ts";
import { escapeControlChars } from "./control.ts";
import { advanceCursor, wrapCursor } from "./cursor.ts";
import type { PromptEnvironment } from "./env/common.ts";

export class Renderer {
  readonly #env: PromptEnvironment;
  #lastLeadingText = "";
  #lastPrefix?: string;
  #lastSuffix?: string;
  #lastState?: TextBufferState;

  constructor(env: PromptEnvironment) {
    this.#env = env;
  }

  render(prefix: string, suffix: string, state: TextBufferState): string {
    const columns = this.#env.getScreenWidth();
    return this.#render(prefix, suffix, state, columns);
  }

  update(prefix: string, suffix: string, state: TextBufferState): string {
    if (
      this.#lastPrefix === prefix &&
      this.#lastSuffix === suffix &&
      this.#lastState === state
    ) {
      return "";
    }
    const columns = this.#env.getScreenWidth();
    const reset = this.#reset(columns);
    const render = this.#render(prefix, suffix, state, columns);
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

  #render(
    prefix: string,
    suffix: string,
    state: TextBufferState,
    columns: number,
  ): string {
    const { text, cursor } = state;
    const leadingText = prefix + escapeControlChars(text.substring(0, cursor));
    const trailingText = escapeControlChars(text.substring(cursor)) + suffix;
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
    this.#lastPrefix = prefix;
    this.#lastSuffix = suffix;
    this.#lastState = state;
    return sequence;
  }
}
