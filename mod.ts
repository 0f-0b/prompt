import { TextBuffer } from "./buffer.ts";
import { type Command, CommandDecoder, type CommandTree } from "./command.ts";
import type { PromptEnvironment } from "./env/common.ts";
import { TextReader, TextWriter } from "./io.ts";

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
  "\x18" /* ^X */: Object.freeze<CommandTree>({
    // @ts-expect-error Remove prototype
    __proto__: null,
    "\x7f" /* ^? */: "cut-to-start",
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
  prompt?: string;
  history?: readonly string[];
  commands?: CommandTree;
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
          const cd = new CommandDecoder(commands);
          const buf = new TextBuffer(prompt, history);
          let quotedInsert = false;
          let pasteBuffer: string | undefined;
          await w.write(buf.initialize(env.getScreenWidth()));
          for (;;) {
            const c = await r.readCodePoint();
            if (c === null) {
              await w.write(buf.finish(env.getScreenWidth()));
              return { action: "cancel" };
            }
            if (cd.empty) {
              if (pasteBuffer !== undefined) {
                pasteBuffer += c;
                if (pasteBuffer.endsWith("\x1b[201~")) {
                  const str = pasteBuffer.slice(0, -"\x1b[201~".length);
                  await w.write(buf.insertText(str, env.getScreenWidth()));
                  pasteBuffer = undefined;
                }
                continue;
              }
              if (quotedInsert || !controlCharacterRE.test(c)) {
                await w.write(buf.insertText(c, env.getScreenWidth()));
                quotedInsert = false;
                continue;
              }
              if (c === "\x04" && buf.text.length === 0) {
                await w.write(buf.finish(env.getScreenWidth()));
                return { action: "cancel" };
              }
            }
            const command = cd.next(c);
            switch (command) {
              case "commit":
                await w.write(buf.finish(env.getScreenWidth()));
                return { action: "commit", text: buf.text };
              case "abort":
                await w.write(buf.finish(env.getScreenWidth()));
                return { action: "abort", text: buf.text };
              case "delete-backward":
                await w.write(buf.deleteBackward(env.getScreenWidth()));
                break;
              case "delete-forward":
                await w.write(buf.deleteForward(env.getScreenWidth()));
                break;
              case "cut-to-start":
                await w.write(buf.cutToStart(env.getScreenWidth()));
                break;
              case "cut-to-end":
                await w.write(buf.cutToEnd(env.getScreenWidth()));
                break;
              case "cut-previous-word":
                await w.write(buf.cutPreviousWord(env.getScreenWidth()));
                break;
              case "cut-next-word":
                await w.write(buf.cutNextWord(env.getScreenWidth()));
                break;
              case "move-to-start":
                await w.write(buf.moveToStart(env.getScreenWidth()));
                break;
              case "move-to-end":
                await w.write(buf.moveToEnd(env.getScreenWidth()));
                break;
              case "move-backward":
                await w.write(buf.moveBackward(env.getScreenWidth()));
                break;
              case "move-forward":
                await w.write(buf.moveForward(env.getScreenWidth()));
                break;
              case "move-backward-word":
                await w.write(buf.moveBackwardWord(env.getScreenWidth()));
                break;
              case "move-forward-word":
                await w.write(buf.moveForwardWord(env.getScreenWidth()));
                break;
              case "clear-screen":
                await w.write(buf.clearScreen(env.getScreenWidth()));
                break;
              case "clear-display":
                await w.write(buf.clearDisplay(env.getScreenWidth()));
                break;
              case "next-history":
                await w.write(buf.nextHistory(env.getScreenWidth()));
                break;
              case "previous-history":
                await w.write(buf.previousHistory(env.getScreenWidth()));
                break;
              case "quoted-insert":
                quotedInsert = true;
                break;
              case "bracketed-paste-begin":
                pasteBuffer = "";
                break;
              default:
                command satisfies null;
            }
          }
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
