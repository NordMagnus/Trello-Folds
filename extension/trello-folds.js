// eslint-disable-next-line no-unused-vars
/* global chrome */

const tfolds = (function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else {
        return factory(jQuery);
    }
}(function ($) {
    'use strict';

    let config = {
        debug: true,
        collapsedIconUrl: null,
        expandedIconUrl: null,
    };

    let settings = {
        sectionChar: '#',
        sectionRepeat: 2,
        enableTopBars: true,
        rememberViewStates: true,
        alwaysCount: false,
        enableCombiningLists: false,
        compactListWidth: 200,
    };

    let compactMode = false;

    let storage = {};
    let boardId;

    const LEFT_LIST = 1;
    const RIGHT_LIST = 2;
    const DEFAULT_COMPACT_WIDTH = 200;

    const GLOBAL_BOARD_SETTING_STRING = "trello-folds-board-settings";

    const self = {

        get config() {
            return config;
        },

        get debug() {
            return config.debug;
        },

        /**
         * Sets the debug flag. The module will output messages to the console
         * when set to `true`.
         *
         * @param {boolean} debug `true` to spam console, otherwise `false`
         */
        set debug(debug) {
            config.debug = debug;
        },

        get boardId() {
            return boardId;
        },

        get sectionCharacter() {
            return settings.sectionChar;
        },

        get sectionRepeat() {
            return settings.sectionRepeat;
        },

        set sectionRepeat(repeat) {
            settings.sectionRepeat = repeat;
        },

        set sectionCharacter(identifier) {
            settings.sectionChar = identifier;
        },

        get sectionIdentifier() {
            return settings.sectionChar.repeat(settings.sectionRepeat);
        },

        get alwaysCount() {
            return settings.alwaysCount;
        },

        set alwaysCount(alwaysCount) {
            settings.alwaysCount = alwaysCount;
        },

        get enableCombiningLists() {
            return settings.enableCombiningLists;
        },

        set enableCombiningLists(enableCombiningLists) {
            settings.enableCombiningLists = enableCombiningLists;
        },

        get compactMode() {
            return compactMode;
        },

        set compactMode(status) {
            compactMode = status;
        },

        get listWidth() {
            let width = 272;
            if (compactMode) {
                width = settings.compactListWidth || DEFAULT_COMPACT_WIDTH;
            }
            return width;
        },

        initialize() {
            tdom.debug = config.debug;
            tdom.onBoardChanged(self.boardChanged);
            tdom.onListModified(self.listModified);
            tdom.onListAdded(self.listAdded);
            tdom.onCardAdded(self.cardAdded);
            tdom.onCardRemoved(self.cardRemoved);
            tdom.onCardModified(self.cardModified);
            tdom.onListTitleModified(self.listTitleModified);
            tdom.onListDragged(self.listDragged);
            tdom.onListDropped(self.listDropped);
            tdom.onBadgesModified(self.cardBadgesModified);
            tdom.onRedrawBoardHeader(self.redrawHeader);
            tdom.init();

            /*
             * Get icon URLs
             */
            config.expandedIconUrl = chrome.runtime.getURL('img/icons8-sort-down-16.png');
            config.collapsedIconUrl = chrome.runtime.getURL('img/icons8-sort-right-16.png');
        },

        //#region EVENT HANDLERS

        /**
         *
         */
        boardChanged(boardId, oldId) {
            if (self.debug) {
                console.log(`boardId=${boardId},oldId=${oldId}`);
            }
            self.initStorage();
        },

        /**
         *
         */
        listModified(listEl) {
            if (!listEl) {
                console.log("[listEl] not defined");
                return;
            }
            self.showWipLimit(listEl);
        },

        /**
         *
         */
        listAdded(listEl) {
            if (!listEl) {
                console.log("[listEl] not defined");
                return;
            }
            self.addFoldingButton(listEl);
            self.addCollapsedList(listEl);
            self.showWipLimit($(listEl).find(".js-list-content")[0]);
        },

        listDragged(listEl) {
            let $list = $(listEl).find(".js-list-content");
            let subList = self.isSubList($list);
            if (subList) {
                self.removeSubListProps($list);
                if (subList === LEFT_LIST) {
                    $list.parent().find(".super-list,.super-list-collapsed").remove();
                    self.removeSubListProps($("div.placeholder").next().find(".js-list-content"));
                } else {
                    let $leftList = $("div.placeholder").prev().find(".js-list-content");
                    self.removeSubListProps($leftList);
                    $leftList.parent().find(".super-list,.super-list-collapsed").remove();
                }
            }
        },

        listDropped() {
            self.combineLists();
        },

        /**
         *
         */
        cardAdded(cardEl) {
            setTimeout(() => {
                self.formatCard(cardEl);
            }, 100);
        },

        /**
         * Called when a card is removed from a list. In practice this method
         * is invoked when a card is dragged and used to expand cards when a section
         * card is moved.
         *
         * @param {Element} cardEl
         */
        cardRemoved(cardEl) {
            let $cardEl = $(cardEl);
            if ($cardEl.hasClass("section-card")) {
                $cardEl.find("div.list-card-details").css("opacity", "0.0");
                //$cardEl.find("span#section-title").css("background-color", "#dfe3e6");
                let $section = $cardEl.find(".icon-collapsed");
                if ($section.length !== 0) {
                    self.toggleSection($section[0]);
                }
            }
        },

        cardBadgesModified(cardEl) {
            let $c = $(cardEl);
            if ($c.find(".badge-text:contains('Blocked'),.badge-text:contains('blocked')").length !== 0) {
                $c.addClass("blocked-card");
                $c.find(".list-card-title").addClass("blocked-title");
                $c.find("div.badge").children().addClass("blocked-badges");
            } else {
                $c.removeClass("blocked-card");
                $c.find(".list-card-title").removeClass("blocked-title");
                $c.find("div.badge").children().removeClass("blocked-badges");
            }
        },

        /**
         * This method is called when a list card changes.
         * It checks if the card changed into a section or from being a section.
         * It also checks if card is a *comment card*.
         *
         * @param {Element} cardEl The card that was modified
         * @param {String} title The new title
         * @param {String} oldTitle The title before it was modified
         */
        cardModified(cardEl, title, oldTitle) {
            let $c = $(cardEl);

            $c.removeClass("comment-card");

            self.checkSectionChange($c, title, oldTitle);

            if (!self.isSection(title)) {
                if (title.indexOf("//") === 0) {
                    $c.addClass("comment-card");
                }
            }

            self.showWipLimit(tdom.getContainingList(cardEl));
        },

        /**
         * Checks if section state changed. There are basically
         * three changes that we need to handle:
         * 1. A section card's title changed
         * 2. A card was changed __into__ a section
         * 3. A card was changed __from__ a section to a normal card
         * In addition for item 2 and 3 above the list WIP has to be updated
         */
        checkSectionChange($c, title, oldTitle) {
            if (!self.isSection(title) && !self.isSection(oldTitle)) {
                return;
            }

            /*
             * Case 1: Only title changed (was, and still is, a section)
             */
            if (self.isSection(title) && self.isSection(oldTitle)) {
                $c.find("#section-title").text(self.getStrippedTitle(title));
                return;
            }

            /*
             * Case 3: A card was changed from a section
             */
            if (!self.isSection(title)) {
                self.removeSectionFormatting($c);
            } else {
                /*
                 * Case 2: Was a normal card now a section
                 */
                self.formatAsSection($c);
            }
        },

        /**
         * Removes any section formatting for the specified card.
         *
         * @param {jQuery} $card The card to strip
         */
        removeSectionFormatting($card) {
            $card.find("span.icon-expanded,span.icon-collapsed").remove();
            $card.find("span#section-title").remove();
            $card.find("span.list-card-title").show();
            $card.find("div.list-card-details").css("opacity", "1.0");
            $card.removeClass("section-card");
        },

        /**
         *
         */
        listTitleModified(list, title) {
            let $l = $(list);

            if (self.isSubList($l)) {
                if (self.splitLists($l)) {
                    $l.parent().find(".super-list,.super-list-collapsed").remove();
                }
            }

            /*
             * Check if it should be a super list with any adjacent list.
             */
            let prev = tdom.getPrevList($l[0]);
            let next = tdom.getNextList($l[0]);
            if (next && self.areListsRelated($l, $(next))) {
                self.combineListWithNext($l[0], next);
            } else if (prev && self.areListsRelated($(prev), $l)) {
                self.combineListWithNext(prev, $l[0]);
            } else {
                self.showWipLimit(list);
            }
        },

        redrawHeader() {
            self.addBoardIcons();
            self.updateCompactModeButtonState(compactMode);
        },

        //#endregion EVENT HANDLERS

        /**
         *
         */
        isSection(title) {
            return title.indexOf(self.sectionIdentifier) !== -1;
        },

        /**
         *
         */
        getStrippedTitle(title) {
            let ch = self.sectionCharacter;
            if (['*', '^', '$', '.', '+', '?', '|', '\\'].indexOf(ch) !== -1) {
                ch = `\\${ch}`;
            }
            let re = new RegExp(`(${ch})\\1{${self.sectionRepeat - 1},}`, 'g');
            return title.replace(re, "").trim();
        },

        /**
         *
         */
        initStorage() {
            boardId = tdom.getBoardIdFromUrl();

            chrome.storage.sync.get(["settings", boardId], result => {
                if (config.debug) {
                    console.table(result.settings);
                    if (result.settings["rememberViewStates"] === true) {
                        console.table(result[boardId]);
                    }
                }
                if (result["settings"]) {
                    settings = result["settings"];
                }
                storage = result[boardId] || {};
                self.setupBoard();
            });
        },

        /**
         * This method is called when the extension is first loaded and when
         * a new board is loaded.
         */
        setupBoard(attemptCount = 1) {
            let $canvas = $("div.board-canvas");
            if (!$canvas.length) {
                /*
                 * Trying to find the board again in 100 ms if not found directly.
                 * Should not happen after changes to ``tdom.js`` but let's play it safe and
                 * keep it - changing log level to warn.
                 */
                if (attemptCount < 3) {
                    setTimeout(() => {
                        console.warn(`Trying to find DIV.board-canvas again (attempt ${attemptCount + 1})`);
                        self.setupBoard(attemptCount + 1);
                    }, 100);
                    return;
                }
                throw ReferenceError(`DIV.board-canvas not found after ${attemptCount} attempts`);
            }

            if (config.debug) {
                console.info("%cSetting up board", "font-weight: bold;");
            }

            self.cleanupStorage();
            self.formatCards();

            self.formatLists();

            self.addBoardIcons();

            compactMode = self.retrieveGlobalBoardSetting("compactMode");
            self.setCompactMode(compactMode);

            if (settings.rememberViewStates) {
                setTimeout(() => {
                    self.restoreSectionsViewState();
                }, 200);
            } else {
                self.clearViewState();
            }

        },

        /**
         * Adds board wide buttons to the top bar.
         */
        addBoardIcons() {
            let $boardBtns = $("div.board-header-btns.mod-right");

            $boardBtns.prepend('<span class="board-header-btn-divider"></span>');

            /*
             * COMPACT MODE
             */
            $boardBtns.prepend(`<a id='toggle-compact-mode' class='board-header-btn board-header-btn-without-icon board-header-btn-text compact-mode-disabled'>
                                                <span class=''>Compact Mode</span></a>`);
            $("a#toggle-compact-mode").click(function() {
                compactMode = !compactMode;
                self.setCompactMode(compactMode);
            });

            /*
             * REDRAW BOARD
             */
            $boardBtns.prepend(`<a id='redraw-board' class='board-header-btn board-header-btn-without-icon board-header-btn-textboard-header-btn board-header-btn-without-icon board-header-btn-text'>
                                                <span class=''>Redraw</span></a>`);
            $("a#redraw-board").click(function() {
                self.formatLists();
                self.formatCards();
            });

        },

        /**
         * Sets the compact mode for the current board and stores the setting.
         *
         * @param {boolean} enabled `true` if compact mode should be enabled, otherwise `false`
         */
        setCompactMode(enabled) {
            self.updateCompactModeButtonState(enabled);
            $("div.list-wrapper:not(:has(>div.list-collapsed:visible)):not(:has(>div.super-list-collapsed:visible))").css("width", `${self.listWidth}px`);
            $("div.super-list:not(:has(>div.super-list-collapsed:visible))").css("width", `${self.listWidth*2-8}px`);
            self.storeGlobalBoardSetting("compactMode", enabled);
        },

        updateCompactModeButtonState(enabled) {
            let $btn = $("a#toggle-compact-mode");
            if (enabled) {
                $btn.addClass("compact-mode-enabled");
                $btn.removeClass("compact-mode-disabled");
            } else {
                $btn.addClass("compact-mode-disabled");
                $btn.removeClass("compact-mode-enabled");
            }
        },

        /**
         *
         */
        cleanupStorage() {
            // console.log("cleanupStorage()", storage);
            if (settings.enableCombiningLists === false) {
                // TODO Add function to clear super list states
            }
        },

        /**
         * Removes the view state for the board. Called when board is setup
         * if the `store view state` has been disabled.
         */
        clearViewState() {
            chrome.storage.sync.remove(boardId);
        },

        /**
         * Iterates section formatted cards and restores stored view states.
         * Called at board setup.
         */
        restoreSectionsViewState() {
            const $lists = tdom.getLists();
            $lists.each(function () {
                const $l = $(this);
                let $sections = tdom.getCardsInList(this, self.sectionIdentifier);
                const sectionStates = self.retrieve(tdom.getListName($l), "sections");
                if (!sectionStates) {
                    return;
                }
                $sections.each(function () {
                    const cardName = tdom.getCardName($(this));
                    if (sectionStates[self.getStrippedTitle(cardName)] === true) {
                        let $section = $(this).find(".icon-expanded");
                        self.toggleSection($section[0], false);
                    }
                });
            });
        },

        /**
         * Stores a board wide setting imitating a list setting for the list specified
         * by GLOBAL_BOARD_SETTING_STRING. Of course, in the unlikely event someone has
         * a list with that name this might fail. Implemented it like this for backward
         * compatibility reasons.
         *
         * @param {String} key The preference to store
         * @param {Object} value The new value of the preference
         * @see #store()
         */
        storeGlobalBoardSetting(key, value) {
            self.store(GLOBAL_BOARD_SETTING_STRING, key, value);
        },

        /**
         * Retrieves a board wide setting.
         *
         * @param {String} key the preference to retrieve
         * @see #storeGlobalBoardSetting()
         * @see #retrieve()
         */
        retrieveGlobalBoardSetting(key) {
            return self.retrieve(GLOBAL_BOARD_SETTING_STRING, key);
        },

        /**
         * Updates the Chrome storage with board viewstate. The chrome storage is organized as follows:
         * ```
         * boardId
         * +--+ listName
         *    +--- setting
         * ```
         *
         * @param {String} listName The list
         * @param {String} key The preference to store
         * @param {Object} value The preference new value
         */
        store(listName, key, value) {
            if (!boardId) {
                throw new ReferenceError("Board ID not set");
            }

            let setting = storage[listName] || {};
            setting[key] = value;
            storage[listName] = setting;
            let boardStorage = {};
            boardStorage[boardId] = storage;
            chrome.storage.sync.set(boardStorage, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                }
            });
        },

        /**
         * Retrieves a list specific preference.
         *
         * @param {String} listName The list
         * @param {String} key The preference to retrieve
         * @see #store()
         */
        retrieve(listName, key) {
            let value;
            try {
                value = storage[listName][key];
            } catch (e) {
                // if (config.debug) {
                //     console.warn(`Setting [${key}] for list [${listName}] not set`);
                // }
            }
            return value;
        },

        /**
         * Applies extension specific formatting to all lists in the board.
         */
        formatLists() {
            self.combineLists();
            self.makeListsFoldable();
            self.addWipLimits();
        },

        //#region COMBINED LISTS

        /**
         *
         */
        combineLists() {
            if (settings.enableCombiningLists === false) {
                return;
            }
            let $lists = tdom.getLists();
            for (let i = 0; i < $lists.length; ++i) {
                if (tdom.getListName($lists[i]).indexOf(".") === -1 || i === $lists.length - 1) {
                    self.removeSubListProps($lists.eq(i));
                    continue;
                }
                if (self.areListsRelated($lists[i], $lists[i + 1])) {
                    self.combineListWithNext($lists[i], $lists[i + 1]);
                    ++i; // Increase i again to skip one list when combining
                } else {
                    self.removeSubListProps($lists.eq(i));
                }
            }
        },

        /**
         * Determines if two lists are related, i.e. have same dot separated prefix.
         * For example
         *
         * `listigt.sub1 listigt.sub2`
         *
         * will return `true`.
         *
         * @param {jQuery} $l1 The first list
         * @param {jQuery} $l2 The second list
         */
        areListsRelated($l1, $l2) {
            const name1 = tdom.getListName($l1);
            const name2 = tdom.getListName($l2);
            return name1.includes(".") && (name1.substr(0, name1.indexOf(".")) === name2.substr(0, name2.indexOf(".")));
        },

        /**
         * Splits the lists into two ordinary lists assuming they are combined
         * and no longer matches.
         *
         * This would typically happen if a list is moved around or its title changed.
         *
         * @param {jQuery} $list The list object for the list being modified
         * @return {boolean} `true` if lists split, otherwise `false`
         */
        splitLists($list) {
            let isSubList = $list.data("subList");
            if (!isSubList) {
                console.warn("Called splitLists() with a list that isn't a sublist", $list);
                return false;
            }

            let $leftList;
            let $rightList;

            if (isSubList === LEFT_LIST) {
                $leftList = $list;
                $rightList = $list.parent().next().find(".js-list-content");
                console.info($rightList);
                if (!self.isSubList($rightList)) {
                    console.warn("List to right not a sub list");
                    return false;
                }
            } else {
                $rightList = $list;
                $leftList = $list.parent().prev().find(".js-list-content");
                console.info($leftList);
                if (!self.isSubList($leftList)) {
                    console.warn("List to left not a sub list");
                    return false;
                }
            }

            if (self.areListsRelated($leftList, $rightList)) {
                return false;
            }

            self.removeSubListProps($leftList);
            self.removeSubListProps($rightList);

            return true;
        },

        /**
         *
         */
        removeSubListProps($l) {
            if ($l.data("subList") === LEFT_LIST) {
                $l.parent().find(".super-list,.super-list-collapsed").remove();
            }
            $l.removeData("subList").removeClass("sub-list");
            self.addFoldingButton($l[0]);
            self.showWipLimit($l[0]);
        },

        combineListWithNext(leftList, rightList) {
            let $l = $(leftList);
            let $r = $(rightList);

            if ($l.hasClass("sub-list")) {
                if (self.debug) {
                    console.log("Left list already combined with other list");
                }
                return;
            }
            if ($r.hasClass("sub-list")) {
                if (self.debug) {
                    console.log("Right list already combined with other list");
                }
            }
            $l.addClass("sub-list");
            $l.data("subList", LEFT_LIST);
            $r.addClass("sub-list");
            $r.data("subList", RIGHT_LIST);
            self.removeFoldingButton(leftList);
            self.removeFoldingButton(rightList);
            self.showWipLimit(leftList);
            self.showWipLimit(rightList);
            self.addSuperList(leftList);
        },

        /**
         *
         */
        isSubList($l) {
            if (!$l) {
                throw new TypeError("Parameter [$l] undefined");
            }
            return $l.data("subList") >= 1;
        },

        addSuperList(leftList) {
            // let $canvas = $("div#board");
            let $leftList = $(leftList);
            let $superList = $('<div class="super-list"></div>');
            let $title = $('<span class="super-list-header"></span>');
            let $extras = $('<div class="list-header-extras"></div>');

            $title.append($extras);

            $superList.data("superList", true);

            /*
            * Make list same height as contained lists. This height is also
            * tweaked using CSS padding.
            */
            $superList.append($title);

            self.addFoldingButton($superList[0]);

            $leftList.parent().prepend($superList);

            self.addCollapsedSuperList($superList);

            self.updateSuperList(leftList, LEFT_LIST);

            $superList.on("resized", function(event, subListEl) {
                self.updateSuperListHeight($(subListEl));
            });


            self.attachListResizeDetector(leftList);
            self.attachListResizeDetector(self.getPairedList(leftList));
        },

        /**
         *
         */
        addCollapsedSuperList($superList) {
            try {
                let $collapsedList = $(`<div style="display: none" class="super-list-collapsed list"><span class="list-header-name">EMPTY</span></div>`);
                $superList.parent().prepend($collapsedList);
                $collapsedList.click(function () {
                    tfolds.expandSuperList($collapsedList);
                    return false;
                });
                if (settings.rememberViewStates) {
                    const collapsed = self.retrieve(tdom.getListName($superList.siblings(".js-list-content")), "super-list-collapsed");
                    if (collapsed === true) {
                        self.collapseSuperList($superList);
                    }
                }
            } catch (e) {
                // Deliberately empty
            }
        },

        /**
         *
         * @param {*} listEl
         */
        getPairedList(listEl) {
            if (!listEl) {
                throw new TypeError("Parameter [$l] undefined");
            }
            let $l = $(listEl);
            if (!self.isSubList($l)) {
                throw new TypeError("Parameter [$l] not sublist");
            }
            let listPos = $l.data("subList");
            if (listPos === LEFT_LIST) {
                return tdom.getNextList(listEl);
            }
            return tdom.getPrevList(listEl);
        },

        /**
         *
         * @param {*} $subList
         */
        updateSuperListHeight($l) {
            if (!$l) {
                throw new TypeError("Parameter [$l] undefined");
            }
            if (!self.isSubList($l)) {
                throw new TypeError("Parameter [$l] not sublist");
            }
            let pairedList = self.getPairedList($l[0]);
            let $superList = self.getMySuperList($l[0]);
            $superList.css("height", Math.max($l.height(), $(pairedList).height()));
        },

        getMySuperList(subListEl) {
            let leftListEl;
            if ($(subListEl).data("subList") == 1) {
                leftListEl = subListEl;
            } else {
                leftListEl = self.getPairedList(subListEl);
            }
            return $(leftListEl).siblings("div.super-list");
        },

        updateSuperList(subList, listPos) {
            let $superList = self.getMySuperList(subList);
            let $title = $superList.find("span.super-list-header");

            /*
             * Only modify if the left sub list
             */
            if (listPos !== 1) {
                return;
            }

            $title.find("span.wip-limit-title").remove();

            /*
             * Get the WiP limit from the left list
             */
            let wipLimit;
            let pairedList = self.getPairedList(subList);

            if (listPos === LEFT_LIST) {
                wipLimit = self.extractWipLimit(subList);
            } else {
                wipLimit = self.extractWipLimit(pairedList);
            }
            let totNumOfCards = self.countWorkCards(subList) + self.countWorkCards(pairedList);
            let title = tdom.getListName(subList);
            title = title.substr(0, title.indexOf('.'));
            let $wipTitle;
            $wipTitle = self.createWipTitle(title, totNumOfCards, wipLimit);
            self.updateWipBars($superList, totNumOfCards, wipLimit);
            $title.append($wipTitle);
            self.updateSuperListHeight($(subList));
            self.updateCollapsedSuperList($superList, $wipTitle.clone());

            $("div.list-wrapper:not(:has(>div.list-collapsed:visible)):not(:has(>div.super-list-collapsed:visible))").css("width", `${self.listWidth}px`);
            $("div.super-list:not(:has(>div.super-list-collapsed:visible))").css("width", `${self.listWidth*2-8}px`);

            return $wipTitle;
        },

        /**
         *
         * @param {Element} listEl
         */
        attachListResizeDetector(listEl) {
            // let timeSinceLast;
            if (self.debug) {
                console.log("Attaching resize detector: ", listEl);
                // timeSinceLast = 0;
            }
            function callback(timestamp) {
                // if (self.debug) {
                //     if (timestamp - timeSinceLast > 5000) {
                //         console.log($(listEl).data("subList"), $(listEl).is(":visible"));
                //         timeSinceLast = timestamp;
                //     }
                // }
                if (!$(listEl).is(":visible") || !$(listEl).data("subList")) {
                    return;
                }
                if (listEl.clientHeight !== $(listEl).data("oldHeight")) {
                    $(listEl).data("oldHeight", listEl.clientHeight);
                    self.getMySuperList(listEl).trigger("resized", listEl);
                }
                requestAnimationFrame(callback);
            }

            $(listEl).data("oldHeight", listEl.clientHeight);

            requestAnimationFrame(callback);
        },

        /**
         *
         */
        updateCollapsedSuperList($superList, $wipTitle) {
            let $header = $superList.parent().find(".super-list-collapsed > span.list-header-name");
            $header.empty().append($wipTitle);
        },

        //#region COMBINED LISTS

        /**
         *
         */
        makeListsFoldable() {
            let $lists = $("div.list-wrapper");
            $lists.each(function () {
                self.addFoldingButton(this);
                self.addCollapsedList(this);
            });
        },

        /**
         *
         */
        addFoldingButton(listEl) {
            let $l = $(listEl);

            if ($l.find(".js-list-content").data("subList") > 0) {
                return;
            }

            let $header = $l.find('div.list-header-extras');
            $header.find(".icon-close").parent().remove();
            let $foldIcon = self.createFoldIcon();

            $foldIcon.click(function () {
                // console.log($(this).closest(".list"));
                let $l = $(this).closest(".list");
                if ($l.length === 1) {
                    self.collapseList($l);
                } else {
                    if ($l.length !== 0) {
                        console.error("Expected to find ONE list or super list");
                        return;
                    }
                    self.collapseSuperList($(this).closest(".super-list"));
                }
                return false;
            });
            $header.append($foldIcon);
        },

        createFoldIcon() {
            return $('<a class="list-header-extras-menu dark-hover" href="#"><span class="icon-sm icon-close dark-hover"/></a>');
        },

        /**
         *
         */
        removeFoldingButton(listEl) {
            let $l = $(listEl);
            // ? Here the span tag is removed - in addFoldingButton() above the parent A tag is removed
            $l.find("div.list-header-extras > a > span.icon-close").remove();
        },

        /**
         *
         */
        addCollapsedList(listEl) {
            const $l = $(listEl);
            if ($l.hasClass("js-add-list")) {
                return;
            }
            /*
             * If list already contains an element with list-collapsed class
             * this method is called from "redraw"
             */
            if ($l.find(".list-collapsed").length !== 0) {
                if (self.debug) {
                    console.log("There's already a list-collapsed elementish");
                }
                return;
            }
            $l.css({
                "position": "relative",
            });
            try {
                const name = tdom.getListName(listEl);
                let $collapsedList = $(`<div style="display: none" class="list-collapsed list"><span class="list-header-name">${name}</span></div>`);
                $collapsedList.click(function () {
                    /*
                     * Call expandList with the list wrapper as argument
                     */
                    self.expandList($collapsedList);
                    return false;
                });
                $l.prepend($collapsedList);
                if (settings.rememberViewStates) {
                    const collapsed = self.retrieve(tdom.getListName($l), "collapsed");
                    if (collapsed === true) {
                        self.collapseList($l.find(".list").first().next());
                    }
                }
            } catch (e) {
                // Deliberately empty
            }
        },

        /**
         *
         */
        addWipLimits() {
            let $wipLists;
            if (settings.alwaysCount === true) {
                $wipLists = tdom.getLists();
            } else {
                $wipLists = tdom.getLists(/\[([0-9]*?)\]/);
            }
            $wipLists.each(function () {
                self.showWipLimit(this);
            });
        },

        /**
         *
         */
        showWipLimit(listEl) {
            const $l = $(listEl);
            let numCards = self.countWorkCards(listEl);
            let wipLimit = self.extractWipLimit(listEl);
            let subList = $l.data("subList");
            self.removeWipLimit($l);
            if (subList > 0) {
                self.addWipLimit($l, numCards);
                self.updateSuperList($l, subList);
                $l.removeClass("wip-limit-reached").removeClass("wip-limit-exceeded");
                $l.prev().removeClass("collapsed-limit-reached").removeClass("collapsed-limit-exceeded");
            } else if (wipLimit !== null) {
                self.addWipLimit($l, numCards, wipLimit);
                self.updateWipBars($l, numCards, wipLimit);
            } else if (settings.alwaysCount === true) {
                self.addWipLimit($l, numCards);
            }
        },

        /**
         * Counts cards representing work in the specified list.
         * In other words, count all cards except those representing sections or notes.
         *
         * @param {Element} listEl The list for which to count cards
         */
        countWorkCards(listEl) {
            // TODO Replace "//" with setting
            return tdom.countCards(listEl, [self.sectionIdentifier, "//"], 0);
        },

        /**
         *
         */
        updateWipBars($l, numCards, wipLimit) {
            if (typeof wipLimit === "number" && settings.enableTopBars) {
                if (numCards === wipLimit) {
                    $l.addClass("wip-limit-reached").removeClass("wip-limit-exceeded");
                    $l.siblings(".list-collapsed,.super-list-collapsed").addClass("collapsed-limit-reached").removeClass("collapsed-limit-exceeded");
                    return;
                } else if (numCards > wipLimit) {
                    $l.removeClass("wip-limit-reached").addClass("wip-limit-exceeded");
                    $l.siblings(".list-collapsed,.super-list-collapsed").removeClass("collapsed-limit-reached").addClass("collapsed-limit-exceeded");
                    return;
                }
            }
            self.removeWipBar($l);
        },

        /**
         *
         */
        removeWipLimit($l) {
            $l.find("span.wip-limit-title").remove();
            const $header = $l.find(".list-header");
            $header.find("textarea").show();
            self.removeWipBar($l);
        },

        /**
         *
         */
        removeWipBar($l) {
            $l.removeClass("wip-limit-reached").removeClass("wip-limit-exceeded");
            $l.prev().removeClass("collapsed-limit-reached").removeClass("collapsed-limit-exceeded");
        },

        /**
         *
         * @param {*} listEl
         */
        extractWipLimit(listEl) {
            let title = tdom.getListName(listEl);
            let matches = title.match(/\[([0-9]*?)\]/);

            if (matches && matches.length > 1) {
                return parseInt(matches[1]);
            }

            return null;
        },

        /**
         *
         * @param {*} $l
         * @param {*} numCards
         * @param {*} wipLimit
         */
        addWipLimit($l, numCards, wipLimit) {
            let strippedTitle;

            $l.find("span.wip-limit-title").remove();
            const title = tdom.getListName($l[0]);
            let isSubList = $l.data("subList") > 0;

            if (title.indexOf('[') !== -1) {
                strippedTitle = title.substr(0, title.indexOf('['));
            } else {
                strippedTitle = title;
            }

            if (isSubList) {
                strippedTitle = strippedTitle.substr(strippedTitle.indexOf(".") + 1);
            }

            self.addWipListTitle($l, numCards, !isSubList ? wipLimit : null, strippedTitle);
        },

        /**
         *
         * @param {*} $l
         * @param {*} numCards
         * @param {*} wipLimit
         * @param {*} strippedTitle
         */
        addWipListTitle($l, numCards, wipLimit, strippedTitle) {
            let $wipTitle;
            let $header = $l.find(".list-header");

            $wipTitle = this.createWipTitle(strippedTitle, numCards, wipLimit);

            $l.parent().find("div.list-collapsed").empty().append($wipTitle);
            $wipTitle = $wipTitle.clone();
            $header.off("click").click(function (e) {
                $(this).find(".wip-limit-title").hide();
                $(this).find("textarea").show().select();
                return !$(e.target).hasClass("wip-limit-badge");
            });
            $header.find("textarea").hide().off("blur").blur(function () {
                self.showWipLimit($l);
            });
            $header.append($wipTitle);
        },

        /**
         *
         */
        createWipTitle(title, numCards, wipLimit) {
            let $wipTitle;

            if (!(typeof wipLimit === "number")) {
                let countBadge = settings.alwaysCount ? `<span class="wip-limit-badge">${numCards}</span>` : "";
                $wipTitle = $(`<span class="wip-limit-title">${title} ${countBadge}</span>`);
            } else {
                $wipTitle = $(`<span class="wip-limit-title">${title} <span class="wip-limit-badge">${numCards} / ${wipLimit}</span></span>`);
                if (numCards === wipLimit) {
                    $wipTitle.find(".wip-limit-badge").css("background-color", "#fb7928");
                } else if (numCards > wipLimit) {
                    $wipTitle.find(".wip-limit-badge").css("background-color", "#b04632");
                }
            }

            return $wipTitle;
        },

        /**
         *
         */
        formatCards($canvas) {
            let $cards = tdom.getCardsByName("", false);
            if (config.debug) {
                console.groupCollapsed("Formatting cards");
            }
            $cards.each(function() {
                self.formatCard(this);
            });
            if (config.debug) {
                console.groupEnd();
            }
        },

        /**
         *
         */
        formatCard(cardEl) {
            let $c = $(cardEl);

            let cardName = tdom.getCardName($c);
            if (cardName.indexOf(self.sectionIdentifier) === 0) {
                if (config.debug) {
                    console.info(`Card [${cardName}] is a section`);
                }
                self.formatAsSection($c);
            } else if (cardName.indexOf("//") === 0) {
                if (config.debug) {
                    console.info(`Card [${cardName}] is a comment`);
                }
                $c.addClass("comment-card");
            } else if ($c.find(".badge-text:contains('Blocked'),.badge-text:contains('blocked')").length !== 0) {
                if (config.debug) {
                    console.info(`Card [${cardName}] is blocked`);
                }
                $c.addClass("blocked-card");
                $c.find(".list-card-title").addClass("blocked-title");
                $c.find("div.badge").children().addClass("blocked-badges");
            }
        },

        /**
         *
         */
        formatAsSection($card) {
            if (self.debug) {
                console.log(`Formatting as section: ${tdom.getCardName($card)}`);
            }
            if ($card.find("#section-title").length !== 0) {
                if (self.debug) {
                    console.log("Section title already exists");
                }
                return;
            }
            const $icon = $('<span class="icon-expanded"/>');
            $icon.click(function () {
                tfolds.toggleSection(this);
                return false;
            });
            const strippedTitle = self.getStrippedTitle(tdom.getCardName($card));

            $card.prepend(`<span id="section-title">${strippedTitle}</span>`);
            $card.prepend($icon);
            $card.find('span.list-card-title').hide();
            $card.addClass("section-card");
        },

        /**
         *
         */
        collapseList($list) {
            $list.toggle().prev().toggle().parent().css("width", "40px");
            $list.prev().find(".list-header-name").text(tdom.getListName($list[0]));
            self.store(tdom.getListName($list), "collapsed", true);
        },

        /**
         *
         * @param {jQuery} $superList
         */
        collapseSuperList($superList) {
            $superList.toggle().siblings(".super-list-collapsed").toggle().parent().css("width", "40px").next().hide();
            /*
             *  Hide sub lists
             */
            $superList.siblings(".sub-list").hide();
            $superList.parent().next().find(".list").hide();
            self.store(tdom.getListName($superList.siblings(".js-list-content")), "super-list-collapsed", true);
        },

        /**
         *
         */
        expandList($list) {
            $list.toggle().next().toggle().parent().css("width", `${self.listWidth}px`);
            // TODO Instead of storing "false" remove setting(?)
            self.store(tdom.getListName($list.next()), "collapsed", false);
        },

        /**
         *
         */
        expandSuperList($collapsedList) {
            let $superList = $collapsedList.toggle().siblings(".super-list");
            $superList.toggle().parent().css("width", `${self.listWidth}px`).next().show();
            $superList.siblings(".sub-list").show();
            $superList.parent().next().find(".js-list-content").show();
            self.store(tdom.getListName($superList.siblings(".js-list-content")), "super-list-collapsed", false);
            self.updateSuperList($superList.siblings(".sub-list")[0], LEFT_LIST);
        },

        /**
         *
         */
        toggleSection(section, updateStorage = true) {
            let $l;
            let $s = $(section);
            let $cards;

            $s.toggleClass("icon-collapsed icon-expanded");

            let $placeholder = $("a.list-card.placeholder");
            let ident = self.sectionIdentifier;

            if ($placeholder.length !== 0) {
                if (self.debug) {
                    console.log("A section was just dragged");
                }
                $l = $(tdom.getContainingList($placeholder[0]));
                $cards = $placeholder.closest("a").nextUntil(`a:contains('${ident}'),div.card-composer`);
            } else {
                $l = $(tdom.getContainingList(section));
                $cards = $s.closest("a").nextUntil(`a.section-card,div.card-composer`);
            }

            $cards.toggle();

            if (updateStorage === true) {
                let listSections = self.retrieve(tdom.getListName($l), "sections");
                if (!listSections) {
                    listSections = {};
                }
                const title = $s.next().text();
                listSections[title] = $s.hasClass("icon-collapsed");
                self.store(tdom.getListName($l), "sections", listSections);
            }

            // if (self.isSubList($l)) {
            //     self.updateSuperListHeight($l);
            // }
        },

    };

    return self;
}));