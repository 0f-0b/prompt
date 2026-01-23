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
  type Renderer,
  type TextBuffer,
  type TextBufferState,
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

export async function* prompt(
  getScreenWidth: () => number,
  options?: PromptOptions,
): AsyncGenerator<string, [PromptResult, string], string | null> {
  const prompt = options?.prompt ?? "> ";
  const history = options?.history ?? [];
  const commands = options?.commands ?? defaultCommands;
  const decorator = options?.decorator ?? defaultDecorator;
  const decoder = new CommandDecoder(commands);
  const buffer = new TextBuffer(history);
  const renderer = new Renderer(decorator, getScreenWidth);
  const jobs = new Jobs();
  const ctx = new CommandContext(buffer, renderer, prompt, jobs);
  let action: CommandResult;
  let output = "\x1b[?2004h\x1b[G" + ctx.draw();
  for (;;) {
    const c = yield output;
    output = "";
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
    [action, output] = yield* command(ctx);
    if (action !== "continue") {
      break;
    }
    for (const job of jobs.thisTick.values()) {
      await job(ctx);
    }
  }
  const { text } = buffer.state;
  buffer.replaceText(text.length, text.length, "\n");
  return [
    action === "cancel" ? { action } : { action, text },
    output + ctx.redraw() + "\x1b[?2004l",
  ];
}
