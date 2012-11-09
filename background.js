
var wnd = null;

/**
 * Listens for the app launching then creates the window
 */
chrome.app.runtime.onLaunched.addListener(function() {
  if (wnd) {
    wnd.show();
  } else {
    chrome.app.window.create('main.html', {width: 300, height: 400, id: 'main'}, function(w) {
      wnd = w;
      // You can't re-show a window after it's been closed.
      wnd.onClosed.addListener(function() {
        wnd = null;
      });
    });
  }
});
