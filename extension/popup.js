/* eslint-disable max-statements */
/* global chrome */

const settings = {
  settings: {},
};

let numOfViewStates = 0;

function sendMessage(msg, data, callback) {
  chrome.tabs.query({
    active: true,
    currentWindow: true,
  }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      msg: msg,
      data: data,
    }, (response) => {
      if (callback) {
        callback(response);
      } else {
        console.log(`Message ${msg} response`, response);
      }
    });
  });
}


function storeAndReload(reload = true) {
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
    }
    if (reload) {
      sendMessage('reload');
    }
  });
}

function log(msg) {
  sendMessage('log', msg);
}

function updateSectionChar(reload = true) {
  const ch = document.getElementById('section-char').value;
  const rpt = parseInt(document.getElementById('section-repeat').value);

  if (ch === settings.settings.sectionChar && rpt === settings.settings.sectionRepeat) {
    return;
  }

  document.getElementById('section-example-1').innerText = `${ch.repeat(rpt)} Section`;
  document.getElementById('section-example-2').innerText = `${ch.repeat(rpt)} Section ${ch.repeat(rpt+1)}`;

  settings.settings.sectionChar = ch;
  settings.settings.sectionRepeat = rpt;

  if (reload) {
    storeAndReload();
  }
}

function udpateCompactListWidth(reload = true) {
  const width = document.getElementById('compact-list-width').value;

  document.getElementById('compact-list').style.width = `${width}px`;

  settings.settings.compactListWidth = width;
  if (reload) {
    storeAndReload(false);
  }
}

function updateWipListBar(reload = true) {
  const enabled = document.getElementById('wip-list-bar').checked;
  settings.settings.enableTopBars = enabled;
  document.getElementById('top-bar-img').src = enabled ? 'img/List_Top_Bar.png' : 'img/List_No_Top_Bar.png';
  document.getElementById('top-bar-example-text').innerText = enabled
    ? 'Sections will get a top bar when WiP limit is exceeded.'
    : 'WiP violations will be indicated with the badge only.';
  if (reload) {
    storeAndReload();
  }
}

function updateAlwaysCount(reload = true) {
  const alwaysCount = document.getElementById('wip-always-count').checked;
  settings.settings.alwaysCount = alwaysCount;
  document.getElementById('always-count-img').src = alwaysCount ? 'img/List_with_Count.png' : 'img/List_without_Count.png';
  document.getElementById('always-count-example-text').innerText = alwaysCount
    ? 'Always show card count.'
    : 'Card count will not show for lists without WiP limits.';
  if (reload) {
    storeAndReload();
  }
}

function updateCombiningLists(reload = true) {
  const enableCombiningLists = document.getElementById('enable-combining-lists').checked;
  settings.settings.enableCombiningLists = enableCombiningLists;
  document.getElementById('combining-lists-img').src = enableCombiningLists ? 'img/Lists_Combined.png' : 'img/Lists_not_Combined.png';
  document.getElementById('combining-lists-example-text').innerText = enableCombiningLists
    ? "Two adjacent lists with same dot prefix, e.g. 'myList.' will be combined. (WiP limit from left list is applied.)"
    : 'List combination is disabled.';
  if (reload) {
    storeAndReload();
  }
}

function updateLoadTimeout(reload = false) {
  const timeout = document.getElementById('load-timeout').value;

  if (timeout === settings.settings.loadTimeout) {
    return;
  }

  settings.settings.loadTimeout = timeout;
  storeAndReload(false);
}

function updateRememberViewStates() {
  const enabled = document.getElementById('remember-view-states').checked;
  settings.settings.rememberViewStates = enabled;
  storeAndReload(false);
  if (!enabled) {
    chrome.storage.sync.clear(() => {
      storeAndReload(false);
      document.getElementById('num-view-states').innerText = 0;
    });
  }
}

function dumpViewState() {
  sendMessage('dump');
}

function clearViewState() {
  sendMessage('clear');
}

document.addEventListener('DOMContentLoaded', () => {
  /*
     * Get settings from storage
     */
  chrome.storage.sync.get(null, result => {
    if (result['settings']) {
      settings.settings = result['settings'];
    } else {
      // TODO Default settings duplicated from tfolds
      settings.settings = {
        sectionChar: '#',
        sectionRepeat: 2,
        enableTopBars: true,
        rememberViewStates: true,
        alwaysCount: false,
        enableCombiningLists: true,
        compactListWidth: 200,
        loadTimeout: 1500,
      };
    }
    numOfViewStates = Object.keys(result).length - 1;
    if (numOfViewStates < 0) {
      numOfViewStates = 0;
    }

    document.getElementById('num-view-states').innerText = numOfViewStates;

    document.getElementById('section-char').addEventListener('change', updateSectionChar);
    document.getElementById('section-char').value = settings.settings.sectionChar || '#';

    document.getElementById('section-repeat').addEventListener('change', updateSectionChar);
    document.getElementById('section-repeat').value = settings.settings.sectionRepeat || 2;
    updateSectionChar(false);

    document.getElementById('wip-list-bar').addEventListener('change', updateWipListBar);
    document.getElementById('wip-list-bar').checked = settings.settings.enableTopBars;
    updateWipListBar(false);

    document.getElementById('wip-always-count').addEventListener('change', updateAlwaysCount);
    document.getElementById('wip-always-count').checked = settings.settings.alwaysCount;
    updateAlwaysCount(false);

    document.getElementById('enable-combining-lists').addEventListener(
        'change', updateCombiningLists);
    document.getElementById('enable-combining-lists')
        .checked = settings.settings.enableCombiningLists;
    updateCombiningLists(false);

    document.getElementById('compact-list-width').addEventListener('change', udpateCompactListWidth);
    document.getElementById('compact-list-width').value = settings.settings.compactListWidth || 200;
    udpateCompactListWidth(false);

    document.getElementById('load-timeout').addEventListener('change', updateLoadTimeout);
    document.getElementById('load-timeout').value = settings.settings.loadTimeout || 1500;
    updateLoadTimeout(false);

    document.getElementById('remember-view-states').addEventListener('change', updateRememberViewStates);
    document.getElementById('remember-view-states').checked = settings.settings.rememberViewStates;

    document.getElementById('clear-view-state').addEventListener('click', clearViewState);
    document.getElementById('clear-view-state').disabled = true;

    sendMessage('id', undefined, (boardId) => {
      if (boardId) {
        document.getElementById('clear-view-state').disabled = false;
      }
    });

    document.getElementById('dump-viewstate').addEventListener('click', dumpViewState);
  });
});
