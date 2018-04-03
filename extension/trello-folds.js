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

        /**
         * Initializes the Squadification extension by adding a `MutationObserver`
         * to the `DIV#content` element, and explicitly calling `setupBoard` in case
         * the first board loaded is a Squadification board.
         *
         * @returns {MutationObserver} The instantiated observer
         */
        initialize() {
            let jContent = $("div#content");

            if (!jContent.length) {
                throw ReferenceError("DIV#content not found");
            }

            if (config.debug) {
                console.info("Initializing board");
            }

            /*
             * The intention is that this is only called when a new board is loaded.
             */
            let trelloObserver = new MutationObserver(function (mutations) {
                if (config.debug) {
                    console.log("Observer invoked");
                }

                // TODO Disconnect any observers here
                // if (constraintsObserver) {
                //     constraintsObserver.disconnect();
                // }

                if (mutations.length !== 0 && $(mutations[mutations.length - 1].addedNodes)) {
                    // .has(`h2:contains('${config.constraintsListName}')`).length === 1) {
                    self.setupBoard();
                }
            });

            let conf = {
                attributes: false,
                childList: true,
                characterData: false,
                subtree: false,
            };
            trelloObserver.observe(jContent[0], conf);

            /*
             * Call initStorage after a short timeout. initStorage will then call setupBoard.
             */
            setTimeout(self.initStorage, 200);

            return trelloObserver;
        },

        /**
         *
         */
        initStorage() {
            // chrome.storage.sync.clear();
            const url = document.URL.split("/");
            boardId = url[url.length - 2];

            chrome.storage.sync.get([boardId], result => {
                storage = result[boardId] || {};
                console.log(storage);
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

            self.formatSections();
            self.formatLists();
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
                console.log(`[${key}] set to [${value}] for list [${listName}] in board ${boardId}`);
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
            } catch(e) {
                if (config.debug) {
                    console.warn(`Setting [${key}] for list [${listName}] not set`);
                }
            }
            return value;
        },

        /**
         *
         */
        formatLists() {
            // // let $lists = $('textarea.list-header-name');
            let $headers = $('div.list-header-extras');

            let $foldIcon = $('<span class="icon-sm icon-add dark-hover">&nbsp;</span>');
            $foldIcon.click(function () {
                tfolds.collapseList($(this).closest(".list"));
                return false;
            });
            $headers.prepend($foldIcon);

            let $lists = $("div.list-wrapper");
            $lists.css({
                "position": "relative",
            });
            $lists.each(function () {
                const $l = $(this);
                console.log("...");
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
                    const collapsed = self.retrieve($l, "collapsed");
                    if (config.debug) {
                        console.log(`Collapsed viewstate: ${collapsed}`);
                    }
                    if (collapsed === true) {
                        tfolds.collapseList($l.find(".list").first().next());
                    }
                } catch (e) {
                    // Deliberately empty
                }
            });
        },

        /**
         *
         */
        formatSections() {
            let $sections = tdom.getCardsByName("##", false);

            let $foldIcon = $('<span class="icon-sm icon-add dark-hover">&nbsp;</span>');
            $foldIcon.click(function (e) {
                console.info("Clicked da ting");
                tfolds.toggleSection(this);
                return false;
            });
            $sections.find("span.list-card-title").prepend($foldIcon);

            // <span class="icon-sm icon-edit list-card-operation dark-hover js-open-quick-card-editor js-card-menu"></span>

            // $("div.header-user").prepend("<a id='group-stats' class='header-btn header-boards'>" +
            //     "<span class='header-btn-icon icon-lg icon-organization light'></span>" +
            //     "<span class='header-btn-text'>Group Overview</span></a>");

            $sections.css({
                "background": "rgba(0,0,0,0.0)",
                "border": "none",
                "font-weight": "bold",
                "font-size": "10pt",
                "padding": "0px",
                "margin": "0px",
            });
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
            $s.toggleClass("icon-add icon-remove");
            let $cards = $s.closest("a").nextUntil("a:contains('##')");
            // console.log($cards);
            $cards.toggle();
        },

    };

    return self;
}));