import type { TextBuffer } from "./buffer.ts";
import { insert } from "./builtin.ts";
import type { TextReader, TextWriter } from "./io.ts";
import type { Renderer } from "./renderer.ts";

export class CommandContext {
  readonly reader: TextReader;
  readonly writer: TextWriter;
  readonly buffer: TextBuffer;
  readonly renderer: Renderer;
  lastChar = "";
  charsUntilSaveState = 0;
  justInsertedChar = false;

  constructor(
    reader: TextReader,
    writer: TextWriter,
    buffer: TextBuffer,
    renderer: Renderer,
  ) {
    this.reader = reader;
    this.writer = writer;
    this.buffer = buffer;
    this.renderer = renderer;
  }

  async redraw(): Promise<undefined> {
    await this.writer.write(this.renderer.update(this.buffer));
  }

  insertChar(c: string): undefined {
    if (this.charsUntilSaveState === 0) {
      this.buffer.saveState();
      this.charsUntilSaveState = 20;
    }
    this.buffer.insertText(c);
    this.charsUntilSaveState--;
    this.justInsertedChar = true;
  }
}

export type CommandResult = "continue" | "commit" | "cancel" | "abort";
export type Command = (ctx: CommandContext) => Promise<CommandResult>;

export interface CommandTree {
  readonly [cp: string]: Command | CommandTree;
}

const controlCharacterRE = /\p{Cc}/u;

export class CommandDecoder {
  readonly #root: CommandTree;
  #tree: CommandTree;

  constructor(root: CommandTree) {
    this.#tree = this.#root = root;
  }

  get empty(): boolean {
    return this.#tree === this.#root;
  }

  next(c: string): Command | null {
    if (this.#tree === this.#root && !controlCharacterRE.test(c)) {
      return insert;
    }
    const command = this.#tree[c];
    if (typeof command !== "function") {
      this.#tree = command ?? this.#root;
      return null;
    }
    this.#tree = this.#root;
    return command;
  }
}
