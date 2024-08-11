import type { TextBuffer } from "./buffer.ts";
import { insert } from "./builtin.ts";
import type { TextReader, TextWriter } from "./io.ts";
import type { Renderer } from "./renderer.ts";

export class DataField<in out T> {
  readonly key: symbol = Symbol();
  readonly defaultValue: T;

  constructor(defaultValue: T) {
    this.defaultValue = defaultValue;
  }
}

export type Job = (ctx: CommandContext) => unknown;

export class Jobs {
  nextTick: Map<symbol, Job> = new Map();
  thisTick: Map<symbol, Job> = new Map();
}

export class CommandContext {
  readonly reader: TextReader;
  readonly writer: TextWriter;
  readonly buffer: TextBuffer;
  readonly renderer: Renderer;
  lastChar = "";
  #data = new Map<symbol, unknown>();
  #jobs: Jobs;

  constructor(
    reader: TextReader,
    writer: TextWriter,
    buffer: TextBuffer,
    renderer: Renderer,
    jobs: Jobs,
  ) {
    this.reader = reader;
    this.writer = writer;
    this.buffer = buffer;
    this.renderer = renderer;
    this.#jobs = jobs;
  }

  async draw(prefix = ""): Promise<undefined> {
    await this.writer.write(prefix + this.renderer.render(this.buffer));
  }

  async redraw(): Promise<undefined> {
    await this.writer.write(this.renderer.update(this.buffer));
  }

  get<T>(field: DataField<T>): T {
    const data = this.#data;
    return data.has(field.key) ? data.get(field.key) as T : field.defaultValue;
  }

  set<T>(field: DataField<T>, value: T): undefined {
    const data = this.#data;
    if (Object.is(value, field.defaultValue)) {
      data.delete(field.key);
    } else {
      data.set(field.key, value);
    }
  }

  update<T>(field: DataField<T>, fn: (value: T) => T): undefined {
    this.set(field, fn(this.get(field)));
  }

  nextTick(key: symbol, job: Job): undefined {
    this.#jobs.nextTick.set(key, job);
    this.#jobs.thisTick.delete(key);
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
