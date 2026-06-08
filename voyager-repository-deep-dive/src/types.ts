export interface Block {
  uuid: string;
  content: string;
  children: Block[];
  parentUuid?: string;
  collapsed?: boolean;
  taskStatus?: 'TODO' | 'DOING' | 'DONE' | 'LATER' | 'NOW' | null;
  refs?: string[];
  // SM-2 Spaced Repetition parameters
  card?: {
    easeFactor: number; // Default: 2.5
    interval: number;   // In days. Default: 0
    repetitions: number; // Consecutive successful reviews. Default: 0
    nextReview?: string; // ISO String
  };
}

export interface Page {
  id: string; // e.g. "journal-2026-03-09" or normal page UUID
  name: string; // e.g. "March 9th, 2026" or "Project Voyager"
  isJournal: boolean;
  createdAt: string;
  blocks: Block[];
  tags?: string[];
}

export interface MediaAttachment {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'video' | 'drawing';
  url: string; // Blob Object URL in memory, backed by IndexedDB Blob
  createdAt: string;
  size?: number;
  duration?: number; // for audio/video
}

export interface AudioNote {
  id: string;
  title: string;
  url: string; // Blob Object URL or base64
  duration: number; // in seconds
  transcription?: string;
  createdAt: string;
}

export interface AppSettings {
  bezelColor: string; // e.g. '#000000', '#1C1C1E', '#D1D1D6', '#E5A93C'
  navMode: 'buttons' | 'gestures';
  batteryLevel: number;
  charging: boolean;
  screenOn: boolean;
  rightSidebarOpen: boolean;
  sPenActive: boolean;
  desktopMode: boolean;
  volume: number; // 0 to 100
}

export interface CardReview {
  id: string;
  blockUuid: string;
  pageId: string;
  score: number; // 0-5
  reviewedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'page' | 'journal' | 'tag';
  val: number; // size weight
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface BacklinkItem {
  pageId: string; // The page containing the link
  pageName: string; // The name of the page containing the link
  blockUuid: string; // The block containing the link
  content: string; // The content of the block
}

// Global database state structure
export interface DatabaseState {
  pages: Record<string, Page>;
  currentPageId: string;
  sidebarPageId: string | null;
  favorites: string[]; // Page IDs
  settings: AppSettings;
  audioNotes: AudioNote[];
  mediaAttachments: MediaAttachment[];
  activeView: 'editor' | 'graph' | 'flashcards' | 'todos' | 'pages' | 'media' | 'settings';
  backlinks: Record<string, BacklinkItem[]>; // Key: target page ID (lowercase) -> pages linking here
  tagIndex: Record<string, string[]>; // Key: tag (lowercase) -> page IDs
}
