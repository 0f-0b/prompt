import { TextBuffer } from "./buffer.ts";
import { type Command, CommandDecoder, type CommandTree } from "./command.ts";
import type { PromptEnvironment } from "./env/common.ts";
import { TextReader, TextWriter } from "./io.ts";
import { Renderer } from "./renderer.ts";

export type { Command, CommandTree, PromptEnvironment };
export const defaultCommands: CommandTree = Object.freeze<CommandTree>({
  // @ts-expect-error Remove prototype
  __proto__: null,
  "\n" /* ^J */: "commit",
  "\r" /* ^M */: "commit",
  "\x03" /* ^C */: "abort",
  "\b" /* ^H */: "delete-backward",
  "\x7f" /* ^? */: "delete-backward",
  "\x04" /* ^D */: "delete-forward",
  "\x15" /* ^U */: "cut-to-start",
  "\v" /* ^K */: "cut-to-end",
  "\x01" /* ^A */: "move-to-start",
  "\x05" /* ^E */: "move-to-end",
  "\x02" /* ^B */: "move-backward",
  "\x06" /* ^F */: "move-forward",
  "\f" /* ^L */: "clear-screen",
  "\x0e" /* ^N */: "next-history",
  "\x10" /* ^P */: "previous-history",
  "\x11" /* ^Q */: "quoted-insert",
  "\x16" /* ^V */: "quoted-insert",
  "\x1f" /* ^_ */: "undo",
  "\x18" /* ^X */: Object.freeze<CommandTree>({
    // @ts-expect-error Remove prototype
    __proto__: null,
    "\x7f" /* ^? */: "cut-to-start",
    "\x15" /* ^U */: "undo",
  }),
  "\x1b" /* ^[ */: Object.freeze<CommandTree>({
    // @ts-expect-error Remove prototype
    __proto__: null,
    "\b" /* ^H */: "cut-previous-word",
    "\x7f" /* ^? */: "cut-previous-word",
    "D": "cut-next-word",
    "d": "cut-next-word",
    "B": "move-backward-word",
    "b": "move-backward-word",
    "F": "move-forward-word",
    "f": "move-forward-word",
    "\f" /* ^L */: "clear-display",
    "[": Object.freeze<CommandTree>({
      // @ts-expect-error Remove prototype
      __proto__: null,
      "H": "move-to-start",
      "F": "move-to-end",
      "D": "move-backward",
      "C": "move-forward",
      "B": "next-history",
      "A": "previous-history",
      "1": Object.freeze<CommandTree>({
        // @ts-expect-error Remove prototype
        __proto__: null,
        ";": Object.freeze<CommandTree>({
          // @ts-expect-error Remove prototype
          __proto__: null,
          "3": Object.freeze<CommandTree>({
            // @ts-expect-error Remove prototype
            __proto__: null,
            "D": "move-backward-word",
            "C": "move-forward-word",
          }),
          "5": Object.freeze<CommandTree>({
            // @ts-expect-error Remove prototype
            __proto__: null,
            "D": "move-backward-word",
            "C": "move-forward-word",
          }),
        }),
      }),
      "2": Object.freeze<CommandTree>({
        "0": Object.freeze<CommandTree>({
          "0": Object.freeze<CommandTree>({
            "~": "bracketed-paste-begin",
          }),
        }),
      }),
      "3": Object.freeze<CommandTree>({
        // @ts-expect-error Remove prototype
        __proto__: null,
        "~": "delete-forward",
        ";": Object.freeze<CommandTree>({
          // @ts-expect-error Remove prototype
          __proto__: null,
          "5": Object.freeze<CommandTree>({
            // @ts-expect-error Remove prototype
            __proto__: null,
            "~": "cut-next-word",
          }),
        }),
      }),
    }),
    "O": Object.freeze<CommandTree>({
      // @ts-expect-error Remove prototype
      __proto__: null,
      "H": "move-to-start",
      "F": "move-to-end",
      "D": "move-backward",
      "C": "move-forward",
      "B": "next-history",
      "A": "previous-history",
    }),
  }),
});
const controlCharacterRE = /\p{Cc}/u;

export interface PromptCommitResult {
  action: "commit";
  text: string;
}

export interface PromptCancelResult {
  action: "cancel";
}

export interface PromptAbortResult {
  action: "abort";
  text: string;
}

export type PromptResult =
  | PromptCommitResult
  | PromptCancelResult
  | PromptAbortResult;

export interface PromptOptions {
  prompt?: string | undefined;
  history?: readonly string[] | undefined;
  commands?: CommandTree | undefined;
}

export async function prompt(
  env: PromptEnvironment,
  options?: PromptOptions,
): Promise<PromptResult> {
  const prompt = options?.prompt ?? "> ";
  const history = options?.history ?? [];
  const commands = options?.commands ?? defaultCommands;
  const rb = env.readable.getReader({ mode: "byob" });
  try {
    const wb = env.writable.getWriter();
    try {
      env.setRawMode(true);
      try {
        const r = new TextReader(rb);
        const w = new TextWriter(wb);
        await w.write("\x1b[?2004h");
        try {
          const decoder = new CommandDecoder(commands);
          const buffer = new TextBuffer(prompt, history);
          const renderer = new Renderer();
          let insertCount = 0;
          let quotedInsert = false;
          let pasteBuffer: string | undefined;
          let action: PromptResult["action"];
          readCommands:
          for (;;) {
            await w.write(renderer.update(buffer, env.getScreenWidth()));
            const c = await r.readCodePoint();
            if (c === null) {
              action = "cancel";
              break;
            }
            if (decoder.empty) {
              if (pasteBuffer !== undefined) {
                pasteBuffer += c;
                if (pasteBuffer.endsWith("\x1b[201~")) {
                  buffer.saveState();
                  buffer.insertText(pasteBuffer.slice(0, -"\x1b[201~".length));
                  pasteBuffer = undefined;
                }
                continue;
              }
              if (quotedInsert || !controlCharacterRE.test(c)) {
                if (insertCount === 0) {
                  buffer.saveState();
                  insertCount = 20;
                }
                buffer.insertText(c);
                quotedInsert = false;
                insertCount--;
                continue;
              }
              if (c === "\x04" && buffer.state.text.length === 0) {
                action = "cancel";
                break;
              }
            }
            const command = decoder.next(c);
            switch (command) {
              case "commit":
                action = "commit";
                break readCommands;
              case "abort":
                action = "abort";
                break readCommands;
              case "delete-backward":
                buffer.deleteBackward();
                break;
              case "delete-forward":
                buffer.deleteForward();
                break;
              case "cut-to-start":
                buffer.cutToStart();
                break;
              case "cut-to-end":
                buffer.cutToEnd();
                break;
              case "cut-previous-word":
                buffer.cutPreviousWord();
                break;
              case "cut-next-word":
                buffer.cutNextWord();
                break;
              case "move-to-start":
                buffer.moveToStart();
                break;
              case "move-to-end":
                buffer.moveToEnd();
                break;
              case "move-backward":
                buffer.moveBackward();
                break;
              case "move-forward":
                buffer.moveForward();
                break;
              case "move-backward-word":
                buffer.moveBackwardWord();
                break;
              case "move-forward-word":
                buffer.moveForwardWord();
                break;
              case "clear-screen":
                renderer.setResetSequence("\x1b[H");
                break;
              case "clear-display":
                renderer.setResetSequence("\x1b[H\x1b[3J");
                break;
              case "next-history":
                buffer.nextHistory();
                break;
              case "previous-history":
                buffer.previousHistory();
                break;
              case "quoted-insert":
                quotedInsert = true;
                continue;
              case "bracketed-paste-begin":
                pasteBuffer = "";
                break;
              case "undo":
                buffer.restoreState();
                break;
              default:
                command satisfies null;
                break;
            }
            insertCount = 0;
          }
          const { text } = buffer.state;
          buffer.replaceText(text.length, text.length, "\n");
          await w.write(renderer.update(buffer, env.getScreenWidth()));
          return action === "cancel" ? { action } : { action, text };
        } finally {
          await w.write("\x1b[?2004l");
        }
      } finally {
        env.setRawMode(false);
      }
    } finally {
      wb.releaseLock();
    }
  } finally {
    rb.releaseLock();
  }
}
