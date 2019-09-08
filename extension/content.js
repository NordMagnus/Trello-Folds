/* global chrome */

console.info("%cRunning TRELLO FOLDS Chrome extension", "font-weight: bold; color: #0088ff; background-color: #e8f8ff;");
console.info(`%cExtension version: ${chrome.runtime.getManifest().version}`, "color: #0088ff; background-color: #e8f8ff;");
console.info(`%cjQuery version: ${jQuery.fn.jquery}`, "color: #0088ff; background-color: #e8f8ff;");

let IS_DEV_MODE = !('update_url' in chrome.runtime.getManifest());

chrome.runtime.onMessage.addListener( (request, sender, sendResponse) => {
    if (request.msg === "dump") {
        chrome.storage.sync.get(null, function(items) {
            console.info("VIEW STATE", items);
        });
        // sendResponse({data: null, success: true});
    } else if (request.msg === "reload") {
        window.location.reload(false);
    } else if (request.msg === "log") {
        console.log(request.data);
    } else if (request.msg === "clear") {
        tfolds.clearViewState();
    } else if (request.msg === "id") {
        sendResponse(tfolds.boardId);
    } else {
        console.warn(`Unrecognized message from extension: ${request.msg}`, request.data);
    }
});

if (IS_DEV_MODE) {
    console.info("%cRunning in developer mode, enabling debugging",
            "color: #a02820; background-color: #ffe8d8;");
    tfolds.debug = true;
} else {
    tfolds.debug = false;
}

tfolds.sectionCharacter = '#';
tfolds.initialize();
