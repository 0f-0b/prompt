import { TextBuffer, type TextBufferState } from "./buffer.ts";
import {
  abort,
  bracketedPasteBegin,
  clearDisplay,
  clearScreen,
  commit,
  cutNextWord,
  cutPreviousWord,
  cutToEnd,
  cutToStart,
  deleteBackward,
  deleteForward,
  deleteForwardOrCancel,
  moveBackward,
  moveBackwardWord,
  moveForward,
  moveForwardWord,
  moveToEnd,
  moveToStart,
  nextHistory,
  previousHistory,
  quotedInsert,
  undo,
} from "./builtin.ts";
import {
  type Command,
  CommandContext,
  CommandDecoder,
  type CommandResult,
  type CommandTree,
  DataField,
  type Job,
  Jobs,
} from "./command.ts";
import type { PromptEnvironment } from "./env/common.ts";
import { TextReader, TextWriter } from "./io.ts";
import { Renderer } from "./renderer.ts";

export {
  type Command,
  type CommandContext,
  type CommandResult,
  type CommandTree,
  DataField,
  type Job,
  type PromptEnvironment,
  type Renderer,
  type TextBuffer,
  type TextBufferState,
  type TextReader,
  type TextWriter,
};
export const defaultCommands: CommandTree = Object.freeze<CommandTree>({
  // @ts-expect-error Remove prototype
  __proto__: null,
  "\n" /* ^J */: commit,
  "\r" /* ^M */: commit,
  "\x03" /* ^C */: abort,
  "\b" /* ^H */: deleteBackward,
  "\x7f" /* ^? */: deleteBackward,
  "\x04" /* ^D */: deleteForwardOrCancel,
  "\x15" /* ^U */: cutToStart,
  "\v" /* ^K */: cutToEnd,
  "\x01" /* ^A */: moveToStart,
  "\x05" /* ^E */: moveToEnd,
  "\x02" /* ^B */: moveBackward,
  "\x06" /* ^F */: moveForward,
  "\f" /* ^L */: clearScreen,
  "\x0e" /* ^N */: nextHistory,
  "\x10" /* ^P */: previousHistory,
  "\x11" /* ^Q */: quotedInsert,
  "\x16" /* ^V */: quotedInsert,
  "\x1f" /* ^_ */: undo,
  "\x18" /* ^X */: Object.freeze<CommandTree>({
    // @ts-expect-error Remove prototype
    __proto__: null,
    "\x7f" /* ^? */: cutToStart,
    "\x15" /* ^U */: undo,
  }),
  "\x1b" /* ^[ */: Object.freeze<CommandTree>({
    // @ts-expect-error Remove prototype
    __proto__: null,
    "\b" /* ^H */: cutPreviousWord,
    "\x7f" /* ^? */: cutPreviousWord,
    "D": cutNextWord,
    "d": cutNextWord,
    "B": moveBackwardWord,
    "b": moveBackwardWord,
    "F": moveForwardWord,
    "f": moveForwardWord,
    "\f" /* ^L */: clearDisplay,
    "[": Object.freeze<CommandTree>({
      // @ts-expect-error Remove prototype
      __proto__: null,
      "H": moveToStart,
      "F": moveToEnd,
      "D": moveBackward,
      "C": moveForward,
      "B": nextHistory,
      "A": previousHistory,
      "1": Object.freeze<CommandTree>({
        // @ts-expect-error Remove prototype
        __proto__: null,
        ";": Object.freeze<CommandTree>({
          // @ts-expect-error Remove prototype
          __proto__: null,
          "3": Object.freeze<CommandTree>({
            // @ts-expect-error Remove prototype
            __proto__: null,
            "D": moveBackwardWord,
            "C": moveForwardWord,
          }),
          "5": Object.freeze<CommandTree>({
            // @ts-expect-error Remove prototype
            __proto__: null,
            "D": moveBackwardWord,
            "C": moveForwardWord,
          }),
        }),
      }),
      "2": Object.freeze<CommandTree>({
        "0": Object.freeze<CommandTree>({
          "0": Object.freeze<CommandTree>({
            "~": bracketedPasteBegin,
          }),
        }),
      }),
      "3": Object.freeze<CommandTree>({
        // @ts-expect-error Remove prototype
        __proto__: null,
        "~": deleteForward,
        ";": Object.freeze<CommandTree>({
          // @ts-expect-error Remove prototype
          __proto__: null,
          "5": Object.freeze<CommandTree>({
            // @ts-expect-error Remove prototype
            __proto__: null,
            "~": cutNextWord,
          }),
        }),
      }),
    }),
    "O": Object.freeze<CommandTree>({
      // @ts-expect-error Remove prototype
      __proto__: null,
      "H": moveToStart,
      "F": moveToEnd,
      "D": moveBackward,
      "C": moveForward,
      "B": nextHistory,
      "A": previousHistory,
    }),
  }),
});

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
  const byteReader = env.readable.getReader({ mode: "byob" });
  try {
    const byteWriter = env.writable.getWriter();
    try {
      env.setRawMode(true);
      try {
        const reader = new TextReader(byteReader);
        const writer = new TextWriter(byteWriter);
        await writer.write("\x1b[?2004h");
        try {
          const decoder = new CommandDecoder(commands);
          const buffer = new TextBuffer(prompt, history);
          const renderer = new Renderer(env);
          const jobs = new Jobs();
          const ctx = new CommandContext(
            reader,
            writer,
            buffer,
            renderer,
            jobs,
          );
          await ctx.draw("\x1b[G");
          let action: PromptResult["action"];
          for (;;) {
            const c = await reader.readCodePoint();
            if (c === null) {
              action = "cancel";
              break;
            }
            ctx.lastChar = c;
            const command = decoder.next(c);
            if (command === null) {
              continue;
            }
            jobs.thisTick = jobs.nextTick;
            jobs.nextTick = new Map();
            const result = await command(ctx);
            if (result !== "continue") {
              action = result;
              break;
            }
            for (const job of jobs.thisTick.values()) {
              await job(ctx);
            }
          }
          const { text } = buffer.state;
          buffer.replaceText(text.length, text.length, "\n");
          await ctx.redraw();
          return action === "cancel" ? { action } : { action, text };
        } finally {
          await writer.write("\x1b[?2004l");
        }
      } finally {
        env.setRawMode(false);
      }
    } finally {
      byteWriter.releaseLock();
    }
  } finally {
    byteReader.releaseLock();
  }
}
