// Uses fetchDeadlineDoc from deadline.js (loaded before this file).
// A "수업 자료 모음" tile at the end of the course overview's tiles. It opens, right under them, every file of the course
// to download: the 파일 activities and the files inside 폴더 activities, by the week they are in.
// 192×192 so it stays sharp at 64px on high-density screens
const MATERIALS_ICON = "icons/materials.png";
const MATERIALS_DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>`;

// A file icon for each kind of file, in [colour on light backgrounds, colour on dark backgrounds] (materials.css tints it).
const materialsGlyph = (paths) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">${paths}</g></svg>`;
const MATERIALS_PAGE = `<path d="M13.5 3H8a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8.5z"/><path d="M13.5 3v3.5a2 2 0 0 0 2 2H19"/>`;
const MATERIALS_KINDS = [
  { types: ["PDF"], colors: ["#dc2626", "#fca5a5"], glyph: materialsGlyph(`${MATERIALS_PAGE}<path d="M8.5 13h7M8.5 16.5h4.5"/>`) },
  {
    types: ["ZIP", "RAR", "7Z", "TAR", "GZ", "ALZ", "EGG", "아카이브"],
    colors: ["#d97706", "#fcd34d"],
    glyph: materialsGlyph(`${MATERIALS_PAGE}<path d="M10.5 5.5H12M12 7.5h1.5M10.5 9.5H12M12 11.5h1.5M10.5 14h3v3.5h-3z"/>`),
  },
  {
    types: ["JAVA", "C", "CPP", "H", "PY", "JS", "TS", "HTML", "CSS", "JSON", "XML", "KT", "CS", "SQL", "IPYNB"],
    colors: ["#7c3aed", "#c4b5fd"],
    glyph: materialsGlyph(`${MATERIALS_PAGE}<path d="M10 12.5l-2 2.25L10 17M14 12.5l2 2.25L14 17"/>`),
  },
  {
    types: ["HWP", "HWPX", "DOC", "DOCX", "TXT", "MD", "RTF", "한글", "WORD", "워드", "텍스트"],
    colors: ["#2563eb", "#93c5fd"],
    glyph: materialsGlyph(`${MATERIALS_PAGE}<path d="M8.5 12h7M8.5 14.75h7M8.5 17.5h4.5"/>`),
  },
  {
    types: ["PPT", "PPTX", "KEY", "POWERPOINT", "파워포인트"],
    colors: ["#ea580c", "#fdba74"],
    glyph: materialsGlyph(`<path d="M3.5 5h17M5 5v8.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5M12 15.5V19M9 19.5h6M9.5 12v-2M12 12V8.5M14.5 12v-3"/>`),
  },
  {
    types: ["XLS", "XLSX", "CSV", "EXCEL", "엑셀"],
    colors: ["#16a34a", "#86efac"],
    glyph: materialsGlyph(`${MATERIALS_PAGE}<path d="M8.5 12h7v5.5h-7zM8.5 14.75h7M12 12v5.5"/>`),
  },
  {
    types: ["PNG", "JPG", "JPEG", "GIF", "SVG", "WEBP", "BMP", "이미지"],
    colors: ["#0d9488", "#5eead4"],
    glyph: materialsGlyph(`<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="9.5" r="1.5"/><path d="M4 17l4.5-4.5 3 3 3.5-3.5L20 17"/>`),
  },
];
const MATERIALS_OTHER = { colors: ["#52525b", "#a1a1aa"], glyph: materialsGlyph(MATERIALS_PAGE) };
const MATERIALS_FOLDER = {
  colors: ["#52525b", "#a1a1aa"],
  glyph: materialsGlyph(`<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.5l2 2.5H18a2.5 2.5 0 0 1 2.5 2.5v6.5A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z"/>`),
};

let materialsStarted = false;
// the course's files, read when the tile is first opened and kept for the page
let materialsRequest = null;

// "1주차 [8월31일 - 9월06일]" → "1주차"
function getMaterialsWeek(li) {
  const name = li.closest("li.section")?.querySelector(".sectionname")?.textContent.trim();
  return name ? name.replace(/\s*\[[^\]]*\]$/, "") : "기타";
}

// A 파일 activity says "1.9MB PDF 문서", "11.5KB 아카이브 (ZIP)", "2.1MB 파워포인트 발표" or "12 바이트 텍스트 파일"
// under its name: its size and kind.
function readUbfileInfo(li) {
  const text = li.querySelector(".displayoptions")?.textContent.replace(/\s+/g, " ").trim() || "";
  const size = text.match(/^[\d.]+\s*(?:[KMGT]?B|바이트)/)?.[0] || "";
  const rest = text.slice(size.length).trim();
  return {
    size,
    type: (rest.match(/\(([^)]+)\)/)?.[1] || rest.match(/^(\S+)\s+(?:문서|발표|파일)$/)?.[1] || "파일").toUpperCase(),
  };
}

function getMaterialsType(name) {
  return name.match(/\.([a-z0-9]{1,5})$/i)?.[1].toUpperCase() || "파일";
}

// Every file in page order: a 파일 activity as it is (its page sends the file), a 폴더 activity as the files its page
// lists. Folder pages are read one at a time, like todo.js reads courses; one that can't be read stays a link to its page.
async function collectMaterials() {
  const files = [];
  for (const li of document.querySelectorAll("li.activity.modtype_ubfile, li.activity.modtype_folder")) {
    const link = li.querySelector(".activityinstance > a");
    const title = li.querySelector(".instancename")?.firstChild?.textContent.trim();
    if (!link || !title) continue;
    const week = getMaterialsWeek(li);
    if (li.classList.contains("modtype_ubfile")) {
      const { size, type } = readUbfileInfo(li);
      files.push({ week, name: title, href: link.href, type, note: size });
      continue;
    }
    try {
      const doc = await fetchDeadlineDoc(link.href);
      const seen = new Set();
      for (const a of doc.querySelectorAll('a[href*="pluginfile.php"]')) {
        const href = new URL(a.getAttribute("href"), location.href).href;
        const name = a.textContent.trim();
        if (!name || seen.has(href)) continue;
        seen.add(href);
        files.push({ week, name, href, type: getMaterialsType(name), note: title });
      }
    } catch {
      files.push({ week, name: title, href: link.href, type: "폴더", note: "폴더 열기", folder: true });
    }
  }
  return files;
}

function renderMaterials(panel, files) {
  if (!panel.isConnected) return;
  panel.querySelector(".tb-materials-head span").textContent = `${files.length}개`;
  const list = panel.querySelector(".tb-materials-list");
  list.replaceChildren();
  if (!files.length) {
    list.innerHTML = `<p class="tb-materials-empty">이 강의에는 내려받을 자료가 없어요.</p>`;
    return;
  }
  let week = null;
  for (const file of files) {
    if (file.week !== week) {
      week = file.week;
      const head = document.createElement("div");
      head.className = "tb-materials-week";
      head.textContent = week;
      list.append(head);
    }
    const row = document.createElement("a");
    row.className = "tb-materials-row";
    row.href = file.href;
    // the file's own name comes from e-class; a folder that couldn't be read opens its page instead
    if (!file.folder) row.download = "";
    const kind = file.folder ? MATERIALS_FOLDER : MATERIALS_KINDS.find(({ types }) => types.includes(file.type)) || MATERIALS_OTHER;
    row.style.setProperty("--tb-mat-c", kind.colors[0]);
    row.style.setProperty("--tb-mat-c-dark", kind.colors[1]);
    row.innerHTML = `<span class="tb-materials-icon">${kind.glyph}</span><span class="tb-materials-name"></span><span class="tb-materials-note"></span>${file.folder ? "" : MATERIALS_DOWNLOAD_ICON}`;
    row.querySelector(".tb-materials-name").textContent = file.name;
    // "PDF · 1.9MB", "ZIP · [Code] 2장"
    row.querySelector(".tb-materials-note").textContent = [file.folder ? "" : file.type, file.note].filter(Boolean).join(" · ");
    list.append(row);
  }
}

function toggleMaterials(e) {
  e.preventDefault();
  const link = e.currentTarget;
  const open = document.getElementById("tb-materials");
  link.setAttribute("aria-expanded", String(!open));
  if (open) {
    open.remove();
    return;
  }

  const panel = document.createElement("section");
  panel.id = "tb-materials";
  panel.setAttribute("aria-label", "수업 자료 모음");
  panel.innerHTML = `
    <div class="tb-materials-core">
      <div class="tb-materials-head"><b>수업 자료 모음</b><span></span></div>
      <div class="tb-materials-list"><p class="tb-materials-empty">자료를 모으는 중이에요…</p></div>
    </div>`;
  link.closest("ul").after(panel);
  trackTone(panel);
  materialsRequest ??= collectMaterials();
  materialsRequest.then((files) => renderMaterials(panel, files));
}

// Built like the overview's own tiles (공지사항, 강좌 Q&A …) so e-class's styles shape it the same way.
function createMaterialsTile() {
  const tiles = document.querySelector("#section-0 ul.section.img-text");
  if (!tiles || document.getElementById("tb-materials-tile")) return;
  const li = document.createElement("li");
  li.id = "tb-materials-tile";
  li.className = "activity";
  li.innerHTML = `<div><div class="mod-indent-outer"><div class="mod-indent"></div><div><div class="activityinstance"><a href="#" role="button" aria-expanded="false"><img class="activityicon" alt=""><span class="instancename">수업 자료 모음</span></a></div></div></div></div>`;
  li.querySelector("img").src = chrome.runtime.getURL(MATERIALS_ICON);
  li.querySelector("a").addEventListener("click", toggleMaterials);
  tiles.append(li);
}

function startMaterials() {
  if (materialsStarted) return;
  materialsStarted = true;
  createMaterialsTile();
}

if (location.pathname === "/course/view.php") {
  chrome.storage.local.get("toolbox", (result) => {
    if (result.toolbox?.materials === false) return;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startMaterials);
    } else {
      startMaterials();
    }
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.toolbox?.newValue?.materials) startMaterials();
  });
}
