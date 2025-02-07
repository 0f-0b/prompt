export interface PromptEnvironment {
  readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
  readonly writable: WritableStream<Uint8Array<ArrayBuffer>>;
  setRawMode(raw: boolean): undefined;
  getScreenWidth(): number;
}
