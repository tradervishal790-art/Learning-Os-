// Renders mentor replies: **bold**, *italic*, # headings, - / * bullets, 1. lists.
// Small on purpose (same subset as Notes) — no markdown dependency.
import type { ReactNode } from 'react';

function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={`${key}-${i}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`${key}-${i}`}>{part}</span>;
  });
}

export default function MentorText({ text }: { text: string }) {
  const lines = text.replace(/\\n/g, '\n').split('\n');
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-2" />;
        const heading = t.match(/^#{1,6}\s+(.*)$/);
        if (heading) return <div key={i} className="font-bold mt-1">{inline(heading[1], `h${i}`)}</div>;
        const bullet = t.match(/^[-*•]\s+(.*)$/);
        if (bullet) {
          const nested = line.length - line.trimStart().length >= 2;
          return (
            <div key={i} className={`flex gap-2 ${nested ? 'ml-5' : 'ml-1'}`}>
              <span aria-hidden="true">•</span>
              <span>{inline(bullet[1], `b${i}`)}</span>
            </div>
          );
        }
        const num = t.match(/^(\d+)[.)]\s+(.*)$/);
        if (num) {
          return (
            <div key={i} className="flex gap-2 ml-1">
              <span aria-hidden="true">{num[1]}.</span>
              <span>{inline(num[2], `n${i}`)}</span>
            </div>
          );
        }
        return <div key={i}>{inline(t, `p${i}`)}</div>;
      })}
    </div>
  );
}
