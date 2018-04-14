/* global chrome */

let settings = {
    settings: {},
};

let numOfViewStates = 0;

function sendMessage(msg, data) {
    chrome.tabs.query({
        active: true,
        currentWindow: true,
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            msg: msg,
            data: data,
        }, (response) => {
            console.log(response);
        });
    });
}


function storeAndReload(reload = true) {
    chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
        if (reload) {
            sendMessage("reload");
        }
    });
}

function log(msg) {
    sendMessage("log", msg);
}

function updateSectionChar() {
    let ch = document.getElementById("section-char").value;
    let rpt = parseInt(document.getElementById("section-repeat").value);

    if (ch === settings.settings.sectionChar && rpt === settings.settings.sectionRepeat) {
        return;
    }

    document.getElementById("section-example-1").innerText = `${ch.repeat(rpt)} Section`;
    document.getElementById("section-example-2").innerText = `${ch.repeat(rpt+1)} Section ${ch.repeat(rpt+1)}`;

    settings.settings.sectionChar = ch;
    settings.settings.sectionRepeat = rpt;

    storeAndReload();
}

function updateWipListBar() {
    let enabled = document.getElementById("wip-list-bar").checked;
    settings.settings.enableTopBars = enabled;
    document.getElementById("top-bar-img").src = enabled ? "img/List_Top_Bar.png" : "img/List_No_Top_Bar.png";
    document.getElementById("top-bar-example-text").innerText = enabled ?
            "Sections will get a top bar when WiP limit is exceeded." :
            "WiP violations will be indicated with the badge only.";
    storeAndReload();
}

function updateRememberViewStates() {
    let enabled = document.getElementById("remember-view-states").checked;
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
    sendMessage("dump");
}

document.addEventListener('DOMContentLoaded', function () {

    /*
     * Get settings from storage
     */
    chrome.storage.sync.get(null, result => {
        if (result["settings"]) {
            settings.settings = result["settings"];
        }
        numOfViewStates = Object.keys(result).length - 1;

        document.getElementById('num-view-states').innerText = numOfViewStates;

        document.getElementById('section-char').addEventListener('change', updateSectionChar);
        document.getElementById('section-char').value = settings.settings.sectionChar;

        document.getElementById('section-repeat').addEventListener('change', updateSectionChar);
        document.getElementById('section-repeat').value = settings.settings.sectionRepeat;

        document.getElementById('wip-list-bar').addEventListener('change', updateWipListBar);
        document.getElementById('wip-list-bar').checked = settings.settings.enableTopBars;

        document.getElementById('remember-view-states').addEventListener('change', updateRememberViewStates);
        document.getElementById('remember-view-states').checked = settings.settings.rememberViewStates;

        document.getElementById('clear-view-state').disabled = true;

        document.getElementById('dump-viewstate').addEventListener('click', dumpViewState);
    });
});