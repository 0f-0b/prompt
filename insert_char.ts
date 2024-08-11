import { type CommandContext, DataField } from "./command.ts";

const charsUntilSaveState = new DataField<number>(0);
const resetCharCounterJob = Symbol("resetCharCounterJob");

export function insertChar(ctx: CommandContext, c: string): undefined {
  if (ctx.get(charsUntilSaveState) === 0) {
    ctx.buffer.saveState();
    ctx.set(charsUntilSaveState, 20);
  }
  ctx.buffer.insertText(c);
  ctx.update(charsUntilSaveState, (x) => x - 1);
  ctx.nextTick(resetCharCounterJob, (ctx) => ctx.set(charsUntilSaveState, 0));
}
