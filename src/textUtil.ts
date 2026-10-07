/** YouTube returns titles HTML-escaped (&quot; &#39; &amp; ...). Decode for display. */
export function decodeHtml(s: string): string {
  if (!s || !s.includes('&')) return s;
  const t = document.createElement('textarea'); // textarea decoding never runs scripts
  t.innerHTML = s;
  return t.value;
}
