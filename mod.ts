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
  buildCommandTree,
  type Command,
  CommandContext,
  CommandDecoder,
  type CommandResult,
  type CommandTree,
  DataField,
  type Job,
  Jobs,
} from "./command.ts";
import { ControlCharsDecorator, type Decorator } from "./decorator.ts";
import type { PromptEnvironment } from "./env/common.ts";
import { TextReader, TextWriter } from "./io.ts";
import { Renderer } from "./renderer.ts";

export {
  buildCommandTree,
  type Command,
  type CommandContext,
  type CommandResult,
  type CommandTree,
  DataField,
  type Decorator,
  type Job,
  type PromptEnvironment,
  type Renderer,
  type TextBuffer,
  type TextBufferState,
  type TextReader,
  type TextWriter,
};
export const defaultCommands: CommandTree = buildCommandTree({
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
  "\x18" /* ^X */: {
    "\x7f" /* ^? */: cutToStart,
    "\x15" /* ^U */: undo,
  },
  "\x1b" /* ^[ */: {
    "\b" /* ^H */: cutPreviousWord,
    "\x7f" /* ^? */: cutPreviousWord,
    "D": cutNextWord,
    "d": cutNextWord,
    "B": moveBackwardWord,
    "b": moveBackwardWord,
    "F": moveForwardWord,
    "f": moveForwardWord,
    "\f" /* ^L */: clearDisplay,
    "[": {
      "H": moveToStart,
      "F": moveToEnd,
      "D": moveBackward,
      "C": moveForward,
      "B": nextHistory,
      "A": previousHistory,
      "1": {
        ";": {
          "3": {
            "D": moveBackwardWord,
            "C": moveForwardWord,
          },
          "5": {
            "D": moveBackwardWord,
            "C": moveForwardWord,
          },
        },
      },
      "2": {
        "0": {
          "0": {
            "~": bracketedPasteBegin,
          },
        },
      },
      "3": {
        "~": deleteForward,
        ";": {
          "5": {
            "~": cutNextWord,
          },
        },
      },
    },
    "O": {
      "H": moveToStart,
      "F": moveToEnd,
      "D": moveBackward,
      "C": moveForward,
      "B": nextHistory,
      "A": previousHistory,
    },
  },
});
export const defaultDecorator: Decorator = new ControlCharsDecorator();

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
  decorator?: Decorator | undefined;
}

export async function prompt(
  env: PromptEnvironment,
  options?: PromptOptions,
): Promise<PromptResult> {
  const prompt = options?.prompt ?? "> ";
  const history = options?.history ?? [];
  const commands = options?.commands ?? defaultCommands;
  const decorator = options?.decorator ?? defaultDecorator;
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
          const buffer = new TextBuffer(history);
          const renderer = new Renderer(env, decorator);
          const jobs = new Jobs();
          const ctx = new CommandContext(
            reader,
            writer,
            buffer,
            renderer,
            prompt,
            jobs,
          );
          await ctx.draw("\x1b[G" + ctx.prompt);
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
