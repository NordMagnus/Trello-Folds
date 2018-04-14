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
        debug: false,
        collapsedIconUrl: null,
        expandedIconUrl: null,
    };

    let settings = {
        sectionChar: '#',
        sectionRepeat: 2,
        enableTopBars: true,
        rememberViewStates: true,
    };

    let storage = {};
    let boardId;

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
            console.info("BOARD CHANGED");
            self.initStorage();
        },

        /**
         *
         */
        listModified(listEl) {
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
                    console.info(result);
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
        setupBoard() {
            let $canvas = $("div.board-canvas");
            if (!$canvas.length) {
                throw new ReferenceError("DIV.board-canvas not found");
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
                const sectionStates = self.retrieve($l, "sections");
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
        store($list, key, value) {
            if (!boardId) {
                throw new ReferenceError("Board ID not set");
            }
            const listName = tdom.getListName($list[0]);

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
        retrieve($list, key) {
            const listName = tdom.getListName($list[0]);
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
            self.addListFolding();
            self.addWipLimits();
        },

        addListFolding() {
            // // let $lists = $('textarea.list-header-name');
            let $headers = $('div.list-header-extras');

            let $foldIcon = $('<a class="list-header-extras-menu dark-hover" href="#"><span class="icon-sm icon-close dark-hover"/></a>');
            $foldIcon.click(function () {
                tfolds.collapseList($(this).closest(".list"));
                return false;
            });
            $headers.append($foldIcon);

            let $lists = $("div.list-wrapper");
            $lists.css({
                "position": "relative",
            });
            $lists.each(function () {
                const $l = $(this);
                try {
                    const name = tdom.getListName(this);
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
                        const collapsed = self.retrieve($l, "collapsed");
                        if (collapsed === true) {
                            tfolds.collapseList($l.find(".list").first().next());
                        }
                    }
                } catch (e) {
                    // Deliberately empty
                }
            });
        },

        /**
         *
         */
        addWipLimits() {
            let $wipLists = tdom.getLists(/\[([0-9]*?)\]/);
            $wipLists.each(function () {
                self.showWipLimit(this);
            });
        },

        /**
         *
         */
        showWipLimit(list) {
            const $l = $(list);
            let title = tdom.getListName(list);
            let matches = title.match(/\[([0-9]*?)\]/);

            if (matches && matches.length > 1) {
                let wipLimit = parseInt(matches[1]);
                let numCards = tdom.countCards(list, self.sectionIdentifier);
                // console.log(`${title} [${numCards}/${wipLimit}]`);
                self.addListTitleBadge($l, numCards, wipLimit);
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
            }

            $l.removeClass("wip-limit-reached").removeClass("wip-limit-exceeded");
            $l.prev().removeClass("collapsed-limit-reached").removeClass("collapsed-limit-exceeded");
        },

        /**
         *
         */
        addListTitleBadge($l, numCards, wipLimit) {
            $l.find("span.wip-limit-title").remove();
            const title = tdom.getListName($l[0]);
            const strippedTitle = title.substr(0, title.indexOf('['));
            const $header = $l.find(".list-header");
            let $wipTitle = $(`<span class="wip-limit-title">${strippedTitle} <span class="wip-limit-badge">${numCards} / ${wipLimit}</span></span>`);
            if (numCards === wipLimit) {
                $wipTitle.find(".wip-limit-badge").css("background-color", "#fb7928");
            } else if (numCards > wipLimit) {
                $wipTitle.find(".wip-limit-badge").css("background-color", "#b04632");
            }
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
        formatSections() {
            let $sections = tdom.getCardsByName(self.sectionIdentifier, false);

            $sections.each(function () {
                self.formatAsSection($(this));
            });
        },

        /**
         *
         */
        formatAsSection($card) {
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
            self.store($list, "collapsed", true);
        },

        /**
         *
         */
        expandList($list) {
            $list.toggle().next().toggle().parent().css("width", "270px");
            self.store($list.next(), "collapsed", false);
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
            let listSections = self.retrieve($l, "sections");
            if (!listSections) {
                listSections = {};
            }
            const title = $s.next().text();
            listSections[title] = $s.hasClass("icon-collapsed");
            self.store($l, "sections", listSections);
        },

    };

    return self;
}));