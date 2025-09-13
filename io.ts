const encoder = new TextEncoder();

export class TextReader {
  readonly #reader: ReadableStreamBYOBReader;
  readonly #decoder = new TextDecoder(undefined, { ignoreBOM: true });
  #buf = new Uint8Array(1);

  constructor(reader: ReadableStreamBYOBReader) {
    this.#reader = reader;
  }

  async readCodePoint(): Promise<string | null> {
    const reader = this.#reader;
    const decoder = this.#decoder;
    for (;;) {
      const { value, done } = await reader.read(this.#buf);
      if (done) {
        const c = decoder.decode();
        if (c) {
          return c;
        }
        return null;
      }
      const c = decoder.decode(this.#buf = value, { stream: true });
      if (c) {
        return c;
      }
    }
  }
}

export class TextWriter {
  readonly #writer: WritableStreamDefaultWriter<Uint8Array<ArrayBuffer>>;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array<ArrayBuffer>>) {
    this.#writer = writer;
  }

  async write(text: string): Promise<undefined> {
    await this.#writer.write(encoder.encode(text));
  }
}
