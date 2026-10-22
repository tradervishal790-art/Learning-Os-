// Renders a validated Mentor card program (OpenUI Lang). Loaded lazily from Mentor.tsx so the
// renderer stays out of every other screen's bundle.
import { Component, type ReactNode } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { useTranslation } from '../i18n/LanguageContext';
import { mentorLibrary } from './library';

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function MentorCards({ program }: { program: string }) {
  const t = useTranslation();
  return (
    <Boundary fallback={<div className="text-sm opacity-70">{t.mentor.cards.renderFailed}</div>}>
      <Renderer response={program} library={mentorLibrary} isStreaming={false} />
    </Boundary>
  );
}
