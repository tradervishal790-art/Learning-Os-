// ============================================================
// mathSolve.ts — solve simple handwritten sums on the device (no AI, no internet).
// "2 + 2 =" -> "2 + 2 = 4". Supports + - x × * / ÷ ^ ( ) decimals, %, sqrt().
// A hand-written parser (no eval): anything it does not understand is left alone.
// ============================================================

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'fn' };

function tokenize(src: string): Tok[] | null {
  const s = src.replace(/[−–—]/g, '-').replace(/[×✕·]/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').replace(/,/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) return null;
      out.push({ t: 'num', v });
      i = j;
      continue;
    }
    if (s.startsWith('sqrt', i)) { out.push({ t: 'fn' }); i += 4; continue; }
    // "3 x 4": a lone x / X between numbers is a times sign
    if ((c === 'x' || c === 'X') && out.length > 0) { out.push({ t: 'op', v: '*' }); i++; continue; }
    if ('+-*/^()%'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    return null;
  }
  return out;
}

/** Evaluate an expression; null when it is not clean arithmetic. */
export function evalMath(src: string): number | null {
  const toks = tokenize(src);
  if (!toks || toks.length === 0) return null;
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v;

  const expr = (): number => {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[p++] as { v: string }).v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const term = (): number => {
    let v = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (toks[p++] as { v: string }).v;
        const r = unary();
        if (op === '/' && r === 0) throw new Error('div0');
        v = op === '*' ? v * r : v / r;
      } else if (peek() && (peek()!.t === 'fn' || isOp('('))) {
        v *= unary(); // 2(3+4) and 2 sqrt(9)
      } else return v;
    }
  };
  const unary = (): number => {
    if (isOp('-')) { p++; return -unary(); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  };
  const power = (): number => {
    const base = postfix();
    if (isOp('^')) { p++; return Math.pow(base, unary()); }
    return base;
  };
  const postfix = (): number => {
    let v = atom();
    while (isOp('%')) { p++; v /= 100; }
    return v;
  };
  const atom = (): number => {
    const k = toks[p++];
    if (!k) throw new Error('end');
    if (k.t === 'num') return k.v;
    if (k.t === 'fn') {
      if (!isOp('(')) throw new Error('fn');
      p++;
      const v = expr();
      if (!isOp(')')) throw new Error('paren');
      p++;
      if (v < 0) throw new Error('sqrt');
      return Math.sqrt(v);
    }
    if (k.v === '(') {
      const v = expr();
      if (!isOp(')')) throw new Error('paren');
      p++;
      return v;
    }
    throw new Error('atom');
  };

  try {
    const v = expr();
    if (p !== toks.length || !Number.isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}

export function formatAnswer(v: number): string {
  const r = Math.round(v * 1e6) / 1e6;
  return String(r);
}

/**
 * Go line by line: a line like "12 x 3 =" (or "12 x 3") that is pure arithmetic gets its answer.
 * Lines that already have an answer after "=" are checked and left as they are. Returns how many lines were solved.
 */
export function solveMathText(text: string): { text: string; solved: number } {
  let solved = 0;
  const lines = text.split('\n').map((line) => {
    const m = line.match(/^(\s*)(.*?)\s*=?\s*$/);
    if (!m) return line;
    const body = m[2];
    if (body.includes('=')) return line; // already has an answer
    if (!/[+\-*/^×÷xX%√]/.test(body) || !/[0-9]/.test(body)) return line;
    const v = evalMath(body);
    if (v === null) return line;
    solved++;
    return `${m[1]}${body} = ${formatAnswer(v)}`;
  });
  return { text: lines.join('\n'), solved };
}
