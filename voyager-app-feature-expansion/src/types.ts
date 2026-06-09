export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'LATER' | 'NOW' | 'CANCELLED' | null;

export interface Block {
  id: string;
  content: string;
  children: Block[];
  collapsed: boolean;
  taskStatus: TaskStatus;
  properties: Record<string, string>;
  refs: string[];
  uuid: string;
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'drawing';
  url: string;
  name: string;
  size?: number;
  duration?: number;
  thumbnailUrl?: string;
  transcription?: string;
  transcriptionStatus?: 'idle' | 'processing' | 'done' | 'error';
  createdAt: string;
  editedAt?: string;
  cropData?: { x: number; y: number; w: number; h: number };
  audioCropData?: { start: number; end: number };
  width?: number;
  height?: number;
  mimeType?: string;
  ownerPageId?: string;
}

export interface Page {
  id: string;
  name: string;
  blocks: Block[];
  isJournal: boolean;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, string>;
  icon?: string;
  tags: string[];
  mediaAttachments?: MediaAttachment[];
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isJournal: boolean;
  isCurrent: boolean;
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface FlashCard {
  id: string;
  front: string;
  back: string[];
  pageId: string;
  easeFactor: number;
  interval: number;
  nextReview: string;
  reviewCount: number;
}

export interface DrawingStroke {
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export interface StickyNote {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  fontSize: number;
  fontFamily: string;
  showBrackets: boolean;
  enableSpellCheck: boolean;
  autoSave: boolean;
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;
  customCSS: string;
  bezelColor: string;
  navMode: 'buttons' | 'gesture';
  batteryLevel: number;
  charging: boolean;
  lastOpenPageId?: string;
}

export interface SearchResult {
  pageId: string;
  pageName: string;
  blockId: string;
  content: string;
  isJournal: boolean;
}

export interface WhiteboardElement {
  id: string;
  type: 'rect' | 'ellipse' | 'text' | 'arrow' | 'line' | 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  fontSize?: number;
  rotation?: number;
  points?: { x: number; y: number }[];
}

export type ActiveView = 'editor' | 'graph' | 'flashcards' | 'search' | 'settings' | 'allPages' | 'todos' | 'media';

export interface AudioNote {
  id: string;
  name: string;
  url: string;
  duration: number;
  transcription: string;
  transcriptionStatus: 'idle' | 'processing' | 'done' | 'error';
  createdAt: string;
  waveform: number[];
  cropStart: number;
  cropEnd: number;
  pageId?: string;
}

export interface CameraState {
  mode: 'camera' | 'gallery' | 'video' | 'audio';
  isRecording: boolean;
  capturedMedia: MediaAttachment | null;
}

export interface CardReview {
  id: string;
  cardId: string;
  score: number;
  reviewedAt: string;
  easeFactor: number;
  interval: number;
  nextReview: string;
  reviewCount: number;
}

