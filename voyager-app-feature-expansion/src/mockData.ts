import { Page, Block, AppSettings, AudioNote } from './types';
import { format, subDays } from 'date-fns';
import { extractRefs } from './lib/parsing';

let blockIdCounter = 1000;

export function genId(): string {
  return `block-${blockIdCounter++}`;
}

function genUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function makeBlock(content: string, children: Block[] = [], taskStatus: Block['taskStatus'] = null): Block {
  return {
    id: genId(),
    uuid: genUUID(),
    content,
    children,
    collapsed: false,
    taskStatus,
    properties: {},
    refs: extractRefs(content),
  };
}

function journalPage(daysAgo: number): Page {
  const date = subDays(new Date(), daysAgo);
  const dateStr = format(date, 'yyyy-MM-dd');
  const displayDate = format(date, 'EEEE, MMMM do yyyy');
  const id = `journal-${dateStr}`;

  const blocks: Block[] = daysAgo === 0 ? [
    makeBlock(`## 🌅 ${displayDate}`),
    makeBlock('Started the day with a review of [[Project Voyager]] goals', [
      makeBlock('Reading chapter 3 of [[Building a Second Brain]]', [
        makeBlock('Key insight: **Progressive Summarization** is the technique of distilling notes over multiple passes'),
      ]),
      makeBlock('Reviewed flashcards — 12 cards due today #spaced-repetition'),
    ]),
    makeBlock('Daily intentions', [
      makeBlock('Finish the [[Logseq Mobile]] outliner engine', [], 'DOING'),
      makeBlock('Write documentation for the [[Knowledge Graph]] feature', [], 'TODO'),
      makeBlock('Review pull requests for #voyager', [], 'TODO'),
      makeBlock('Exercise — 30 min run', [], 'DONE'),
      makeBlock('Morning meditation', [], 'DONE'),
    ]),
    makeBlock('## 🌞 Afternoon'),
    makeBlock('Deep work session on [[React]] component architecture', [
      makeBlock('Refactored the block renderer to handle infinite nesting efficiently'),
      makeBlock('Added `#card` support for spaced repetition extraction'),
      makeBlock('Implemented [[Bi-directional Links]] parser with regex'),
    ]),
    makeBlock('## 💡 Ideas & Insights'),
    makeBlock('The outliner paradigm works because it mirrors how we actually think — hierarchically, not linearly', [
      makeBlock('Reference: [[Andy Matuschak]] notes on evergreen notes'),
      makeBlock('Counter-point: Some knowledge is inherently non-hierarchical → use [[Knowledge Graph]]'),
    ]),
    makeBlock('## 📷 Media & Audio Captured Today', [
      makeBlock('Workspace photo attached below #workspace #setup'),
      makeBlock('Voice memo transcribed: "Remember to add camera + audio capture to Voyager" #audio'),
      makeBlock('Screen recording of the graph view showing 48 connected pages'),
    ]),
    makeBlock('## 🎯 Evening Review'),
    makeBlock('What went well?', [
      makeBlock('Made significant progress on the outliner #win'),
      makeBlock('Maintained focus for 3 consecutive hours using Pomodoro'),
    ]),
    makeBlock('What to improve?', [
      makeBlock('Start documentation earlier in the day #improvement'),
    ]),
    makeBlock('Gratitude: Grateful for the focus and clarity today 🙏'),
  ] : daysAgo === 1 ? [
    makeBlock(`## 📅 ${displayDate}`),
    makeBlock('Reviewed [[Project Voyager]] architecture', [
      makeBlock('Decided to use force-directed graph for [[Knowledge Graph]]'),
      makeBlock('Chose SM-2 algorithm for [[Flashcards]] spaced repetition'),
      makeBlock('Added camera + audio capture module with speech-to-text transcription'),
    ]),
    makeBlock('Tasks', [
      makeBlock('Setup Vite + React + Tailwind project structure', [], 'DONE'),
      makeBlock('Define TypeScript interfaces in types.ts', [], 'DONE'),
      makeBlock('Create mock data for journals and pages', [], 'DONE'),
      makeBlock('Design Audio Capture architecture with Whisper-style transcription', [], 'DONE'),
      makeBlock('Build camera module with webcam + gallery + video', [], 'DONE'),
    ]),
  ] : [
    makeBlock(`## 📅 ${displayDate}`),
    makeBlock('Planning session for the week', [
      makeBlock('[[Project Voyager]] milestone review'),
      makeBlock('Research [[Logseq]] feature parity checklist'),
    ]),
    makeBlock('Reading notes from [[Building a Second Brain]]', [
      makeBlock('**PARA Method**: Projects, Areas, Resources, Archives'),
      makeBlock('**CODE**: Capture, Organize, Distill, Express'),
    ]),
    makeBlock('Linked to [[Zettlekasten Method]] for comparison #zettelkasten #pkm'),
  ];

  return {
    id,
    name: dateStr,
    blocks,
    isJournal: true,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    properties: {},
    tags: ['journal'],
    mediaAttachments: [],
  };
}

const mediaStudioPage: Page = {
  id: 'media-studio',
  name: 'Media Studio',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '🎬' },
  tags: ['media', 'camera', 'audio', 'feature'],
  blocks: [
    makeBlock('# 🎬 Voyager Media Studio', [
      makeBlock('Full-featured media capture, editing, and transcription hub'),
      makeBlock('Integrated into the Logseq knowledge base as a first-class feature'),
    ]),
    makeBlock('## 📸 Camera Module', [
      makeBlock('**Live Webcam**: Access device camera via `getUserMedia` API'),
      makeBlock('**Gallery Import**: Upload images and videos from device storage'),
      makeBlock('**200MP S23 Ultra Preset Scenes**: Pre-loaded flagship scenes'),
      makeBlock('**Image Editing**: Crop, resize, rotate, brightness/contrast controls'),
      makeBlock('**Video Capture**: Record video directly in-app with playback'),
    ]),
    makeBlock('## 🎙️ Audio Capture Module', [
      makeBlock('**Voice Recording**: MediaRecorder API — 16kHz mono PCM WAV format', [
        makeBlock('Supports background thread recording simulation'),
        makeBlock('Live waveform visualization during recording'),
        makeBlock('File saved to local app storage (IndexedDB simulation)'),
      ]),
      makeBlock('**Audio Editing**: Crop audio clips with start/end trim handles'),
      makeBlock('**Waveform Display**: Visual audio waveform representation'),
      makeBlock('**Playback Controls**: Play, pause, seek, speed control'),
    ]),
    makeBlock('## 🗣️ Speech-to-Text Transcription (Whisper.cpp Architecture)', [
      makeBlock('**Audio Capture**: MediaRecorder in 16kHz mono 16-bit PCM WAV'),
      makeBlock('**File Management**: Raw audio saved to local IndexedDB store'),
      makeBlock('**Transcription Engine**: Whisper.cpp WASM running on background worker thread'),
      makeBlock('**Data Binding**: Transcription text attached to AudioNote object in Room-style DB'),
      makeBlock('**Note Object Schema**:', [
        makeBlock('`id`: Unique UUID'),
        makeBlock('`audioDataUrl`: Base64-encoded WAV data'),
        makeBlock('`transcription`: Output text from Whisper engine'),
        makeBlock('`transcriptionStatus`: idle | processing | done | error'),
        makeBlock('`waveform`: Array of amplitude samples for visualization'),
        makeBlock('`cropStart / cropEnd`: Trim timestamps in seconds'),
      ]),
    ]),
    makeBlock('## Architecture Design Decisions', [
      makeBlock('**React MediaRecorder Hook** wraps native Web Audio API'),
      makeBlock('**Web Worker** simulates Whisper background thread — non-blocking UI'),
      makeBlock('**IndexedDB** via localStorage polyfill acts as Room/SQLite equivalent'),
      makeBlock('**AudioContext + AnalyserNode** for real-time waveform data'),
      makeBlock('**Canvas API** for waveform rendering and image cropping UI'),
    ]),
  ],
  mediaAttachments: [],
};

const logseqGuidePage: Page = {
  id: 'logseq-guide',
  name: 'Logseq Guide',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '📖' },
  tags: ['guide', 'documentation'],
  blocks: [
    makeBlock('# Welcome to Voyager — Logseq Mobile 📱', [
      makeBlock('This is a full-featured **local-first** knowledge base inspired by [[Logseq]]'),
      makeBlock('All your data stays on device — no account required, no cloud dependency'),
    ]),
    makeBlock('## Core Concepts'),
    makeBlock('### 📝 Outliner', [
      makeBlock('Every piece of content is a **block** — the atomic unit of your knowledge'),
      makeBlock('Blocks can be nested infinitely using `Tab` (indent) and `Shift+Tab` (outdent)'),
      makeBlock('Collapse and expand blocks by clicking the bullet point •'),
    ]),
    makeBlock('### 🔗 Bi-directional Links', [
      makeBlock('Use `[[Page Name]]` to create a **wiki link** to any page', [
        makeBlock('Example: [[Project Voyager]] — clicking navigates to that page'),
        makeBlock("If the page doesn't exist, it's created automatically"),
      ]),
      makeBlock('Use `#tag` for hashtag references — e.g. `#productivity` #productivity'),
      makeBlock('All links are **bi-directional** — backlinks appear at the bottom of every page'),
    ]),
    makeBlock('### ✅ Task Management', [
      makeBlock('Tasks cycle through states: `TODO` → `DOING` → `DONE` → `LATER` → `NOW` → `CANCELLED`', [
        makeBlock('Use the `/` slash command to insert task markers', [], 'TODO'),
        makeBlock('This is an active task', [], 'DOING'),
        makeBlock('This is a completed task', [], 'DONE'),
        makeBlock('Scheduled for later', [], 'LATER'),
      ]),
    ]),
    makeBlock('### 🎬 Media Studio', [
      makeBlock('Capture photos and videos with the built-in camera'),
      makeBlock('Record and trim audio notes with speech-to-text transcription'),
      makeBlock('Edit images: crop, resize, rotate, color adjustments'),
      makeBlock('All media linked to your knowledge blocks'),
    ]),
    makeBlock('## Keyboard Shortcuts', [
      makeBlock('`Tab` — Indent block (create child)'),
      makeBlock('`Shift+Tab` — Outdent block'),
      makeBlock('`Enter` — New sibling block'),
      makeBlock('`/` — Open slash command menu'),
      makeBlock('`[[` — Start a page link'),
    ]),
  ],
  mediaAttachments: [],
};

const projectVoyagerPage: Page = {
  id: 'project-voyager',
  name: 'Project Voyager',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '🚀', status: 'active', priority: 'high' },
  tags: ['project', 'active', 'mobile'],
  blocks: [
    makeBlock('# 🚀 Project Voyager', [
      makeBlock('**Goal**: Build a full-featured [[Logseq]] replica as a native Android app'),
      makeBlock('**Tech Stack**: [[React]], [[TypeScript]], Tailwind CSS, Vite'),
      makeBlock('**Status**: Active development — MVP complete, feature iteration ongoing'),
    ]),
    makeBlock('## Architecture', [
      makeBlock('### Frontend', [
        makeBlock('React 19 with TypeScript for type safety'),
        makeBlock('Tailwind CSS v4 for styling'),
        makeBlock('Vite for blazing fast builds'),
      ]),
      makeBlock('### Media Layer (New)', [
        makeBlock('MediaRecorder API for audio/video capture'),
        makeBlock('Web Audio API + AnalyserNode for waveform visualization'),
        makeBlock('Canvas API for image editing and waveform rendering'),
        makeBlock('Whisper.cpp WASM for on-device speech transcription'),
        makeBlock('IndexedDB for media blob storage'),
      ]),
    ]),
    makeBlock('## Feature Checklist', [
      makeBlock('Samsung Galaxy S23 Ultra hardware simulation', [], 'DONE'),
      makeBlock('Infinite outliner with nesting', [], 'DONE'),
      makeBlock('Bi-directional links and backlinks', [], 'DONE'),
      makeBlock('Knowledge graph (force-directed physics)', [], 'DONE'),
      makeBlock('Spaced repetition flashcards (SM-2)', [], 'DONE'),
      makeBlock('Full-text global search', [], 'DONE'),
      makeBlock('📸 Camera — Webcam live capture', [], 'DONE'),
      makeBlock('📸 Gallery — Photo/Video import from device', [], 'DONE'),
      makeBlock('✂️ Image Editor — Crop, resize, rotate, filters', [], 'DONE'),
      makeBlock('🎙️ Audio Recorder — MediaRecorder 16kHz mono WAV', [], 'DONE'),
      makeBlock('✂️ Audio Editor — Crop/trim with waveform UI', [], 'DONE'),
      makeBlock('🗣️ Speech-to-Text — Whisper.cpp transcription engine', [], 'DONE'),
      makeBlock('🎬 Video Capture & Playback', [], 'DONE'),
      makeBlock('S-Pen drawing canvas + OCR simulation', [], 'DONE'),
      makeBlock('Dark/Light/System theme support', [], 'DONE'),
      makeBlock('Plugin API system', [], 'LATER'),
      makeBlock('PDF annotation', [], 'LATER'),
    ]),
    makeBlock('## Related Pages', [
      makeBlock('[[Logseq Guide]] — Feature documentation'),
      makeBlock('[[Media Studio]] — Camera & Audio capture module'),
      makeBlock('[[Knowledge Graph]] — Graph view documentation'),
      makeBlock('[[Flashcards]] — SRS system docs'),
    ]),
  ],
  mediaAttachments: [],
};

const knowledgeGraphPage: Page = {
  id: 'knowledge-graph',
  name: 'Knowledge Graph',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '🌐' },
  tags: ['feature', 'graph', 'visualization'],
  blocks: [
    makeBlock('# 🌐 Knowledge Graph', [
      makeBlock('A **force-directed graph** that visualizes all pages and their connections'),
    ]),
    makeBlock('## Physics Model', [
      makeBlock('**Node Repulsion**: All nodes push each other away (Coulomb force)'),
      makeBlock('**Link Attraction**: Connected nodes pull toward each other (spring force)'),
      makeBlock('**Central Gravity**: Gentle pull toward center prevents drift'),
      makeBlock('**Damping**: Velocity reduced each frame to reach equilibrium'),
    ]),
    makeBlock('## Controls', [
      makeBlock('**Drag** — Reposition nodes'),
      makeBlock('**Pinch/Scroll** — Zoom in and out'),
      makeBlock('**Tap node** — Navigate to that page'),
      makeBlock('**Pause button** — Freeze physics simulation'),
    ]),
  ],
  mediaAttachments: [],
};

const samsungS23Page: Page = {
  id: 'samsung-s23-ultra',
  name: 'Samsung S23 Ultra',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '📱', category: 'hardware' },
  tags: ['samsung', 'hardware', 'android'],
  blocks: [
    makeBlock('# 📱 Samsung Galaxy S23 Ultra Specifications'),
    makeBlock('## Display', [
      makeBlock('6.8" Dynamic AMOLED 2X'),
      makeBlock('3088 × 1440 px — 500 ppi density'),
      makeBlock('1-120Hz adaptive refresh rate'),
      makeBlock('2200 nits peak brightness'),
    ]),
    makeBlock('## Camera System', [
      makeBlock('**Main**: 200MP f/1.7 Wide, OIS'),
      makeBlock('**Ultra-Wide**: 12MP f/2.2'),
      makeBlock('**Telephoto 1**: 10MP f/2.4, 3× optical'),
      makeBlock('**Telephoto 2**: 10MP f/4.9, 10× optical, 100× Space Zoom'),
      makeBlock('**Front**: 12MP f/2.2'),
    ]),
    makeBlock('## S-Pen', [
      makeBlock('4096 levels of pressure sensitivity'),
      makeBlock('0.7mm tip diameter'),
      makeBlock('2.8ms latency'),
      makeBlock('Bluetooth 5.0 for Air Actions'),
    ]),
  ],
  mediaAttachments: [],
};

const flashcardsPage: Page = {
  id: 'flashcards',
  name: 'Flashcards',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '🃏' },
  tags: ['feature', 'spaced-repetition', 'learning'],
  blocks: [
    makeBlock('# 🃏 Spaced Repetition Flashcards'),
    makeBlock('## How to Create Cards', [
      makeBlock('Add `#card` to any block to mark it as a flashcard', [
        makeBlock('The block becomes the **front** (question)'),
        makeBlock('Child blocks become the **back** (answer)'),
      ]),
    ]),
    makeBlock('What is the [[Zettlekasten Method]]? #card', [
      makeBlock('A note-taking system developed by Niklas Luhmann'),
      makeBlock('Uses atomic notes with bi-directional links'),
      makeBlock('No hierarchical folders — emergent structure through connections'),
    ]),
    makeBlock('What does PARA stand for? #card', [
      makeBlock('**P**rojects'),
      makeBlock('**A**reas'),
      makeBlock('**R**esources'),
      makeBlock('**A**rchives'),
    ]),
    makeBlock('What is the Whisper.cpp audio transcription pipeline? #card', [
      makeBlock('1. Capture audio at 16kHz mono 16-bit PCM WAV'),
      makeBlock('2. Save raw audio to local IndexedDB storage'),
      makeBlock('3. Run Whisper WASM engine on background Web Worker'),
      makeBlock('4. Bind transcription text to AudioNote object in Room-style DB'),
    ]),
    makeBlock('What MediaRecorder format does Voyager use for audio? #card', [
      makeBlock('16kHz sample rate, mono channel, 16-bit PCM WAV'),
      makeBlock('Optimal format for Whisper.cpp speech recognition engine'),
      makeBlock('Fallback: audio/webm;codecs=opus for browser compatibility'),
    ]),
  ],
  mediaAttachments: [],
};

const buildingSecondBrainPage: Page = {
  id: 'building-a-second-brain',
  name: 'Building a Second Brain',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '📚', author: 'Tiago Forte', type: 'book' },
  tags: ['book', 'pkm', 'productivity', 'notes'],
  blocks: [
    makeBlock('# 📚 Building a Second Brain', [
      makeBlock('**Author**: Tiago Forte'),
      makeBlock('**Core thesis**: Externalize your memory and thinking into a trusted digital system'),
    ]),
    makeBlock('## The PARA Method', [
      makeBlock('**P**rojects — Active projects with a deadline and goal'),
      makeBlock('**A**reas — Spheres of responsibility with no end date'),
      makeBlock('**R**esources — Topics of ongoing interest'),
      makeBlock('**A**rchives — Inactive items from other categories'),
    ]),
    makeBlock('## The CODE Framework', [
      makeBlock('**C**apture — Save what resonates'),
      makeBlock('**O**rganize — Put it where it goes'),
      makeBlock('**D**istill — Find the essence'),
      makeBlock('**E**xpress — Show your work'),
    ]),
  ],
  mediaAttachments: [],
};

const zettlekastenPage: Page = {
  id: 'zettlekasten-method',
  name: 'Zettlekasten Method',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '🗂️', origin: 'Niklas Luhmann' },
  tags: ['pkm', 'method', 'notes', 'zettelkasten'],
  blocks: [
    makeBlock('# 🗂️ Zettlekasten Method', [
      makeBlock('Developed by sociologist Niklas Luhmann (1927–1998)'),
      makeBlock('Luhmann wrote 70+ books and 400+ articles using this system'),
    ]),
    makeBlock('## Core Principles', [
      makeBlock('**Atomicity** — Each note contains exactly one idea'),
      makeBlock('**Autonomy** — Each note is self-contained and understandable alone'),
      makeBlock('**Always link** — Connect each new note to existing notes'),
      makeBlock('**No hierarchy** — Flat structure with emergent order through links'),
    ]),
  ],
  mediaAttachments: [],
};

const reactPage: Page = {
  id: 'react',
  name: 'React',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '⚛️', type: 'technology' },
  tags: ['javascript', 'framework', 'frontend'],
  blocks: [
    makeBlock('# ⚛️ React', [
      makeBlock('A JavaScript library for building user interfaces'),
      makeBlock('Maintained by Meta and a large open-source community'),
    ]),
    makeBlock('## Core Concepts Used in [[Project Voyager]]', [
      makeBlock('**Hooks**: useState, useEffect, useCallback, useRef, useReducer, useContext'),
      makeBlock('**Component Composition**: Every UI element is a reusable component'),
      makeBlock('**Canvas API**: Used for [[Knowledge Graph]] and S-Pen drawing'),
      makeBlock('**MediaRecorder API**: Used for audio/video capture in [[Media Studio]]'),
    ]),
  ],
  mediaAttachments: [],
};

const todosPage: Page = {
  id: 'all-todos',
  name: 'All TODOs',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '✅' },
  tags: ['tasks', 'productivity'],
  blocks: [
    makeBlock('# ✅ Task Management'),
    makeBlock('## Active Tasks', [
      makeBlock('Complete [[Logseq Mobile]] whiteboard feature', [], 'DOING'),
      makeBlock('Write unit tests for graph engine', [], 'TODO'),
      makeBlock('Research PDF annotation libraries for mobile', [], 'TODO'),
      makeBlock('Review [[Building a Second Brain]] chapter 5', [], 'TODO'),
      makeBlock('Share [[Project Voyager]] demo with team', [], 'NOW'),
    ]),
    makeBlock('## Completed', [
      makeBlock('Setup project boilerplate', [], 'DONE'),
      makeBlock('Implement block outliner', [], 'DONE'),
      makeBlock('Add bi-directional link parsing', [], 'DONE'),
      makeBlock('Build knowledge graph with physics', [], 'DONE'),
      makeBlock('Implement SM-2 flashcard algorithm', [], 'DONE'),
      makeBlock('Add camera + audio capture + transcription', [], 'DONE'),
    ]),
  ],
  mediaAttachments: [],
};

const andyMatuschakPage: Page = {
  id: 'andy-matuschak',
  name: 'Andy Matuschak',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '🌱', type: 'person' },
  tags: ['pkm', 'notes', 'research'],
  blocks: [
    makeBlock('# 🌱 Andy Matuschak', [
      makeBlock('Researcher, engineer, and designer working on tools for thought'),
      makeBlock('Former Apple engineer, Khan Academy VP of Product'),
    ]),
    makeBlock('## Key Concepts', [
      makeBlock('**Evergreen Notes** — Notes that accumulate and evolve over time'),
      makeBlock('**Spaced Repetition** — Scientifically optimal review scheduling'),
      makeBlock('**Executable Books** — Books you can interact with and execute code within'),
    ]),
  ],
  mediaAttachments: [],
};

export function buildInitialDatabase(): Record<string, Page> {
  const pages: Record<string, Page> = {};
  [
    journalPage(0),
    journalPage(1),
    journalPage(2),
    journalPage(3),
    logseqGuidePage,
    projectVoyagerPage,
    knowledgeGraphPage,
    samsungS23Page,
    buildingSecondBrainPage,
    zettlekastenPage,
    flashcardsPage,
    reactPage,
    todosPage,
    andyMatuschakPage,
    mediaStudioPage,
  ].forEach(p => { pages[p.id] = p; });
  return pages;
}

export function buildInitialAudioNotes(): AudioNote[] {
  return [
    {
      id: 'audio-sample-1',
      name: 'Project Voyager brainstorm',
      url: '',
      duration: 45.3,
      transcription: 'Remember to add the camera module to project voyager. The audio recording should capture at 16 kilohertz mono for whisper compatibility. Also need to implement the waveform visualization using the canvas API.',
      transcriptionStatus: 'done',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      waveform: Array.from({ length: 80 }, () => Math.random() * 0.8 + 0.1),
      cropStart: 0,
      cropEnd: 45.3,
      pageId: 'project-voyager',
    },
    {
      id: 'audio-sample-2',
      name: 'Daily standup notes',
      url: '',
      duration: 23.1,
      transcription: 'Today I worked on the knowledge graph physics simulation and fixed the node repulsion algorithm. Tomorrow planning to focus on the S-Pen drawing canvas integration.',
      transcriptionStatus: 'done',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      waveform: Array.from({ length: 80 }, () => Math.random() * 0.7 + 0.15),
      cropStart: 0,
      cropEnd: 23.1,
    },
  ];
}

export function getTodayJournalId(): string {
  return `journal-${format(new Date(), 'yyyy-MM-dd')}`;
}

export function formatJournalTitle(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T12:00:00');
    return format(date, 'EEEE, MMMM do yyyy');
  } catch {
    return dateStr;
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: '#6366f1',
  fontSize: 14,
  fontFamily: 'Inter',
  showBrackets: false,
  enableSpellCheck: true,
  autoSave: true,
  sidebarOpen: false,
  rightSidebarOpen: false,
  customCSS: '',
  bezelColor: '#0a0a0a',
  navMode: 'buttons',
  batteryLevel: 82,
  charging: false,
  alwaysOpenJournal: true,
  lastOpenedPageId: null,
  browserPersistHistory: false,
  browserSandboxMode: 'strict',
  browserSearchEngine: 'duckduckgo',
  browserCustomSearchUrl: '',
};
