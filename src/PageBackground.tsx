import { useId } from 'react';
import { PAGE_RATIO, PAGE_UNITS } from './inkEngine';
import { paperColor, paperIsDark, templateSpacing, type PageTemplateId } from './pageTemplates';

// ============================================================
// PageBackground.tsx — the paper pattern under a page (ruled / dotted /
// grid / Cornell + paper colour). One SVG with <pattern>s, so it stays
// crisp at any zoom. Sits at the very bottom of the sheet and never
// takes pointer events. All sizes are in page units * (width / 1000).
// ============================================================

export default function PageBackground({
  template, paper, width, height, dark,
}: {
  template: PageTemplateId;
  paper?: string;
  width: number;
  height: number;
  dark: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const k = width / PAGE_UNITS;
  const sp = templateSpacing(template) * k;
  const sw = Math.max(0.75, k);
  // line colour follows the PAPER (a charcoal paper is dark even in the light theme)
  // Plain opaque colours (no alpha): alpha inside SVG patterns is drawn wrongly by some renderers.
  const onDark = paperIsDark(paper, dark);
  const stroke = onDark ? '#4a5059' : '#d3d9e2'; // pattern lines
  const frame = onDark ? '#6b727d' : '#b4bdca'; // Cornell frame lines, a little stronger
  const fill = paperColor(paper, dark);

  const ruled = `r${uid}`;
  const dots = `d${uid}`;
  const grid = `g${uid}`;

  // Cornell geometry (against an A4 page so it does not stretch when the page grows)
  const pageH = width * PAGE_RATIO;
  const headerY = sp * 1.5;
  const cueX = width * 0.25;
  const summaryY = pageH * 0.82;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]"
      style={{ width, height, background: fill }}
    >
      {template !== 'blank' && sp > 0 && width > 0 && (
        <svg width={width} height={height} className="absolute inset-0">
          <defs>
            <pattern id={ruled} width={10} height={sp} patternUnits="userSpaceOnUse">
              <line x1={0} y1={sp - sw / 2} x2={10} y2={sp - sw / 2} stroke={stroke} strokeWidth={sw} />
            </pattern>
            <pattern id={dots} width={sp} height={sp} patternUnits="userSpaceOnUse">
              <circle cx={sp / 2} cy={sp / 2} r={Math.max(1, 1.5 * k)} fill={stroke} />
            </pattern>
            <pattern id={grid} width={sp} height={sp} patternUnits="userSpaceOnUse">
              <path d={`M0 ${sp - sw / 2} H${sp} M${sp - sw / 2} 0 V${sp}`} stroke={stroke} strokeWidth={sw} fill="none" />
            </pattern>
          </defs>

          {template === 'ruled' && <rect x={0} y={0} width={width} height={height} fill={`url(#${ruled})`} />}
          {template === 'dotted' && <rect x={0} y={0} width={width} height={height} fill={`url(#${dots})`} />}
          {template === 'grid' && <rect x={0} y={0} width={width} height={height} fill={`url(#${grid})`} />}

          {template === 'cornell' && (
            <>
              {/* ruled lines only inside the main area (right of the cue column, between header and summary) */}
              <g transform={`translate(${cueX} ${headerY})`}>
                <rect width={width - cueX} height={Math.max(0, summaryY - headerY)} fill={`url(#${ruled})`} />
              </g>
              <line x1={0} y1={headerY} x2={width} y2={headerY} stroke={frame} strokeWidth={sw * 1.5} />
              <line x1={cueX} y1={headerY} x2={cueX} y2={summaryY} stroke={frame} strokeWidth={sw * 1.5} />
              <line x1={0} y1={summaryY} x2={width} y2={summaryY} stroke={frame} strokeWidth={sw * 1.5} />
            </>
          )}
        </svg>
      )}
    </div>
  );
}
