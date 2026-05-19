// Fixed-size ASCII grid, now painted to a DOM <pre> instead of Canvas (the
// game render layer is Solid/CSS — DESIGN.md §11). Scenes are unchanged: they
// only use cols/rows/clear/put/text/textCentered. toHTML() batches runs of
// same-styled cells into coloured <span>s; the Solid Game sets it each frame.
// Color stays a packed 0xRRGGBB number so equal styles are === for batching.

export type Color = number;

export const rgb = (r: number, g: number, b: number): Color =>
  ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);

export const Palette = {
  bg: rgb(5, 6, 10),
  dim: rgb(90, 96, 110),
  text: rgb(206, 212, 222),
  ember: rgb(255, 138, 60),
  emberDim: rgb(150, 78, 36),
  mirror: rgb(96, 220, 150),
  native: rgb(120, 170, 255),
  warn: rgb(240, 180, 70),
  danger: rgb(232, 86, 86),
} as const;

// The apprentice's sigil — ONE definition, used by every scene that draws the
// character (the camp, the route map's current node, the local map's avatar),
// so it is always identical. ô / Ô is the camp walk-cycle (matches ludus
// CampMap); scenes pick the frame, or PLAYER.ch for a single-frame marker.
export const PLAYER_SPRITE = ["ô", "Ô"] as const;
export const PLAYER = { ch: PLAYER_SPRITE[1], col: Palette.ember } as const;

// The bonded Cinder, a small ember that trails one step behind the apprentice
// (the "dotted @" — an @ that pulses down to a dot and back). One shared
// definition so it animates the same in the camp and the cave.
export const CINDER_FOLLOW = ["@", "◦", "·", "˚"] as const;
export const CINDER_COL = Palette.ember;

interface Cell {
  ch: string;
  fg: Color;
  bg: Color;
}

function hex(c: Color): string {
  return "#" + (c & 0xffffff).toString(16).padStart(6, "0");
}

function esc(ch: string): string {
  if (ch === "&") return "&amp;";
  if (ch === "<") return "&lt;";
  if (ch === ">") return "&gt;";
  return ch;
}

export class Screen {
  cols: number;
  rows: number;
  _cells: Cell[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this._cells = new Array(cols * rows);
    for (let i = 0; i < this._cells.length; i++) {
      this._cells[i] = { ch: " ", fg: Palette.text, bg: Palette.bg };
    }
  }

  clear(bg: Color = Palette.bg): void {
    for (let i = 0; i < this._cells.length; i++) {
      const c = this._cells[i];
      c.ch = " ";
      c.fg = Palette.text;
      c.bg = bg;
    }
  }

  put(x: number, y: number, ch: string, fg: Color = Palette.text, bg: Color = Palette.bg): void {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const c = this._cells[y * this.cols + x];
    c.ch = ch;
    c.fg = fg;
    c.bg = bg;
  }

  text(x: number, y: number, s: string, fg: Color = Palette.text, bg: Color = Palette.bg): void {
    for (let i = 0; i < s.length; i++) this.put(x + i, y, s[i], fg, bg);
  }

  // Center a string on row y across the full width.
  textCentered(y: number, s: string, fg: Color = Palette.text, bg: Color = Palette.bg): void {
    this.text(Math.max(0, Math.floor((this.cols - s.length) / 2)), y, s, fg, bg);
  }

  // Row-major HTML: consecutive cells sharing (fg,bg) collapse into one span.
  toHTML(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.rows; y++) {
      let line = "";
      let runFg = -1;
      let runBg = -1;
      let runTxt = "";
      const flush = () => {
        if (runTxt === "") return;
        const bgPart = runBg === Palette.bg ? "" : `;background:${hex(runBg)}`;
        line += `<span style="color:${hex(runFg)}${bgPart}">${runTxt}</span>`;
        runTxt = "";
      };
      for (let x = 0; x < this.cols; x++) {
        const c = this._cells[y * this.cols + x];
        if (c.fg !== runFg || c.bg !== runBg) {
          flush();
          runFg = c.fg;
          runBg = c.bg;
        }
        runTxt += esc(c.ch);
      }
      flush();
      lines.push(line);
    }
    return lines.join("\n");
  }
}
