
function $$(s) {
  var ret = document.querySelectorAll(s);
  if (!ret || !ret.length) {
    throw Error('Bad query selector: ' + s);
  }
  return ret;
}

function $(s) {
  return $$(s)[0];
}

function setVisible(elem, value) {
  elem.style.display = value ? '' : 'none';
}

/////////
var HAS_PHYSICAL_KEYBOARD = !window.cordova;

var logInFailViewElem = $('#log-in-failure-view');
var logInFailButtonElem = $('#log-in-failure-view button');
var syncingViewElem = $('#syncing-view');
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
var editViewLastSavedElem = $('#last-saved');
var editViewCharCountElem = $('#char-count');
var flipContainerElem = $('#flip-container');
var settingsAutoLockElem = $('#autolock-select');
var settingsBackElem = $('#btn-close');
var settingsChangePasswordSectionElem = $('#change-password-section');
var settingsChangePasswordBtnElem = $('#change-password-btn');
var settingsExistingPasswordElem = $$('#settings-view .password-input')[0];
var settingsNewPasswordElem = $$('#settings-view .password-input')[1];
var activeVault = null;
var activeCompartment = null;
var curUiState = 0;
var autoLockTimerId = 0;
var wnd = chrome.app.window.current();
var unlockedWindowSize = wnd.getBounds();

var UiState = {
  INIT: 0,
  LOG_IN_FAILURE: 1,
  SYNCING: 2,
  NEW: 3,
  EXISTING: 4,
  EDITING: 5,
  SETTINGS: 6
};

function isLockScreen(uiState) {
  return uiState == UiState.EXISTING || uiState == UiState.NEW;
}

function updateUiState(forceState) {
  // Don't update any state if the window has been closed.
  if (!window) {
    return;
  }
  
  var firstTimeUser = !rootModel.vaults.length;
  var hasPassword = activeVault && !!activeVault.hash;
  var newState = rootModel.logInFailure ? UiState.LOG_IN_FAILURE :
                 rootModel.scanInProgress ? UiState.SYNCING :
                 firstTimeUser ? UiState.NEW :
                 !hasPassword ? UiState.EXISTING:
                 UiState.EDITING;
  // Stay in settings until they leave via forceState.
  if (newState == UiState.EDITING && curUiState == UiState.SETTINGS) {
    newState = UiState.SETTINGS;
  }
  // Ignore events that are passed as params.
  if (typeof forceState == 'number') {
    newState = forceState;
  }
  if (curUiState != newState) {
    console.log('UI State Change: ' + curUiState + '->' + newState);
    setVisible(existingUserLockElem, newState == UiState.EXISTING);
    if (newState == UiState.EDITING && curUiState == UiState.EXISTING) {
      existingUserLockElem.classList.add('correct-pass-anim');
      setVisible(existingUserLockElem, true);
    } else if (newState == UiState.EXISTING && curUiState == UiState.EDITING) {
      existingUserLockElem.classList.add('lock-anim');
    } else if (newState == UiState.EXISTING && (curUiState == UiState.INIT || curUiState == UiState.SYNCING)) {
      existingUserLockElem.classList.add('start-up-anim');
    }
    if (newState == UiState.EDITING && isLockScreen(curUiState)) {
      resizeWindow(unlockedWindowSize.width, unlockedWindowSize.height);
    } else if (isLockScreen(newState)) {
      resizeWindow(300, 400);
    }

    if (newState == UiState.SETTINGS) {
      flipContainerElem.classList.add('flipped');
      editViewGearElem.classList.add('gear-anim');
    } else {
      flipContainerElem.classList.remove('flipped');
      editViewGearElem.classList.remove('gear-anim');
    }
    setVisible(syncingViewElem, newState == UiState.SYNCING);
    setVisible(logInFailViewElem, newState == UiState.LOG_IN_FAILURE);
    setVisible(newUserViewElem, newState == UiState.NEW);
    setVisible(existingUserViewElem, newState == UiState.EXISTING);
    setVisible(editViewElem, newState == UiState.EDITING || newState == UiState.SETTINGS);
    newUserInputElem.value = '';
    existingUserInputElem.value = '';
    settingsAutoLockElem.value = activeVault && activeVault.metadata.autoLockTimeout;
    // Focus the default field.
    if (HAS_PHYSICAL_KEYBOARD) {
      switch (newState) {
        case UiState.NEW:
          newUserInputElem.focus();
          break;
        case UiState.EXISTING:
          existingUserInputElem.focus();
          break;
        case UiState.EDITING:
          editViewTextAreaElem.focus();
          break;
        case UiState.SETTINGS:
          settingsBackElem.focus();
          break;
      }
    }
    curUiState = newState;
  }
  if (curUiState == UiState.EDITING) {
    editViewLastSavedElem.innerText = new Date(activeVault.lastSaved).toString().replace(/ GMT.*/, '');
    editViewTextAreaElem.value = activeCompartment.unencryptedData;
    editViewCharCountElem.innerText = activeCompartment.unencryptedData.length;
  }
  if (curUiState == UiState.SETTINGS) {
    var curPassword = settingsExistingPasswordElem.value;
    settingsExistingPasswordElem.classList.remove('password-input-correct');
    settingsExistingPasswordElem.classList.remove('password-input-wrong');
    if (activeCompartment.isCorrectPassword(curPassword)) {
      settingsExistingPasswordElem.classList.add('password-input-correct');
    } else if (curPassword) {
      settingsExistingPasswordElem.classList.add('password-input-wrong');
    }
    settingsChangePasswordBtnElem.disabled = !(settingsNewPasswordElem.value);
  }
}

function flushChanges(autoSave, resetAfter, e) {
  if (activeCompartment.unencryptedData != editViewTextAreaElem.value || resetAfter) {
    console.log('flush from event: ' + (e.type || e));
    activeCompartment.unencryptedData = editViewTextAreaElem.value;
//    updateUiState();
    if (autoSave) {
      activeVault.autoSave();
    } else {
      activeVault.save(function() {
        if (resetAfter) {
          activeCompartment = null;
          activeVault.lock();
          // updateUiState called by onsave handler.
        }
      });
    }
  }
}

function resizeWindow(newWidth, newHeight) {
  var startBounds = wnd.getBounds();
  var wDiff = newWidth - startBounds.width;
  var hDiff = newHeight - startBounds.height;
  wnd.setBounds({
    left: Math.floor(Math.min(screen.width - newWidth, Math.max(0, startBounds.left - wDiff / 2))),
    top: Math.min(screen.height - newHeight, Math.max(0, startBounds.top - hDiff)),
    width: newWidth,
    height: newHeight
  });
}

function resetAutoLock() {
  clearTimeout(autoLockTimerId);
  if (activeVault && activeCompartment) {
    document.body.classList.remove('auto-lock-fade');
    if (activeVault.metadata.autoLockTimeout > 0) {
      autoLockTimerId = setTimeout(onAutoLockBegin, activeVault.metadata.autoLockTimeout * 1000);
    }
  }
}

function onAutoLockBegin() {
  document.body.classList.add('auto-lock-fade');
}

function onBodyTransitionEnd(e) {
  if (e.target == document.body) {
    console.log('Auto-lock kicked in');
    window.close();
  }
}

function onExistingPasswordSubmit(e) {
  e.preventDefault();
  var password = existingUserInputElem.value;
  if (!password) {
    return;
  }

  var firstCompartment = activeVault.compartments[0];
  firstCompartment.unlock(password, function() {
    if (firstCompartment.unencryptedData !== null) {
      activeVault.hash = password;
      activeCompartment = firstCompartment;
      existingUserInputElem.blur();
      updateUiState();
    } else {
      setTimeout(function() {
        existingUserLockElem.classList.add('wrong-pass-anim');
        existingUserInputElem.select();
      }, 0);
      existingUserInputElem.focus();
    }
  });
}

function selectVault(v) {
  activeVault = v;
  activeVault.onSave = updateUiState;
  if (v.compartments[0].unencryptedData !== null) {
    activeCompartment = v.compartments[0];
  }
  updateUiState();
}

function onNewPasswordSubmit(e) {
  e.preventDefault();
  newUserInputElem.blur();
  var password = newUserInputElem.value;
  if (!password) {
    return;
  }
  // TODO: Hash the password instead of using it directly.
  rootModel.createVault(password, function(v) {
    selectVault(v);
  });
}

function onChangeAutoLock() {
  activeVault.metadata.autoLockTimeout = +settingsAutoLockElem.value;
  activeVault.save();
  resetAutoLock();
}

function onChangePassword() {
  activeVault.hash = settingsNewPasswordElem.value;
  activeVault.save();
  settingsNewPasswordElem.value = settingsExistingPasswordElem.value = '';
  settingsChangePasswordBtnElem.disabled = true;
  settingsChangePasswordSectionElem.classList.add('change-password-anim');
}

function onBoundsChanged() {
  if (!isLockScreen(curUiState)) {
    unlockedWindowSize = wnd.getBounds();
  }
}

function registerEvents() {
  logInFailButtonElem.onclick = function() {
    rootModel.scanFileSystem();
  };

  newUserFormElem.onsubmit = onNewPasswordSubmit;
  newUserInputElem.oninput = function() {
    newUserSubmitElem.disabled = !newUserInputElem.value;
  };

  existingUserFormElem.onsubmit = onExistingPasswordSubmit;
  existingUserInputElem.oninput = function() {
    existingUserSubmitElem.disabled = !existingUserInputElem.value;
  };

  editViewTextAreaElem.oninput = flushChanges.bind(null, true, false);
  editViewTextAreaElem.onblur = flushChanges.bind(null, false, false);
  editViewLockButtonElem.onclick = flushChanges.bind(null, false, true);
  editViewGearElem.onclick = updateUiState.bind(null, UiState.SETTINGS);
  editViewGearElem.onkeypress = function(e) {
    (e.which == 13) && editViewGearElem.onclick();
  };

  settingsBackElem.onclick = updateUiState.bind(null, UiState.EDITING);
  settingsAutoLockElem.onchange = onChangeAutoLock;
  settingsExistingPasswordElem.oninput = updateUiState;
  settingsNewPasswordElem.oninput = updateUiState;
  settingsChangePasswordBtnElem.onclick = onChangePassword;
  settingsChangePasswordSectionElem.addEventListener('webkitAnimationEnd', function() {
    settingsChangePasswordSectionElem.classList.remove('change-password-anim');
  }, false);


  existingUserLockElem.addEventListener('webkitAnimationEnd', function() {
    if (curUiState == UiState.EDITING) {
      setVisible(existingUserLockElem, false);
    }
    window.setTimeout(function() {
      existingUserLockElem.classList.remove('wrong-pass-anim');
      existingUserLockElem.classList.remove('correct-pass-anim');
      existingUserLockElem.classList.remove('start-up-anim');
      existingUserLockElem.classList.remove('lock-anim');
    }, 0);
  }, false);

  document.addEventListener('touchstart', resetAutoLock, false);
  document.addEventListener('mousedown', resetAutoLock, false);
  document.addEventListener('keydown', resetAutoLock, false);

  wnd.onClosed.addListener(flushChanges.bind(null, false, true, 'closed'));
  wnd.onBoundsChanged.addListener(onBoundsChanged);
  document.body.addEventListener('webkitTransitionEnd', onBodyTransitionEnd, false);

  if (chrome.mobile) {
    new FastClick(document.body);
  }
}

function onRootModelUpdate() {
  if (!activeVault && rootModel.vaults.length) {
    rootModel.vaults[0].load(function() {
      rootModel.vaults[0].compartments[0].load(function() {
        selectVault(rootModel.vaults[0]);
      });
    });
  } else {
    // Go to new user screen.
    updateUiState();
  }
}

function init() {
  if (chrome.mobile) {
    document.body.classList.add('ios');
  }
  registerEvents();
  updateUiState();
  rootModel.onModelUpdated = onRootModelUpdate;
  onRootModelUpdate();
  resetAutoLock();
}

init();
