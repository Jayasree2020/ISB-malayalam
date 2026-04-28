# Malayalam Translation Workbench

This project is a working starter for a Malayalam print-translation workflow: English PDF source text, Malayalam translated notes, licensed Malayalam Bible text at the top, editorial cleanup, and export for Word, PDF, archive, and InDesign placement.

Open `index.html` in a browser to use the local workspace immediately. Browser save works without any database setup. Deploy the same folder to Vercel when you want cloud saving and Google Translate inside the app.

## Important Copyright Note

Bible Society of India Malayalam Bible text is not bundled here. Paste or import BSI text only if your project has the required permission or license. The app gives you a place to use licensed text; it does not provide the text itself.

## What The Workspace Does Now

- Stores project title, section reference, editor name, English source, Malayalam translation, BSI verse text, final print body, glossary, and editor notes.
- Places licensed BSI Malayalam verse text at the top and translated notes below.
- Inserts verse markers, reference markers, symbols, Malayalam characters, and glossary terms.
- Normalizes common book abbreviations and reference spacing.
- Switches number style between Western digits and Malayalam digits.
- Saves locally in the browser with no setup, using IndexedDB with a localStorage fallback.
- Saves to a Vercel-managed Neon Postgres database after Vercel storage is connected.
- Opens Google Translate fallback when API keys are not configured.
- Exports:
  - Word-compatible `.doc`
  - HTML for InDesign placement
  - JSON archive
  - Browser print/PDF

## Suggested Editorial Workflow

1. Put the English PDF source in the left source pane. For now, paste extracted text or import `.txt`.
2. Put the Malayalam translation in the right source pane.
3. Paste licensed BSI Malayalam Bible text in the BSI box.
4. Click `Place at Top`.
5. Use `Compose` to add verse numbers, references, symbols, glossary words, translation suggestions, and notes.
6. Use `Normalize Text` to clean references and number style.
7. Use `Run Checks` before export.
8. Export Word/HTML/JSON and print to PDF.
9. For final print layout, place the exported HTML in InDesign, or ask for ICML export once paragraph/character style names are finalized.

## Project Structure

```text
index.html          Main editing workspace
styles.css          Print/editor styling
app.js              Browser editor logic and export tools
api/db.js           Lazy Neon Postgres connection and table setup
api/save.js         Vercel API route for saving projects
api/projects.js     Vercel API route for listing projects
api/translate.js    Vercel API route for Google Translate
package.json        Vercel/Neon/Translate dependencies
vercel.json         Vercel configuration
.env.example        Environment variable template
```

## Local Use

Double-click `index.html` or open it in your browser.

Local browser save works without setup. Cloud saving and in-app Google Translate need deployment or `vercel dev`.

## Vercel Setup

Install Node.js from `https://nodejs.org/`, then in this folder run:

```bash
npm install
npm run dev
```

For deployment:

```bash
npx vercel
```

## Storage Setup

The no-work storage path is already included: use the `Save` button, and the project saves in your browser. This uses IndexedDB, which is better for larger editing sections than simple localStorage.

For cloud storage, use Vercel-managed Neon Postgres. It is SQL, has a free tier, and is the easiest Vercel-friendly option. You should not need to create tables manually; the API creates the `translation_projects` table automatically on first save.

In Vercel, add a Neon Postgres database from the Marketplace/Storage tab. Vercel will add `DATABASE_URL` to the project.

Why this choice:

- Vercel Marketplace storage can provision databases from the Vercel dashboard and inject environment variables automatically.
- Neon is listed as a Postgres storage integration and has plans starting at `$0`.
- Vercel's older first-party Postgres product moved to Neon, so this is the current Vercel-friendly SQL path.

Useful links:

- `https://vercel.com/docs/marketplace-storage`
- `https://vercel.com/storage/postgres`
- `https://vercel.com/marketplace/neon`

Set these environment variables in Vercel:

```text
DATABASE_URL
GOOGLE_TRANSLATE_PROJECT_ID
GOOGLE_APPLICATION_CREDENTIALS_JSON
```

If you do not connect cloud storage, the editor still works locally through browser save and JSON export.

## Google Translate Setup

1. Create or choose a Google Cloud project.
2. Enable Cloud Translation API.
3. Create a service account with Translation permissions.
4. Put the project ID in `GOOGLE_TRANSLATE_PROJECT_ID`.
5. Put the service account JSON in `GOOGLE_APPLICATION_CREDENTIALS_JSON`.

When the API is not configured, the editor opens Google Translate in a new browser tab with the selected text.

## Print And InDesign Plan

Current export gives you Word-compatible `.doc`, browser PDF, HTML, and JSON. For a 3000-4000 page print project, the next production step should be a style-controlled export layer:

- Paragraph styles: `VerseText`, `NoteText`, `ArticleTitle`, `ArticleBody`, `TableText`, `MapCaption`.
- Character styles: `VerseNumber`, `BibleReference`, `FootnoteSymbol`, `TranslatorNote`.
- Export options:
  - `.docx` with real Word styles.
  - `.icml` for direct InDesign placement.
  - Image/table asset manifest.

## Recommended Next Features

- Real PDF extraction using server-side parsing.
- Real `.docx` import/export with Word styles.
- ICML export after InDesign style names are chosen.
- User accounts and project permissions.
- Chapter/section dashboard for thousands of pages.
- Version history and review status.
- BSI text import module that validates your licensed source file.
- Malayalam spellcheck and terminology consistency reports.
- Table, picture, map, column, and article block editor.

## GitHub Plan

Create a GitHub repository for this folder, then connect it to Vercel. Recommended branches:

- `main`: stable deployable version.
- `editor-tools`: active editing features.
- `import-export`: PDF, Word, and InDesign work.
- `review-workflow`: checks, approvals, and version history.

## Notes For Large-Scale Work

For 3000-4000 pages, do not keep the whole work as one document. Split it by book/chapter/article/section. Each section should have:

- English source
- BSI verse text
- Malayalam notes
- Final edited body
- status
- assigned editor
- updated date
- export history

This starter is the first usable desk. The database model can grow into that section-based production system.
