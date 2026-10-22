// Test-only entry: renders MentorText to an HTML string.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import MentorText from '../../src/MentorText';

export function renderMentorText(text: string): string {
  return renderToString(createElement(MentorText, { text }));
}
