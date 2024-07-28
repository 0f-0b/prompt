export interface PromptEnvironment {
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
  setRawMode(raw: boolean): undefined;
  getScreenWidth(): number;
}
