(function() {

function FileMonitor() {
  this._boundSyncChangeListener = this._onSyncChange.bind(this);
  this._boundServiceChangeListener = this._onServiceChange.bind(this);
  this._watchList = [];
  this.state = 'idle';
  this.onSyncStatusChange = null;

  chrome.syncFileSystem.onFileStatusChanged.addListener(this._boundSyncChangeListener);
  chrome.syncFileSystem.onServiceStatusChanged.addListener(this._boundServiceChangeListener);
}

FileMonitor.prototype.addWatch = function(fileEntry, callback) {
  this._watchList.push(fileEntry, callback);
};

FileMonitor.prototype._onServiceChange = function(e) {
  // this.state = e.state;
  this.onSyncStatusChange && this.onSyncStatusChange();
};

FileMonitor.prototype._onSyncChange = function(changes) {
  for (var i = 0; i < this._watchList.length; i += 2) {
    var targetEntry = this._watchList[i];
    var callback = this._watchList[i + 1];
  }
};

window.FileMonitor = FileMonitor;
})();

