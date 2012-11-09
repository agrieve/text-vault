
var wnd = null;

function onWindowCreated(w) {
  wnd = w;
  // Always log to the background page's console.
  wnd.contentWindow.console = console;

  // Required to make storage calls continue to work within onClosed().
  wnd.contentWindow.chrome = chrome;
  chrome.app.window.current = function() { return wnd };
  // You can't re-show a window after it's been closed.
  wnd.onClosed.addListener(function() {
    wnd = null;
  });
}

function createWindow() {
  if (wnd) {
    wnd.show();
  } else {
    chrome.app.window.create('main.html', {width: 300, height: 400, id: 'main'}, onWindowCreated);
  }
}

/**
 * Listens for the app launching then creates the window
 */
chrome.app.runtime.onLaunched.addListener(function() {
  createWindow();
});
