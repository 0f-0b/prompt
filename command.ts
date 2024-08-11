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
  prompt: string;
  lastChar = "";
  #data = new Map<symbol, unknown>();
  #jobs: Jobs;

  constructor(
    reader: TextReader,
    writer: TextWriter,
    buffer: TextBuffer,
    renderer: Renderer,
    prompt: string,
    jobs: Jobs,
  ) {
    this.reader = reader;
    this.writer = writer;
    this.buffer = buffer;
    this.renderer = renderer;
    this.prompt = prompt;
    this.#jobs = jobs;
  }

  async draw(prefix = this.prompt, suffix = ""): Promise<undefined> {
    await this.writer.write(
      this.renderer.render(prefix, suffix, this.buffer.state),
    );
  }

  async redraw(prefix = this.prompt, suffix = ""): Promise<undefined> {
    await this.writer.write(
      this.renderer.update(prefix, suffix, this.buffer.state),
    );
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
  readonly [codePoint: string]: Command | CommandTree;
}

export function buildCommandTree(...sources: CommandTree[]): CommandTree {
  // deno-lint-ignore ban-types
  const root: Record<string, Command | CommandTree> = { __proto__: null } as {};
  for (const tree of sources) {
    const sequence: string[] = [];
    (function dump(tree) {
      for (const [key, command] of Object.entries(tree)) {
        sequence.push(key);
        if (typeof command === "function") {
          let target = root;
          let lastCp = "";
          for (const cp of sequence) {
            if (lastCp) {
              let branch = target[lastCp];
              if (branch === undefined || typeof branch === "function") {
                // deno-lint-ignore ban-types
                target[lastCp] = branch = { __proto__: null } as {};
              }
              target = branch;
            }
            lastCp = cp;
          }
          if (lastCp) {
            target[lastCp] = command;
          }
        } else {
          dump(command);
        }
        sequence.pop();
      }
    })(tree);
  }
  const toFreeze = new Set([root]);
  for (const tree of toFreeze) {
    Object.freeze(tree);
    for (const branch of Object.values(tree)) {
      if (typeof branch !== "function") {
        toFreeze.add(branch);
      }
    }
  }
  return root;
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
