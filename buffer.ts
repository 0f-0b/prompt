import {
  getGraphemeRange,
  getNextWordRange,
  getPreviousWordRange,
  nextGraphemeBoundary,
} from "./boundary.ts";

export interface TextBufferState {
  readonly text: string;
  readonly cursor: number;
}

export class TextBuffer {
  #prompt: string;
  #state: TextBufferState = { text: "", cursor: 0 };
  #history: readonly string[];
  #position: number;
  #stash = "";

  constructor(prompt: string, history: readonly string[]) {
    this.#prompt = prompt;
    this.#history = history;
    this.#position = history.length;
  }

  get prompt(): string {
    return this.#prompt;
  }

  set prompt(value: string) {
    this.#prompt = value;
  }

  get state(): TextBufferState {
    return this.#state;
  }

  setState(text: string, cursor: number): undefined {
    this.#state = { text, cursor: nextGraphemeBoundary(text, cursor) };
  }

  get history(): readonly string[] {
    return this.#history;
  }

  get position(): number {
    return this.#position;
  }

  navigate(to: number): undefined {
    const position = this.#position;
    if (position === to) {
      return;
    }
    const history = this.#history;
    if (position === history.length) {
      this.#stash = this.#state.text;
    }
    this.#position = to;
    let text: string;
    if (to === history.length) {
      text = this.#stash;
      this.#stash = "";
    } else {
      text = history[to]!;
    }
    this.setState(text, text.length);
  }

  moveCursor(to: number): undefined {
    const { text, cursor } = this.state;
    if (cursor === to) {
      return;
    }
    this.setState(text, to);
  }

  replaceText(start: number, end: number, replacement: string): undefined {
    if (start === end && !replacement) {
      return;
    }
    const { text } = this.state;
    this.setState(
      text.substring(0, start) + replacement + text.substring(end),
      start + replacement.length,
    );
  }

  insertText(insertion: string): undefined {
    const { cursor } = this.state;
    this.replaceText(cursor, cursor, insertion);
  }

  deleteText(start: number, end: number): undefined {
    this.replaceText(start, end, "");
  }

  deleteBackward(): undefined {
    const { text, cursor } = this.state;
    if (cursor === 0) {
      return;
    }
    const { start, end } = getGraphemeRange(text, cursor - 1);
    this.deleteText(start, end);
  }

  deleteForward(): undefined {
    const { text, cursor } = this.state;
    if (cursor === text.length) {
      return;
    }
    const { start, end } = getGraphemeRange(text, cursor);
    this.deleteText(start, end);
  }

  cutToStart(): undefined {
    const { cursor } = this.state;
    this.deleteText(0, cursor);
  }

  cutToEnd(): undefined {
    const { text, cursor } = this.state;
    this.deleteText(cursor, text.length);
  }

  cutPreviousWord(): undefined {
    const { text, cursor } = this.state;
    if (cursor === 0) {
      return;
    }
    const { start } = getPreviousWordRange(text, cursor);
    this.deleteText(start, cursor);
  }

  cutNextWord(): undefined {
    const { text, cursor } = this.state;
    if (cursor === text.length) {
      return;
    }
    const { end } = getNextWordRange(text, cursor);
    this.deleteText(cursor, end);
  }

  moveToStart(): undefined {
    this.moveCursor(0);
  }

  moveToEnd(): undefined {
    const { text } = this.state;
    this.moveCursor(text.length);
  }

  moveBackward(): undefined {
    const { text, cursor } = this.state;
    if (cursor === 0) {
      return;
    }
    const { start } = getGraphemeRange(text, cursor - 1);
    this.moveCursor(start);
  }

  moveForward(): undefined {
    const { text, cursor } = this.state;
    if (cursor === text.length) {
      return;
    }
    const { end } = getGraphemeRange(text, cursor);
    this.moveCursor(end);
  }

  moveBackwardWord(): undefined {
    const { text, cursor } = this.state;
    if (cursor === 0) {
      return;
    }
    const { start } = getPreviousWordRange(text, cursor);
    this.moveCursor(start);
  }

  moveForwardWord(): undefined {
    const { text, cursor } = this.state;
    if (cursor === text.length) {
      return;
    }
    const { end } = getNextWordRange(text, cursor);
    this.moveCursor(end);
  }

  nextHistory(): undefined {
    const position = this.position;
    const history = this.history;
    if (position === history.length) {
      return;
    }
    this.navigate(position + 1);
  }

  previousHistory(): undefined {
    const position = this.position;
    if (position === 0) {
      return;
    }
    this.navigate(position - 1);
  }
}
