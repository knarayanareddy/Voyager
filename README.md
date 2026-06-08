# Voyager: Logseq Mobile & Samsung S23 Ultra Simulator

An ultra-realistic, end-to-end simulation of the **Logseq** privacy-first knowledge base running inside a pixel-perfect **Samsung Galaxy S23 Ultra** flagship smartphone. This application is built using **React, Vite, and Tailwind CSS**, featuring physical hardware buttons, S-Pen Air Command overlay tools, a fully-featured **Media Studio** (with webcam access, live audio recorder with waveform editor, Whisper transcription engine, and full vector image editing), an interactive physics knowledge graph, spaced repetition flashcards, and a multi-pane split-screen editor.

---

## 🌟 Interactive Features & Architecture Deep-Dive

### 1. 📱 Samsung Galaxy S23 Ultra Hardware Simulation (`S23UltraFrame.tsx`)
This component replicates the physical and software properties of Samsung's premium flagship:
*   **Chassis Bezel finishes**: Support for centered punch-hole front camera and a bezel color picker matching official finishes (*Phantom Black*, *Botanic Green*, *Cream*, and *Lavender*).
*   **Hardware Keys**: Toggles screen power (blackout lock state) and volume control keys with a **One UI Volume HUD overlay** that slides in and fades out dynamically.
*   **Android One UI Navigation**: Switch between Gesture navigation and classic soft buttons. Buttons trigger Android standard lifecycle actions:
    *   `Home` minimizes current windows and opens the One UI desktop.
    *   `Back` pops from the page navigation history stack or closes overlay screens.
    *   `Recents` toggles active background views.
*   **System Tray HUD**: Renders cellular 5G indicators, battery levels (animating when charging is active), and a real-time system clock.

---

### 2. ✏️ S-Pen Air Command Overlay (`SPenOverlay.tsx`)
Clicking the physical S-Pen slot slides out the stylus and triggers a glassmorphic floating One UI menu:
*   **Screen Write**: Draw with pen, highlighter, or eraser over your active notes. Select line thicknesses and colors, then click save to automatically append your drawing as a PNG data URL block in today's Logseq journal entry!
*   **OCR Pad / Handwriting-to-Text**: Converts handwriting motions into typed text blocks and inserts them into the selected active outliner node.
*   **Draggable Memo Pad**: A floating note widget that remains on-screen while you navigate pages, allowing you to sync text fragments directly to Logseq at any time.

---

### 3. 🎬 Media Studio Suite (`MediaStudio.tsx`) [New & Expanded]
A massive media editing and capture center simulating real-world note attachments:
*   **Simulated 200MP Pro Camera**:
    *   *Viewfinder Stream*: Uses the webcam via the HTML5 Webcam API with automatic fallback to high-resolution simulated Astro/Space Zoom scenes.
    *   *Gridlines & HDR*: Real-time DSLR rule-of-thirds grid overlays and active HDR indicators.
    *   *Photo & Video modes*: Capture snaps or record mock footage, then preview and edit before saving.
*   **Interactive Image Editor (Cropper / Filters)**:
    *   Crop images inside the viewport with draggable grid markers.
    *   Adjust scale/zoom, rotate by $90^\circ$ steps, and manipulate **Brightness** and **Contrast** filters in real time using slider inputs.
*   **Audio Recorder & Waveform Editor**:
    *   Record voice memos with active visual amplitude waveform pulses.
    *   Cut and trim audio notes using visual start/end slider bounds over the waveform display.
    *   Test playback with custom audio players.
*   **Whisper AI Transcription Simulator**:
    *   Automatically runs text transcription on voice recordings, simulating background Whisper workers, and appends the transcribed speech blocks directly into your notes.

---

### 4. 🌲 Outliner Outlining Engine (`LogseqEditor.tsx`)
The core writing space implementing Logseq's local-first outline structure:
*   **Infinite Indentation**: Nest bullet items infinitely using `Tab` and `Shift+Tab`.
*   **Collapsible Hierarchy**: Toggle bullet folders to collapse or expand children.
*   **Checklist Workflow**: Cycles checkboxes through standard states: `TODO` ➔ `DOING` (pulsing amber) ➔ `DONE` (emerald line-through) ➔ `LATER` ➔ `NOW` (pulsing rose) ➔ `CANCELLED` ➔ none.
*   **Bi-directional Wiki Links**: Automatically parses double brackets (e.g. `[[Project Voyager]]`) and tags (e.g. `#srs`). Clicking them automatically creates or navigates to the target page.
*   **Linked References (Backlinks)**: Computes and displays reference nodes at the bottom of the page showing other documents pointing to the current one.
*   **Split-Pane Side-by-Side Editor**: Hold **Shift** and click on any page link or backlink reference to open it inside a **Right Sidebar split-screen panel**. You can read, write, and update both pages simultaneously, with real-time state synchronization!
*   **Slash Command Menu (`/`)**: Autocomplete commands to insert headings, blockquotes, code blocks, or card tags.

---

### 5. 🌐 Interactive physics Knowledge Graph (`GraphView.tsx`)
Renders a 2D canvas network visualization of your pages:
*   **Force-Directed Physics**: Repulsive forces push nodes apart, links act as spring constraints, and central gravity keeps the graph aligned.
*   **Visual Highlights**: Highlights the active viewport document, glows connection lines on hover, and distinguishes between general notes and daily journals.

---

### 6. 📇 Flashcard SRS Deck Reviewer (`Flashcards.tsx`)
An Anki-style review deck engine:
*   **Automatic Scanning**: Finds all items across notes marked with `#card`. The parent bullet acts as the card front, and nested children are used as card backs.
*   **SuperMemo-2 (SM2) scheduling**: Rates performance (*Forgot*, *Hard*, *Good*, *Easy*) to schedule intervals.
*   **Celebration Effects**: Triggers an animated particle confetti shower when the deck is completed.

---

## 🛠️ Project Setup & Building

### 1. Install Dependencies
Navigate to the project directory and install:
```bash
cd voyager-app-feature-expansion
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```

### 3. Build Production Bundle
```bash
npm run build
```
The application compiles all scripts, assets, and styling into a single-file, self-contained HTML bundle (`dist/index.html`) using the Vite inlining plugins.

---

## 🚀 Quality & Optimization Safeguards
1.  **Strict Type Safety**: Fully compiled under TypeScript with zero compiler warnings.
2.  **Modularized Architecture**: Code is split cleanly across focused views (`LeftSidebar.tsx`, `MediaStudio.tsx`, `SettingsView.tsx`, `TodosView.tsx`).
3.  **Local-First Syncing**: Employs an in-memory database reducer context that ensures absolute state synchronization between the main window editor and the right sidebar editor.
