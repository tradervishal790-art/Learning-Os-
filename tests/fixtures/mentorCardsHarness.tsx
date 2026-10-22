// Test-only entry: renders MentorCards to an HTML string inside the real LanguageProvider.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import MentorCards from '../../src/mentorUi/MentorCards';

export function renderCards(program: string): string {
  return renderToString(createElement(LanguageProvider, null, createElement(MentorCards, { program })));
}
