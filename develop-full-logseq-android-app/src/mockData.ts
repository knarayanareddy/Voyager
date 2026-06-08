import { Page, Block } from './types';
import { format, subDays } from 'date-fns';

let blockIdCounter = 1000;

export function genId(): string {
  return `block-${blockIdCounter++}`;
}

export function genUUID(): string {
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

function extractRefs(content: string): string[] {
  const refs: string[] = [];
  const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g);
  if (wikiLinks) {
    wikiLinks.forEach(link => {
      refs.push(link.slice(2, -2));
    });
  }
  const tags = content.match(/#(\w[\w-]*)/g);
  if (tags) {
    tags.forEach(tag => refs.push(tag.slice(1)));
  }
  return refs;
}

function journalPage(daysAgo: number): Page {
  const date = subDays(new Date(), daysAgo);
  const dateStr = format(date, 'yyyy-MM-dd');
  const displayDate = format(date, 'EEEE, MMMM do yyyy');
  const id = `journal-${dateStr}`;

  const blocks: Block[] = daysAgo === 0
    ? [
        makeBlock(`## 🌅 Morning ${displayDate}`),
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
        makeBlock('## 📷 Media captured today', [
          makeBlock('Workspace photo attached below #workspace #setup'),
          makeBlock('Screenshot of the graph view showing 48 connected pages'),
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
      ]
    : daysAgo === 1
    ? [
        makeBlock(`## 📅 ${displayDate}`),
        makeBlock('Reviewed [[Project Voyager]] architecture', [
          makeBlock('Decided to use force-directed graph for [[Knowledge Graph]]'),
          makeBlock('Chose SM-2 algorithm for [[Flashcards]] spaced repetition'),
        ]),
        makeBlock('Tasks', [
          makeBlock('Setup Vite + React + Tailwind project structure', [], 'DONE'),
          makeBlock('Define TypeScript interfaces in types.ts', [], 'DONE'),
          makeBlock('Create mock data for journals and pages', [], 'DONE'),
          makeBlock('Research [[S-Pen]] integration approaches', [], 'DONE'),
        ]),
        makeBlock('Met with team about [[Samsung S23 Ultra]] hardware simulation', [
          makeBlock('Agreed on pixel-perfect bezel rendering approach'),
          makeBlock('Volume HUD overlay should match One UI 5.1 design language'),
        ]),
      ]
    : [
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
  };
}

const logseqGuidePage: Page = {
  id: 'logseq-guide',
  name: 'Logseq Guide',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '📖' },
  tags: ['guide', 'documentation'],
  blocks: [
    makeBlock('# Welcome to Logseq Mobile 📱', [
      makeBlock('This is a full-featured **local-first** knowledge base inspired by [[Logseq]]'),
      makeBlock('All your data stays on device — no account required, no cloud dependency'),
    ]),
    makeBlock('## Core Concepts'),
    makeBlock('### 📝 Outliner', [
      makeBlock('Every piece of content is a **block** — the atomic unit of your knowledge'),
      makeBlock('Blocks can be nested infinitely using `Tab` (indent) and `Shift+Tab` (outdent)'),
      makeBlock('Collapse and expand blocks by clicking the bullet point • or using `Ctrl+Click`'),
    ]),
    makeBlock('### 🔗 Bi-directional Links', [
      makeBlock('Use `[[Page Name]]` to create a **wiki link** to any page', [
        makeBlock('Example: [[Project Voyager]] — clicking navigates to that page'),
        makeBlock('If the page doesn\'t exist, it\'s created automatically'),
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
    makeBlock('### 📅 Journals', [
      makeBlock('A new journal page is automatically created each day'),
      makeBlock('Journal entries appear on the home screen by default'),
      makeBlock('Linked references connect journal entries to topic pages automatically'),
    ]),
    makeBlock('### 🌐 Knowledge Graph', [
      makeBlock('The graph view shows all pages and their connections visually'),
      makeBlock('Force-directed physics simulation — nodes repel, links attract'),
      makeBlock('Drag nodes, zoom in/out, and pause the simulation'),
    ]),
    makeBlock('### 🃏 Flashcards (Spaced Repetition)', [
      makeBlock('Add `#card` to any block to turn it into a flashcard'),
      makeBlock('The block content becomes the **front**, child blocks become the **back**', [
        makeBlock('What is the SM-2 algorithm? #card', [
          makeBlock('The **SuperMemo 2** algorithm for spaced repetition'),
          makeBlock('Ratings: Forgot → Hard → Good → Easy'),
          makeBlock('Adjusts review intervals based on recall difficulty'),
        ]),
      ]),
    ]),
    makeBlock('## Keyboard Shortcuts', [
      makeBlock('`Tab` — Indent block (create child)'),
      makeBlock('`Shift+Tab` — Outdent block'),
      makeBlock('`Enter` — New sibling block'),
      makeBlock('`/` — Open slash command menu'),
      makeBlock('`[[` — Start a page link'),
      makeBlock('`Ctrl+Z` — Undo'),
      makeBlock('`Ctrl+Shift+F` — Global search'),
      makeBlock('`Ctrl+K` — Quick page switcher'),
    ]),
    makeBlock('## Slash Commands `/`', [
      makeBlock('`/TODO` — Insert TODO task'),
      makeBlock('`/date` — Insert current date'),
      makeBlock('`/H1` `/H2` `/H3` — Insert headings'),
      makeBlock('`/code` — Insert code block'),
      makeBlock('`/quote` — Insert blockquote'),
      makeBlock('`/card` — Mark as flashcard'),
      makeBlock('`/table` — Insert a table'),
      makeBlock('`/embed` — Embed a page'),
    ]),
    makeBlock('## Markdown Support', [
      makeBlock('**Bold** — `**text**`'),
      makeBlock('*Italic* — `*text*`'),
      makeBlock('~~Strikethrough~~ — `~~text~~`'),
      makeBlock('`Inline code` — `` `code` ``'),
      makeBlock('> Blockquote — `> text`'),
      makeBlock('```\nCode block\n``` — triple backticks'),
      makeBlock('- [ ] Checkbox list'),
      makeBlock('==Highlight== — `==text==`'),
    ]),
  ],
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
        makeBlock('Local state management with useReducer + Context'),
      ]),
      makeBlock('### Data Layer', [
        makeBlock('In-memory graph database with localStorage persistence'),
        makeBlock('Planned: [[IndexedDB]] for large graph support'),
        makeBlock('Export formats: Markdown, JSON, Org-mode'),
      ]),
    ]),
    makeBlock('## Feature Checklist', [
      makeBlock('Samsung Galaxy S23 Ultra hardware simulation', [], 'DONE'),
      makeBlock('Infinite outliner with nesting', [], 'DONE'),
      makeBlock('Bi-directional links and backlinks', [], 'DONE'),
      makeBlock('Journal pages with daily auto-creation', [], 'DONE'),
      makeBlock('Task management (TODO/DOING/DONE/LATER/NOW)', [], 'DONE'),
      makeBlock('Slash command menu', [], 'DONE'),
      makeBlock('Markdown rendering', [], 'DONE'),
      makeBlock('Knowledge graph (force-directed physics)', [], 'DONE'),
      makeBlock('Spaced repetition flashcards (SM-2)', [], 'DONE'),
      makeBlock('Full-text global search', [], 'DONE'),
      makeBlock('Camera integration (webcam + file upload)', [], 'DONE'),
      makeBlock('S-Pen drawing canvas + OCR simulation', [], 'DONE'),
      makeBlock('Dark/Light/System theme support', [], 'DONE'),
      makeBlock('Page templates', [], 'DOING'),
      makeBlock('Whiteboard / Excalidraw-style canvas', [], 'TODO'),
      makeBlock('Plugin API system', [], 'LATER'),
      makeBlock('PDF annotation', [], 'LATER'),
      makeBlock('Org-mode parser', [], 'TODO'),
    ]),
    makeBlock('## Milestones', [
      makeBlock('**v0.1** — Basic outliner + journals (✅ Done)'),
      makeBlock('**v0.2** — Graph view + flashcards (✅ Done)'),
      makeBlock('**v0.3** — Search + camera + S-Pen (✅ Done)'),
      makeBlock('**v0.4** — Whiteboard + templates (🔄 In Progress)'),
      makeBlock('**v1.0** — Full feature parity with desktop Logseq (🎯 Target)'),
    ]),
    makeBlock('## Related Pages', [
      makeBlock('[[Logseq Guide]] — Feature documentation'),
      makeBlock('[[Samsung S23 Ultra]] — Hardware specifications'),
      makeBlock('[[Knowledge Graph]] — Graph view documentation'),
      makeBlock('[[Flashcards]] — SRS system docs'),
      makeBlock('[[Building a Second Brain]] — Inspiration'),
    ]),
  ],
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
      makeBlock('Based on physics simulation: repulsion forces + spring connections + gravity'),
    ]),
    makeBlock('## Physics Model', [
      makeBlock('**Node Repulsion**: All nodes push each other away (Coulomb force)'),
      makeBlock('**Link Attraction**: Connected nodes pull toward each other (spring force)'),
      makeBlock('**Central Gravity**: Gentle pull toward center prevents drift'),
      makeBlock('**Damping**: Velocity reduced each frame to reach equilibrium'),
    ]),
    makeBlock('## Visual Encoding', [
      makeBlock('Node size ∝ number of connections (degree centrality)'),
      makeBlock('Highlighted node = currently active page'),
      makeBlock('Blue nodes = regular pages'),
      makeBlock('Green nodes = journal entries'),
      makeBlock('Edge thickness ∝ link frequency'),
    ]),
    makeBlock('## Controls', [
      makeBlock('**Drag** — Reposition nodes'),
      makeBlock('**Pinch/Scroll** — Zoom in and out'),
      makeBlock('**Tap node** — Navigate to that page'),
      makeBlock('**Pause button** — Freeze physics simulation'),
      makeBlock('**Labels toggle** — Show/hide page names'),
      makeBlock('**Reset** — Return to default layout'),
    ]),
    makeBlock('## Related', [
      makeBlock('[[Bi-directional Links]] — The connections that form the graph'),
      makeBlock('[[Project Voyager]] — Implementation details'),
    ]),
  ],
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
      makeBlock('Gorilla Glass Victus 2'),
    ]),
    makeBlock('## Camera System', [
      makeBlock('**Main**: 200MP f/1.7 Wide, OIS'),
      makeBlock('**Ultra-Wide**: 12MP f/2.2'),
      makeBlock('**Telephoto 1**: 10MP f/2.4, 3× optical'),
      makeBlock('**Telephoto 2**: 10MP f/4.9, 10× optical, 100× Space Zoom'),
      makeBlock('**Front**: 12MP f/2.2'),
    ]),
    makeBlock('## Performance', [
      makeBlock('Snapdragon 8 Gen 2 for Galaxy'),
      makeBlock('12GB RAM'),
      makeBlock('256GB / 512GB / 1TB storage'),
      makeBlock('5000 mAh battery'),
      makeBlock('45W wired + 15W wireless charging'),
    ]),
    makeBlock('## S-Pen', [
      makeBlock('4096 levels of pressure sensitivity'),
      makeBlock('0.7mm tip diameter'),
      makeBlock('2.8ms latency'),
      makeBlock('Bluetooth 5.0 for Air Actions'),
      makeBlock('Built-in storage slot with wireless charging'),
    ]),
    makeBlock('## Software', [
      makeBlock('Android 13 → upgradeable to Android 14'),
      makeBlock('One UI 5.1'),
      makeBlock('4 years OS updates guaranteed'),
    ]),
  ],
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
      makeBlock('**Published**: 2022'),
      makeBlock('**Core thesis**: Externalize your memory and thinking into a trusted digital system'),
    ]),
    makeBlock('## The PARA Method', [
      makeBlock('Organize all information into 4 categories:', [
        makeBlock('**P**rojects — Active projects with a deadline and goal', [
          makeBlock('Example: [[Project Voyager]] — Build Logseq Android App'),
        ]),
        makeBlock('**A**reas — Spheres of responsibility with no end date', [
          makeBlock('Examples: Health, Finances, Career development'),
        ]),
        makeBlock('**R**esources — Topics of ongoing interest', [
          makeBlock('Examples: [[Knowledge Graph]] research, [[React]] patterns'),
        ]),
        makeBlock('**A**rchives — Inactive items from other categories'),
      ]),
    ]),
    makeBlock('## The CODE Framework', [
      makeBlock('**C**apture — Save what resonates'),
      makeBlock('**O**rganize — Put it where it goes'),
      makeBlock('**D**istill — Find the essence'),
      makeBlock('**E**xpress — Show your work'),
    ]),
    makeBlock('## Progressive Summarization', [
      makeBlock('Layer 1: Saved note'),
      makeBlock('Layer 2: **Bold** the most important passages'),
      makeBlock('Layer 3: ==Highlight== the most essential bolded passages'),
      makeBlock('Layer 4: Executive summary in your own words'),
      makeBlock('Layer 5: Remix/apply in your own work'),
    ]),
    makeBlock('## Key Insights', [
      makeBlock('Information has value when **in motion**, not at rest', [
        makeBlock('Don\'t organize for the sake of organizing — do it to express'),
      ]),
      makeBlock('Your brain is for **having ideas**, not holding them'),
      makeBlock('A second brain makes you a better **thinker**, not just a better archivist'),
      makeBlock('12 favourite problems you\'re always thinking about → filter new info through these'),
    ]),
    makeBlock('## Related', [
      makeBlock('[[Zettlekasten Method]] — Niklas Luhmann\'s card index system'),
      makeBlock('[[Logseq Guide]] — Tool for implementing a second brain'),
      makeBlock('[[Project Voyager]] — Application of these principles'),
    ]),
  ],
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
      makeBlock('**Own words** — Paraphrase, never copy verbatim'),
      makeBlock('**No hierarchy** — Flat structure with emergent order through links'),
    ]),
    makeBlock('## Note Types', [
      makeBlock('**Fleeting notes** — Quick captures, temporary'),
      makeBlock('**Literature notes** — Summaries from reading (like [[Building a Second Brain]])'),
      makeBlock('**Permanent notes** — Distilled insights in your own words'),
      makeBlock('**Index notes** — Entry points into topic clusters'),
    ]),
    makeBlock('## vs PARA Method', [
      makeBlock('Zettlekasten: bottom-up, emergent structure through links'),
      makeBlock('PARA: top-down, intentional hierarchical organization'),
      makeBlock('Best: **Combine both** — PARA for projects, Zettlekasten for ideas'),
    ]),
    makeBlock('## In [[Logseq]]', [
      makeBlock('Block references enable Zettlekasten-style atomic notes'),
      makeBlock('[[Bi-directional Links]] replace physical index cards'),
      makeBlock('[[Knowledge Graph]] visualizes the emergent network'),
    ]),
  ],
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
    makeBlock('# 🃏 Spaced Repetition Flashcards', [
      makeBlock('The [[SM-2 Algorithm]] schedules reviews to maximize retention with minimum effort'),
    ]),
    makeBlock('## How to Create Cards', [
      makeBlock('Add `#card` to any block to mark it as a flashcard', [
        makeBlock('The block becomes the **front** (question)'),
        makeBlock('Child blocks become the **back** (answer)'),
      ]),
      makeBlock('Example card below ↓'),
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
      makeBlock('From [[Building a Second Brain]] by Tiago Forte'),
    ]),
    makeBlock('What is Progressive Summarization? #card', [
      makeBlock('A technique for distilling notes across multiple review passes'),
      makeBlock('Layer 1: Save → Layer 2: Bold → Layer 3: Highlight → Layer 4: Summary'),
      makeBlock('Reference: [[Building a Second Brain]]'),
    ]),
    makeBlock('What are the 4 CODE steps? #card', [
      makeBlock('**C**apture what resonates'),
      makeBlock('**O**rganize where it belongs'),
      makeBlock('**D**istill the essence'),
      makeBlock('**E**xpress and share it'),
    ]),
    makeBlock('How does the S-Pen integrate with [[Logseq Mobile]]? #card', [
      makeBlock('Screen Write: Draw annotations directly on notes'),
      makeBlock('Handwrite to Text: OCR converts handwriting to typed text'),
      makeBlock('Quick Memo: Floating sticky note syncs to journal'),
    ]),
    makeBlock('## SM-2 Algorithm Ratings', [
      makeBlock('**Forgot (0)** — Reset interval to 1 day'),
      makeBlock('**Hard (1)** — Ease factor decreases, short interval'),
      makeBlock('**Good (3)** — Normal progression'),
      makeBlock('**Easy (5)** — Ease factor increases, long interval'),
    ]),
  ],
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
      makeBlock('**Controlled Components**: Form state managed by React'),
      makeBlock('**Canvas API**: Used for [[Knowledge Graph]] and S-Pen drawing'),
    ]),
    makeBlock('## Patterns Applied', [
      makeBlock('**Context + Reducer** for global state (database, settings)'),
      makeBlock('**Custom Hooks** for encapsulating complex logic'),
      makeBlock('**Memoization** (useMemo, useCallback) for graph performance'),
      makeBlock('**Portals** for modal overlays'),
      makeBlock('**Refs** for DOM access (canvas, video, scroll)'),
    ]),
  ],
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
    makeBlock('# ✅ Task Management', [
      makeBlock('All tasks across your knowledge base in one place'),
      makeBlock('Tasks are automatically extracted from all pages and journals'),
    ]),
    makeBlock('## Active Tasks', [
      makeBlock('Complete [[Logseq Mobile]] whiteboard feature', [], 'DOING'),
      makeBlock('Write unit tests for graph engine', [], 'TODO'),
      makeBlock('Research PDF annotation libraries for mobile', [], 'TODO'),
      makeBlock('Review [[Building a Second Brain]] chapter 5', [], 'TODO'),
      makeBlock('Share [[Project Voyager]] demo with team', [], 'NOW'),
    ]),
    makeBlock('## Scheduled', [
      makeBlock('Plugin API research and prototyping', [], 'LATER'),
      makeBlock('Org-mode parser implementation', [], 'LATER'),
      makeBlock('RTC sync research', [], 'LATER'),
    ]),
    makeBlock('## Completed', [
      makeBlock('Setup project boilerplate', [], 'DONE'),
      makeBlock('Implement block outliner', [], 'DONE'),
      makeBlock('Add bi-directional link parsing', [], 'DONE'),
      makeBlock('Build knowledge graph with physics', [], 'DONE'),
      makeBlock('Implement SM-2 flashcard algorithm', [], 'DONE'),
      makeBlock('Add camera integration', [], 'DONE'),
    ]),
  ],
};

const templatePage: Page = {
  id: 'templates',
  name: 'Templates',
  isJournal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  properties: { icon: '📋' },
  tags: ['templates', 'productivity'],
  blocks: [
    makeBlock('# 📋 Templates', [
      makeBlock('Reusable block structures for common workflows'),
      makeBlock('Use the `/template` slash command to insert these'),
    ]),
    makeBlock('## Meeting Notes Template', [
      makeBlock('template:: meeting-notes'),
      makeBlock('**Date**: [[{{date}}]]'),
      makeBlock('**Attendees**: '),
      makeBlock('**Agenda**:', [
        makeBlock('Item 1'),
        makeBlock('Item 2'),
      ]),
      makeBlock('**Notes**:', [
        makeBlock('Key point 1'),
        makeBlock('Key point 2'),
      ]),
      makeBlock('**Action Items**:', [
        makeBlock('Action 1', [], 'TODO'),
        makeBlock('Action 2', [], 'TODO'),
      ]),
    ]),
    makeBlock('## Daily Review Template', [
      makeBlock('template:: daily-review'),
      makeBlock('**What did I accomplish today?**', [
        makeBlock(''),
      ]),
      makeBlock('**What should I do tomorrow?**', [
        makeBlock('', [], 'TODO'),
      ]),
      makeBlock('**What am I grateful for?**', [
        makeBlock(''),
      ]),
      makeBlock('**One insight from today**:', [
        makeBlock(''),
      ]),
    ]),
    makeBlock('## Book Notes Template', [
      makeBlock('template:: book-notes'),
      makeBlock('**Author**: '),
      makeBlock('**Published**: '),
      makeBlock('**My Rating**: ⭐⭐⭐⭐⭐'),
      makeBlock('**Summary**: '),
      makeBlock('**Key Ideas**:', [
        makeBlock('Idea 1'),
      ]),
      makeBlock('**Quotes**:', [
        makeBlock('> '),
      ]),
      makeBlock('**Actions to take**: ', [], 'TODO'),
    ]),
  ],
};

export function buildInitialDatabase(): Record<string, Page> {
  const today = journalPage(0);
  const yesterday = journalPage(1);
  const twoDaysAgo = journalPage(2);

  const pages: Record<string, Page> = {};
  [today, yesterday, twoDaysAgo, logseqGuidePage, projectVoyagerPage, knowledgeGraphPage,
   samsungS23Page, buildingSecondBrainPage, zettlekastenPage, flashcardsPage,
   reactPage, todosPage, templatePage].forEach(p => { pages[p.id] = p; });

  return pages;
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
