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
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  page: DashboardPageId | null;
  tone: string;
}[] = [
  { id: '01', title: 'Know Me', subtitle: 'Learner intelligence', detail: 'Understand your learning patterns', page: null, tone: 'from-violet-400/20 to-indigo-400/5' },
  { id: '02', title: 'Plan', subtitle: 'Adaptive roadmap', detail: 'Choose the next right topic', page: 'roadmap', tone: 'from-cyan-400/20 to-sky-400/5' },
  { id: '03', title: 'Learn', subtitle: 'Learning workspace', detail: 'Videos, notes and AI mentor', page: 'videos', tone: 'from-blue-400/20 to-indigo-400/5' },
  { id: '04', title: 'Retain', subtitle: 'Memory intelligence', detail: 'Recall and revision sessions', page: 'revision', tone: 'from-emerald-400/20 to-teal-400/5' },
  { id: '05', title: 'Prove', subtitle: 'Mastery evidence', detail: 'Tests and skill progress', page: 'test', tone: 'from-fuchsia-400/20 to-violet-400/5' },
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
  const primaryAction: DashboardPageId = revisionOverdue + revisionDue > 0
    ? 'revision'
    : nextTopic
      ? 'videos'
      : 'roadmap';
  const primaryLabel = revisionOverdue + revisionDue > 0
    ? 'Continue revision'
    : nextTopic
      ? 'Continue learning'
      : 'Build your learning plan';

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 md:gap-7 md:px-8 md:py-8">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b1020] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.22)] md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-cyan-500/15 blur-[90px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 left-1/3 -z-10 h-72 w-72 rounded-full bg-violet-500/15 blur-[90px]" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
              Adaptive learning intelligence
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good to see you, {name}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
              One clear next step. A learning system that adapts as you grow.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40">Active goal</div>
            <div className="mt-1 max-w-[220px] truncate text-sm font-medium text-white/90">{goalTitle || 'Choose a skill to begin'}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)] lg:items-end">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-200/70">Your next best action</div>
            <h2 className="mt-2 max-w-2xl text-xl font-semibold leading-snug sm:text-2xl">
              {revisionOverdue > 0
                ? `Bring back ${revisionOverdue} overdue ${revisionOverdue === 1 ? 'topic' : 'topics'}`
                : revisionDue > 0
                  ? `${revisionDue} ${revisionDue === 1 ? 'topic needs' : 'topics need'} a quick recall`
                  : nextTopic
                    ? `Pick up where you left off: ${nextTopic}`
                    : 'Create a clear path toward your next skill'}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/50">{revisionOverdue + revisionDue > 0 ? 'A short recall session strengthens what you have already learned.' : nextTopicDetail}</p>
            <button
              type="button"
              onClick={() => onNavigate(primaryAction)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#07111c] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1020]"
            >
              {primaryLabel}
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          <div className="relative hidden min-h-[190px] items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-[#080d19]/70 p-4 lg:flex">
            <svg viewBox="0 0 340 180" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <linearGradient id="learning-path-line" x1="0" x2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity=".12" />
                  <stop offset="50%" stopColor="#22d3ee" stopOpacity=".8" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity=".3" />
                </linearGradient>
              </defs>
              <path d="M42 92 C95 20 130 20 170 90 S250 160 298 88" fill="none" stroke="url(#learning-path-line)" strokeWidth="1.5" strokeDasharray="4 5" />
              <path d="M42 92 L170 90 L298 88" fill="none" stroke="white" strokeOpacity=".08" />
              {[42,170,298].map((x,i) => <g key={x}><circle cx={x} cy={i===1?90:i===0?92:88} r="17" fill={i===1?'#123a49':'#111b2e'} stroke={i===1?'#22d3ee':'#64748b'} strokeOpacity=".8" /><circle cx={x} cy={i===1?90:i===0?92:88} r="4" fill={i===1?'#67e8f9':'#a5b4fc'} /></g>)}
            </svg>
            <div className="relative z-10 flex w-full justify-between self-end text-[10px] uppercase tracking-[0.12em] text-white/45">
              <span>Understand</span><span>Learn</span><span>Improve</span>
            </div>
            <div className="absolute left-1/2 top-4 -translate-x-1/2 text-xs font-medium text-cyan-100/80">Your learning loop</div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Learning engines">
        {engines.map((engine) => (
          <button
            key={engine.id}
            type="button"
            onClick={() => engine.page ? onNavigate(engine.page) : onOpenProfile()}
            className={`group min-w-0 rounded-2xl border border-gray-200/80 bg-white p-4 text-left transition duration-200 hover:-translate-y-1 hover:border-cyan-300/50 hover:shadow-[0_14px_35px_rgba(8,145,178,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-white/[0.08] dark:bg-[#0c101a] dark:hover:bg-[#101827]`}
          >
            <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${engine.tone} text-xs font-semibold text-gray-800 ring-1 ring-black/5 dark:text-white dark:ring-white/10`}>{engine.id}</div>
            <div className="text-base font-semibold tracking-tight text-gray-950 dark:text-white">{engine.title}</div>
            <div className="mt-1 text-xs font-medium text-cyan-700 dark:text-cyan-200/80">{engine.subtitle}</div>
            <p className="mt-3 min-h-9 text-xs leading-relaxed text-gray-500 dark:text-white/40">{engine.detail}</p>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-[11px] text-gray-400 dark:border-white/[0.07] dark:text-white/35">
              <span>{engine.id === '01' ? (hasLearningProfile ? 'Profile ready' : 'Set up profile') : 'Open engine'}</span>
              <span className="transition group-hover:translate-x-1" aria-hidden="true">→</span>
            </div>
          </button>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(260px,.6fr)]">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.08] dark:bg-[#0c101a]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Learning signals</div>
              <p className="mt-1 text-xs text-gray-500 dark:text-white/40">A snapshot from your actual activity</p>
            </div>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1 text-[10px] text-emerald-700 dark:text-emerald-300">Live data</span>
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 dark:divide-white/[0.08]">
            <div className="px-2 first:pl-0">
              <div className="text-2xl font-semibold tabular-nums text-gray-950 dark:text-white">{streak}</div>
              <div className="mt-1 text-[11px] text-gray-500 dark:text-white/40">Active-day streak</div>
            </div>
            <div className="px-3">
              <div className="text-2xl font-semibold tabular-nums text-gray-950 dark:text-white">{revisionDue + revisionOverdue}</div>
              <div className="mt-1 text-[11px] text-gray-500 dark:text-white/40">Recall sessions due</div>
            </div>
            <div className="px-3">
              <div className="text-2xl font-semibold tabular-nums text-gray-950 dark:text-white">{activeGoals}</div>
              <div className="mt-1 text-[11px] text-gray-500 dark:text-white/40">Active learning goals</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.08] dark:bg-[#0c101a]">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">Learner profile</div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-white/40">
            {hasLearningProfile ? 'Your learning preferences are ready to guide recommendations.' : 'Build your learning profile so recommendations can reflect how you prefer to learn.'}
          </p>
          <button type="button" onClick={onOpenProfile} className="mt-4 text-xs font-semibold text-cyan-700 transition hover:text-cyan-500 dark:text-cyan-200 dark:hover:text-cyan-100">
            {hasLearningProfile ? 'Review learning profile' : 'Understand how you learn'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  );
}
