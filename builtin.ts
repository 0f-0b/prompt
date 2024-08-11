import type { Command } from "./command.ts";
import { insertChar } from "./insert_char.ts";

// deno-lint-ignore require-await
export const commit: Command = async () => "commit";
// deno-lint-ignore require-await
export const abort: Command = async () => "abort";
export const insert: Command = async (ctx) => {
  insertChar(ctx, ctx.lastChar);
  await ctx.redraw();
  return "continue";
};
export const deleteBackward: Command = async (ctx) => {
  ctx.buffer.deleteBackward();
  await ctx.redraw();
  return "continue";
};
export const deleteForward: Command = async (ctx) => {
  ctx.buffer.deleteForward();
  await ctx.redraw();
  return "continue";
};
export const deleteForwardOrCancel: Command = async (ctx) => {
  if (ctx.buffer.state.text.length === 0) {
    return "cancel";
  }
  ctx.buffer.deleteForward();
  await ctx.redraw();
  return "continue";
};
export const cutToStart: Command = async (ctx) => {
  ctx.buffer.cutToStart();
  await ctx.redraw();
  return "continue";
};
export const cutToEnd: Command = async (ctx) => {
  ctx.buffer.cutToEnd();
  await ctx.redraw();
  return "continue";
};
export const cutPreviousWord: Command = async (ctx) => {
  ctx.buffer.cutPreviousWord();
  await ctx.redraw();
  return "continue";
};
export const cutNextWord: Command = async (ctx) => {
  ctx.buffer.cutNextWord();
  await ctx.redraw();
  return "continue";
};
export const moveToStart: Command = async (ctx) => {
  ctx.buffer.moveToStart();
  await ctx.redraw();
  return "continue";
};
export const moveToEnd: Command = async (ctx) => {
  ctx.buffer.moveToEnd();
  await ctx.redraw();
  return "continue";
};
export const moveBackward: Command = async (ctx) => {
  ctx.buffer.moveBackward();
  await ctx.redraw();
  return "continue";
};
export const moveForward: Command = async (ctx) => {
  ctx.buffer.moveForward();
  await ctx.redraw();
  return "continue";
};
export const moveBackwardWord: Command = async (ctx) => {
  ctx.buffer.moveBackwardWord();
  await ctx.redraw();
  return "continue";
};
export const moveForwardWord: Command = async (ctx) => {
  ctx.buffer.moveForwardWord();
  await ctx.redraw();
  return "continue";
};
export const clearScreen: Command = async (ctx) => {
  await ctx.draw("\x1b[H");
  return "continue";
};
export const clearDisplay: Command = async (ctx) => {
  await ctx.draw("\x1b[H\x1b[3J");
  return "continue";
};
export const nextHistory: Command = async (ctx) => {
  ctx.buffer.nextHistory();
  await ctx.redraw();
  return "continue";
};
export const previousHistory: Command = async (ctx) => {
  ctx.buffer.previousHistory();
  await ctx.redraw();
  return "continue";
};
export const undo: Command = async (ctx) => {
  ctx.buffer.restoreState();
  await ctx.redraw();
  return "continue";
};
export const quotedInsert: Command = async (ctx) => {
  const c = await ctx.reader.readCodePoint();
  if (c === null) {
    return "cancel";
  }
  insertChar(ctx, c);
  await ctx.redraw();
  return "continue";
};
export const bracketedPasteBegin: Command = async (ctx) => {
  let text = "";
  for (;;) {
    const c = await ctx.reader.readCodePoint();
    if (c === null) {
      return "cancel";
    }
    text += c;
    if (text.endsWith("\x1b[201~")) {
      text = text.slice(0, -"\x1b[201~".length);
      break;
    }
  }
  ctx.buffer.saveState();
  ctx.buffer.insertText(text);
  await ctx.redraw();
  return "continue";
};
