const $ = (id) => document.getElementById(id);

const stateKeys = [
  "projectTitle",
  "sectionRef",
  "editorName",
  "englishText",
  "malayalamText",
  "bsiText",
  "finalText",
  "editorNotes",
  "glossaryInput",
  "bookStyle",
  "numberStyle"
];

const bookMap = {
  Genesis: "ഉല്പത്തി",
  Gen: "ഉല്പ",
  Exodus: "പുറപ്പാട്",
  Exod: "പുറ",
  Matthew: "മത്തായി",
  Matt: "മത്താ",
  Mark: "മർക്കോസ്",
  Luke: "ലൂക്കോസ്",
  John: "യോഹന്നാൻ",
  Acts: "പ്രവൃത്തികൾ",
  Romans: "റോമർ",
  Rom: "റോമ",
  Corinthians: "കൊരിന്ത്യർ",
  Cor: "കൊരി",
  Psalms: "സങ്കീർത്തനങ്ങൾ",
  Psalm: "സങ്കീ",
  Ps: "സങ്കീ",
  Revelation: "വെളിപ്പാട്",
  Rev: "വെളി"
};

const mlDigits = ["൦", "൧", "൨", "൩", "൪", "൫", "൬", "൭", "൮", "൯"];
const mlDigitMap = Object.fromEntries(mlDigits.map((digit, index) => [digit, String(index)]));
const mlKeys = ["അ", "ആ", "ഇ", "ഈ", "ഉ", "ഊ", "എ", "ഏ", "ഐ", "ഒ", "ഓ", "ഔ", "ക", "ഖ", "ഗ", "ച", "ജ", "ട", "ഡ", "ണ", "ത", "ദ", "ന", "പ", "ബ", "മ", "യ", "ര", "ല", "വ", "ശ", "ഷ", "സ", "ഹ", "ള", "ഴ", "റ", "്", "ം", "ഃ"];

let englishPages = [];
let malayalamPages = [];
let englishLayouts = [];
let malayalamLayouts = [];
let imageAssets = [];
let selectedImageId = "";
let currentPage = 1;
let isShowingPage = false;
let malayalamEditMode = "text";
let sourceViewerFile = null;
let localDbPromise;
let selectedLayoutBlock = null;
let undoStack = [];
let redoStack = [];
let suppressHistory = false;
let malayalamZoom = Number(localStorage.getItem("mlTranslationWorkbench:malayalamZoom") || 100);
if (localStorage.getItem("mlTranslationWorkbench:fontDefaultVersion") !== "mlw-default-1") {
  localStorage.setItem("mlTranslationWorkbench:malayalamFontMode", "mlw");
  localStorage.setItem("mlTranslationWorkbench:fontDefaultVersion", "mlw-default-1");
}
let malayalamFontMode = localStorage.getItem("mlTranslationWorkbench:malayalamFontMode") || "mlw";
let detectedDocumentFont = localStorage.getItem("mlTranslationWorkbench:detectedDocumentFont") || "";

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2400);
}

function applyMalayalamZoom(value) {
  malayalamZoom = Math.min(Math.max(Number(value) || 100, 70), 180);
  const textSize = 16 * (malayalamZoom / 100);
  const layoutSize = 14 * (malayalamZoom / 100);
  const tableSize = 13 * (malayalamZoom / 100);
  $("malayalamText")?.style.setProperty("font-size", `${textSize}px`);
  $("finalText")?.style.setProperty("font-size", `${textSize}px`);
  $("malayalamLayoutEditor")?.style.setProperty("--malayalam-editor-font-size", `${textSize}px`);
  $("malayalamLayoutEditor")?.style.setProperty("--malayalam-layout-font-size", `${layoutSize}px`);
  $("malayalamLayoutEditor")?.style.setProperty("--malayalam-table-font-size", `${tableSize}px`);
  localStorage.setItem("mlTranslationWorkbench:malayalamZoom", String(malayalamZoom));
  renderMalayalamLayout();
  toast(`Malayalam zoom ${malayalamZoom}%`);
}

function applyMalayalamFontMode(mode = malayalamFontMode) {
  malayalamFontMode = ["document", "mlw", "unicode"].includes(mode) ? mode : "mlw";
  const documentStack = detectedDocumentFont
    ? `"${detectedDocumentFont}", "MLW-TTKarthika", "Karthika", "Kartika", "Nirmala UI", serif`
    : '"MLW-TTKarthika", "Karthika", "Kartika", "Nirmala UI", serif';
  const fontStack = malayalamFontMode === "document"
    ? documentStack
    : malayalamFontMode === "mlw"
      ? '"MLW-TTKarthika", "Karthika", "Kartika", "Nirmala UI", serif'
      : '"Nirmala UI", "Karthika", "Kartika", "Rachana", "AnjaliOldLipi", serif';
  document.documentElement.style.setProperty("--malayalam-font-family", fontStack);
  if ($("malayalamFontMode")) $("malayalamFontMode").value = malayalamFontMode;
  localStorage.setItem("mlTranslationWorkbench:malayalamFontMode", malayalamFontMode);
}

function setDetectedDocumentFont(fontName) {
  if (!fontName) return;
  detectedDocumentFont = fontName;
  localStorage.setItem("mlTranslationWorkbench:detectedDocumentFont", detectedDocumentFont);
  malayalamFontMode = "document";
  applyMalayalamFontMode("document");
  toast(`Using document font: ${fontName}`);
}

function snapshot() {
  persistCurrentPageEdits();
  return {
    ...Object.fromEntries(stateKeys.map((key) => [key, $(key)?.value ?? ""])),
    englishPages,
    malayalamPages,
    englishLayouts,
    malayalamLayouts,
    malayalamEditMode,
    imageAssets,
    selectedImageId,
    currentPage
  };
}

function localProjectId(data) {
  const title = data.projectTitle || "Malayalam Translation Project";
  const section = data.sectionRef || "main";
  return `${title}::${section}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function openLocalDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (localDbPromise) return localDbPromise;

  localDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("malayalamTranslationWorkbench", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return localDbPromise;
}

function restore(data) {
  stateKeys.forEach((key) => {
    if ($(key) && data[key] !== undefined) $(key).value = data[key];
  });
  englishPages = Array.isArray(data.englishPages) ? data.englishPages : [];
  malayalamPages = Array.isArray(data.malayalamPages) ? data.malayalamPages : [];
  englishLayouts = Array.isArray(data.englishLayouts) ? data.englishLayouts : [];
  malayalamLayouts = Array.isArray(data.malayalamLayouts) ? data.malayalamLayouts : [];
  malayalamEditMode = data.malayalamEditMode || "text";
  imageAssets = Array.isArray(data.imageAssets) ? data.imageAssets : [];
  selectedImageId = data.selectedImageId || imageAssets[0]?.id || "";
  currentPage = Number(data.currentPage || 1);
  renderImageGallery();
  showPage(currentPage);
  renderPreview();
}

function captureEditState() {
  return {
    values: Object.fromEntries(stateKeys.map((key) => [key, $(key)?.value ?? ""])),
    malayalamPages: structuredClone(malayalamPages),
    malayalamLayouts: structuredClone(malayalamLayouts),
    imageAssets: structuredClone(imageAssets),
    selectedImageId,
    currentPage,
    malayalamEditMode
  };
}

function applyEditState(state) {
  suppressHistory = true;
  Object.entries(state.values || {}).forEach(([key, value]) => {
    if ($(key)) $(key).value = value;
  });
  malayalamPages = structuredClone(state.malayalamPages || []);
  malayalamLayouts = structuredClone(state.malayalamLayouts || []);
  imageAssets = structuredClone(state.imageAssets || []);
  selectedImageId = state.selectedImageId || "";
  currentPage = Number(state.currentPage || 1);
  malayalamEditMode = state.malayalamEditMode || "text";
  selectedLayoutBlock = null;
  renderImageGallery();
  showPage(currentPage);
  suppressHistory = false;
}

function saveEditHistory() {
  if (suppressHistory) return;
  const state = captureEditState();
  const serialized = JSON.stringify(state);
  if (undoStack.at(-1)?.serialized === serialized) return;
  undoStack.push({ state, serialized });
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}

function undoEdit() {
  if (!undoStack.length) {
    toast("Nothing to undo.");
    return;
  }
  persistCurrentPageEdits();
  redoStack.push(captureEditState());
  const previous = undoStack.pop().state;
  applyEditState(previous);
  toast("Undo done.");
}

function redoEdit() {
  if (!redoStack.length) {
    toast("Nothing to redo.");
    return;
  }
  persistCurrentPageEdits();
  undoStack.push({ state: captureEditState(), serialized: JSON.stringify(captureEditState()) });
  applyEditState(redoStack.pop());
  toast("Redo done.");
}

async function saveLocal() {
  const data = snapshot();
  const record = { ...data, id: localProjectId(data), updatedAt: new Date().toISOString() };
  const db = await openLocalDb();

  if (db) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  localStorage.setItem("mlTranslationWorkbench:last", JSON.stringify(record));
  toast("Saved in this browser.");
}

function resetWorkspace() {
  if (sourceViewerFile?.url) URL.revokeObjectURL(sourceViewerFile.url);
  sourceViewerFile = null;
  englishPages = [];
  malayalamPages = [];
  englishLayouts = [];
  malayalamLayouts = [];
  imageAssets = [];
  selectedImageId = "";
  selectedLayoutBlock = null;
  currentPage = 1;
  ["englishText", "malayalamText", "bsiText", "finalText", "editorNotes"].forEach((key) => {
    if ($(key)) $(key).value = "";
  });
  if ($("projectTitle")) $("projectTitle").value = "Malayalam Translation Project";
  if ($("englishFileInput")) $("englishFileInput").value = "";
  if ($("malayalamFileInput")) $("malayalamFileInput").value = "";
  updatePageStatus();
  renderSourceViewer();
  renderMalayalamLayout();
  applyMalayalamMode();
  renderImageGallery();
  renderPreview();
}

async function deleteLocalSaves() {
  if (!window.confirm("Delete saved browser work and clear the current display?")) return;
  const db = await openLocalDb();
  if (db) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }
  localStorage.removeItem("mlTranslationWorkbench:last");
  localStorage.removeItem("mlTranslationWorkbench");
  resetWorkspace();
  toast("Saved browser work deleted. Upload files again to display them.");
}

async function loadLocal() {
  const current = snapshot();
  const id = localProjectId(current);
  const db = await openLocalDb();
  let record = null;

  if (db) {
    record = await new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readonly");
      const request = transaction.objectStore("projects").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  if (!record) {
    const raw = localStorage.getItem("mlTranslationWorkbench:last") || localStorage.getItem("mlTranslationWorkbench");
    if (!raw) {
      toast("No browser save found yet.");
      return;
    }
    record = JSON.parse(raw);
  }

  restore(record);
  toast("Loaded saved work.");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function splitTextIntoPages(text) {
  const byFormFeed = text.split(/\f+/).map((page) => page.trim()).filter(Boolean);
  if (byFormFeed.length > 1) return byFormFeed;

  const byPageLabel = text.split(/\n\s*(?:page|p)\.?\s+\d+\s*\n/gi).map((page) => page.trim()).filter(Boolean);
  return byPageLabel.length > 1 ? byPageLabel : [text.trim()];
}

function cleanImportedLine(line) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/[\u00ff\u00fe\ufffd\uffff\ufffe\ufdd0-\ufdef]{2,}/g, "")
    .replace(/[\uffff\ufffe\ufdd0-\ufdef]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]+$/g, "");
}

function repairMalayalamMojibake(value) {
  if (!/[\u00e0\u00c2\u00c3][\u0080-\u00ff]|\u00e0\u00b4|\u00e0\u00b5|\u00c2/.test(value)) return value;
  try {
    const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const originalMalayalam = (value.match(/[\u0D00-\u0D7F]/g) || []).length;
    const decodedMalayalam = (decoded.match(/[\u0D00-\u0D7F]/g) || []).length;
    return decodedMalayalam > originalMalayalam ? decoded : value;
  } catch {
    return value;
  }
}

function cleanImportedWordText(text) {
  return repairMalayalamMojibake(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u00ff\u00fe\ufffd\uffff\ufffe\ufdd0-\ufdef]{2,}/g, "")
    .replace(/[\uffff\ufffe\ufdd0-\ufdef]/g, "")
    .split("\n")
    .map(cleanImportedLine)
    .join("\n")
    .replace(/\n{5,}/g, "\n\n\n\n")
    .trimEnd();
}

function readableTextScore(text) {
  const cleaned = text.replace(/\s/g, "");
  if (!cleaned.length) return 0;
  const readable = (cleaned.match(/[\p{L}\p{N}\u0D00-\u0D7F.,;:!?()[\]\-]/gu) || []).length;
  const junk = (cleaned.match(/[\u00ff\u00fe\ufffd\uffff\ufffe\ufdd0-\ufdef]/g) || []).length;
  return (readable - junk * 3) / cleaned.length;
}

function visibleJunkRatio(text) {
  const compact = text.replace(/\s/g, "");
  if (!compact.length) return 0;
  const allowed = compact.match(/[\u0D00-\u0D7F\p{Script=Latin}\p{N}\p{P}\p{S}]/gu) || [];
  const hardJunk = compact.match(/[\uffff\ufffe\ufffd\ufdd0-\ufdef\uE000-\uF8FF]/g) || [];
  return Math.max(1 - allowed.length / compact.length, hardJunk.length / compact.length);
}

function looksLikeBinaryText(text) {
  const compact = text.replace(/\s/g, "");
  if (compact.length < 40) return false;
  return visibleJunkRatio(compact) > 0.2 || readableTextScore(compact) < 0.35;
}

function assertReadableImport(text, label = "file") {
  if (looksLikeBinaryText(text)) {
    throw new Error(`The ${label} contains binary or corrupted text. Please convert it to DOCX or PDF and upload again.`);
  }
  return text;
}

async function extractPdfPages(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF reader is still loading. Please try again in a moment.");
  }

  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  const layouts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    let lastY = null;
    const lines = [];
    let line = "";
    let lineItems = [];
    const positionedLines = [];

    const pushLine = () => {
      const text = line.trim();
      if (!text) {
        line = "";
        lineItems = [];
        return;
      }
      const minX = Math.min(...lineItems.map((item) => item.x));
      const maxX = Math.max(...lineItems.map((item) => item.x + item.width));
      const avgY = lineItems.reduce((sum, item) => sum + item.y, 0) / lineItems.length;
      const avgHeight = lineItems.reduce((sum, item) => sum + item.height, 0) / lineItems.length;
      lines.push(text);
      positionedLines.push({
        text,
        x: minX / viewport.width,
        y: 1 - avgY / viewport.height,
        width: Math.max((maxX - minX) / viewport.width, 0.08),
        height: Math.max(avgHeight / viewport.height, 0.018)
      });
      line = "";
      lineItems = [];
    };

    textContent.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        pushLine();
      }
      line += `${item.str} `;
      lineItems.push({
        x: item.transform[4],
        y: item.transform[5],
        width: item.width || item.str.length * 5,
        height: item.height || Math.abs(item.transform[0]) || 10
      });
      lastY = y;
    });

    pushLine();
    pages.push(lines.filter(Boolean).join("\n"));
    layouts.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      lines: positionedLines
    });
  }

  file._extractedLayouts = layouts;
  return pages;
}

async function extractDocxPages(file) {
  if (!window.mammoth) {
    throw new Error("Word reader is still loading. Please try again in a moment.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const detectedFont = await detectDocxFont(arrayBuffer);
  if (detectedFont) setDetectedDocumentFont(detectedFont);
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return splitTextIntoPages(cleanImportedWordText(result.value || ""));
}

async function detectDocxFont(arrayBuffer) {
  if (!window.JSZip) return "";
  try {
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const files = ["word/document.xml", "word/styles.xml"];
    const counts = new Map();
    for (const path of files) {
      const file = zip.file(path);
      if (!file) continue;
      const xmlText = await file.async("text");
      const xml = new DOMParser().parseFromString(xmlText, "application/xml");
      Array.from(xml.getElementsByTagName("w:rFonts")).forEach((node) => {
        ["w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"].forEach((attr) => {
          const value = node.getAttribute(attr);
          if (!value || /^\+/.test(value)) return;
          counts.set(value, (counts.get(value) || 0) + 1);
        });
      });
    }
    const preferred = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([font]) => font)
      .find((font) => /mlw|karthika|kartika|rachana|anjali|malayalam|meera|nirmala/i.test(font));
    return preferred || Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  } catch {
    return "";
  }
}

function stripRtf(value) {
  return value
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\u(-?\d+)\??/g, (match, code) => String.fromCharCode(Number(code)))
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function cleanLegacyDocText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[\uffff\ufffe\ufffd\ufdd0-\ufdef\uE000-\uF8FF]/g, " ")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u024F\u0D00-\u0D7F]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function extractPrintableRuns(text) {
  const runs = text.match(/[\u0020-\u007E\u00A0-\uFFFF]{12,}/g) || [];
  return runs
    .map((run) => cleanLegacyDocText(run))
    .filter((run) => /[\p{L}\u0D00-\u0D7F]/u.test(run))
    .join("\n");
}

async function extractLegacyDocPages(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const signature = Array.from(bytes.slice(0, 8)).map((byte) => byte.toString(16).padStart(2, "0")).join(" ");

  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (/<html|<!doctype html/i.test(utf8)) {
    const doc = new DOMParser().parseFromString(utf8, "text/html");
    return splitTextIntoPages(cleanImportedWordText(cleanLegacyDocText(doc.body?.innerText || utf8)));
  }
  if (/^{\\rtf/i.test(utf8)) return splitTextIntoPages(cleanImportedWordText(stripRtf(utf8)));

  const utf16 = new TextDecoder("utf-16le", { fatal: false }).decode(bytes);
  const utf16Runs = extractPrintableRuns(utf16);
  const ansiRuns = extractPrintableRuns(new TextDecoder("windows-1252", { fatal: false }).decode(bytes));
  const best = utf16Runs.length > ansiRuns.length ? utf16Runs : ansiRuns;
  const cleaned = cleanLegacyDocText(best);

  if (cleaned.length < 40 || readableTextScore(cleaned) < 0.45) {
    throw new Error(`This looks like an old binary Word .doc file (${signature}). Please save it as .docx or PDF for reliable import.`);
  }

  return splitTextIntoPages(cleanImportedWordText(cleaned));
}

async function extractFilePages(file) {
  if (/\.pdf$/i.test(file.name)) return extractPdfPages(file);
  if (/\.docx$/i.test(file.name)) return extractDocxPages(file);
  if (/\.doc$/i.test(file.name)) return extractLegacyDocPages(file);
  if (/\.rtf$/i.test(file.name)) return splitTextIntoPages(cleanImportedWordText(stripRtf(await file.text())));
  if (/\.(txt|md|html)$/i.test(file.name)) return splitTextIntoPages(cleanImportedWordText(await file.text()));
  if (file.type.startsWith("image/")) return [""];
  throw new Error("Please upload PDF, DOC, DOCX, RTF, TXT, MD, HTML, or an image.");
}

function setSourceViewer(file, pages = []) {
  if (sourceViewerFile?.url) URL.revokeObjectURL(sourceViewerFile.url);
  const url = URL.createObjectURL(file);
  let type = "text";
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") type = "pdf";
  if (file.type.startsWith("image/")) type = "image";
  if (/\.(doc|docx|rtf)$/i.test(file.name)) type = "doc";

  sourceViewerFile = {
    name: file.name,
    type,
    url,
    pages
  };
  renderSourceViewer();
}

function renderSourceViewer() {
  const viewer = $("sourceViewer");
  if (!viewer) return;

  if (!sourceViewerFile) {
    viewer.innerHTML = '<p class="hint">Upload an English PDF, Word file, image, or text file to view it here.</p>';
    return;
  }

  const { type, url, name, pages } = sourceViewerFile;
  if (type === "pdf") {
    viewer.innerHTML = `<iframe title="${escapeHtml(name)}" src="${url}#page=${currentPage}&view=FitH"></iframe>`;
    return;
  }

  if (type === "image") {
    viewer.innerHTML = `<img alt="${escapeHtml(name)}" src="${url}">`;
    return;
  }

  const pageText = pages[currentPage - 1] || pages[0] || "";
  viewer.innerHTML = `<pre class="source-text-view">${escapeHtml(pageText || "No selectable text was found in this file.")}</pre>`;
}

function updatePageStatus() {
  const total = Math.max(englishPages.length, malayalamPages.length, 1);
  $("pageNumber").max = String(total);
  $("pageNumber").value = String(currentPage);
  $("pageStatus").textContent = `Page ${currentPage} of ${total}. English pages: ${englishPages.length || 0}. Malayalam pages: ${malayalamPages.length || 0}.`;
}

function showPage(pageNumber) {
  persistCurrentPageEdits();
  const total = Math.max(englishPages.length, malayalamPages.length, 1);
  currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), total);

  isShowingPage = true;
  if (englishPages.length) $("englishText").value = englishPages[currentPage - 1] || "";
  if (malayalamPages.length) $("malayalamText").value = malayalamPages[currentPage - 1] || "";
  isShowingPage = false;

  updatePageStatus();
  renderSourceViewer();
  renderMalayalamLayout();
  applyMalayalamMode();
  renderPreview();
}

function persistCurrentPageEdits() {
  if (isShowingPage || suppressHistory) return;
  const index = currentPage - 1;
  if (englishPages.length && index >= 0) englishPages[index] = $("englishText").value;
  if (malayalamPages.length && index >= 0) malayalamPages[index] = $("malayalamText").value;
  if (malayalamLayouts[index]) {
    const page = $("malayalamLayoutEditor").querySelector(".layout-page");
    if (page) {
      malayalamLayouts[index].lines = Array.from(page.querySelectorAll(".layout-block, .layout-table")).map((block) => ({
        type: block.dataset.type || "text",
        text: block.dataset.type === "table" ? tableElementToText(block) : cleanEditableText(block.innerText),
        html: block.dataset.type === "table" ? block.innerHTML : "",
        x: Number(block.dataset.x),
        y: Number(block.dataset.y),
        width: Number(block.dataset.width),
        height: Number(block.dataset.height)
      }));
      $("malayalamText").value = malayalamLayouts[index].lines.map((line) => line.text).filter(Boolean).join("\n");
      malayalamPages[index] = $("malayalamText").value;
    }
  }
}

async function importIntoTarget(file, target) {
  if (!file) return;
  saveEditHistory();
  $("importStatus").textContent = `Reading ${file.name}...`;
  const pages = await extractFilePages(file);

  if (!pages.length && !file.type.startsWith("image/")) {
    pages.push("");
  }
  const importedText = pages.join("\n");
  if (!file.type.startsWith("image/")) {
    assertReadableImport(importedText, file.name);
  }

  if (target === "english") {
    englishPages = pages.slice();
    englishLayouts = Array.isArray(file._extractedLayouts) ? file._extractedLayouts : [];
    setSourceViewer(file, pages);
    $("englishText").value = englishPages[currentPage - 1] || englishPages[0] || "";
    $("importStatus").textContent = `English loaded from ${file.name}: ${englishPages.length} page(s).`;
    toast(`English loaded: ${englishPages.length} page(s).`);
  } else {
    if (file.type.startsWith("image/")) {
      await addImageFile(file);
      $("importStatus").textContent = "Malayalam image added to preview. Type or paste editable Malayalam text in the Malayalam box.";
      toast("Malayalam image added. OCR is needed to make image text editable.");
      return;
    }
    malayalamPages = pages.slice();
    if (!malayalamLayouts.length) malayalamLayouts = [];
    $("malayalamText").value = malayalamPages[currentPage - 1] || malayalamPages[0] || "";
    $("importStatus").textContent = `Malayalam loaded from ${file.name}: ${malayalamPages.length} page(s).`;
    toast(`Malayalam loaded: ${malayalamPages.length} page(s).`);
  }

  showPage(currentPage);
}

function createMalayalamLayoutFromSource() {
  persistCurrentPageEdits();
  saveEditHistory();
  const index = currentPage - 1;
  const source = englishLayouts[index] || { width: 612, height: 792, lines: [] };

  const existingMalayalam = ($("malayalamText").value || "").split(/\r?\n/);
  malayalamLayouts[index] = {
    width: source.width,
    height: source.height,
    lines: source.lines.length
      ? source.lines.map((line, lineIndex) => ({
          ...line,
          type: "text",
          text: existingMalayalam[lineIndex] || ""
        }))
      : [
          {
            type: "text",
            text: existingMalayalam.filter(Boolean).join("\n"),
            x: 0.08,
            y: 0.08,
            width: 0.84,
            height: 0.08
          }
        ]
  };
  malayalamEditMode = "layout";
  renderMalayalamLayout();
  applyMalayalamMode();
  toast(source.lines.length ? "Source page layout copied to Malayalam editor." : "Blank page layout created. Add text blocks or tables manually.");
}

function ensureCurrentLayout() {
  const index = currentPage - 1;
  if (!malayalamLayouts[index]) {
    const source = englishLayouts[index] || { width: 612, height: 792 };
    malayalamLayouts[index] = { width: source.width, height: source.height, lines: [] };
  }
  malayalamEditMode = "layout";
  applyMalayalamMode();
}

function addLayoutTextBlock() {
  persistCurrentPageEdits();
  saveEditHistory();
  ensureCurrentLayout();
  const index = currentPage - 1;
  malayalamLayouts[index].lines.push({
    type: "text",
    text: "മലയാളം ടെക്സ്റ്റ്",
    x: 0.08,
    y: Math.min(0.12 + malayalamLayouts[index].lines.length * 0.06, 0.88),
    width: 0.84,
    height: 0.04
  });
  renderMalayalamLayout();
  toast("Text block added.");
}

function tableHtml(rows = 3, columns = 3) {
  return `<table>${Array.from({ length: rows }).map(() => `<tr>${Array.from({ length: columns }).map(() => '<td contenteditable="plaintext-only"></td>').join("")}</tr>`).join("")}</table>`;
}

function cleanEditableText(value) {
  return cleanMalayalamPaste(value)
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function tableElementToText(block) {
  return Array.from(block.querySelectorAll("tr"))
    .map((row) => Array.from(row.querySelectorAll("td")).map((cell) => cleanEditableText(cell.innerText)).join("\t"))
    .filter((row) => row.trim())
    .join("\n");
}

function addLayoutTable() {
  persistCurrentPageEdits();
  saveEditHistory();
  ensureCurrentLayout();
  const index = currentPage - 1;
  malayalamLayouts[index].lines.push({
    type: "table",
    html: tableHtml(3, 3),
    x: 0.08,
    y: Math.min(0.16 + malayalamLayouts[index].lines.length * 0.06, 0.78),
    width: 0.84,
    height: 0.18
  });
  renderMalayalamLayout();
  toast("Table added. Click cells to type.");
}

function renderMalayalamLayout() {
  const editor = $("malayalamLayoutEditor");
  if (!editor) return;
  const layout = malayalamLayouts[currentPage - 1];

  if (!layout?.lines?.length) {
    editor.innerHTML = '<div class="layout-empty"><p>Click Copy Source Layout to create editable Malayalam blocks with the English page format. If the source is scanned, use Add Text Block here, or use Add Table from the Page Match tools on the left.</p><div class="layout-empty-actions"><button id="copyLayoutEmptyBtn" type="button">Copy Source Layout</button><button id="addTextBlockEmptyBtn" type="button">Add Text Block</button></div></div>';
    $("copyLayoutEmptyBtn")?.addEventListener("click", createMalayalamLayoutFromSource);
    $("addTextBlockEmptyBtn")?.addEventListener("click", addLayoutTextBlock);
    return;
  }

  const maxWidth = Math.min(editor.clientWidth ? editor.clientWidth - 28 : 620, 760);
  const width = maxWidth;
  const height = Math.max(width * (layout.height / layout.width), 760);
  const lines = layout.lines
    .map((line, index) => {
      const left = Math.max(line.x * width, 0);
      const top = Math.max(line.y * height, 0);
      const lineWidth = Math.max(line.width * width, 60);
      const minHeight = Math.max(line.height * height, 18);
      if (line.type === "table") {
        return `<div class="layout-table" data-type="table" data-index="${index}" data-x="${line.x}" data-y="${line.y}" data-width="${line.width}" data-height="${line.height}" style="left:${left}px;top:${top}px;width:${lineWidth}px;min-height:${minHeight}px;">${line.html || tableHtml(3, 3)}</div>`;
      }
      return `<div class="layout-block layout-line" contenteditable="plaintext-only" data-type="text" data-index="${index}" data-x="${line.x}" data-y="${line.y}" data-width="${line.width}" data-height="${line.height}" style="left:${left}px;top:${top}px;width:${lineWidth}px;min-height:${minHeight}px;">${escapeHtml(line.text || "")}</div>`;
    })
    .join("");

  editor.innerHTML = `<div class="layout-page" style="width:${width}px;height:${height}px;">${lines}</div>`;
  editor.querySelectorAll(".layout-block, .layout-table").forEach((block) => {
    block.addEventListener("click", (event) => {
      event.stopPropagation();
      selectLayoutBlock(block);
    });
    block.addEventListener("focusin", () => {
      saveEditHistory();
      selectLayoutBlock(block);
    });
    block.addEventListener("input", persistCurrentPageEdits);
    block.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!text) return;
      const cleaned = cleanMalayalamPaste(text);
      if (!cleaned && text.trim()) {
        event.preventDefault();
        toast("That pasted text looks corrupted. Convert the source to DOCX/PDF and try again.");
        return;
      }
      event.preventDefault();
      insertPlainTextAtSelection(cleaned);
      persistCurrentPageEdits();
    });
  });
  editor.querySelector(".layout-page")?.addEventListener("click", () => selectLayoutBlock(null));
}

function applyMalayalamMode() {
  const textarea = $("malayalamText");
  const layout = $("malayalamLayoutEditor");
  if (malayalamEditMode === "layout") {
    textarea.classList.add("hidden");
    layout.classList.remove("hidden");
  } else {
    layout.classList.add("hidden");
    textarea.classList.remove("hidden");
  }
}

function selectLayoutBlock(block) {
  selectedLayoutBlock?.classList.remove("selected");
  selectedLayoutBlock = block;
  selectedLayoutBlock?.classList.add("selected");
}

function deleteSelectedEdit() {
  saveEditHistory();
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && $("malayalamLayoutEditor")?.contains(selection.anchorNode)) {
    selection.deleteFromDocument();
    persistCurrentPageEdits();
    renderMalayalamLayout();
    toast("Selected layout text deleted.");
    return;
  }

  if (selectedLayoutBlock) {
    selectedLayoutBlock.remove();
    selectedLayoutBlock = null;
    persistCurrentPageEdits();
    renderMalayalamLayout();
    toast("Selected layout item deleted.");
    return;
  }

  const area = selectedTextarea();
  if (area && area.selectionStart !== area.selectionEnd) {
    const start = area.selectionStart;
    area.value = area.value.slice(0, start) + area.value.slice(area.selectionEnd);
    area.selectionStart = area.selectionEnd = start;
    area.focus();
    persistCurrentPageEdits();
    renderPreview();
    toast("Selected text deleted.");
    return;
  }

  toast("Select text, a layout block, or a table first.");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toMalayalamDigits(value) {
  return value.replace(/\d/g, (digit) => mlDigits[Number(digit)]);
}

function toWesternDigits(value) {
  return value.replace(/[൦-൯]/g, (digit) => mlDigitMap[digit] || digit);
}

function cleanMalayalamPaste(value) {
  const cleaned = toWesternDigits(repairMalayalamMojibake(value))
    .replace(/[\uffff\ufffe\ufffd\ufdd0-\ufdef\uE000-\uF8FF]/g, "")
    .replace(/\u200c|\u200d/g, "");
  return looksLikeBinaryText(cleaned) ? "" : cleaned;
}

function normalizeReferences(text) {
  let output = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s([,.;:])/g, "$1").trim())
    .join("\n");
  if ($("bookStyle").value === "malayalam") {
    Object.entries(bookMap).forEach(([en, ml]) => {
      output = output.replace(new RegExp(`\\b${en}\\.?\\b`, "gi"), ml);
    });
  }
  output = output.replace(/(\d+)\s*:\s*(\d+)/g, "$1:$2");
  output = output.replace(/(\d+)\s*-\s*(\d+)/g, "$1-$2");
  if ($("numberStyle").value === "malayalam") output = toMalayalamDigits(output);
  return output.trim();
}

function selectedTextarea() {
  const active = document.activeElement;
  return active && active.tagName === "TEXTAREA" ? active : $("finalText");
}

function insertText(value) {
  const area = selectedTextarea();
  const cleanValue = area.id === "malayalamText" || area.lang === "ml" ? cleanMalayalamPaste(value) : value;
  const start = area.selectionStart;
  const end = area.selectionEnd;
  area.value = area.value.slice(0, start) + cleanValue + area.value.slice(end);
  area.focus();
  area.selectionStart = area.selectionEnd = start + cleanValue.length;
  renderPreview();
}

function insertPlainTextAtSelection(text) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  selection.deleteFromDocument();
  selection.getRangeAt(0).insertNode(document.createTextNode(cleanMalayalamPaste(text)));
  selection.collapseToEnd();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function addImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Please choose an image file.");
    return;
  }

  const dataUrl = await fileToDataUrl(file);
  const asset = {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name || "Pasted image",
    dataUrl,
    createdAt: new Date().toISOString()
  };

  imageAssets.push(asset);
  selectedImageId = asset.id;
  renderImageGallery();
  insertImageMarker(asset.id);
  toast("Image added to preview.");
}

function insertImageMarker(id = selectedImageId) {
  const asset = imageAssets.find((item) => item.id === id);
  if (!asset) {
    toast("Add or select an image first.");
    return;
  }
  insertText(`\n[image ${asset.id} ${asset.name}]\n`);
}

function renderImageGallery() {
  const box = $("imageGallery");
  if (!box) return;
  box.innerHTML = "";

  if (!imageAssets.length) {
    box.innerHTML = '<p class="hint">No images added yet.</p>';
    return;
  }

  imageAssets.forEach((asset) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `image-item${asset.id === selectedImageId ? " selected" : ""}`;
    item.innerHTML = `<img alt="" src="${asset.dataUrl}"><span class="image-name">${escapeHtml(asset.name)}</span>`;
    item.addEventListener("click", () => {
      selectedImageId = asset.id;
      renderImageGallery();
    });
    box.appendChild(item);
  });
}

function wrapSelection(kind) {
  const area = selectedTextarea();
  const start = area.selectionStart;
  const end = area.selectionEnd;
  const selected = area.value.slice(start, end) || (kind === "verse" ? "1" : "John 3:16");
  const value = kind === "verse" ? `[v ${selected}]` : `[ref ${selected}]`;
  area.value = area.value.slice(0, start) + value + area.value.slice(end);
  area.focus();
  renderPreview();
}

function splitVerses() {
  saveEditHistory();
  $("finalText").value = $("finalText").value.replace(/\s*(\d+)\s+/g, "\n[v $1] ");
  renderPreview();
  toast("Verse markers added where numbers were found.");
}

function placeBsiAtTop() {
  persistCurrentPageEdits();
  saveEditHistory();
  const bsi = $("bsiText").value.trim();
  if (!bsi) {
    toast("BSI helper box is empty.");
    return;
  }
  if (malayalamEditMode === "layout") {
    addLayoutTextBlock();
    const index = currentPage - 1;
    const last = malayalamLayouts[index]?.lines?.at(-1);
    if (last) last.text = bsi;
    renderMalayalamLayout();
  } else {
    const current = $("malayalamText").value.trimEnd();
    $("malayalamText").value = [bsi, current].filter(Boolean).join("\n\n");
    persistCurrentPageEdits();
  }
  renderPreview();
  toast("BSI text inserted into the Malayalam editor.");
}

function parseGlossary() {
  return $("glossaryInput").value
    .split(/\r?\n/)
    .map((line) => line.split("="))
    .filter((parts) => parts.length === 2)
    .map(([source, target]) => ({ source: source.trim(), target: target.trim() }))
    .filter((item) => item.source && item.target);
}

function suggestWords() {
  const english = $("englishText").value.toLowerCase();
  const suggestions = parseGlossary().filter((item) => english.includes(item.source.toLowerCase()));
  const box = $("suggestions");
  box.innerHTML = "";
  suggestions.forEach((item) => {
    const row = document.createElement("div");
    row.className = "suggestion";
    row.innerHTML = `<span>${escapeHtml(item.source)} → <strong lang="ml">${escapeHtml(item.target)}</strong></span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Insert";
    btn.addEventListener("click", () => insertText(item.target));
    row.appendChild(btn);
    box.appendChild(row);
  });
  if (!suggestions.length) box.textContent = "No glossary matches found in English text.";
}

async function saveCloud() {
  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot())
    });
    if (!response.ok) throw new Error(await response.text());
    toast("Saved to cloud database.");
  } catch (error) {
    toast("Cloud save needs Vercel storage connected. Browser save still works.");
  }
}

async function translateSelection() {
  const area = selectedTextarea();
  const selected = area.value.slice(area.selectionStart, area.selectionEnd);
  if (!selected) {
    toast("Select text to translate first.");
    return;
  }
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: selected, target: "ml" })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    insertText(data.translation);
  } catch (error) {
    window.open(`https://translate.google.com/?sl=en&tl=ml&text=${encodeURIComponent(selected)}&op=translate`, "_blank");
    toast("Opened Google Translate. Add API keys for in-app translation.");
  }
}

async function lookupGlossaryMeaning() {
  const word = $("glossaryLookupInput").value.trim();
  if (!word) {
    toast("Type an English word first.");
    return;
  }

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: word, target: "ml" })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const meaning = data.translation?.trim();
    if (!meaning) throw new Error("No Malayalam meaning returned.");
    const current = $("glossaryInput").value.trimEnd();
    $("glossaryInput").value = `${current}${current ? "\n" : ""}${word}=${meaning}`;
    suggestWords();
    toast("Malayalam meaning added to glossary.");
  } catch {
    window.open(`https://translate.google.com/?sl=en&tl=ml&text=${encodeURIComponent(word)}&op=translate`, "_blank");
    toast("Opened Google Translate for Malayalam meaning.");
  }
}

function openGoogleInputTools() {
  window.open("https://www.google.com/inputtools/try/", "_blank");
}

function openGoogleTranslateMalayalam() {
  const area = selectedTextarea();
  const selected = area.value?.slice(area.selectionStart, area.selectionEnd) || "";
  window.open(`https://translate.google.com/?sl=en&tl=ml&text=${encodeURIComponent(selected)}&op=translate`, "_blank");
}

function openTypeIt() {
  window.open("https://www.leosoftwares.in/", "_blank");
  toast("Opened TypeIt information/download page.");
}

async function copyForTypeIt() {
  const text = getEditedTextForExport();
  if (!text.trim()) {
    toast("Malayalam editing window is empty.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Malayalam text copied. Paste it into TypeIt.");
  } catch {
    const area = selectedTextarea();
    area.value = text;
    area.select();
    toast("Text selected. Press Ctrl+C, then paste into TypeIt.");
  }
}

function renderPreview() {
  $("printPreview").innerHTML = getEditedExportHtml() || "<p class=\"hint\">Print preview will appear here.</p>";
}

function renderRichText(raw) {
  const imageMap = Object.fromEntries(imageAssets.map((asset) => [asset.id, asset]));
  return escapeHtml(raw)
    .replace(/\[v\s+([^\]]+)\]/g, '<span class="verse-number">$1</span>')
    .replace(/\[ref\s+([^\]]+)\]/g, '<span class="reference">$1</span>')
    .replace(/\[image\s+([^\]\s]+)(?:\s+([^\]]+))?\]/g, (match, id, caption) => {
      const asset = imageMap[id];
      if (!asset) return `<span class="missing-image">${match}</span>`;
      const label = caption || asset.name || "Image";
      return `<figure class="print-image"><img src="${asset.dataUrl}" alt="${escapeHtml(label)}"><figcaption>${escapeHtml(label)}</figcaption></figure>`;
    })
    .split(/\n{2,}/)
    .map((para) => {
      const content = para.replace(/\n/g, "<br>");
      return content.includes('class="print-image"') ? content : `<p class="verse-line">${content}</p>`;
    })
    .join("");
}

function getEditedTextForExport() {
  persistCurrentPageEdits();
  const pageText = $("malayalamText").value.trimEnd();
  const finalText = $("finalText").value.trimEnd();
  return pageText || finalText;
}

function layoutToHtml(layout) {
  const width = Math.round(layout.width || 612);
  const height = Math.round(layout.height || 792);
  const blocks = (layout.lines || []).map((line) => {
    const left = `${(line.x || 0) * 100}%`;
    const top = `${(line.y || 0) * 100}%`;
    const blockWidth = `${Math.max(line.width || 0.2, 0.05) * 100}%`;
    const minHeight = `${Math.max(line.height || 0.025, 0.02) * 100}%`;
    if (line.type === "table") {
      return `<div class="export-layout-table" style="left:${left};top:${top};width:${blockWidth};min-height:${minHeight};">${line.html || tableHtml(3, 3)}</div>`;
    }
    return `<div class="export-layout-block" style="left:${left};top:${top};width:${blockWidth};min-height:${minHeight};">${renderRichText(line.text || "")}</div>`;
  }).join("");
  return `<section class="export-layout-page" style="width:${width}px;min-height:${height}px;">${blocks}</section>`;
}

function getEditedExportHtml() {
  persistCurrentPageEdits();
  const layout = malayalamLayouts[currentPage - 1];
  const hasLayout = layout?.lines?.length;
  if (hasLayout && malayalamEditMode === "layout") {
    return layoutToHtml(layout);
  }
  return renderRichText(getEditedTextForExport());
}

function getExportStyles() {
  const exportFont = malayalamFontMode === "document" && detectedDocumentFont
    ? `"${detectedDocumentFont}","MLW-TTKarthika","Karthika","Kartika","Nirmala UI",serif`
    : malayalamFontMode === "mlw"
      ? '"MLW-TTKarthika","Karthika","Kartika","Nirmala UI",serif'
      : '"Nirmala UI","Karthika","Kartika","Rachana","AnjaliOldLipi",serif';
  return `
    body{font-family:${exportFont};font-size:14pt;line-height:1.35;color:#17211c}
    p{margin:0 0 10px;white-space:pre-wrap}
    .verse-number{font-weight:bold;color:#a73f2b}
    .reference{font-style:italic}
    .export-layout-page{position:relative;margin:0 auto;background:#fff;page-break-after:always}
    .export-layout-block{position:absolute;white-space:pre-wrap;overflow-wrap:anywhere}
    .export-layout-table{position:absolute}
    .export-layout-table table{width:100%;border-collapse:collapse}
    .export-layout-table td{border:1px solid #888;padding:4px;vertical-align:top}
    .print-image img{max-width:100%;height:auto}
  `;
}

function runChecks() {
  const text = getEditedTextForExport();
  const checks = [
    text.trim() ? "Final body has content." : "Final body is empty.",
    /\[v\s+/.test(text) ? "Verse markers found." : "No verse markers found.",
    /\[ref\s+/.test(text) ? "Reference markers found." : "No reference markers found.",
    /[A-Za-z]{3,}\s+\d+:\d+/.test(text) ? "English references may still need Malayalam formatting." : "No obvious English references found.",
    $("bsiText").value.trim() ? "BSI top text area has content." : "BSI text area is empty."
  ];
  $("checkList").innerHTML = checks.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  toast("Checks completed.");
}

function exportHtml() {
  persistCurrentPageEdits();
  const data = snapshot();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.projectTitle)}</title><style>${getExportStyles()}</style></head><body>${getEditedExportHtml()}</body></html>`;
  download(`${data.projectTitle || "translation"}-indesign.html`, html, "text/html;charset=utf-8");
}

function exportDoc() {
  persistCurrentPageEdits();
  const data = snapshot();
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(data.projectTitle)}</title><style>${getExportStyles()}</style></head><body>${getEditedExportHtml()}</body></html>`;
  download(`${data.projectTitle || "translation"}.doc`, doc, "application/msword;charset=utf-8");
}

function exportTaggedText() {
  persistCurrentPageEdits();
  const data = snapshot();
  const text = getEditedTextForExport()
    .replace(/\[v\s+([^\]]+)\]/g, "<CharStyle:VerseNumber>$1<CharStyle:>")
    .replace(/\[ref\s+([^\]]+)\]/g, "<CharStyle:BibleReference>$1<CharStyle:>");
  const tagged = `<ASCII-WIN>\n<Version:18.0>\n<ParaStyle:MalayalamBody>\n${text.replace(/\n{2,}/g, "\n<ParaStyle:MalayalamBody>\n")}`;
  download(`${data.projectTitle || "translation"}-indesign-tagged.txt`, tagged, "text/plain;charset=utf-8");
}

function exportJson() {
  persistCurrentPageEdits();
  download(`${$("projectTitle").value || "translation"}-archive.json`, JSON.stringify(snapshot(), null, 2), "application/json;charset=utf-8");
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .view").forEach((el) => el.classList.remove("active"));
      tab.classList.add("active");
      $(`${tab.dataset.view}View`).classList.add("active");
      renderPreview();
    });
  });

  $("englishFileInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await importIntoTarget(file, "english");
    } catch (error) {
      $("importStatus").textContent = `Could not read English file: ${error.message}`;
      toast("English import failed.");
    }
  });

  $("malayalamFileInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await importIntoTarget(file, "malayalam");
    } catch (error) {
      $("importStatus").textContent = `Could not read Malayalam file: ${error.message}`;
      toast("Malayalam import failed.");
    }
  });
  $("imageFileInput")?.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      saveEditHistory();
      await addImageFile(file);
    } catch (error) {
      toast(`Image import failed: ${error.message}`);
    }
  });
  $("insertImageBtn")?.addEventListener("click", () => {
    saveEditHistory();
    insertImageMarker();
  });
  $("toggleExtractedEnglishBtn").addEventListener("click", () => {
    $("englishExtractedPanel").classList.toggle("collapsed");
  });
  $("undoEditBtn").addEventListener("click", undoEdit);
  $("redoEditBtn").addEventListener("click", redoEdit);
  $("deleteSelectionBtn").addEventListener("click", deleteSelectedEdit);
  $("editorOptionsBtn").addEventListener("click", () => {
    $("editorOptionsPanel").classList.toggle("hidden");
  });
  $("zoomOutMalayalamBtn").addEventListener("click", () => applyMalayalamZoom(malayalamZoom - 10));
  $("zoomInMalayalamBtn").addEventListener("click", () => applyMalayalamZoom(malayalamZoom + 10));
  $("prevPageBtn").addEventListener("click", () => showPage(currentPage - 1));
  $("nextPageBtn").addEventListener("click", () => showPage(currentPage + 1));
  $("pageNumber").addEventListener("change", () => showPage($("pageNumber").value));
  $("copyLayoutBtn").addEventListener("click", createMalayalamLayoutFromSource);
  $("copyLayoutInlineBtn").addEventListener("click", createMalayalamLayoutFromSource);
  $("addTextBlockBtn").addEventListener("click", addLayoutTextBlock);
  $("addTableBtn").addEventListener("click", addLayoutTable);
  $("textModeBtn").addEventListener("click", () => {
    persistCurrentPageEdits();
    malayalamEditMode = "text";
    applyMalayalamMode();
  });
  $("layoutModeBtn").addEventListener("click", () => {
    persistCurrentPageEdits();
    malayalamEditMode = "layout";
    renderMalayalamLayout();
    applyMalayalamMode();
  });

  $("saveLocalBtn").addEventListener("click", saveLocal);
  $("loadLocalBtn").addEventListener("click", loadLocal);
  $("deleteLocalBtn").addEventListener("click", deleteLocalSaves);
  $("saveCloudBtn").addEventListener("click", saveCloud);
  $("insertBsiBtn").addEventListener("click", placeBsiAtTop);
  $("applyGlossaryBtn").addEventListener("click", suggestWords);
  $("lookupGlossaryBtn").addEventListener("click", lookupGlossaryMeaning);
  $("googleInputToolsBtn").addEventListener("click", openGoogleInputTools);
  $("googleTranslateBtn").addEventListener("click", openGoogleTranslateMalayalam);
  $("typeItBtn").addEventListener("click", openTypeIt);
  $("copyForTypeItBtn").addEventListener("click", copyForTypeIt);
  $("malayalamFontMode").addEventListener("change", (event) => applyMalayalamFontMode(event.target.value));
  $("normalizeBtn").addEventListener("click", () => {
    saveEditHistory();
    $("finalText").value = normalizeReferences($("finalText").value);
    renderPreview();
    toast("Text normalized.");
  });
  $("cleanRefsBtn").addEventListener("click", () => {
    saveEditHistory();
    const area = selectedTextarea();
    area.value = normalizeReferences(area.value);
    renderPreview();
  });
  $("splitVersesBtn").addEventListener("click", splitVerses);
  $("translateSelectionBtn").addEventListener("click", translateSelection);
  $("exportHtmlBtn").addEventListener("click", exportHtml);
  $("exportDocBtn").addEventListener("click", exportDoc);
  $("exportTaggedTextBtn").addEventListener("click", exportTaggedText);
  $("exportJsonBtn").addEventListener("click", exportJson);
  $("printPdfBtn").addEventListener("click", () => {
    renderPreview();
    window.print();
  });
  $("runChecksBtn").addEventListener("click", runChecks);

  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => insertText(button.dataset.insert));
  });
  document.querySelectorAll("[data-wrap]").forEach((button) => {
    button.addEventListener("click", () => wrapSelection(button.dataset.wrap));
  });
  $("englishText").addEventListener("input", () => {
    persistCurrentPageEdits();
    renderPreview();
  });
  $("malayalamText").addEventListener("input", () => {
    const start = $("malayalamText").selectionStart;
    const end = $("malayalamText").selectionEnd;
    const cleaned = cleanMalayalamPaste($("malayalamText").value);
    if (cleaned !== $("malayalamText").value) {
      $("malayalamText").value = cleaned;
      $("malayalamText").selectionStart = start;
      $("malayalamText").selectionEnd = end;
    }
    persistCurrentPageEdits();
    renderPreview();
  });
  $("malayalamText").addEventListener("focus", saveEditHistory);
  $("malayalamText").addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!text) return;
    const cleaned = cleanMalayalamPaste(text);
    if (!cleaned && text.trim()) {
      event.preventDefault();
      toast("That pasted text looks corrupted. Convert the source to DOCX/PDF and try again.");
      return;
    }
    saveEditHistory();
    event.preventDefault();
    insertText(cleaned);
  });
  $("finalText")?.addEventListener("focus", saveEditHistory);
  $("bsiText")?.addEventListener("focus", saveEditHistory);
  stateKeys
    .filter((key) => key !== "englishText" && key !== "malayalamText")
    .forEach((key) => $(key)?.addEventListener("input", () => {
      renderPreview();
    }));
}

function buildMalayalamKeyboard() {
  const box = $("malayalamKeys");
  mlKeys.forEach((char) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = char;
    button.addEventListener("click", () => insertText(char));
    box.appendChild(button);
  });
}

buildMalayalamKeyboard();
bindEvents();
applyMalayalamFontMode(malayalamFontMode);
applyMalayalamZoom(malayalamZoom);
updatePageStatus();
renderImageGallery();
renderPreview();
