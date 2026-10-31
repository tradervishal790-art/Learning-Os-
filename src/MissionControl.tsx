import { ArrowUpRight, BrainCircuit, BookOpenCheck, Compass, GraduationCap, RotateCcw, Sparkles, Target, Zap } from 'lucide-react';
import type { DashboardPageId } from './types';

interface MissionControlProps {
  name: string;
  goalTitle: string;
  nextTopic: string | null;
  nextTopicDetail: string;
  hasLearningProfile: boolean;
  revisionDue: number;
  revisionOverdue: number;
  streak: number;
  activeGoals: number;
  onNavigate: (page: DashboardPageId) => void;
  onOpenProfile: () => void;
}

const engines: {
  number: string;
  title: string;
  description: string;
  action: string;
  page: DashboardPageId | null;
  icon: typeof BrainCircuit;
  accent: string;
  glow: string;
}[] = [
  { number: '01', title: 'Know me', description: 'Your learning profile', action: 'Explore profile', page: null, icon: BrainCircuit, accent: 'text-violet-300', glow: 'bg-violet-400/15' },
  { number: '02', title: 'Plan', description: 'A clear path to your goal', action: 'Open roadmap', page: 'roadmap', icon: Compass, accent: 'text-cyan-300', glow: 'bg-cyan-400/15' },
  { number: '03', title: 'Learn', description: 'Videos, notes and mentor', action: 'Start learning', page: 'videos', icon: GraduationCap, accent: 'text-sky-300', glow: 'bg-sky-400/15' },
  { number: '04', title: 'Retain', description: 'Recall what you learned', action: 'Review topics', page: 'revision', icon: RotateCcw, accent: 'text-emerald-300', glow: 'bg-emerald-400/15' },
  { number: '05', title: 'Prove', description: 'Test your understanding', action: 'Take a test', page: 'test', icon: Target, accent: 'text-fuchsia-300', glow: 'bg-fuchsia-400/15' },
];

export default function MissionControl({
  name,
  goalTitle,
  nextTopic,
  nextTopicDetail,
  hasLearningProfile,
  revisionDue,
  revisionOverdue,
  streak,
  activeGoals,
  onNavigate,
  onOpenProfile,
}: MissionControlProps) {
  const nextPage: DashboardPageId = revisionOverdue + revisionDue > 0 ? 'revision' : nextTopic ? 'videos' : 'roadmap';
  const nextAction = revisionOverdue + revisionDue > 0
    ? 'Continue revision'
    : nextTopic
      ? 'Continue learning'
      : 'Build my learning path';

  return (
    <main className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 text-slate-100 md:gap-6 md:px-7 md:py-7">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="absolute -left-32 -top-36 h-[430px] w-[430px] rounded-full bg-violet-600/[0.10] blur-[110px]" />
        <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-cyan-500/[0.08] blur-[110px]" />
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.9)]" />
            Your personal learning system
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Welcome back, {name}</h1>
          <p className="mt-1.5 text-sm text-slate-400">One connected path. From curiosity to capability.</p>
        </div>
        <div className="min-w-[190px] rounded-2xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 backdrop-blur">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Current focus</div>
          <div className="mt-1 max-w-[240px] truncate text-sm font-semibold text-slate-100">{goalTitle || 'Choose your next skill'}</div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="relative overflow-hidden rounded-[26px] border border-white/[0.09] bg-[#0b1120]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] md:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Your learning journey</div>
              <p className="mt-1 text-sm text-slate-500">Five engines working as one system</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-medium text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Adaptive workspace
            </div>
          </div>

          <div className="relative mt-7">
            <div aria-hidden="true" className="absolute left-[9%] right-[9%] top-[31px] hidden h-px bg-gradient-to-r from-violet-400/50 via-cyan-300/60 to-fuchsia-400/50 xl:block" />
            <div aria-hidden="true" className="absolute left-[25px] top-8 bottom-8 w-px bg-gradient-to-b from-violet-400/50 via-cyan-300/60 to-fuchsia-400/50 xl:hidden" />
            <div className="grid gap-3 xl:grid-cols-5">
              {engines.map((engine, index) => {
                const Icon = engine.icon;
                return (
                  <button
                    key={engine.number}
                    type="button"
                    onClick={() => engine.page ? onNavigate(engine.page) : onOpenProfile()}
                    className="group relative flex min-h-[112px] items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#111a2b]/90 p-4 text-left transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-[#172338] hover:shadow-[0_12px_32px_rgba(0,0,0,.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 xl:min-h-[190px] xl:flex-col xl:items-start xl:justify-between xl:gap-5 xl:p-4"
                  >
                    <span className="absolute left-[19px] top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#0b1120] bg-slate-500 xl:left-1/2 xl:top-[25px] xl:-translate-x-1/2 xl:translate-y-0" style={{ backgroundColor: index === 0 ? '#a78bfa' : index === 1 ? '#67e8f9' : index === 2 ? '#7dd3fc' : index === 3 ? '#6ee7b7' : '#e879f9' }} />
                    <div className={`ml-5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/[0.07] ${engine.glow} xl:ml-0`}>
                      <Icon className={`h-5 w-5 ${engine.accent}`} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0 flex-1 xl:w-full xl:flex-none">
                      <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">{engine.number}</div>
                      <div className="mt-1 text-base font-semibold text-white">{engine.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{engine.description}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white xl:self-end" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> Understand</span>
            <span className="text-slate-700">→</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Plan and learn</span>
            <span className="text-slate-700">→</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Retain and prove</span>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[26px] border border-white/[0.09] bg-[#0b1120]/95 p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-300">Learning snapshot</div>
              <Zap className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="text-2xl font-semibold tabular-nums text-white">{streak}</div>
                <div className="mt-1 text-[10px] text-slate-500">Day streak</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="text-2xl font-semibold tabular-nums text-white">{activeGoals}</div>
                <div className="mt-1 text-[10px] text-slate-500">Active goals</div>
              </div>
              <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-2xl font-semibold tabular-nums text-white">{revisionDue + revisionOverdue}</div>
                    <div className="mt-1 text-[10px] text-slate-500">Topics ready for recall</div>
                  </div>
                  <button type="button" onClick={() => onNavigate('revision')} className="text-[11px] font-semibold text-emerald-300 transition hover:text-emerald-200">Review now ↗</button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-violet-300/15 bg-gradient-to-br from-violet-500/[0.12] via-[#111426] to-cyan-500/[0.07] p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-200"><BrainCircuit className="h-4 w-4" /> Know your mind</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {hasLearningProfile ? 'Your learner profile is ready. Use it to understand your learning preferences.' : 'Build your learner profile to make your learning experience more personal.'}
            </p>
            <button type="button" onClick={onOpenProfile} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white transition hover:text-cyan-200">
              {hasLearningProfile ? 'View my profile' : 'Create my profile'} <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </aside>
      </section>

      <section className="relative overflow-hidden rounded-[24px] border border-cyan-300/15 bg-gradient-to-r from-[#102333] via-[#111a2b] to-[#17152b] p-5 md:flex md:items-center md:justify-between md:gap-6 md:px-7">
        <div className="absolute -right-10 -top-20 h-48 w-48 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="relative min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Your next best step</div>
          <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">
            {revisionOverdue > 0
              ? `Bring back ${revisionOverdue} overdue ${revisionOverdue === 1 ? 'topic' : 'topics'}`
              : revisionDue > 0
                ? `${revisionDue} ${revisionDue === 1 ? 'topic needs' : 'topics need'} a quick recall`
                : nextTopic
                  ? `Continue with ${nextTopic}`
                  : 'Turn your goal into a learning path'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-400">{revisionOverdue + revisionDue > 0 ? 'A short recall session can strengthen what you already learned.' : nextTopicDetail}</p>
        </div>
        <button type="button" onClick={() => onNavigate(nextPage)} className="relative mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#07111c] transition hover:-translate-y-0.5 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:mt-0">
          {nextAction} <ArrowUpRight className="h-4 w-4" />
        </button>
      </section>
    </main>
  );
}
