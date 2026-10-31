import { ArrowUpRight, BrainCircuit, CheckCircle2, Compass, GraduationCap, NotebookPen, RotateCcw, Sparkles, Target, Users, Video, Zap, MoreHorizontal, Search, BookOpen, Newspaper, MessageCircle, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

const rows = [
  {
    id: 'know', number: '01', title: 'Know Me', subtitle: 'Understand how you learn',
    color: '#a78bfa', tint: 'violet', icon: BrainCircuit,
    children: [
      { label: 'Mind blueprint', detail: 'Learning profile', icon: BrainCircuit, action: 'profile' as const },
      { label: 'Learning preferences', detail: 'Personal settings', icon: Users, action: 'profile' as const },
    ],
  },
  {
    id: 'plan', number: '02', title: 'Plan', subtitle: 'Build a clear direction',
    color: '#67e8f9', tint: 'cyan', icon: Compass,
    children: [
      { label: 'Learning roadmap', detail: 'Your next topics', icon: Compass, action: 'roadmap' as const },
      { label: 'Goal and milestones', detail: 'Track your path', icon: Target, action: 'roadmap' as const },
    ],
  },
  {
    id: 'learn', number: '03', title: 'Learn', subtitle: 'Turn plans into progress',
    color: '#7dd3fc', tint: 'sky', icon: GraduationCap,
    children: [
      { label: 'Video intelligence', detail: 'Learn with focus', icon: Video, action: 'videos' as const },
      { label: 'Notes and mentor', detail: 'Think it through', icon: NotebookPen, action: 'notes' as const },
    ],
  },
  {
    id: 'retain', number: '04', title: 'Retain', subtitle: 'Make learning last',
    color: '#6ee7b7', tint: 'emerald', icon: RotateCcw,
    children: [
      { label: 'Revision room', detail: 'Recall and review', icon: RotateCcw, action: 'revision' as const },
      { label: 'Memory checkpoints', detail: 'Topics due: dynamic', icon: CheckCircle2, action: 'revision' as const },
    ],
  },
  {
    id: 'prove', number: '05', title: 'Prove', subtitle: 'See what you can do',
    color: '#e879f9', tint: 'fuchsia', icon: Target,
    children: [
      { label: 'Tests and practice', detail: 'Check understanding', icon: CheckCircle2, action: 'test' as const },
      { label: 'Growth and progress', detail: 'See your progress', icon: Zap, action: 'progress' as const },
    ],
  },
];


const functionNodes = [
  { id: 'roadmap', number: '06', title: 'Roadmap', subtitle: 'Your learning direction', color: '#67e8f9', icon: Compass, children: [{ label: 'Learning roadmap', detail: 'Topics and milestones', icon: Compass, action: 'roadmap' as const }] },
  { id: 'revision', number: '07', title: 'Revision', subtitle: 'Remember what matters', color: '#6ee7b7', icon: RotateCcw, children: [{ label: 'Revision room', detail: 'Recall and review', icon: RotateCcw, action: 'revision' as const }] },
  { id: 'notes', number: '08', title: 'Notes', subtitle: 'Capture your thinking', color: '#7dd3fc', icon: NotebookPen, children: [{ label: 'Notes workspace', detail: 'Write and organize', icon: NotebookPen, action: 'notes' as const }] },
  { id: 'test', number: '09', title: 'Tests', subtitle: 'Check your understanding', color: '#e879f9', icon: CheckCircle2, children: [{ label: 'Tests and practice', detail: 'Build a test from questions', icon: CheckCircle2, action: 'test' as const }] },
  { id: 'videos', number: '10', title: 'Videos', subtitle: 'Learn with focus', color: '#7dd3fc', icon: Video, children: [{ label: 'Video intelligence', detail: 'Personalized learning videos', icon: Video, action: 'videos' as const }] },
  { id: 'mentor', number: '11', title: 'AI Mentor', subtitle: 'Ask and explore', color: '#67e8f9', icon: MessageCircle, children: [{ label: 'Open AI Mentor', detail: 'Ask your learning mentor', icon: MessageCircle, action: 'mentor' as const }] },
  { id: 'progress', number: '12', title: 'Progress', subtitle: 'See your growth', color: '#a78bfa', icon: Zap, children: [{ label: 'Growth and progress', detail: 'Track your progress', icon: Zap, action: 'progress' as const }] },
  { id: 'research', number: '13', title: 'Research', subtitle: 'Explore new ideas', color: '#67e8f9', icon: Search, children: [{ label: 'Research workspace', detail: 'Explore ideas and sources', icon: Search, action: 'research' as const }] },
  { id: 'dictionary', number: '14', title: 'Dictionary', subtitle: 'Look up concepts', color: '#a78bfa', icon: BookOpen, children: [{ label: 'Open dictionary', detail: 'Find meanings and concepts', icon: BookOpen, action: 'dictionary' as const }] },
  { id: 'current-affairs', number: '15', title: 'Current Affairs', subtitle: 'Stay informed', color: '#e879f9', icon: Newspaper, children: [{ label: 'Current affairs', detail: 'Read latest updates', icon: Newspaper, action: 'current-affairs' as const }] },
];
const allFunctionNodes = [...rows, ...functionNodes];
const MAP_NODES_STORAGE_KEY = 'learning_os_mission_map_nodes';
const defaultNodeIds = ['know', 'plan', 'learn', 'retain', 'prove'];

export default function MissionControl({
  name, goalTitle, nextTopic, nextTopicDetail, hasLearningProfile,
  revisionDue, revisionOverdue, streak, activeGoals, onNavigate, onOpenProfile,
}: MissionControlProps) {
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [functionSearch, setFunctionSearch] = useState('');
  const [visibleNodeIds, setVisibleNodeIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(MAP_NODES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && allFunctionNodes.some((node) => node.id === id)) : defaultNodeIds;
    } catch { return defaultNodeIds; }
  });
  useEffect(() => {
    try { localStorage.setItem(MAP_NODES_STORAGE_KEY, JSON.stringify(visibleNodeIds)); } catch { /* Best effort */ }
  }, [visibleNodeIds]);
  const visibleRows = useMemo(() => allFunctionNodes.filter((node) => visibleNodeIds.includes(node.id)), [visibleNodeIds]);
  const mapHeight = Math.max(660, visibleRows.length <= 1 ? 660 : 132 + (visibleRows.length - 1) * 132);
  const rowY = visibleRows.map((_, index) => visibleRows.length === 1 ? mapHeight / 2 : 66 + index * ((mapHeight - 132) / (visibleRows.length - 1)));
  const open = (action: 'profile' | DashboardPageId) => action === 'profile' ? onOpenProfile() : onNavigate(action);
  const moreItems = [
    { label: 'Mind blueprint', detail: 'Your learning profile', icon: BrainCircuit, action: 'profile' as const },
    { label: 'Roadmap', detail: 'Plan topics and milestones', icon: Compass, action: 'roadmap' as const },
    { label: 'Revision', detail: 'Recall and review', icon: RotateCcw, action: 'revision' as const },
    { label: 'Notes', detail: 'Capture your thinking', icon: NotebookPen, action: 'notes' as const },
    { label: 'Tests', detail: 'Practice and check understanding', icon: CheckCircle2, action: 'test' as const },
    { label: 'Videos', detail: 'Personalized video learning', icon: Video, action: 'videos' as const },
    { label: 'AI Mentor', detail: 'Ask and explore', icon: MessageCircle, action: 'mentor' as const },
    { label: 'Progress', detail: 'See your growth', icon: Zap, action: 'progress' as const },
    { label: 'Research', detail: 'Explore new ideas', icon: Search, action: 'research' as const },
    { label: 'Dictionary', detail: 'Look up concepts', icon: BookOpen, action: 'dictionary' as const },
    { label: 'Current Affairs', detail: 'Stay informed', icon: Newspaper, action: 'current-affairs' as const },
  ];
  const filteredMoreItems = moreItems.filter((item) => item.label.toLowerCase().includes(functionSearch.toLowerCase()));
  const currentStep = revisionOverdue + revisionDue > 0
    ? `${revisionOverdue + revisionDue} topics ready for revision`
    : nextTopic || 'Your learning path starts here';

  return (
    <main className="mission-map relative flex h-[calc(100dvh-64px-env(safe-area-inset-bottom))] min-h-0 md:h-[calc(100dvh-64px)] w-full flex-col overflow-hidden bg-[#080d19] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-[-220px] h-[520px] w-[520px] rounded-full bg-violet-600/[0.10] blur-[130px]" />
        <div className="absolute right-[-120px] top-[10%] h-[480px] w-[480px] rounded-full bg-cyan-500/[0.08] blur-[130px]" />
        <div className="absolute bottom-[-260px] left-[35%] h-[500px] w-[500px] rounded-full bg-blue-600/[0.06] blur-[130px]" />
      </div>

      <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3 md:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.9)]" />
            Personal learning network
          </div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-white md:text-xl">Your learning map</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] sm:gap-3">
          <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-slate-400 sm:inline-flex">
            <span className="mr-1.5 text-cyan-300">●</span> {goalTitle || 'Choose a learning goal'}
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-slate-400">
            <span className="text-violet-300">{streak}</span> day streak
          </span>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-slate-400">
            <span className="text-emerald-300">{revisionDue + revisionOverdue}</span> to recall
          </span>
        </div>
      </header>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 md:px-6 md:pb-5 md:pt-3">
        <div className="mb-1 flex shrink-0 items-center justify-between px-1 text-[9px] uppercase tracking-[0.2em] text-slate-600 md:px-3">
          <span>Student journey map</span>
          <span className="inline-flex items-center gap-1.5 text-cyan-300/70"><Sparkles className="h-3 w-3" /> Connected learning system</span>
        </div>

        <div className="relative hidden min-h-0 flex-1 overflow-auto rounded-[24px] border border-white/[0.07] bg-[#0b1221]/65 lg:block">
          <div className="relative min-h-[660px]" style={{ height: `${mapHeight}px` }}>
          <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'radial-gradient(#7dd3fc 0.7px, transparent 0.7px)', backgroundSize: '24px 24px' }} />
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 1200 ${mapHeight}`} preserveAspectRatio="none" fill="none" aria-hidden="true">
            <defs>
              <filter id="mindGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {visibleRows.map((row) => <linearGradient key={row.id} id={`line-${row.id}`} x1="180" y1="330" x2="950" y2={rowY[rows.indexOf(row)]} gradientUnits="userSpaceOnUse"><stop stopColor="#64748b" stopOpacity=".55" /><stop offset=".52" stopColor={row.color} stopOpacity=".95" /><stop offset="1" stopColor={row.color} stopOpacity=".5" /></linearGradient>)}
            </defs>
            {visibleRows.map((row, i) => {
              const y = rowY[i];
              return (
                <g key={row.id} filter="url(#mindGlow)" opacity=".95">
                  <path d={`M 235 330 C 330 330, 330 ${y}, 420 ${y}`} stroke={`url(#line-${row.id})`} strokeWidth="2.2" />
                  <g style={{ opacity: selectedEngine === row.id ? 1 : 0, transition: 'opacity 420ms cubic-bezier(.22,1,.36,1)' }}>
                    <path d={`M 690 ${y} C 790 ${y}, 800 ${y-22}, 900 ${y-22}`} stroke={row.color} strokeOpacity=".85" strokeWidth="1.9" />
                    <path d={`M 690 ${y} C 790 ${y}, 800 ${y+22}, 900 ${y+22}`} stroke={row.color} strokeOpacity=".85" strokeWidth="1.9" />
                    <circle cx="900" cy={y-22} r="3" fill={row.color} />
                    <circle cx="900" cy={y+22} r="3" fill={row.color} />
                  </g>
                  <circle cx="420" cy={y} r="4" fill={row.color} />
                </g>
              );
            })}
            <circle cx="235" cy="330" r="7" fill="#c4b5fd" filter="url(#mindGlow)" />
          </svg>

          <div className="absolute left-[2.5%] z-10 flex h-[132px] w-[17%] flex-col justify-center rounded-2xl border border-violet-300/50 bg-gradient-to-br from-[#29214d] to-[#151a31] px-4 shadow-[0_0_38px_rgba(139,92,246,.15)]" style={{ top: '50%', transform: 'translateY(-50%)' }}>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-200"><Users className="h-3.5 w-3.5" /> Student</div>
            <div className="mt-2 truncate text-lg font-semibold text-white">{name || 'Learner'}</div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-violet-100/60">{goalTitle ? `Learning ${goalTitle}` : 'Starts with curiosity'}</div>
            <div className="mt-3 text-[9px] text-violet-200/60">YOU ARE HERE</div>
          </div>

          {rows.map((row, i) => {
            const Icon = row.icon;
            const top = `${(rowY[i] / mapHeight) * 100}%`;
            return (
              <div key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedEngine((current) => current === row.id ? null : row.id)}
                  aria-expanded={selectedEngine === row.id}
                  className={`group absolute left-[35%] z-10 flex h-[76px] w-[22%] -translate-y-1/2 items-center gap-3 rounded-2xl border bg-[#111d31]/95 px-4 text-left shadow-[0_10px_35px_rgba(0,0,0,.25)] transition-[transform,background-color,box-shadow,border-color] duration-300 ease-out hover:scale-[1.015] hover:bg-[#17263d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selectedEngine === row.id ? 'ring-1 ring-white/30 bg-[#1a2940]' : ''}`}
                  style={{ top, transform: selectedEngine === row.id ? 'translateY(calc(-50% - 4px)) scale(1.015)' : undefined, borderColor: `${row.color}55`, boxShadow: selectedEngine === row.id ? `0 9px 32px ${row.color}24` : `0 0 22px ${row.color}12` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${row.color}20`, color: row.color }}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold tracking-[0.18em]" style={{ color: row.color }}>{row.number}</span>
                    <span className="mt-0.5 block text-sm font-semibold text-white">{row.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{row.subtitle}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-white" />
                </button>
                {row.children.map((child, childIndex) => {
                  const isExpanded = selectedEngine === row.id;
                  const ChildIcon = child.icon;
                  return (
                    <button
                      key={child.label}
                      type="button"
                      onClick={() => open(child.action)}
                      className="group absolute left-[75%] z-10 flex h-[42px] w-[22%] -translate-y-1/2 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-[#101a2b]/95 px-3 text-left transition-[opacity,transform,background-color,border-color,box-shadow] duration-[420ms] ease-out hover:border-white/20 hover:bg-[#18263a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      aria-hidden={!isExpanded}
                      tabIndex={isExpanded ? 0 : -1}
                      style={{ top: `${((rowY[i] + (childIndex === 0 ? -22 : 22)) / mapHeight) * 100}%`, borderColor: `${row.color}35`, opacity: isExpanded ? 1 : 0, pointerEvents: isExpanded ? 'auto' : 'none', transform: isExpanded ? 'translateY(-50%) translateX(0) scale(1)' : 'translateY(calc(-50% + 9px)) translateX(-8px) scale(.985)', transitionDelay: isExpanded ? `${childIndex * 75}ms` : '0ms' }}
                    >
                      <ChildIcon className="h-3.5 w-3.5 shrink-0" style={{ color: row.color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-medium text-slate-200">{child.label}</span>
                        <span className="block truncate text-[8px] text-slate-500">{row.id === 'retain' && childIndex === 1 ? `${revisionDue + revisionOverdue} topics due` : child.detail}</span>
                      </span>
                      <ArrowUpRight className="ml-auto h-3 w-3 shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="absolute bottom-4 left-5 flex items-center gap-4 text-[9px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> Student</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Learning engines</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Actions</span>
          </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#0b1221]/70 p-3 lg:hidden">
          <div className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-violet-400 via-cyan-300 to-fuchsia-400 opacity-60" />
          <div className="relative flex flex-col gap-2.5">
            <div className="mb-1 flex items-center gap-3 rounded-xl border border-violet-300/40 bg-[#211b40] p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/15 text-violet-200"><Users className="h-4 w-4" /></span>
              <span><span className="block text-xs font-semibold text-white">{name || 'Student'}</span><span className="block text-[10px] text-violet-200/60">{goalTitle || 'Starts with curiosity'}</span></span>
            </div>
            {visibleRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.id} className="relative ml-5 rounded-xl border bg-[#111d31] p-3" style={{ borderColor: `${row.color}50` }}>
                  <button type="button" onClick={() => setSelectedEngine((current) => current === row.id ? null : row.id)} aria-expanded={selectedEngine === row.id} className="flex w-full items-center gap-3 text-left">
                    <Icon className="h-5 w-5" style={{ color: row.color }} />
                    <span className="flex-1"><span className="block text-xs font-semibold text-white">{row.number} · {row.title}</span><span className="block text-[10px] text-slate-500">{row.subtitle}</span></span>
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  </button>
                  {selectedEngine === row.id && <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                    {row.children.map((child) => <button key={child.label} onClick={() => open(child.action)} className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 text-[9px] text-slate-300">{child.label} ↗</button>)}
                  </div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 text-[9px] text-slate-500 md:px-3">
          <div className="relative">
            <button type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/[0.07]">
              <MoreHorizontal className="h-4 w-4 text-cyan-300" /> More <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && <div className="absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#111d31] p-1.5 shadow-2xl">
              {moreItems.map((item) => {
                const ItemIcon = item.icon;
                return <button key={item.action} type="button" onClick={() => { setMoreOpen(false); open(item.action); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.07]">
                  <ItemIcon className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span className="min-w-0"><span className="block text-xs font-medium text-white">{item.label}</span><span className="block text-[10px] text-slate-500">{item.detail}</span></span>
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-slate-600" />
                </button>;
              })}
            </div>}
          </div>
          <span className="min-w-0 flex-1 truncate text-center">{nextTopic ? `Next topic: ${nextTopic}` : nextTopicDetail}</span>
          <span className="shrink-0">{activeGoals} active goal{activeGoals === 1 ? '' : 's'} · {hasLearningProfile ? 'Profile ready' : 'Profile not set up'}</span>
        </div>
        <button type="button" onClick={() => open(revisionOverdue + revisionDue > 0 ? 'revision' : nextTopic ? 'videos' : 'roadmap')} className="mt-1 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-2 text-left transition hover:bg-cyan-300/10 md:hidden">
          <span className="min-w-0"><span className="block text-[9px] uppercase tracking-[0.16em] text-cyan-200/70">Next best step</span><span className="block truncate text-xs font-medium text-white">{currentStep}</span></span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-cyan-200" />
        </button>
      </section>
    </main>
  );
}
