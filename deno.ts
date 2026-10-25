import {
  prompt as impl,
  type PromptOptions,
  type PromptResult,
} from "./mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder(undefined, { ignoreBOM: true });
const buf = new Uint8Array(1);

export function readChar(): string | null {
  for (;;) {
    if (!Deno.stdin.readSync(buf)) {
      const c = decoder.decode();
      if (c) {
        return c;
      }
      return null;
    }
    const c = decoder.decode(buf, { stream: true });
    if (c) {
      return c;
    }
  }
}

export function writeString(str: string): undefined {
  let buf = encoder.encode(str);
  while (buf.length !== 0) {
    buf = buf.subarray(Deno.stdout.writeSync(buf));
  }
}

export function getScreenWidth(): number {
  const { columns } = Deno.consoleSize();
  return columns;
}

export async function prompt(options?: PromptOptions): Promise<PromptResult> {
  Deno.stdin.setRaw(true);
  try {
    const gen = impl(getScreenWidth, options);
    let it = await gen.next();
    while (!it.done) {
      const output = it.value;
      writeString(output);
      it = await gen.next(readChar());
    }
    const [result, output] = it.value;
    writeString(output);
    return result;
  } finally {
    Deno.stdin.setRaw(false);
  }
}
