import type { CSSProperties, ReactNode } from 'react';

const greek: Record<string, string> = {
  alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', theta:'θ', lambda:'λ',
  mu:'μ', pi:'π', rho:'ρ', sigma:'σ', phi:'φ', omega:'ω', Delta:'Δ', Lambda:'Λ',
  Gamma:'Γ', Theta:'Θ', Sigma:'Σ', Phi:'Φ', Omega:'Ω',
};
const symbols: Record<string, string> = {
  times:'×', cdot:'·', div:'÷', pm:'±', mp:'∓', leq:'≤', geq:'≥', neq:'≠',
  approx:'≈', infty:'∞', to:'→', rightarrow:'→', leftarrow:'←', degree:'°',
  partial:'∂', nabla:'∇', sum:'∑', int:'∫', propto:'∝', sim:'∼',
};

type Token = { node: ReactNode; text: string };
function parseLatex(source: string): ReactNode[] {
  let i = 0;
  const readGroup = (): ReactNode => {
    if (source[i] !== '{') return readAtom();
    i++;
    const children = readSequence('}');
    if (source[i] === '}') i++;
    return <mrow>{children}</mrow>;
  };
  const readAtom = (): ReactNode => {
    if (source[i] === '{') return readGroup();
    if (source[i] === '\\') {
      i++;
      const match = source.slice(i).match(/^[a-zA-Z]+|^./);
      const command = match?.[0] ?? '';
      i += command.length;
      if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
        const numerator = readGroup();
        const denominator = readGroup();
        return <mfrac><mrow>{numerator}</mrow><mrow>{denominator}</mrow></mfrac>;
      }
      if (command === 'sqrt') return <msqrt><mrow>{readGroup()}</mrow></msqrt>;
      if (command === 'text' || command === 'mathrm' || command === 'mathbf' || command === 'operatorname') {
        const value = readGroup();
        return <mtext>{value}</mtext>;
      }
      if (command === 'left' || command === 'right' || command === 'displaystyle' || command === 'limits') return null;
      if (command in greek) return <mi>{greek[command]}</mi>;
      if (command in symbols) return <mo>{symbols[command]}</mo>;
      if (command === ',' || command === ';' || command === ':' || command === '!') return <mspace width="0.2em" />;
      if (command === 'quad') return <mspace width="1em" />;
      if (command === 'qquad') return <mspace width="2em" />;
      if (command === '{' || command === '}' || command === '%') return <mo>{command}</mo>;
      return <mi>{command}</mi>;
    }
    const char = source[i++] ?? '';
    if (/\d/.test(char)) {
      let digits = char;
      while (i < source.length && /[\d.]/.test(source[i])) digits += source[i++];
      return <mn>{digits}</mn>;
    }
    if (/[a-zA-Z]/.test(char)) return <mi>{char}</mi>;
    if (/\s/.test(char)) return <mspace width="0.25em" />;
    return <mo>{char}</mo>;
  };
  const readSequence = (stop?: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    while (i < source.length && source[i] !== stop) {
      let base = readAtom();
      let sub: ReactNode | null = null;
      let sup: ReactNode | null = null;
      while (source[i] === '_' || source[i] === '^') {
        const marker = source[i++];
        const value = readGroup();
        if (marker === '_') sub = value;
        else sup = value;
      }
      if (sub && sup) base = <msubsup><mrow>{base}</mrow><mrow>{sub}</mrow><mrow>{sup}</mrow></msubsup>;
      else if (sub) base = <msub><mrow>{base}</mrow><mrow>{sub}</mrow></msub>;
      else if (sup) base = <msup><mrow>{base}</mrow><mrow>{sup}</mrow></msup>;
      nodes.push(base);
    }
    return nodes;
  };
  return readSequence();
}

function renderMixed(text: string): ReactNode[] {
  // Preserve ordinary prose while typesetting TeX commands and delimited math.
  const parts: ReactNode[] = [];
  const pattern = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$[^$]+\$|\\(?:frac|dfrac|tfrac|sqrt|text|mathrm|mathbf|operatorname)\s*\{(?:[^{}]|\{[^{}]*\})*\}(?:\s*\{(?:[^{}]|\{[^{}]*\})*\})?|\\(?:[a-zA-Z]+|.)[\w{}^_]*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0];
    const expression = raw.startsWith('\\(') ? raw.slice(2, -2) : raw.startsWith('\\[') ? raw.slice(2, -2) : raw.startsWith('$') ? raw.slice(1, -1) : raw;
    parts.push(<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"><mrow>{parseLatex(expression)}</mrow></math>);
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export default function MathText({ children, className = '' }: { children: string; className?: string }) {
  return <span className={className} style={{ overflowWrap: 'anywhere' } as CSSProperties}>{renderMixed(children)}</span>;
}
