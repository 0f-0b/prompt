// deno-lint-ignore-file require-yield
import type { Command } from "./command.ts";
import { insertChar } from "./insert_char.ts";

export const commit: Command = async function* () {
  return ["commit", ""];
};
export const abort: Command = async function* () {
  return ["abort", ""];
};
export const insert: Command = async function* (ctx) {
  insertChar(ctx, ctx.lastChar);
  return ["continue", ctx.redraw()];
};
export const deleteBackward: Command = async function* (ctx) {
  ctx.buffer.deleteBackward();
  return ["continue", ctx.redraw()];
};
export const deleteForward: Command = async function* (ctx) {
  ctx.buffer.deleteForward();
  return ["continue", ctx.redraw()];
};
export const deleteForwardOrCancel: Command = async function* (ctx) {
  if (ctx.buffer.state.text.length === 0) {
    return ["cancel", ""];
  }
  ctx.buffer.deleteForward();
  return ["continue", ctx.redraw()];
};
export const cutToStart: Command = async function* (ctx) {
  ctx.buffer.cutToStart();
  return ["continue", ctx.redraw()];
};
export const cutToEnd: Command = async function* (ctx) {
  ctx.buffer.cutToEnd();
  return ["continue", ctx.redraw()];
};
export const cutPreviousWord: Command = async function* (ctx) {
  ctx.buffer.cutPreviousWord();
  return ["continue", ctx.redraw()];
};
export const cutNextWord: Command = async function* (ctx) {
  ctx.buffer.cutNextWord();
  return ["continue", ctx.redraw()];
};
export const moveToStart: Command = async function* (ctx) {
  ctx.buffer.moveToStart();
  return ["continue", ctx.redraw()];
};
export const moveToEnd: Command = async function* (ctx) {
  ctx.buffer.moveToEnd();
  return ["continue", ctx.redraw()];
};
export const moveBackward: Command = async function* (ctx) {
  ctx.buffer.moveBackward();
  return ["continue", ctx.redraw()];
};
export const moveForward: Command = async function* (ctx) {
  ctx.buffer.moveForward();
  return ["continue", ctx.redraw()];
};
export const moveBackwardWord: Command = async function* (ctx) {
  ctx.buffer.moveBackwardWord();
  return ["continue", ctx.redraw()];
};
export const moveForwardWord: Command = async function* (ctx) {
  ctx.buffer.moveForwardWord();
  return ["continue", ctx.redraw()];
};
export const clearScreen: Command = async function* (ctx) {
  return ["continue", "\x1b[H" + ctx.draw()];
};
export const clearDisplay: Command = async function* (ctx) {
  return ["continue", "\x1b[H\x1b[3J" + ctx.draw()];
};
export const nextHistory: Command = async function* (ctx) {
  ctx.buffer.nextHistory();
  return ["continue", ctx.redraw()];
};
export const previousHistory: Command = async function* (ctx) {
  ctx.buffer.previousHistory();
  return ["continue", ctx.redraw()];
};
export const undo: Command = async function* (ctx) {
  ctx.buffer.restoreState();
  return ["continue", ctx.redraw()];
};
export const quotedInsert: Command = async function* (ctx) {
  const c = yield "";
  if (c === null) {
    return ["cancel", ""];
  }
  insertChar(ctx, c);
  return ["continue", ctx.redraw()];
};
export const bracketedPasteBegin: Command = async function* (ctx) {
  let text = "";
  for (;;) {
    const c = yield "";
    if (c === null) {
      return ["cancel", ""];
    }
    text += c === "\r" ? "\n" : c;
    if (text.endsWith("\x1b[201~")) {
      text = text.slice(0, -"\x1b[201~".length);
      break;
    }
  }
  ctx.buffer.saveState();
  ctx.buffer.insertText(text);
  return ["continue", ctx.redraw()];
};
