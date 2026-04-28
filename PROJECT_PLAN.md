# Project Plan

## Goal

Build a Malayalam editorial and print-production system for Bible notes and related material. The system should support English source PDF text, Malayalam translation, licensed BSI Malayalam Bible text, verse/reference cleanup, translation help, Malayalam typing, review, saving, and export for Word, PDF, and InDesign.

## Phase 1: Working Editing Desk

Status: started in this folder.

- Browser workspace for English source and Malayalam translation.
- Separate licensed BSI text area.
- Final print-body editor.
- Verse/reference/symbol insertion.
- Malayalam character insertion.
- Glossary suggestions.
- Browser save/load with IndexedDB.
- Word-compatible `.doc`, HTML, JSON, and PDF print export.
- README and deployment notes.

## Phase 2: Real Import And Export

- Extract text from uploaded PDF.
- Import `.docx` while preserving headings, tables, and notes.
- Export real `.docx` with Word styles.
- Export `.icml` for InDesign.
- Keep image, map, table, article, and column blocks as structured content instead of plain text.

## Phase 3: Database And Workflow

- SQL project dashboard using Vercel-managed Neon Postgres.
- Split the 3000-4000 page project into small sections.
- Add status fields: draft, checked, theological review, language review, ready for layout, exported.
- Version history.
- Editor assignments.
- Search across all sections.
- Consistency reports for references, terms, and verse numbers.

## Phase 4: Translation Assistance

- Google Translate API inside the editor.
- Malayalam terminology glossary with approved words.
- BSI-based lookup module for licensed Bible text.
- Suggestions for alternate Malayalam wording.
- Highlight untranslated English words.
- Flag inconsistent names, abbreviations, punctuation, and reference formats.

## Phase 5: Print Production

- InDesign style mapping.
- Page and section export batches.
- Asset manifest for images, maps, and tables.
- Preflight checks before final layout.
- Archive package containing source, edited text, exports, notes, and metadata.

## Storage Choice

Default storage should be easy:

- Immediate local work: browser IndexedDB save, no setup.
- Cloud work: Vercel-managed Neon Postgres free tier.
- No manual table setup: the API creates the table on first save.

MongoDB is not the main plan now because SQL storage is easier to reason about for sections, statuses, exports, and later reports.

## Key Data Model

Each section should become one SQL row:

```json
{
  "projectTitle": "Malayalam Translation Project",
  "book": "Matthew",
  "chapter": 5,
  "range": "1-12",
  "englishSource": "",
  "bsiMalayalamText": "",
  "malayalamTranslation": "",
  "finalText": "",
  "notes": "",
  "status": "draft",
  "editor": "",
  "updatedAt": ""
}
```

## Production Advice

Do not edit a 3000-4000 page project as one huge file. Work section by section. Export small batches for review and layout. Keep every section saved with its own status and history.
