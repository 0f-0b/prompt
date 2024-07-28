const toEscapeRE = /[\p{Cc}--\n]/gv;

export function escapeControlCharacters(text: string, styled: boolean): string {
  return text.replace(toEscapeRE, (c) => {
    const cp = c.codePointAt(0)!;
    const str = cp < 0x80
      ? "^" + String.fromCharCode(cp ^ 0x40)
      : "\\" + cp.toString(8);
    return styled ? `\x1b[7m${str}\x1b[m` : str;
  });
}
