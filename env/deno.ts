import type { PromptEnvironment } from "./common.ts";

export class DenoPromptEnvironment implements PromptEnvironment {
  get readable(): ReadableStream<Uint8Array> {
    return Deno.stdin.readable;
  }

  get writable(): WritableStream<Uint8Array> {
    return Deno.stdout.writable;
  }

  setRawMode(enabled: boolean): undefined {
    Deno.stdin.setRaw(enabled);
  }

  getScreenWidth(): number {
    const { columns } = Deno.consoleSize();
    return columns;
  }
}
