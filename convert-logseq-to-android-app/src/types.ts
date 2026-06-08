export interface Block {
  id: string;
  content: string;
  children: Block[];
  collapsed?: boolean;
  todoType?: 'TODO' | 'DOING' | 'DONE' | 'LATER' | 'NOW' | null;
}

export interface Page {
  name: string; // Unique, e.g. "Logseq Guide" or "March 1st, 2026"
  isJournal: boolean;
  journalDate?: string; // YYYY-MM-DD
  blocks: Block[];
  updatedAt: number;
}

export interface Card {
  pageName: string;
  blockId: string;
  front: string;
  back: string;
  ease: number;
  interval: number;
  repetition: number;
  dueDate: number; // timestamp
}

export interface DrawingStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  type: 'pen' | 'highlighter' | 'eraser';
}

export interface S23Settings {
  color: 'phantom-black' | 'botanic-green' | 'cream' | 'lavender';
  showFrame: boolean;
  batteryLevel: number;
  isCharging: boolean;
  useGestures: boolean;
  volume: number;
  sPenConnected: boolean;
  brightness: number;
}

export interface LogseqSettings {
  theme: 'dark' | 'light';
  fontSize: number; // 12, 14, 16, 18, 20
  customCss: string;
  showBulletLines: boolean;
}
