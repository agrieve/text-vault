
function $(s) {
  var ret = document.querySelector(s);
  if (!ret) {
    throw Error('Bad query selector: ' + s);
  }
  return ret;
}

function setVisible(elem, value) {
  elem.style.display = value ? '' : 'none';
}

/////////
var newUserViewElem = $('#new-user');
var newUserFormElem = $('#new-user form');
var newUserInputElem = $('#new-user input')
var newUserFormElem = $('#new-user form');
var newUserSubmitElem = $('#new-user input[type=submit]');
var existingUserViewElem = $('#existing-user');
var existingUserFormElem = $('#existing-user form');
var existingUserLockElem = $('.lock-img');
var existingUserInputElem = $('#existing-user input')
var existingUserSubmitElem = $('#existing-user input[type=submit]');
var editViewElem = $('#edit-view');
var editViewLockButtonElem = $('#btn-lock');
var editViewTextAreaElem = $('#edit-view textarea');
var editViewGearElem = $('.gear-img');
var lastSavedElem = $('#last-saved');
var flipContainerElem = $('#flip-container');
var settingsViewBackElem = $('#btn-close');
var curUiState = 0;

var UiState = {
  INIT: 0,
  NEW: 1,
  EXISTING: 2,
  EDITING: 3,
  SETTINGS: 4
};

function updateUiState(forceState) {
  var firstTimeUser = !dataModel.fileName;
  var hasPassword = !firstTimeUser && !!dataModel.password;
  var newState = firstTimeUser ? UiState.NEW :
                 hasPassword ? UiState.EDITING :
                 UiState.EXISTING;
  if (forceState !== undefined) {
    newState = forceState;
  }
  if (curUiState != newState) {
    setVisible(existingUserLockElem, newState == UiState.EXISTING);
    if (newState == UiState.EDITING && curUiState == UiState.EXISTING) {
      existingUserLockElem.classList.add('correct-pass-anim');
      setVisible(existingUserLockElem, true);
    }
    if (newState == UiState.SETTINGS) {
      flipContainerElem.classList.add('flipped');
      editViewGearElem.classList.add('gear-anim');
    } else {
      flipContainerElem.classList.remove('flipped');
      editViewGearElem.classList.remove('gear-anim');
    }
    setVisible(newUserViewElem, newState == UiState.NEW);
    setVisible(existingUserViewElem, newState == UiState.EXISTING);
    setVisible(editViewElem, newState == UiState.EDITING || newState == UiState.SETTINGS);
    newUserInputElem.value = '';
    existingUserInputElem.value = '';
    // Focus the password textbox if they are visible.
    newUserInputElem.offsetWidth && newUserInputElem.focus();
    existingUserInputElem.offsetWidth && existingUserInputElem.focus();
    editViewTextAreaElem.offsetWidth && editViewTextAreaElem.focus();
    curUiState = newState;
  }
  if (curUiState == UiState.EDITING) {
    editViewTextAreaElem.value = dataModel.unencryptedData;
    lastSavedElem.innerText = dataModel.lastSaved.toString().replace(/ GMT.*/, '');
  }
}

function flushChanges(autoSave, resetAfter, e) {
  if (dataModel.unencryptedData != editViewTextAreaElem) {
    console.log('flush from event: ' + (e.type || e));
    dataModel.unencryptedData = editViewTextAreaElem.value;
    if (autoSave) {
      dataModel.autoSave();
    } else {
      dataModel.save(function() {
        if (resetAfter) {
          dataModel.reset();
        }
      });
    }
  }
}

function onExistingPasswordSubmit(e) {
  e.preventDefault();
  var password = existingUserInputElem.value;
  if (!password) {
    return;
  }
  dataModel.password = password;
  dataModel.load(function() {
    existingUserInputElem.blur();
    updateUiState();
  }, function() {
    setTimeout(function() {
      existingUserLockElem.classList.add('wrong-pass-anim');
      existingUserInputElem.select();
    }, 0);
  });
}

function onNewPasswordSubmit(e) {
  e.preventDefault();
  newUserInputElem.blur();
  var password = newUserInputElem.value;
  if (!password) {
    return;
  }
  dataModel.fileName = 'file1';
  dataModel.password = password;
  dataModel.save(updateUiState);
}

function onGearClick() {
  updateUiState(UiState.SETTINGS);
}

function onSettingsBackClick() {
  updateUiState(UiState.EDITING);
}

function onStorageChanged(changes, areaName) {
  // TODO
}

function registerEvents() {
  newUserFormElem.onsubmit = onNewPasswordSubmit;
  existingUserFormElem.onsubmit = onExistingPasswordSubmit;
  editViewTextAreaElem.oninput = flushChanges.bind(null, true, false);
  editViewTextAreaElem.onblur = flushChanges.bind(null, false, false);
  editViewLockButtonElem.onclick = flushChanges.bind(null, false, true);
  chrome.app.window.current().onClosed.addListener(flushChanges.bind(null, false, true, 'closed'));
  editViewGearElem.onclick = onGearClick;
  editViewGearElem.onkeypress = function(e) {
    (e.which == 13) && onGearClick();
  };
  settingsViewBackElem.onclick = onSettingsBackClick;
  existingUserLockElem.addEventListener('webkitAnimationEnd', function() {
    if (curUiState == UiState.EDITING) {
      setVisible(existingUserLockElem, false);
    }
    window.setTimeout(function() {
      existingUserLockElem.classList.remove('wrong-pass-anim');
      existingUserLockElem.classList.remove('correct-pass-anim');
    }, 0);
  }, false);

  existingUserInputElem.oninput = function() {
    existingUserSubmitElem.disabled = !existingUserInputElem.value;
  };
  newUserInputElem.oninput = function() {
    newUserSubmitElem.disabled = !newUserInputElem.value;
  };

  chrome.storage.onChanged.addListener(onStorageChanged);
  dataModel.onsave = updateUiState;
}

function init() {
  if (chrome.mobile) {
    document.body.classList.add('ios');
  }
  registerEvents();
  updateUiState();
}

init();
