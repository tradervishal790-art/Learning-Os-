// noteTabs.ts — the Notebook "ribbon": which tool lives under which tab.
// One list drives both layouts (PC ribbon, phone bottom row). Names are the
// standard English ones, same as the rest of the Notes section.

export type NoteTabId = 'home' | 'insert' | 'draw' | 'view' | 'ai';

export type NoteToolId =
  // Home — text
  | 'undo' | 'redo' | 'heading' | 'font' | 'size'
  | 'bold' | 'italic' | 'underline' | 'strike' | 'superscript' | 'subscript'
  | 'textColor' | 'highlight' | 'clearFormat'
  | 'bulletList' | 'numberedList' | 'checklist'
  | 'alignLeft' | 'alignCenter' | 'alignRight'
  // Insert
  | 'table' | 'link' | 'divider' | 'quote' | 'inlineCode' | 'codeBlock'
  | 'addPhoto' | 'takePhoto' | 'recordAudio' | 'addPdf' | 'linkVideo'
  // Draw
  | 'penType' | 'penColor' | 'penThickness' | 'penFavorites' | 'shapeSnap' | 'fingerDraw'
  | 'eraser' | 'eraseAll' | 'selectLasso' | 'selectRect' | 'selectionActions' | 'resetPen'
  // View
  | 'zoomIn' | 'zoomOut' | 'zoomFit' | 'pagesGrid' | 'find' | 'readAloud' | 'recall' | 'fullscreen'
  // AI
  | 'aiPanel'
  // ⋯ File menu
  | 'export' | 'exportPdfs' | 'versions' | 'shortcuts';

export interface NoteToolGroup {
  id: string;
  label: string;
  tools: NoteToolId[];
}
export interface NoteTab {
  id: NoteTabId;
  label: string;
  groups: NoteToolGroup[];
}

export const NOTE_TABS: NoteTab[] = [
  {
    id: 'home',
    label: 'Home',
    groups: [
      { id: 'history', label: 'Undo', tools: ['undo', 'redo'] },
      { id: 'font', label: 'Font', tools: ['heading', 'font', 'size', 'bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'textColor', 'highlight', 'clearFormat'] },
      { id: 'paragraph', label: 'Paragraph', tools: ['bulletList', 'numberedList', 'checklist', 'alignLeft', 'alignCenter', 'alignRight'] },
    ],
  },
  {
    id: 'insert',
    label: 'Insert',
    groups: [
      { id: 'blocks', label: 'Blocks', tools: ['table', 'link', 'divider', 'quote', 'inlineCode', 'codeBlock'] },
      { id: 'media', label: 'Media', tools: ['addPhoto', 'takePhoto', 'recordAudio', 'addPdf', 'linkVideo'] },
    ],
  },
  {
    id: 'draw',
    label: 'Draw',
    groups: [
      { id: 'history', label: 'Undo', tools: ['undo', 'redo'] },
      { id: 'pen', label: 'Pen', tools: ['penType', 'penColor', 'penThickness', 'penFavorites', 'shapeSnap', 'fingerDraw', 'resetPen'] },
      { id: 'erase', label: 'Eraser', tools: ['eraser', 'eraseAll'] },
      { id: 'select', label: 'Select', tools: ['selectLasso', 'selectRect', 'selectionActions'] },
    ],
  },
  {
    id: 'view',
    label: 'View',
    groups: [
      { id: 'zoom', label: 'Zoom', tools: ['zoomIn', 'zoomOut', 'zoomFit'] },
      { id: 'pages', label: 'Pages', tools: ['pagesGrid', 'find'] },
      { id: 'study', label: 'Study', tools: ['readAloud', 'recall'] },
      { id: 'screen', label: 'Screen', tools: ['fullscreen'] },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    groups: [{ id: 'ai', label: 'AI', tools: ['aiPanel'] }],
  },
];

/** Rarely used — stays in the ⋯ menu. */
export const FILE_MENU_TOOLS: NoteToolId[] = ['export', 'exportPdfs', 'versions', 'shortcuts'];

/** Undo / redo are shown on both Home and Draw (one tap away in either). */
export const SHARED_TOOLS: NoteToolId[] = ['undo', 'redo'];

export function tabsForTool(id: NoteToolId): NoteTabId[] {
  return NOTE_TABS.filter((t) => t.groups.some((g) => g.tools.includes(id))).map((t) => t.id);
}
