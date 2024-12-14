export interface Decorator {
  decorate(text: string, start: number, end: number): string;
}

const toEscapeRE = /[\p{Cc}--\n]+/gv;

export class ControlCharsDecorator implements Decorator {
  decorate(text: string, start: number, end: number): string {
    return text.substring(start, end).replace(toEscapeRE, (s) => {
      let escaped = "";
      for (let i = 0, len = s.length; i < len; i++) {
        const c = s.charCodeAt(i)!;
        escaped += c < 0x80
          ? "^" + String.fromCharCode(c ^ 0x40)
          : "\\" + c.toString(8);
      }
      return `\x1b[7m${escaped}\x1b[m`;
    });
  }
}
