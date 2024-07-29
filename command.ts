export type Command =
  | "commit"
  | "abort"
  | "delete-backward"
  | "delete-forward"
  | "cut-to-start"
  | "cut-to-end"
  | "cut-previous-word"
  | "cut-next-word"
  | "move-to-start"
  | "move-to-end"
  | "move-backward"
  | "move-forward"
  | "move-backward-word"
  | "move-forward-word"
  | "clear-screen"
  | "clear-display"
  | "next-history"
  | "previous-history"
  | "undo"
  | "quoted-insert"
  | "bracketed-paste-begin";

export interface CommandTree {
  readonly [cp: string]: Command | CommandTree;
}

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
    const command = this.#tree[c];
    if (typeof command !== "string") {
      this.#tree = command ?? this.#root;
      return null;
    }
    this.#tree = this.#root;
    return command;
  }
}
