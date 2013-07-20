(function() {

var DATA_PREFIX = 'A5jwiqb';

function throttleDecorator(obj, func, delay) {
  var timerId = null;
  function unthrottled() {
    window.clearTimeout(timerId)
    timerId = null;
    func.apply(obj, arguments);
  }
  function throttled() {
    timerId = timerId || window.setTimeout(unthrottled, delay);
  }
  return [throttled, unthrottled];
}

function maybeCall(func) {
  if (func) {
    var args = Array.prototype.slice.call(arguments, 1);
    func.apply(this, args);
  }
}

function createId() {
  return Math.floor((Math.random() * Math.pow(2, 52))).toString(36);
}

function readTextFile(entry, callback) {
  var me = this;
  entry.file(function(file) {
    var fileReader = new FileReader();
    fileReader.onloadend = function() {
      if (fileReader.result === null) {
        console.error('Failed to read file: ', entry.fullPath);
      }
      callback(fileReader.result);
    };
    fileReader.readAsText(file);
  });
};

function writeTextFile(entry, text, callback) {
  entry.createWriter(function(writer) {
    writer.onwriteend = function() {
      callback(!writer.error);
    };
    writer.write(new Blob([text]));
  }, function() {
    callback(false);
  });
}



function RootModel() {
  this.logInFailure = false;
  this.vaults = [];
  this.scanInProgress = false;
  this._fsRoot = null;
  this.onModelUpdated = null;
}

RootModel.prototype.createVault = function(hash, callback) {
  var me = this;
  var vaultId = createId();
  var compartmentId = createId();
  function getFileFail(e) {
    console.error(e.name);
    callback(null);
  }
  me._fsRoot.getFile('vault-' + vaultId + '.meta', {create: true}, function(vaultFileEntry) {
    me._fsRoot.getFile('compartment-' + vaultId + '-' + compartmentId + '.data', {create: true}, function(compartmentFileEntry) {
      var newCompartment = new Compartment(compartmentFileEntry);
      var newVault = new Vault(vaultId, vaultFileEntry, [newCompartment]);
      newVault.hash = hash;
      newVault.save(function() {
        me.vaults.push(newVault);
        callback && callback(newVault);
        maybeCall(me.onModelUpdated);
      });
    }, getFileFail);
  }, getFileFail);
};

RootModel.prototype.scanFileSystem = function() {
  if (this.scanInProgress) return;
  this.scanInProgress = true;
  this.logInFailure = false;
  maybeCall(this.onModelUpdated);
  var me = this;
  chrome.syncFileSystem.requestFileSystem(function(fs) {
  // window.webkitRequestFileSystem(PERSISTENT, 50000, function(fs) {
    if (!fs) {
      me.logInFailure = true;
      console.error('syncFileSystem failed to open: ' + (chrome.runtime.lastError && chrome.runtime.lastError.message));
      me.scanInProgress = false;
      maybeCall(me.onModelUpdated);
      return;
    }
    me._fsRoot = fs.root;
    var reader = fs.root.createReader();
    var allEntries = [];
    reader.readEntries(readerGood, readerBad);
    function readerGood(someEntries) {
      if (someEntries.length) {
        allEntries.push.apply(allEntries, someEntries);
        reader.readEntries(readerGood, readerBad);
      } else {
        me.vaults = createVaultsFromEntries(allEntries);
        var numLeft = me.vaults.length + 1;
        function onLoaded() {
          if (!--numLeft) {
            me.scanInProgress = false;
            maybeCall(me.onModelUpdated);
          }
        }
        me.vaults.forEach(function(v) {
          v.load(onLoaded);
        });
        onLoaded();
      }
    }
    function readerBad() {
      console.error('Failed to read directory entries');
      me.scanInProgress = false;
      maybeCall(me.onModelUpdated);
    };
  });
};

function createVaultsFromEntries(entries) {

  function scan(pattern, func) {
    for (var i = 0, entry; entry = entries[i]; ++i) {
      var match;
      if (match = pattern.exec(entry.name)) {
        func(match, entry);
      }
    }
  }
  //entries.forEach(function(e) {e.remove(function(){})});

  // vault-(vaultId).meta
  var VAULT_PATTERN = /vault-([a-z0-9]+)\.meta/;
  // compartment-(vaultId)-(compartmentId).data
  var COMPARTMENT_PATTERN = /compartment-([a-z0-9]+)-([a-z0-9]+)\.data/;
  var entryMap = {};

  function lazyCreate(map, key) {
    return map[key] = (map[key] || {id: key});
  }
  scan(VAULT_PATTERN, function(match, fileEntry) {
    var entry = lazyCreate(entryMap, match[1]);
    entry.metaEntry = fileEntry;
    entry.compartmentMap = {};
  });
  scan(COMPARTMENT_PATTERN, function(match, fileEntry) {
    var entry = lazyCreate(entryMap, match[1]);
    var cMap = entry.compartmentMap = (entry.compartmentMap || {});
    var comp = lazyCreate(cMap, match[2]);
    comp.dataEntry = fileEntry;
  });

  var vaults = [];
  for (var vaultId in entryMap) {
    var entry = entryMap[vaultId];
    if (!entry.metaEntry) {
      console.warn('Found vault with missing meta file: ' + vaultId);
    } else {
      var compEntry = null;
      var compartmentList = [];
      for (var compartmentId in entry.compartmentMap) {
        compEntry = entry.compartmentMap[compartmentId];
        compartmentList.push(new Compartment(compEntry.dataEntry));
      }
      if (!compEntry) {
        console.warn('Found vault is missing one or more files: ' + vaultId);
      } else {
        vaults.push(new Vault(vaultId, entry.metaEntry, compartmentList));
      }
    }
  }
  return vaults;
}

function Compartment(fileEntry) {
  this.fileEntry = fileEntry;
  this._encryptedData = null;
  this.lock();
}

Compartment.prototype.lock = function() {
  this.unencryptedData = null;
};

Compartment.prototype.unlock = function(hash, callback) {
  var decryptedText = CryptoJS.AES.decrypt(this._encryptedData, hash).toString(CryptoJS.enc.Utf8);
  if (decryptedText.slice(0, DATA_PREFIX.length) == DATA_PREFIX) {
    this.unencryptedData = decryptedText.slice(DATA_PREFIX.length);
  }
  callback();
};

Compartment.prototype.save = function(hash, callback) {
  // New component.
  if (this.unencryptedData === null) {
    this.unencryptedData = '';
  }
  this._encryptedData = CryptoJS.AES.encrypt(DATA_PREFIX + this.unencryptedData, hash);
  // 1 is the version.
  var fileData = '1 ' + this._encryptedData;
  writeTextFile(this.fileEntry, fileData, callback);
};

Compartment.prototype.load = function(callback) {
  var me = this;
  readTextFile(this.fileEntry, function(result) {
    if (result) {
      me._encryptedData = result.slice(2);
      callback(true);
    } else {
      callback(false);
    }
  });
};


function Vault(id, metaFileEntry, compartments) {
  this.id = id;
  this.metaFileEntry = metaFileEntry;
  this.compartments = compartments;
  // Data that's saved in metaFileEntry.
  this.metadata = {
    name: 'New Vault',
    autoLockTimeout: 30,
    lastSaved: +new Date
  };
  this._serializedMetadata = null;
  this.lock();

  var pair = throttleDecorator(this, Vault.prototype.save, 1000);
  this.autoSave = pair[0];
  this.save = pair[1];
  this.onSave = null;
}

function serializeVaultMetadata(metadata) {
  return JSON.stringify(metadata);
};

Vault.prototype.lock = function() {
  this.lastSaveAttempt = null;
  this.hash = null;
  this.compartments.forEach(function(c) { c.lock(); });
};

Vault.prototype.save = function(callback) {
  var me = this;
  var numTasksRemaining = this.compartments.length;
  this.lastSaved = +new Date;
  var serialized = serializeVaultMetadata(this.metadata);
  if (serialized != this._serializedMetadata) {
    numTasksRemaining++;
    this.metadata.lastSaveAttempt = +new Date;
    serialized = serializeVaultMetadata(this.metadata);
    writeTextFile(this.metaFileEntry, serialized, function(success) {
      if (success) {
        me._serializedMetadata = serialized;
      }
      subTaskDone(success);
    });
  }
  this.compartments.forEach(function(c) {
    c.save(me.hash, subTaskDone);
  });
  var success = true;
  function subTaskDone(subSuccess) {
    success = success && subSuccess;
    if (!--numTasksRemaining) {
      maybeCall(callback, success);
      maybeCall(me.onSave, success);
    }
  }
};

Vault.prototype.load = function(callback) {
  var me = this;
  readTextFile(this.metaFileEntry, function(result) {
    if (result) {
      onRead(result);
    } else {
      callback();
    }
  });

  function onRead(fileContents) {
    try {
      var newMetadata = JSON.parse(fileContents);
      me.lastSaveAttempt = +new Date;
    } catch (e) {
      console.error(e);
    }
    if (newMetadata) {
      me._serializedMetadata = fileContents;
      for (var k in newMetadata) {
        me.metadata[k] = newMetadata[k];
      }
    }
    callback();
  }
};

window.RootModel = RootModel;
})();
