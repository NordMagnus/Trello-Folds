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
    };

    let storage = {};
    let boardId;

    const LEFT_LIST = 1;
    const RIGHT_LIST = 2;

    const self = {

        get config() {
            return config;
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

        /**
         * Initializes the Squadification extension by adding a `MutationObserver`
         * to the `DIV#content` element, and explicitly calling `setupBoard` in case
         * the first board loaded is a Squadification board.
         *
         * @returns {MutationObserver} The instantiated observer
         */
        initialize() {
            tdom.debug = config.debug;
            tdom.onBoardChanged(self.boardChanged);
            tdom.onListModified(self.listModified);
            tdom.onListAdded(self.listAdded);
            tdom.onCardAdded(self.cardAdded);
            tdom.onCardModified(self.cardModified);
            tdom.onListTitleModified(self.listTitleModified);
            tdom.initialize();

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
        boardChanged(oldBoardId, newBoardId) {
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
                return;
            }
            self.addFoldingButton(listEl);
            self.addCollapsedList(listEl);
            self.showWipLimit(listEl);
        },

        /**
         *
         */
        cardAdded(cardEl) {
            const $c = $(cardEl);
            let text = tdom.getCardName($c);
            if (self.isSection(text)) {
                console.error("TODO: Add logic to add new section");
                self.formatAsSection($c);
            }
        },

        /**
         * This method is called when a list card changes. There are basically
         * three changes that we need to handle:
         * 1. A section card's title changed
         * 2. A card was changed __into__ a section
         * 3. A card was changed __from_ a section to a normal card
         * In addition for item 2 and 3 above the list WIP has to be updated
         *
         * @param {Element} cardEl The card that was modified
         * @param {String} title The new title
         * @param {String} oldTitle The title before it was modified
         */
        cardModified(cardEl, title, oldTitle) {
            console.log("cardModified()");
            let $c = $(cardEl);

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
                console.log("CASE 2: Removing section");
                $c.find("span.icon-expanded,span.icon-collapsed").remove();
                $c.find("span#section-title").remove();
                $c.find("span.list-card-title").show();
                $c.removeClass("section-card");
            } else {
                /*
                 * Case 2: Was a normal card now a section
                 */
                self.formatAsSection($c);
            }

            self.showWipLimit(tdom.getContainingList(cardEl));
        },

        /**
         *
         */
        listTitleModified(list, title) {
            console.log("listTitleModified()", list, title);
            self.showWipLimit(list);
        },

        //#endregion EVENT HANDLERS

        /**
         *
         */
        isSection(title) {
            return title.indexOf(self.sectionIdentifier) !== -1;
            // return title.search()
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
            // chrome.storage.sync.clear();
            boardId = tdom.getBoardIdFromUrl();

            chrome.storage.sync.get(["settings", boardId], result => {
                if (config.debug) {
                    console.info("Getting settings", result);
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
                if (attemptCount < 3) {
                    setTimeout(() => {
                        console.log(`Trying to find DIV.board-canvas again (attempt ${attemptCount + 1})`);
                        self.setupBoard(attemptCount + 1);
                    }, 100);
                    return;
                }
                throw ReferenceError(`DIV.board-canvas not found after ${attemptCount} attempts`);
            }

            if (config.debug) {
                console.info("Setting up board");
            }

            self.cleanupStorage();
            self.formatSections();
            if (settings.rememberViewStates) {
                self.restoreSectionsViewState(); // TODO Refactor to "restoreViewstate" including both lists and sections?
            } else {
                self.clearViewState();
            }
            self.formatLists();
        },

        /**
         *
         */
        cleanupStorage() {
            console.log(storage);
            // TODO Implement
        },

        /**
         *
         */
        clearViewState() {
            chrome.storage.sync.remove(boardId);
        },

        /**
         *
         */
        restoreSectionsViewState() {
            const $lists = tdom.getLists();
            $lists.each(function() {
                const $l = $(this);
                let $sections = tdom.getCardsInList(this, self.sectionIdentifier);
                const sectionStates = self.retrieve(tdom.getListName($l), "sections");
                if (!sectionStates) {
                    return;
                }
                $sections.each(function() {
                    const cardName = tdom.getCardName($(this));
                    if (sectionStates[self.getStrippedTitle(cardName)] === true) {
                        self.toggleSection($(this).find("span.icon-expanded")[0]);
                    }
                });
            });
        },

        /**
         * Updates the Chrome storage with board viewstate. The chrome storage is organized as follows:
         * ```
         * boardId
         * +--+ listName
         *    +--- setting
         * ```
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
                // console.log(`[${key}] set to [${value}] for list [${listName}] in board ${boardId}`);
            });
        },

        /**
         *
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
         *
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
            let $lists = tdom.getLists(".");
            for (let i = 0; i < $lists.length - 1; ++i) {
                const listName = tdom.getListName($lists[i]);
                const nextName = tdom.getListName($lists[i+1]);
                if (listName.substr(0, listName.indexOf(".")) ===
                        nextName.substr(0, nextName.indexOf("."))) {
                            console.info(`Combining lists:${listName} and ${nextName}`);
                            self.combineListWithNext($lists[i], $lists[i+1]);
                            ++i;
                        }
            }
        },

        combineListWithNext(leftList, rightList) {
            self.addSuperList(leftList, rightList);
            $(leftList).addClass("sub-list");
            $(leftList).data("subList", LEFT_LIST);
            $(rightList).addClass("sub-list");
            $(rightList).data("subList", RIGHT_LIST);
        },

        addSuperList(leftList, rightList) {
            // let $canvas = $("div#board");
            let $leftList = $(leftList);
            let $superList = $('<div class="super-list"></div>');
            let $title = $('<span class="super-list-header"></span>');
            let $extras = $('<div class="list-header-extras"></div>');

            $title.append($extras);

            /*
            * Make list same height as contained lists. This height is also
            * tweaked using CSS padding.
            */
           $superList.append($title);

           $leftList.parent().prepend($superList);

           let title = self.updateSuperList(leftList, LEFT_LIST);

           self.addCollapsedSuperList($superList, title);
        },

        /**
         *
         */
        addCollapsedSuperList($superList, title) {
            try {
                let $collapsedList = $(`<div style="display: none" class="list-collapsed list"><span class="list-header-name">${name}</span></div>`);
                $collapsedList.click(function() {
                    tfolds.expandList($collapsedList);
                    return false;
                });
                $superList.prepend($collapsedList);
                if (settings.rememberViewStates) {
                    const collapsed = self.retrieve(title, "collapsed");
                    if (collapsed === true) {
                        // TODO Collapse super list
                        //tfolds.collapseList($l.find(".list").first().next());
                    }
                }
            } catch(e) {
                // Deliberately empty
            }
        },

        updateSuperList(subList, listPos) {
            let $superList = $(subList).siblings("div.super-list");
            // if (config.debug) {
            //     console.log($superList);
            //     console.info($(subList).parent().siblings());
            // }
            let $title = $superList.find("span.super-list-header");
            $title.find("span.wip-limit-title").remove();

            /*
             * Get the WiP limit from the left list
             */
            let wipLimit = self.extractWipLimit(subList);
            let pairedList;
            if (listPos === LEFT_LIST) {
                pairedList = tdom.getNextList(subList)[0];
            } else {
                pairedList = tdom.getPrevList(subList)[0];
            }
            console.info(pairedList);
            let totNumOfCards = tdom.countCards(subList) + tdom.countCards(pairedList); //+ tdom.countCards(rightList);
            let title = tdom.getListName(subList);
            title = title.substr(0, title.indexOf('.'));
            $title.append(self.createWipTitle(title, totNumOfCards, wipLimit));
            $superList.css("height", Math.max($(subList).height(), $(pairedList).height()));

            return title;
        },

        //#region COMBINED LISTS

        /**
         *
         */
        makeListsFoldable() {
            let $lists = $("div.list-wrapper");
            $lists.each(function() {
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
            let $foldIcon = self.createFoldIcon();

            $foldIcon.click(function () {
                tfolds.collapseList($(this).closest(".list"));
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
        addCollapsedList(listEl) {
            const $l = $(listEl);
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
                    tfolds.expandList($collapsedList);
                    return false;
                });
                $l.prepend($collapsedList);
                if (settings.rememberViewStates) {
                    const collapsed = self.retrieve(tdom.getListName($l), "collapsed");
                    if (collapsed === true) {
                        tfolds.collapseList($l.find(".list").first().next());
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
            let numCards = tdom.countCards(listEl, self.sectionIdentifier);
            let wipLimit = self.extractWipLimit(listEl);

            if ($l.data("subList") > 0) {
                self.addWipLimit($l, numCards);
                self.updateSuperList($l, $l.data("subList"));
            } else if (wipLimit !== null) {
                self.addWipLimit($l, numCards, wipLimit);
                if (settings.enableTopBars) {
                    if (numCards === wipLimit) {
                        $l.addClass("wip-limit-reached").removeClass("wip-limit-exceeded");
                        $l.prev().addClass("collapsed-limit-reached").removeClass("collapsed-limit-exceeded");
                        return;
                    } else if (numCards > wipLimit) {
                        $l.removeClass("wip-limit-reached").addClass("wip-limit-exceeded");
                        $l.prev().removeClass("collapsed-limit-reached").addClass("collapsed-limit-exceeded");
                        return;
                    }
                }
            } else {
                if (settings.alwaysCount === true) {
                    self.addWipLimit($l, numCards);
                } else {
                    self.removeWipLimit($l);
                }
            }

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
            $header.off("click").click(function(e) {
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

            if (wipLimit === null) {
                $wipTitle = $(`<span class="wip-limit-title">${title} <span class="wip-limit-badge">${numCards}</span></span>`);
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
        removeWipLimit($l) {
            $l.find("span.wip-limit-title").remove();
            const $header = $l.find(".list-header");
            $header.find("textarea").show();
        },

        /**
         *
         */
        formatSections(attemptCount = 1) {
            let $sections = tdom.getCardsByName(self.sectionIdentifier, false);

            if (!$sections.length) {
                if (attemptCount < 3) {
                    setTimeout(() => {
                        console.log(`Trying to find sections again (attempt ${attemptCount + 1})`);
                        self.formatSections(attemptCount + 1);
                    }, 100);
                    return;
                }
                console.warn("No sections found");
            }

            $sections.each(function () {
                // self.formatAsSection($(this));
                // HACK Would rather not depend on timeout here (added to draw correctly when switching board)
                setTimeout(() => {
                    self.formatAsSection($(this));
                }, 100);
            });
        },

        /**
         *
         */
        formatAsSection($card) {
            console.log("formatAsSection()", tdom.getCardName($card));
            const $icon = $('<span class="icon-expanded"/>');
            $icon.click(function () {
                tfolds.toggleSection(this);
                return false;
            });
            const strippedTitle = self.getStrippedTitle(tdom.getCardName($card));

            console.log($card.prepend(`<span id="section-title">${strippedTitle}</span>`));
            $card.prepend($icon);
            $card.find('span.list-card-title').hide();
            $card.addClass("section-card");

            console.log($card);
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
         */
        expandList($list) {
            $list.toggle().next().toggle().parent().css("width", "270px");
            self.store(tdom.getListName($list.next()), "collapsed", false);
        },

        /**
         *
         */
        toggleSection(section) {
            let $s = $(section);
            $s.toggleClass("icon-collapsed icon-expanded");
            let $cards = $s.closest("a").nextUntil(`a:contains('${self.sectionIdentifier}'),div.card-composer`);
            $cards.toggle();

            // const listName = tdom.getListName(tdom.getContainingList(section));
            const $l = $(tdom.getContainingList(section));
            let listSections = self.retrieve(tdom.getListName($l), "sections");
            if (!listSections) {
                listSections = {};
            }
            const title = $s.next().text();
            listSections[title] = $s.hasClass("icon-collapsed");
            self.store(tdom.getListName($l), "sections", listSections);
        },

    };

    return self;
}));