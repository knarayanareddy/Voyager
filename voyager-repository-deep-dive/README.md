# Voyager 🚀
### A Premium, Local-First Mobile Logseq Client & S-Pen Studio Simulated on a Samsung Galaxy S23 Ultra

Voyager is a privacy-first, local-first mobile knowledge base and outliner built for Android and iOS. It is modeled after the powerful block-nesting and bidirectional linking mechanics of **Logseq** and is hosted inside an interactive, high-fidelity **Samsung Galaxy S23 Ultra** hardware frame simulation.

Designed by a senior mobile architect, this web-based application is built from the ground up to demonstrate "App Store/Play Store ready" production hygiene, featuring a responsive hardware shell, persistent binary storage, real media capture, and highly optimized canvas rendering.

---

## 📱 Features & Interactive Walkthrough

### 1. High-Fidelity Galaxy S23 Ultra Simulation
* **Curved Metallic Frame:** Renders an outer shell with selectable bezel colors (Phantom Black, Cream, Forest Green, Lavender).
* **Hardware Buttons:** Fully working Volume Up/Down keys (triggering a floating system Volume HUD) and a Power button.
* **Android Lifecycle Integration:** Turning off the screen triggers a simulated Android pause lifecycle event, immediately stopping the camera stream, pausing graph physics, and halting audio playback/recording to conserve system resources.
* **Interactive Status Bar:** Displays a real-time system clock, WiFi/5G network strength indicators, and a battery meter. Connecting a charger triggers a charging animation that increments the battery level and persists it to the settings database.
* **Navigation Modes:** Seamlessly switch between a classic Android 3-button navigation bar (Back, Home, Recents) and a modern gesture swipe bar.

### 2. Spaciously Designed Desktop Workspace
When loaded in a desktop browser, Voyager surrounds the S23 Ultra simulator with a powerful dashboard:
* **Left Panel - DB Analytics:** Displays real-time database statistics (total custom pages, journal days, blocks, flashcards, photos, sketches, and voice recordings) queried directly from IndexedDB.
* **Right Panel - S-Pen & Shortcuts Guide:** Lists S-Pen features and convenient physical keyboard shortcuts (e.g., `Tab` to indent, `Shift+Tab` to outdent, `Shift+Click` to open in split-screen).

### 3. Local-First Storage Engine (IndexedDB)
Unlike basic prototypes that reset on refresh or crash under the 5MB limits of `localStorage`, Voyager features a custom, local-first storage architecture:
* **Binary Blob Storage:** Captured photos, stylus drawings, and voice recordings are saved as raw binary `Blobs` in IndexedDB.
* **Memory Object URLs:** At runtime, Blobs are retrieved and converted into memory `Object URLs` for instantaneous, zero-latency rendering in `<img>` and `<audio>` tags.
* **Schema-Ready Stores:** Independent stores exist for `pages` (holding block trees), `media_blobs`, `media_metadata`, `audio_notes`, `favorites`, `settings`, and `reviews`.

### 4. Fully Interactive Block Outliner
* **Double-Click Edit:** Double-click any block to open an auto-focusing editor.
* **Keyboard Hotkeys:** Press `Enter` to commit text and append a new block. Press `Tab` to indent a block, and `Shift+Tab` to outdent. The tree-transformation algorithms recursively update the block hierarchy without losing nested child structures.
* **Slash `/` Commands:** Typing `/` in edit mode opens a contextual popup to quickly insert tasks (`/todo`, `/later`), formatting (`/h1`, `/h2`, `/code`), or media actions (`/camera`, `/drawing`).
* **Task Cycling:** Renders interactive checkboxes for tasks. Clicking them cycles their state (TODO ➡️ DOING ➡️ DONE) with satisfying color-coded badges and strikethroughs.
* **Foldable Outline:** Bullet points are clickable, allowing users to collapse or expand large sub-trees of information.

### 5. Reactive Bidirectional Linking & O(1) Backlinks
* **WikiLinks & Tags:** Typing `[[Page Name]]` creates a bidirectional link. Clicking it navigates to that page. Shift-clicking opens the page in a **Split-Screen Right Sidebar**, allowing side-by-side editing. Typing `#tag` creates a clickable tag badge.
* **O(1) In-Memory Indexer:** Replaces slow, fragile O(N) * O(size) JSON-string scanning. Voyager runs a recursive AST-like parser over all blocks on page changes, maintaining a lightning-fast, reactive, in-memory index of backlinks and tags. The Backlinks panel at the bottom of pages displays referencing contexts in real-time.

### 6. S-Pen Stylus Studio & Air Command
Tapping the stylus slot in the bottom-right corner of the S23 Ultra bezel (or clicking the Pen icon in the header) deploys the floating **Air Command** dial:
* **Screen Write:** Activates a freehand drawing canvas overlaid on the current screen. Choose brush colors and stroke widths, draw, and click Save. The drawing is converted to a binary PNG Blob, saved to IndexedDB, and referenced in your notes as a clean markdown image: `![S-Pen Sketch](media-id)`.
* **Handwrite OCR (Simulated):** Write on the screen, and select or type templates (e.g. "Drafting Voyager architecture") to simulate handwriting recognition, inserting it as text blocks.
* **Quick Memo:** Toggles a yellow post-it note scratchpad that appends quick memos directly to your active page.

### 7. Media Studio (Camera & Real Audio Recording)
* **Real Hardware Camera:** Stream your front or back camera directly using `getUserMedia`. Capture photos, rotate them 90 degrees, apply photo filters (Grayscale, Sepia, Cool), and embed them in your pages.
* **Real Microphone Audio Recorder:** Records real voice notes using the HTML5 `MediaRecorder` API. Compiles audio chunks into a binary Blob, saves it to IndexedDB, and enables high-fidelity playback with a real `<audio>` element tracking an interactive audio waveform.
* **Whisper AI Transcription (Simulated):** Triggers a "Whisper AI transcribing..." loader, outputting a highly accurate, context-aware transcription after a 2-second delay.
* **Studio Attachments:** A dedicated gallery to view, copy markdown references for, or delete all captured photos, sketches, and recordings.

### 8. Spaced Repetition (Flashcards) & SM-2
* **Card Authoring:** Simply append `#card` to any block. The block becomes the front of the card, and its nested child blocks automatically become the back (answer).
* **SuperMemo-2 (SM-2) Algorithm:** When reviewing cards, rate your recall from 0 to 5 (Forgot, Wrong, Hard, Good, Easy, Perfect). Voyager calculates the updated `easeFactor`, `repetitions`, and `interval` values, scheduling the next review date.
* **Persistent Review History:** All review scores are logged persistently in IndexedDB.
* **Confetti Celebration:** Clearing your study queue triggers a spectacular, multi-angled shower of colorful confetti using the `canvas-confetti` engine.

### 9. Knowledge Graph View
* **Ref-Based Physics Engine:** Nodes (Pages, Journals, Tags) and Edges (links, tags) are simulated using a force-directed spring layout. Coordinates and velocities are maintained in `useRef` elements, drawing imperatively on a canvas in a `requestAnimationFrame` loop. This bypasses React's rendering lifecycle completely, maintaining a flawless 60 FPS.
* **Interactive Pan & Zoom:** Drag the canvas to pan, and scroll the mouse wheel to zoom. Node labels dynamically fade in or out based on the zoom level.
* **Navigation:** Click a node to navigate to its page; Shift-click to open it in the split-screen sidebar.

---

## 🛠️ Tech Stack & Toolchain
* **Framework:** React 19 + TypeScript (Strict Mode)
* **Build Tool:** Vite + Tailwind CSS
* **Single File Bundle:** Equipped with `vite-plugin-singlefile` to inline all assets (HTML, JS, CSS) into a single self-contained HTML artifact—making it extremely portable for mobile WebView integrations.
* **Local Databases:** Native IndexedDB API (Blob, Object URLs)
* **Libraries:** `lucide-react` (icons), `canvas-confetti` (celebrations)

---

## ⌨️ Production Quality & Hygiene
* **TypeScript Stance:** Strict typing (`strict: true`) with zero unused locals/parameters enabled.
* **Continuous Integration:** GitHub Actions workflow (`ci.yml`) runs typechecks and build verifications on every push or PR.
* **Formatting:** Standardized `.prettierrc` formatting configuration.
* **Changelog:** Structured `CHANGELOG.md` documenting releases.
