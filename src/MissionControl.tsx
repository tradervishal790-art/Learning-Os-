import { ArrowUpRight, BrainCircuit, CheckCircle2, Compass, Flame, GraduationCap, NotebookPen, RotateCcw, Target, Users, Video, Zap, MoreHorizontal, Search, BookOpen, Newspaper, MessageCircle, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardPageId } from './types';
import { pullFromCloud, pushToCloud } from './cloudSync';
import { getNextBestStepAction } from './missionControlLogic';
import { useTranslation } from './i18n/LanguageContext';
import { format } from './i18n/format';
import { formatClock } from './resumeStore';
import { GlassButton, GlassPanel, Heatmap, HeatmapLegend, ProgressRing, readActiveDays } from './ui/kit';

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
  /** Roadmap completion for the active goal (0-100) and the topic counts behind it. */
  progressPercent: number;
  topicsDone: number;
  topicsTotal: number;
  onNavigate: (page: DashboardPageId) => void;
  onOpenProfile: () => void;
  /** Where the learner stopped, if anything is half-finished (drives the Continue card text). */
  resume: { kind: 'video'; title: string; seconds: number } | { kind: 'revision'; title: string } | { kind: 'test'; title: string } | { kind: 'note'; title: string } | null;
  onContinueLearning: () => void;
}

type EngineId = 'know' | 'plan' | 'learn' | 'retain' | 'prove' | 'research' | 'dictionary' | 'currentAffairs';
type ToolId = 'profile' | 'roadmap' | 'videos' | 'notes' | 'mentor' | 'revision' | 'test' | 'progress' | 'research' | 'dictionary' | 'currentAffairs';
interface ToolDef { id: ToolId; icon: LucideIcon; action: 'profile' | DashboardPageId }
interface EngineDef { id: EngineId; number: string; color: string; icon: LucideIcon; children: ToolDef[] }

// Only structure lives here (ids, colours, icons, where a tool leads). Every word shown on screen
// comes from t.dashboard.home.hub, so the map switches language with the rest of the app.
const rows: EngineDef[] = [
  { id: 'know', number: '01', color: '#a78bfa', icon: BrainCircuit, children: [{ id: 'profile', icon: BrainCircuit, action: 'profile' }] },
  { id: 'plan', number: '02', color: '#67e8f9', icon: Compass, children: [{ id: 'roadmap', icon: Compass, action: 'roadmap' }] },
  { id: 'learn', number: '03', color: '#7dd3fc', icon: GraduationCap, children: [
    { id: 'videos', icon: Video, action: 'videos' },
    { id: 'notes', icon: NotebookPen, action: 'notes' },
    { id: 'mentor', icon: MessageCircle, action: 'mentor' },
  ] },
  { id: 'retain', number: '04', color: '#6ee7b7', icon: RotateCcw, children: [{ id: 'revision', icon: RotateCcw, action: 'revision' }] },
  { id: 'prove', number: '05', color: '#e879f9', icon: Target, children: [
    { id: 'test', icon: CheckCircle2, action: 'test' },
    { id: 'progress', icon: Zap, action: 'progress' },
  ] },
];

const functionNodes: EngineDef[] = [
  { id: 'research', number: '06', color: '#67e8f9', icon: Search, children: [{ id: 'research', icon: Search, action: 'research' }] },
  { id: 'dictionary', number: '07', color: '#a78bfa', icon: BookOpen, children: [{ id: 'dictionary', icon: BookOpen, action: 'dictionary' }] },
  { id: 'currentAffairs', number: '08', color: '#e879f9', icon: Newspaper, children: [{ id: 'currentAffairs', icon: Newspaper, action: 'current-affairs' }] },
];
const allFunctionNodes = [...rows, ...functionNodes];
const MAP_NODES_STORAGE_KEY = 'learning_os_mission_map_nodes';
const defaultNodeIds: string[] = ['know', 'plan', 'learn', 'retain', 'prove'];

export default function MissionControl({
  name, goalTitle, nextTopic, nextTopicDetail, hasLearningProfile,
  revisionDue, revisionOverdue, streak, activeGoals, progressPercent, onNavigate, onOpenProfile, onContinueLearning, resume,
}: MissionControlProps) {
  const hub = useTranslation().dashboard.home.hub;
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [functionSearch, setFunctionSearch] = useState('');
  const [mapPrefsHydrated, setMapPrefsHydrated] = useState(false);
  const mapPrefsEdited = useRef(false);
  const [visibleNodeIds, setVisibleNodeIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(MAP_NODES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (!Array.isArray(parsed)) return defaultNodeIds;
      const valid = parsed.filter((id) => typeof id === 'string' && allFunctionNodes.some((node) => node.id === id));
      return valid.length > 0 || parsed.length === 0 ? valid : defaultNodeIds;
    } catch { return defaultNodeIds; }
  });
  useEffect(() => {
    let active = true;
    void pullFromCloud<string[]>('missionMapNodes').then((cloudNodes) => {
      if (!active) return;
      if (Array.isArray(cloudNodes) && !mapPrefsEdited.current) {
        const valid = cloudNodes.filter((id) => typeof id === 'string' && allFunctionNodes.some((node) => node.id === id));
        setVisibleNodeIds(valid.length > 0 || cloudNodes.length === 0 ? valid : defaultNodeIds);
      }
      setMapPrefsHydrated(true);
    }).catch(() => { if (active) setMapPrefsHydrated(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!mapPrefsHydrated) return;
    try { localStorage.setItem(MAP_NODES_STORAGE_KEY, JSON.stringify(visibleNodeIds)); } catch { /* Best effort */ }
    void pushToCloud('missionMapNodes', visibleNodeIds);
  }, [visibleNodeIds, mapPrefsHydrated]);
  const visibleRows = useMemo(() => allFunctionNodes.filter((node) => defaultNodeIds.includes(node.id) || visibleNodeIds.includes(node.id)), [visibleNodeIds]);
  const mapHeight = Math.max(660, visibleRows.length <= 1 ? 660 : 132 + (visibleRows.length - 1) * 132);
  const nextBestStepAction = getNextBestStepAction({ hasLearningProfile, revisionDue, revisionOverdue });
  const nextStepStageId = nextBestStepAction === 'profile' ? 'know' : nextBestStepAction === 'revision' ? 'retain' : 'plan';
  const rowY = visibleRows.map((_, index) => visibleRows.length === 1 ? mapHeight / 2 : 66 + index * ((mapHeight - 132) / (visibleRows.length - 1)));
  const open = (action: 'profile' | DashboardPageId) => action === 'profile' ? onOpenProfile() : onNavigate(action);
  const activeDays = useMemo(() => readActiveDays(), [streak]);
  const moreItems = functionNodes.map((node) => ({ id: node.id, icon: node.children[0].icon, action: node.children[0].action, label: hub.engines[node.id].title, detail: hub.engines[node.id].subtitle }));
  const filteredMoreItems = moreItems.filter((item) => item.label.toLowerCase().includes(functionSearch.toLowerCase()));

  return (
    <main className="mission-map relative flex h-[calc(100dvh-64px-env(safe-area-inset-top))] min-h-0 w-full flex-col overflow-hidden bg-transparent md:bg-[#080d19] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hidden md:block absolute -left-40 top-[-220px] h-[520px] w-[520px] rounded-full bg-violet-600/[0.10] blur-[130px]" />
        <div className="hidden md:block absolute right-[-120px] top-[10%] h-[480px] w-[480px] rounded-full bg-cyan-500/[0.08] blur-[130px]" />
        <div className="hidden md:block absolute bottom-[-260px] left-[35%] h-[500px] w-[500px] rounded-full bg-blue-600/[0.06] blur-[130px]" />
      </div>

      <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3 md:px-8">
        <div className="min-w-0">
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-white md:text-xl">{hub.mapTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] sm:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-slate-300">
            <Flame className={`h-3.5 w-3.5 ${streak > 0 ? 'text-amber-300' : 'text-slate-500'}`} />
            {format(hub.streakChip, streak)}
          </span>
        </div>
      </header>

      <section className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:px-6 md:pb-5 md:pt-4">
        <div className="order-2 mb-3 grid shrink-0 gap-3 md:order-none lg:grid-cols-12">
          {/* Slim Continue strip: one clear action, exactly where the learner stopped. */}
          <GlassButton onClick={onContinueLearning} accent="#a78bfa" className="border-violet-300/25 bg-gradient-to-br from-violet-500/[0.14] to-indigo-500/[0.05] hover:border-violet-200/45 lg:col-span-7">
            <span className="flex items-center gap-3 p-3 md:gap-4 md:p-4">
              <ProgressRing value={progressPercent} color="#a78bfa" size={64} stroke={6}>
                <span className="text-sm font-semibold tabular-nums text-white">{progressPercent}%</span>
              </ProgressRing>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200/80">
                  {resume ? (resume.kind === 'video' ? hub.resumeVideo : resume.kind === 'revision' ? hub.resumeRevision : resume.kind === 'note' ? hub.resumeNote : hub.resumeTest) : hub.continueEyebrow}
                </span>
                <span className="mt-0.5 block line-clamp-2 break-words text-base font-semibold leading-snug text-white md:truncate md:text-lg">
                  {resume?.title || nextTopic || hub.continueTitle}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  {resume
                    ? resume.kind === 'video' ? format(hub.stoppedAt, formatClock(resume.seconds))
                      : resume.kind === 'revision' ? hub.resumeRevisionDetail : resume.kind === 'note' ? hub.resumeNoteDetail : hub.resumeTestDetail
                    : nextTopic ? nextTopicDetail : goalTitle ? format(hub.continueWithGoal, goalTitle) : hub.continueEmpty}
                </span>
              </span>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-violet-300/20 text-xs font-semibold text-violet-50 sm:h-auto sm:w-auto sm:px-3 sm:py-2">
                <span className="sr-only sm:not-sr-only">{resume ? hub.resumeCta : hub.continueTitle}</span> <ArrowUpRight className="h-4 w-4" />
              </span>
            </span>
          </GlassButton>

          <GlassPanel accent="#6ee7b7" className="lg:col-span-5">
            <div className="flex items-center justify-between gap-3 p-3 md:p-4">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">{hub.consistencyTitle}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular-nums text-white">{streak}</span>
                  <span className="text-[11px] text-slate-400">{hub.dayStreakLabel}</span>
                </div>
                <div className="mt-1"><HeatmapLegend less={hub.less} more={hub.more} color="#6ee7b7" /></div>
              </div>
              <div className="shrink-0 overflow-hidden"><Heatmap days={activeDays} weeks={12} color="#6ee7b7" compact /></div>
            </div>
          </GlassPanel>
        </div>

        {visibleRows.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center"><p className="text-sm font-medium text-white">{hub.space.emptyTitle}</p><p className="mt-1 text-xs text-slate-400">{hub.space.emptyBody}</p><button type="button" onClick={() => { mapPrefsEdited.current = true; setVisibleNodeIds(defaultNodeIds); }} className="mt-3 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100">{hub.space.restore}</button></div>}
        <div className="relative order-1 hidden flex-none overflow-visible rounded-[24px] border border-white/[0.07] bg-[#0b1221]/65 lg:order-none lg:block" style={{ height: `${mapHeight}px` }}>
          <div className="relative min-h-[660px]" style={{ height: `${mapHeight}px` }}>
          <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'radial-gradient(#7dd3fc 0.7px, transparent 0.7px)', backgroundSize: '24px 24px' }} />
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 1200 ${mapHeight}`} preserveAspectRatio="none" fill="none" aria-hidden="true">
            <defs>
              <filter id="mindGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {visibleRows.map((row, index) => <linearGradient key={row.id} id={`line-${row.id}`} x1="180" y1={mapHeight / 2} x2="950" y2={rowY[index]} gradientUnits="userSpaceOnUse"><stop stopColor="#64748b" stopOpacity=".55" /><stop offset=".52" stopColor={row.color} stopOpacity=".95" /><stop offset="1" stopColor={row.color} stopOpacity=".5" /></linearGradient>)}
            </defs>
            {visibleRows.map((row, i) => {
              const y = rowY[i];
              return (
                <g key={row.id} filter="url(#mindGlow)" opacity=".95">
                  <path d={`M 235 ${mapHeight / 2} C 330 ${mapHeight / 2}, 330 ${y}, 420 ${y}`} stroke={`url(#line-${row.id})`} strokeWidth="2.2" />
                  <g style={{ opacity: selectedEngine === row.id ? 1 : 0, transition: 'opacity 420ms cubic-bezier(.22,1,.36,1)' }}>
                    {row.children.map((child, childIndex) => {
                      const childOffset = (childIndex - (row.children.length - 1) / 2) * 44;
                      return <g key={child.id}>
                        <path d={`M 690 ${y} C 790 ${y}, 800 ${y + childOffset}, 900 ${y + childOffset}`} stroke={row.color} strokeOpacity=".85" strokeWidth="1.9" />
                        <circle cx="900" cy={y + childOffset} r="3" fill={row.color} />
                      </g>;
                    })}
                  </g>
                  <circle cx="420" cy={y} r="4" fill={row.color} />
                </g>
              );
            })}
            <circle cx="235" cy={mapHeight / 2} r="7" fill="#c4b5fd" filter="url(#mindGlow)" />
          </svg>

          <div className="absolute left-[2.5%] z-10 flex h-[132px] w-[17%] flex-col justify-center rounded-2xl border border-violet-300/50 bg-gradient-to-br from-[#29214d] to-[#151a31] px-4 shadow-[0_0_38px_rgba(139,92,246,.15)]" style={{ top: '50%', transform: 'translateY(-50%)' }}>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-violet-200"><Users className="h-3.5 w-3.5" /> {hub.student}</div>
            <div className="mt-2 truncate text-lg font-semibold text-white">{name}</div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-violet-100/60">{goalTitle ? format(hub.learningGoal, goalTitle) : hub.startsWithCuriosity}</div>
            <div className="mt-3 text-[9px] uppercase text-violet-200/60">{hub.youAreHere}</div>
          </div>

          {visibleRows.map((row, i) => {
            const Icon = row.icon;
            const copy = hub.engines[row.id];
            const top = `${(rowY[i] / mapHeight) * 100}%`;
            return (
              <div key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelectedEngine((current) => current === row.id ? null : row.id)}
                  aria-expanded={selectedEngine === row.id}
                  aria-current={nextStepStageId === row.id ? 'step' : undefined}
                  className={`group absolute left-[35%] z-10 flex h-[76px] w-[22%] -translate-y-1/2 items-center gap-3 rounded-2xl border bg-[#111d31]/95 px-4 text-left shadow-[0_10px_35px_rgba(0,0,0,.25)] transition-[transform,background-color,box-shadow,border-color] duration-300 ease-out hover:scale-[1.015] hover:bg-[#17263d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${selectedEngine === row.id ? 'ring-1 ring-white/30 bg-[#1a2940]' : ''}`}
                  style={{ top, transform: selectedEngine === row.id ? 'translateY(calc(-50% - 4px)) scale(1.015)' : undefined, borderColor: `${row.color}55`, boxShadow: selectedEngine === row.id ? `0 9px 32px ${row.color}24` : `0 0 22px ${row.color}12` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${row.color}20`, color: row.color }}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-semibold tracking-[0.18em]" style={{ color: row.color }}>{row.number}</span>
                    <span className="mt-0.5 block text-sm font-semibold text-white">{copy.title}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{copy.subtitle}</span>
                    {nextStepStageId === row.id && <span className="mt-0.5 inline-flex rounded-full bg-cyan-300/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-cyan-200">{hub.space.nextStep}</span>}
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-white" />
                </button>
                {row.children.map((child, childIndex) => {
                  const isExpanded = selectedEngine === row.id;
                  const ChildIcon = child.icon;
                  const tool = hub.tools[child.id];
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => open(child.action)}
                      className="group absolute left-[75%] z-10 flex h-[42px] w-[22%] -translate-y-1/2 items-center gap-2.5 rounded-xl border border-white/[0.09] bg-[#101a2b]/95 px-3 text-left transition-[opacity,transform,background-color,border-color,box-shadow] duration-[420ms] ease-out hover:border-white/20 hover:bg-[#18263a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      aria-hidden={!isExpanded}
                      tabIndex={isExpanded ? 0 : -1}
                      style={{ top: `${((rowY[i] + (childIndex - (row.children.length - 1) / 2) * 44) / mapHeight) * 100}%`, borderColor: `${row.color}35`, opacity: isExpanded ? 1 : 0, pointerEvents: isExpanded ? 'auto' : 'none', transform: isExpanded ? 'translateY(-50%) translateX(0) scale(1)' : 'translateY(calc(-50% + 9px)) translateX(-8px) scale(.985)', transitionDelay: isExpanded ? `${childIndex * 75}ms` : '0ms' }}
                    >
                      <ChildIcon className="h-3.5 w-3.5 shrink-0" style={{ color: row.color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-medium text-slate-200">{tool.label}</span>
                        <span className="block truncate text-[8px] text-slate-500">{tool.detail}</span>
                      </span>
                      <ArrowUpRight className="ml-auto h-3 w-3 shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="absolute bottom-4 left-5 flex items-center gap-4 text-[9px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> {hub.legend.student}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> {hub.legend.engines}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {hub.legend.actions}</span>
          </div>
          </div>
        </div>

        <div className="relative order-1 flex-none rounded-2xl border border-white/[0.07] bg-[#0b1221]/70 p-3 lg:order-none lg:hidden">
          <div className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-violet-400 via-cyan-300 to-fuchsia-400 opacity-60" />
          <div className="relative flex flex-col gap-2.5">
            <div className="mb-1 flex items-center gap-3 rounded-xl border border-violet-300/40 bg-[#211b40] p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/15 text-violet-200"><Users className="h-4 w-4" /></span>
              <span><span className="block text-xs font-semibold text-white">{name}</span><span className="block text-[10px] text-violet-200/60">{goalTitle || hub.startsWithCuriosity}</span></span>
            </div>
            {visibleRows.map((row) => {
              const Icon = row.icon;
              const copy = hub.engines[row.id];
              return (
                <div key={row.id} className="relative ml-5 rounded-xl border bg-[#111d31] p-3" style={{ borderColor: `${row.color}50` }}>
                  <button type="button" onClick={() => setSelectedEngine((current) => current === row.id ? null : row.id)} aria-expanded={selectedEngine === row.id} aria-current={nextStepStageId === row.id ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-lg text-left ${nextStepStageId === row.id ? 'ring-1 ring-cyan-300/40' : ''}`}>
                    <Icon className="h-5 w-5" style={{ color: row.color }} />
                    <span className="flex-1"><span className="block text-xs font-semibold text-white">{row.number} · {copy.title}</span><span className="block text-[10px] text-slate-500">{copy.subtitle}</span>{nextStepStageId === row.id && <span className="mt-1 inline-flex rounded-full bg-cyan-300/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-cyan-200">{hub.space.yourNextStep}</span>}</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  </button>
                  {selectedEngine === row.id && <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                    {row.children.map((child) => <button key={child.id} type="button" onClick={() => open(child.action)} className="rounded-lg border border-white/[0.08] bg-white/[0.035] px-2 py-1.5 text-[9px] text-slate-300">{hub.tools[child.id].label} ↗</button>)}
                  </div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative order-4 mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 text-[9px] text-slate-500 md:order-none md:px-3">
          <div className="relative">
            <button type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/[0.07]">
              <MoreHorizontal className="h-4 w-4 text-cyan-300" /> {hub.moreMenu.button} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(16rem,calc(100vw-2rem))] max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border border-white/10 bg-[#111d31] p-1.5 shadow-2xl">
              <div className="sticky top-0 z-10 bg-[#111d31] p-1.5"><input value={functionSearch} onChange={(event) => setFunctionSearch(event.target.value)} placeholder={hub.moreMenu.searchPlaceholder} className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40" /></div>
              {filteredMoreItems.length === 0 && <p className="px-3 py-4 text-xs text-slate-500">{hub.moreMenu.noMatch}</p>}
              {filteredMoreItems.map((item) => {
                const ItemIcon = item.icon;
                return <button key={item.id} type="button" onClick={() => { setMoreOpen(false); open(item.action); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.07]">
                  <ItemIcon className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span className="min-w-0"><span className="block text-xs font-medium text-white">{item.label}</span><span className="block text-[10px] text-slate-500">{item.detail}</span></span>
                  <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-slate-600" />
                </button>;
              })}
            </div>}
          </div>
          <button type="button" onClick={() => { setCustomizeOpen(true); setMoreOpen(false); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/10">{hub.customize.button}</button>
          <span className="shrink-0">{format(activeGoals === 1 ? hub.footer.goalOne : hub.footer.goalMany, activeGoals)} · {hasLearningProfile ? hub.footer.profileReady : hub.footer.profileMissing}</span>
        </div>
        {customizeOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="map-customize-title">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#101a2b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div><h2 id="map-customize-title" className="text-base font-semibold text-white">{hub.customize.title}</h2><p className="mt-1 text-xs text-slate-400">{hub.customize.body}</p></div>
              <button type="button" onClick={() => setCustomizeOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label={hub.customize.close}>✕</button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-3">
              {allFunctionNodes.map((node) => {
                const NodeIcon = node.icon;
                const copy = hub.engines[node.id];
                const isCoreStage = defaultNodeIds.includes(node.id);
                const checked = isCoreStage || visibleNodeIds.includes(node.id);
                return <label key={node.id} className={`flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[0.05] ${isCoreStage ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={checked} disabled={isCoreStage} onChange={() => { mapPrefsEdited.current = true; setVisibleNodeIds((current) => checked ? current.filter((id) => id !== node.id) : [...current, node.id]); if (checked && selectedEngine === node.id) setSelectedEngine(null); }} className="h-4 w-4 accent-cyan-400 disabled:opacity-50" />
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: node.color, backgroundColor: `${node.color}20` }}><NodeIcon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-100">{copy.title}</span><span className="block text-xs text-slate-500">{copy.subtitle}</span></span>
                  <span className="text-[10px] text-slate-500">{isCoreStage ? hub.space.coreStage : checked ? hub.customize.onMap : hub.customize.add}</span>
                </label>;
              })}
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3">
              <button type="button" onClick={() => { mapPrefsEdited.current = true; setVisibleNodeIds(defaultNodeIds); }} className="text-xs text-slate-400 transition hover:text-white">{hub.customize.reset}</button>
              <button type="button" onClick={() => setCustomizeOpen(false)} className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200">{hub.customize.done}</button>
            </div>
          </div>
        </div>}
      </section>
    </main>
  );
}
