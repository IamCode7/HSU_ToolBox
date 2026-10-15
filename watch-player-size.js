// Runs in the video page's own JavaScript world before the site's scripts. On load the site resizes its window to the
// size set for that video (firstResizing → window.resizeTo; 1005×755 for most, 1920×1088 for some courses), so in the
// toolbox's window 자동시청 changed the window size whenever it moved to a video set to another size. There, keep the size
// the window already has (the list opens it at the site's usual 1005×755; the user may resize it).
if (location.hash === "#tb-watch") {
  window.resizeTo = () => {};
}
