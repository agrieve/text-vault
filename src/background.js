
var rootModel = new RootModel();
var wnd = null;

rootModel.scanFileSystem();

function onWindowCreated(w) {
  wnd = w;
  // Always log to the background page's console.
  wnd.contentWindow.console = console;
  wnd.contentWindow.rootModel = rootModel;

  // You can't re-show a window after it's been closed.
  wnd.onClosed.addListener(function() {
    wnd = null;
  });

  wnd.focus();
}

/**
 * Listens for the app launching then creates the window
 */
chrome.app.runtime.onLaunched.addListener(function() {
  if (wnd) {
    wnd.show();
  } else {
    chrome.app.window.create('main.html', {width: 300, height: 400, id: 'a'}, onWindowCreated);
  }
});
