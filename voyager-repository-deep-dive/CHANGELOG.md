# Changelog

All notable changes to the **Voyager** project will be documented in this file.

## [1.0.0] - 2026-03-09

This release marks the transition from an in-memory prototype to a fully featured, production-grade, local-first application ready for App Store and Play Store compilation.

### Added
- **Local-First Persistence (IndexedDB):** Integrated a robust IndexedDB storage engine. All pages, nested blocks, favorites, system settings, card reviews, and binary media blobs are now persistently stored locally.
- **Real Audio Recorder:** Replaced the simulated audio note recorder with a real-time voice capturer utilizing the browser's `MediaRecorder` API. Saved recordings are stored as binary Blobs and can be played back using memory Object URLs.
- **S-Pen Binary Attachments:** Modified the S-Pen Screen Write canvas to save drawings as local binary PNG Blobs in IndexedDB, inserting short markdown references `![S-Pen Drawing](media-id)` in notes rather than bloating state with huge base64 strings.
- **SM-2 Spaced Repetition Scheduler:** Implemented a mathematically correct SuperMemo-2 spaced repetition algorithm for flashcards (rating 0-5), dynamically calculating next review dates, ease factors, and repetitions.
- **Persistent Review Logs:** Created an IndexedDB store and a dashboard interface to view the persistent history of all flashcard review sessions.
- **Interactive Zoom & Pan Graph:** Added mouse dragging to pan and wheel scrolling to zoom the knowledge graph, complete with scale-dependent node labels and color-coded node classes.
- **Sleek In-App Modal Sheet:** Replaced the mobile-hostile browser `prompt()` for new page creation with a gorgeous, responsive bottom sheet modal.
- **Spacious Desktop Workspace:** Wrapped the Galaxy S23 Ultra phone simulator inside a beautiful desktop workspace displaying live database statistics, S-Pen guides, and outline keyboard shortcuts.
- **CI/CD Workflows & Hygiene:** Added GitHub Actions CI, Prettier configurations, and MIT licensing.

### Changed
- **Decomposed MediaStudio:** Refactored the monolithic `MediaStudio.tsx` into clean, testable sub-components (`useCamera`, `CameraView`, `AudioRecorder`, and `GalleryView`).
- **High-Performance Physics Graph:** Refactored the canvas physics simulation to store coordinates, velocities, and repulsion forces inside `useRef` elements, drawing imperatively in a `requestAnimationFrame` loop. This avoids React's state-update overhead, yielding a steady 60 FPS.
- **Single Source of Truth navigation:** Synchronized active view states directly to the global database context, correcting double-state smells.
- **Reactive O(1) Backlinks:** Replaced the slow, O(N) * O(size) JSON string-scanning backlinks parser with a recursive AST in-memory indexer that updates backlinks and tag indices reactively on page edits.
- **Outline Editor Correctness:** Fully implemented the previously missing `INDENT_BLOCK` and `OUTDENT_BLOCK` tree transformation algorithms in the reducer, allowing fully functional nesting (`Tab` and `Shift + Tab`).

## [0.0.0] - 2026-02-18
- Initial in-memory prototype with S23 Ultra frame, block outline editor, S-Pen drawing simulation, mock graph view, and mock flashcards.
