# Malayalam Translation Workbench

This project is a working starter for a Malayalam print-translation workflow: English PDF source text, Malayalam translated notes, licensed Malayalam Bible text at the top, editorial cleanup, and export for Word, PDF, archive, and InDesign placement.

Open `index.html` in a browser to use the local workspace immediately. Browser save works without any database setup. Deploy the same folder to Vercel when you want cloud saving and Google Translate inside the app.

GitHub repo: `https://github.com/Jayasree2020/ISB-malayalam`

Live Vercel app: `https://isb-malayalam.vercel.app`

## Important Copyright Note

Bible Society of India Malayalam Bible text is not bundled here. Paste or import BSI text only if your project has the required permission or license. The app gives you a place to use licensed text; it does not provide the text itself.

## What The Workspace Does Now

- Stores project title, section reference, editor name, English source, Malayalam translation, BSI verse text, final print body, glossary, and editor notes.
- Extracts text from uploaded PDF, DOCX, RTF, text, and many legacy DOC files page by page in the browser.
- Shows the original English source beside the editable Malayalam translation.
- Keeps PDF files visible as PDFs, so the English page can be viewed as it is while Malayalam is edited.
- Can copy the current English PDF page structure into an editable Malayalam page-layout editor.
- Creates a blank page-format layout when the PDF is scanned or has no selectable text.
- Adds manual text blocks and editable tables for layout correction.
- Adds Undo, Redo, Delete, and Options controls in the Malayalam editing section.
- Keeps the BSI Bible text box on the left and the project title above the editing window.
- Treats the Malayalam translation/editing window as the main document. Word/PDF/InDesign exports use only that window.
- Displays Malayalam editing text with `MLW-TTKarthika` first in the font stack.
- Keeps normal Western numerals and preserves English abbreviations when Malayalam text is pasted into layout blocks.
- Preserves imported Word spacing, line breaks, indentation, and tabs as closely as possible in the editing window.
- Filters binary Word import junk such as repeated `ÿÿÿ` characters and asks for DOCX/PDF when an old `.doc` cannot be read reliably.
- Stacks the original source viewer above the Malayalam editing window so both can use the full page width without horizontal scrolling.
- Adds Zoom + and Zoom - controls for the Malayalam editing window.
- Imports or pastes images, maps, and pictures, then shows them in the viewing/print preview.
- Places licensed BSI Malayalam verse text at the top and translated notes below.
- Inserts verse markers, reference markers, symbols, Malayalam characters, and glossary terms.
- Normalizes common book abbreviations and reference spacing.
- Switches number style between Western digits and Malayalam digits.
- Saves locally in the browser with no setup, using IndexedDB with a localStorage fallback.
- Saves to a Vercel-managed Neon Postgres database after Vercel storage is connected.
- Opens Google Translate fallback when API keys are not configured.
- Gives Malayalam glossary meanings for English words using the translate API when configured, with Google Translate fallback.
- Auto-saves browser work and restores the previous browser work on reopen.
- Includes quick links to Google Malayalam typing/Input Tools and Google Translate.
- Exports:
  - Word-compatible `.doc`
  - HTML for InDesign placement
  - InDesign Tagged Text
  - JSON archive
  - Browser print/PDF

## Suggested Editorial Workflow

1. Upload the English PDF/DOC/DOCX/RTF/image/text file in the English file box.
2. The original English source appears on the left. PDFs are shown as PDFs, not only extracted text.
3. Upload the Malayalam PDF/DOC/DOCX/RTF/text file in the Malayalam file box, or paste/type Malayalam directly.
4. The Malayalam page appears on the right in an editable Malayalam-font box.
5. Edit the Malayalam box directly; edits are kept page by page while you navigate.
6. Click `Copy Source Layout` when you want the Malayalam side to follow the current English page format.
7. If the PDF is scanned and no layout text is captured, the app creates a blank page layout instead of stopping.
8. Use `Add Text Block` in the Malayalam editor or `Add Table` from the Page Match tools to build the Malayalam page manually.
9. Use `Page Layout` mode to edit Malayalam in positioned blocks that follow the English page spacing, columns, and table-like line positions.
10. Use `Undo`, `Redo`, and `Delete` in the Malayalam editing section if a block/table/action was added by mistake.
11. Use `Previous`, `Next`, or the page number field to move through both documents together.
12. Paste licensed BSI Malayalam Bible text in the BSI helper box only when you need it as reference.
13. Click `Insert into Malayalam Editor` only if that BSI text should become part of the edited Malayalam document.
14. Use `Compose` to add verse numbers, references, symbols, glossary words, translation suggestions, and notes.
15. Use `Normalize Text` to clean references and number style.
16. Use `Run Checks` before export.
17. Export Word/HTML/InDesign Tagged Text/JSON, or print to PDF.
18. For final print layout, place the exported HTML or Tagged Text in InDesign.

## Notes On Your Latest Requirements

- Glossary: type an English word in `English word meaning` and click `Find Malayalam Meaning`.
- Browser save: the app auto-saves and restores the latest browser work when reopened.
- Malayalam typing: use the Malayalam editor directly, the built-in Malayalam character buttons, or the `Google Malayalam Typing` button.
- Word import: DOCX/RTF/PDF are most reliable. Legacy `.doc` is best effort; if text is missing, save the file as `.docx` or PDF and upload again.
- Google എഴുത്ത് ഉപകരണങ്ങൾ: use the `Google Malayalam Typing` button in the Malayalam Typing panel.

## Project Structure

```text
index.html          Main editing workspace
styles.css          Print/editor styling
app.js              Browser editor logic and export tools
                  Includes PDF page extraction using PDF.js
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

The easiest path is to deploy directly from GitHub:

1. Open `https://vercel.com/new`.
2. Import `Jayasree2020/ISB-malayalam`.
3. Keep the framework preset as `Other`.
4. Leave Build Command empty.
5. Leave Output Directory empty.
6. Deploy.

The app works immediately after deployment with browser save/export. Cloud database save and in-app translation are optional.

For local development, install Node.js from `https://nodejs.org/`, then in this folder run:

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

For optional cloud storage, use Vercel-managed Neon Postgres. It is SQL, has a free tier, and is the easiest Vercel-friendly option. You should not need to create tables manually; the API creates the `translation_projects` table automatically on first save.

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

## Deployment Check

After Vercel deploys, open:

```text
https://isb-malayalam.vercel.app/api/health
```

You should see `ok: true`. The response also tells you whether database and translation environment variables are configured.

## Google Translate Setup

1. Create or choose a Google Cloud project.
2. Enable Cloud Translation API.
3. Create a service account with Translation permissions.
4. Put the project ID in `GOOGLE_TRANSLATE_PROJECT_ID`.
5. Put the service account JSON in `GOOGLE_APPLICATION_CREDENTIALS_JSON`.

When the API is not configured, the editor opens Google Translate in a new browser tab with the selected text.

## Print And InDesign Plan

Current export uses only the Malayalam editing window content and gives you Word-compatible `.doc`, browser PDF, InDesign HTML, InDesign Tagged Text, and JSON. BSI helper text is not exported unless it is inserted into the Malayalam editing window. For a 3000-4000 page print project, the next production step should be a deeper style-controlled export layer:

- Paragraph styles: `VerseText`, `NoteText`, `ArticleTitle`, `ArticleBody`, `TableText`, `MapCaption`.
- Character styles: `VerseNumber`, `BibleReference`, `FootnoteSymbol`, `TranslatorNote`.
- Export options:
  - `.docx` with real Word styles.
  - `.icml` for direct InDesign placement.
  - Image/table asset manifest.

## Recommended Next Features

- OCR for scanned PDFs that do not contain selectable text.
- Server-side conversion for old binary `.doc` files that cannot be extracted cleanly in the browser.
- Deeper table/image reconstruction from PDFs. Current layout mode preserves text-block positions from selectable PDF text.
- Real `.docx` export with Word styles.
- Dedicated image library using Vercel Blob for very large print assets.
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
