# FieldSnap Pro — Product Requirements (v1)

## Overview
A React Native (Expo) mobile app that lets field engineers, auditors, surveyors and inspectors
capture a photo, instantly annotate it, automatically stamp GPS location & address,
and generate documentation-ready images and PDF reports — with zero context switching.

## Stack
- React Native + Expo (SDK 54), Expo Router (file-based routing)
- TypeScript
- AsyncStorage (observation list + settings), expo-secure-store (PIN), expo-file-system (image files)
- expo-camera, expo-location, expo-print, expo-sharing, expo-local-authentication
- react-native-svg, react-native-view-shot
- No backend — fully offline-first; reverse-geocoding queued when offline

## Routes
- `/` — Home (Capture/Gallery/Recent/Settings)
- `/camera` — Capture (front/rear, flash, shutter)
- `/editor` — Annotation editor (text, circle, arrow, rectangle, free-draw, marker, undo/redo)
- `/gallery` — Thumbnail grid + search + PDF export
- `/observation` — Detail (image + location + notes, share-as-PDF, delete)
- `/settings` — GPS toggle, stamp templates, company info, watermark, theme, app lock
- `/pin-setup` — Set & confirm app PIN
- `/lock` — PIN/Biometric unlock gate

## MVP Deliverables (v1 — implemented)
- [x] Camera capture (front/rear/flash)
- [x] Instant editor launch after capture
- [x] Annotation tools: text (3 sizes / 5 colors), circle, arrow, rectangle, free-draw (3 stroke widths), numbered markers
- [x] Unlimited undo/redo
- [x] GPS location stamp (with 4 templates A/B/C/D and offline queue for reverse-geocode)
- [x] GPS ON/OFF toggle in Settings
- [x] Observation auto-numbering (OBS-0001…) + reset
- [x] Watermark (company / auditor / observation# / date-time)
- [x] Gallery with thumbnails, search by number/project/date
- [x] PDF export (single observation or whole gallery)
- [x] PIN lock + Biometric (Face ID / Fingerprint via expo-local-authentication)
- [x] Light & Dark theme (system / light / dark)
- [x] Offline-first storage; address auto-resolves when network returns

## Deferred to v2
- Voice-to-text dictation (English / Hindi / Telugu)
- Word and Excel exports
- Cloud backup (Google Drive / OneDrive / Dropbox)
- AI observation suggestions

## Design
Design tokens are sourced from `/app/design_guidelines.json`
(archetype: Swiss & High-Contrast / MD3 Functional, primary `#0A2463`).
