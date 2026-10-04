// Single source of truth for pulling a video ID out of any YouTube URL.
// Supports: watch?v=, youtu.be/, embed/, shorts/, live/, v/ (+ m./music. subdomains, extra params like &t= or ?si=)
const YT_ID_RE =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/;

export function extractYouTubeId(url: string): string | null {
  const m = url.trim().match(YT_ID_RE);
  return m ? m[1] : null;
}
