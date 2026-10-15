// Dashboard button that opens the unwatched-video window (watch.html).
// Counts come from todo.js's cache; the play icon is TODO_ICONS.video from todo.js and readVodReport is from deadline.js
// (both loaded before this file).
const WATCH_WINDOW_FEATURES = "popup,width=400,height=640";
// watch-player.js refreshes this time every 5s while the window shows a video, and clears it when the window closes.
// Chrome may run the timers of a minimized, silent window only once a minute, so only a time older than this means the
// window is gone without clearing it (e.g. Chrome quit).
const WATCH_OPEN_KEY = "watchOpen";
const WATCH_OPEN_MS = 150 * 1000;
// videos the window played (marked by watch-player.js); once it has closed, their courses' reports are read again here
const WATCH_STALE_KEY = "watchStale";
// the site saves the position as the video window closes; give that request a moment before reading the report
const WATCH_STALE_DELAY_MS = 2000;
let watchStaleRunning = false;

const watchStorage = {
  get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
  set: (items) => new Promise((resolve) => chrome.storage.local.set(items, resolve)),
  remove: (keys) => new Promise((resolve) => chrome.storage.local.remove(keys, resolve)),
};

// A video window closes too fast to read the report itself, so the list's progress bars (and a video the report now
// counts as attended) are brought up to date from here. Reading the report adds no 열람; only opening a video does.
async function refreshWatchStale() {
  if (watchStaleRunning) return;
  watchStaleRunning = true;
  try {
    const { [WATCH_STALE_KEY]: stale } = await watchStorage.get(WATCH_STALE_KEY);
    if (!stale?.length) return;
    // taken off first, so another dashboard tab doesn't read the same reports
    await watchStorage.remove(WATCH_STALE_KEY);
    await new Promise((resolve) => setTimeout(resolve, WATCH_STALE_DELAY_MS));
    const { todoCache } = await watchStorage.get("todoCache");
    const courseIds = Object.keys(todoCache?.todos || {}).filter((id) =>
      todoCache.todos[id].some((t) => t.kind === "video" && stale.includes(t.cmid))
    );
    for (const courseId of courseIds) {
      const report = await readVodReport(courseId).catch(() => new Map());
      // an empty report (e.g. the login page once the session has ended) leaves the list as it was
      if (!report.size) continue;
      // the cache is read again right before writing, so a sync saved in the meantime isn't overwritten
      const { todoCache: cache } = await watchStorage.get("todoCache");
      if (!cache?.todos?.[courseId]) continue;
      cache.todos[courseId] = cache.todos[courseId].map((t) => {
        const row = t.kind === "video" && report.get(t.title);
        return row ? { ...t, seconds: row.seconds, done: row.attended } : t;
      });
      await watchStorage.set({ todoCache: cache });
    }
  } finally {
    watchStaleRunning = false;
  }
}

function countWatchable(cache) {
  const now = Date.now();
  return Object.values(cache?.todos || {})
    .flat()
    .filter((t) => t.kind === "video" && !t.done && t.cmid && t.start <= now && now <= t.end).length;
}

function createWatchButton() {
  const anchor = document.getElementById("mycourse-type");
  if (!anchor || document.getElementById("tb-watch-btn")) return;

  const btn = document.createElement("button");
  btn.id = "tb-watch-btn";
  btn.type = "button";
  btn.innerHTML = `<span class="tb-watch-icon">${TODO_ICONS.video}</span>미시청 영상<span class="tb-watch-count">…</span>`;
  btn.addEventListener("click", () => window.open(chrome.runtime.getURL("watch.html"), "tb-watch", WATCH_WINDOW_FEATURES));
  anchor.after(btn);
  trackTone(btn);

  const count = btn.querySelector(".tb-watch-count");
  const update = (cache) => {
    count.textContent = cache ? countWatchable(cache) : "…";
  };
  // While the window shows a video the button is disabled: opening the list would load it into that window and stop the video.
  let openTimer = null;
  const lock = (openAt) => {
    clearTimeout(openTimer);
    const left = openAt ? openAt + WATCH_OPEN_MS - Date.now() : 0;
    btn.disabled = left > 0;
    btn.title = btn.disabled ? "미시청 영상 창에서 영상을 보고 있어요" : "";
    if (left > 0) openTimer = setTimeout(() => lock(openAt), left);
    // no video window any more: bring what it played up to date
    else refreshWatchStale();
  };
  chrome.storage.local.get(["todoCache", WATCH_OPEN_KEY], (result) => {
    update(result.todoCache);
    lock(result[WATCH_OPEN_KEY]);
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.todoCache) update(changes.todoCache.newValue);
    if (changes[WATCH_OPEN_KEY]) lock(changes[WATCH_OPEN_KEY].newValue);
  });
}

document.addEventListener("DOMContentLoaded", createWatchButton);
