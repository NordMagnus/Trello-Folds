/* global chrome */

console.info("Running TRELLO FOLDS Chrome extension");

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

tfolds.debug = true;
tfolds.sectionCharacter = '#';
tfolds.initialize();
