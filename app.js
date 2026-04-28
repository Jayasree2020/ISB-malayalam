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

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.classList.add("show");
  setTimeout(() => box.classList.remove("show"), 2400);
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
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return splitTextIntoPages(result.value || "");
}

function stripRtf(value) {
  return value
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\u(-?\d+)\??/g, (match, code) => String.fromCharCode(Number(code)))
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanLegacyDocText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\uFFFF]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    return splitTextIntoPages(cleanLegacyDocText(doc.body?.innerText || utf8));
  }
  if (/^{\\rtf/i.test(utf8)) return splitTextIntoPages(stripRtf(utf8));

  const utf16 = new TextDecoder("utf-16le", { fatal: false }).decode(bytes);
  const utf16Runs = extractPrintableRuns(utf16);
  const ansiRuns = extractPrintableRuns(new TextDecoder("windows-1252", { fatal: false }).decode(bytes));
  const best = utf16Runs.length > ansiRuns.length ? utf16Runs : ansiRuns;
  const cleaned = cleanLegacyDocText(best);

  if (cleaned.length < 40) {
    throw new Error(`This looks like an old binary Word .doc file (${signature}). Please save it as .docx or PDF for reliable import.`);
  }

  return splitTextIntoPages(cleaned);
}

async function extractFilePages(file) {
  if (/\.pdf$/i.test(file.name)) return extractPdfPages(file);
  if (/\.docx$/i.test(file.name)) return extractDocxPages(file);
  if (/\.doc$/i.test(file.name)) return extractLegacyDocPages(file);
  if (/\.rtf$/i.test(file.name)) return splitTextIntoPages(stripRtf(await file.text()));
  if (/\.(txt|md|html)$/i.test(file.name)) return splitTextIntoPages(await file.text());
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
  if (isShowingPage) return;
  const index = currentPage - 1;
  if (englishPages.length && index >= 0) englishPages[index] = $("englishText").value;
  if (malayalamPages.length && index >= 0) malayalamPages[index] = $("malayalamText").value;
  if (malayalamLayouts[index]) {
    const page = $("malayalamLayoutEditor").querySelector(".layout-page");
    if (page) {
      malayalamLayouts[index].lines = Array.from(page.querySelectorAll(".layout-line")).map((line) => ({
        text: line.innerText,
        x: Number(line.dataset.x),
        y: Number(line.dataset.y),
        width: Number(line.dataset.width),
        height: Number(line.dataset.height)
      }));
      $("malayalamText").value = malayalamLayouts[index].lines.map((line) => line.text).join("\n");
      malayalamPages[index] = $("malayalamText").value;
    }
  }
}

async function importIntoTarget(file, target) {
  if (!file) return;
  $("importStatus").textContent = `Reading ${file.name}...`;
  const pages = await extractFilePages(file);

  if (!pages.length) {
    throw new Error("No selectable text was found. If this is a scanned PDF, OCR is needed.");
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
  const index = currentPage - 1;
  const source = englishLayouts[index];
  if (!source?.lines?.length) {
    toast("This source page has no captured layout. PDF pages with selectable text work best.");
    return;
  }

  const existingMalayalam = ($("malayalamText").value || "").split(/\r?\n/);
  malayalamLayouts[index] = {
    width: source.width,
    height: source.height,
    lines: source.lines.map((line, lineIndex) => ({
      ...line,
      text: existingMalayalam[lineIndex] || ""
    }))
  };
  malayalamEditMode = "layout";
  renderMalayalamLayout();
  applyMalayalamMode();
  toast("Source page layout copied to Malayalam editor.");
}

function renderMalayalamLayout() {
  const editor = $("malayalamLayoutEditor");
  if (!editor) return;
  const layout = malayalamLayouts[currentPage - 1];

  if (!layout?.lines?.length) {
    editor.innerHTML = '<div class="layout-empty"><p>Click Copy Source Layout to create editable Malayalam blocks with the English page format.</p><button id="copyLayoutEmptyBtn" type="button">Copy Source Layout</button></div>';
    $("copyLayoutEmptyBtn")?.addEventListener("click", createMalayalamLayoutFromSource);
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
      return `<div class="layout-line" contenteditable="true" data-index="${index}" data-x="${line.x}" data-y="${line.y}" data-width="${line.width}" data-height="${line.height}" style="left:${left}px;top:${top}px;width:${lineWidth}px;min-height:${minHeight}px;">${escapeHtml(line.text || "")}</div>`;
    })
    .join("");

  editor.innerHTML = `<div class="layout-page" style="width:${width}px;height:${height}px;">${lines}</div>`;
  editor.querySelectorAll(".layout-line").forEach((line) => {
    line.addEventListener("input", persistCurrentPageEdits);
  });
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
  const start = area.selectionStart;
  const end = area.selectionEnd;
  area.value = area.value.slice(0, start) + value + area.value.slice(end);
  area.focus();
  area.selectionStart = area.selectionEnd = start + value.length;
  renderPreview();
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
  $("finalText").value = $("finalText").value.replace(/\s*(\d+)\s+/g, "\n[v $1] ");
  renderPreview();
  toast("Verse markers added where numbers were found.");
}

function placeBsiAtTop() {
  persistCurrentPageEdits();
  const bsi = $("bsiText").value.trim();
  const notes = $("malayalamText").value.trim();
  $("finalText").value = [bsi, notes].filter(Boolean).join("\n\n");
  renderPreview();
  toast("BSI text placed above notes.");
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

function renderPreview() {
  const raw = $("finalText").value || "";
  const imageMap = Object.fromEntries(imageAssets.map((asset) => [asset.id, asset]));
  const html = escapeHtml(raw)
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
  $("printPreview").innerHTML = html || "<p class=\"hint\">Print preview will appear here.</p>";
}

function runChecks() {
  const text = $("finalText").value;
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
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.projectTitle)}</title><style>body{font-family:"Nirmala UI","Kartika",serif;font-size:14pt;line-height:1.7}.verse-number{font-weight:bold;color:#a73f2b}</style></head><body>${$("printPreview").innerHTML}</body></html>`;
  download(`${data.projectTitle || "translation"}-indesign.html`, html, "text/html;charset=utf-8");
}

function exportDoc() {
  persistCurrentPageEdits();
  const data = snapshot();
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(data.projectTitle)}</title></head><body>${$("printPreview").innerHTML}</body></html>`;
  download(`${data.projectTitle || "translation"}.doc`, doc, "application/msword;charset=utf-8");
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
  $("imageFileInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await addImageFile(file);
    } catch (error) {
      toast(`Image import failed: ${error.message}`);
    }
  });
  $("insertImageBtn").addEventListener("click", () => insertImageMarker());
  $("toggleExtractedEnglishBtn").addEventListener("click", () => {
    $("englishExtractedPanel").classList.toggle("collapsed");
  });
  document.addEventListener("paste", async (event) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (file) await addImageFile(file);
  });
  $("prevPageBtn").addEventListener("click", () => showPage(currentPage - 1));
  $("nextPageBtn").addEventListener("click", () => showPage(currentPage + 1));
  $("pageNumber").addEventListener("change", () => showPage($("pageNumber").value));
  $("copyLayoutBtn").addEventListener("click", createMalayalamLayoutFromSource);
  $("copyLayoutInlineBtn").addEventListener("click", createMalayalamLayoutFromSource);
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
  $("saveCloudBtn").addEventListener("click", saveCloud);
  $("insertBsiBtn").addEventListener("click", placeBsiAtTop);
  $("applyGlossaryBtn").addEventListener("click", suggestWords);
  $("normalizeBtn").addEventListener("click", () => {
    $("finalText").value = normalizeReferences($("finalText").value);
    renderPreview();
    toast("Text normalized.");
  });
  $("cleanRefsBtn").addEventListener("click", () => {
    const area = selectedTextarea();
    area.value = normalizeReferences(area.value);
    renderPreview();
  });
  $("splitVersesBtn").addEventListener("click", splitVerses);
  $("translateSelectionBtn").addEventListener("click", translateSelection);
  $("exportHtmlBtn").addEventListener("click", exportHtml);
  $("exportDocBtn").addEventListener("click", exportDoc);
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
    persistCurrentPageEdits();
    renderPreview();
  });
  stateKeys
    .filter((key) => key !== "englishText" && key !== "malayalamText")
    .forEach((key) => $(key)?.addEventListener("input", renderPreview));
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
updatePageStatus();
renderImageGallery();
renderPreview();
