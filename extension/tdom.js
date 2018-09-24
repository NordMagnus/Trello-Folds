// eslint-disable-next-line no-unused-vars
const tdom = (function (factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['jquery'], factory);
    } else {
        return factory(jQuery);
    }
}(function ($) {
    'use strict';

    class EventHandler {

        constructor() {
            this.listeners = new Map();
        }

        addListener(label, callback) {
            this.listeners.has(label) || this.listeners.set(label, []);
            this.listeners.get(label).push(callback);
        }

        removeListener(label, callback) {
            let listeners = this.listeners.get(label);

            if (listeners && listeners.length) {
                let index = listeners.reduce((i, listener, index) => {
                    return ((typeof listener == "function") && listener === callback) ? index : i;
                }, -1);

                if (index > -1) {
                    listeners.splice(index, 1);
                    this.listeners.set(label, listeners);
                    return true;
                }
            }
            return false;
        }

        emit(label, ...args) {
            let listeners = this.listeners.get(label);
            if (listeners && listeners.length) {
                listeners.forEach((listener) => {
                    listener(...args);
                });
                return true;
            }
            return false;
        }

    }

    EventHandler.BOARD_CHANGED = Symbol("board_changed");
    EventHandler.CARD_ADDED = Symbol("card_added");
    EventHandler.CARD_REMOVED = Symbol("card_removed");
    EventHandler.CARD_MODIFIED = Symbol("card_modified");
    EventHandler.LIST_ADDED = Symbol("list_added"); // TODO
    EventHandler.LIST_MODIFIED = Symbol("list_modified");
    EventHandler.LIST_TITLE_MODIFIED = Symbol("list_title_modified"); // TODO

    Object.freeze(EventHandler);

    //#region PRIVATE MEMBERS

    let handler = new EventHandler();
    let currentBoardId;
    let debug = false;

    //#endregion PRIVATE MEMBERS

    const self = {

        get debug() {
            return debug;
        },

        set debug(d) {
            debug = d;
        },

        get boardId() {
            return currentBoardId;
        },

        /**
         *
         */
        initialize(attemptCount = 0) {
            let $content = $("DIV#content");

            if (!$content.length) {
                if (attemptCount < 3) {
                    setTimeout(() => {
                        console.log(`Trying to find DIV#content (attempt ${attemptCount + 1})`);
                        self.initialize(attemptCount + 1);
                    }, 100);
                    return;
                }
                throw ReferenceError(`DIV#content not found after ${attemptCount} attempts`);
            }

            let boardObserver = new MutationObserver(function (mutations) {
                if (debug) {
                    console.log("Board observer invoked");
                }

                if (mutations.length !== 0 && $(mutations[mutations.length - 1].addedNodes)) {
                    const boardId = self.getBoardIdFromUrl();
                    console.info(`NEW BOARD: ${boardId} (old board ID: ${currentBoardId})`);
                    if (currentBoardId !== boardId) {
                        self.boardChanged(boardId);
                    }
                }
            });

            let conf = {
                attributes: false,
                childList: true,
                characterData: false,
                subtree: false,
            };

            self.boardChanged(self.getBoardIdFromUrl());

            /*
             * Give the page a chance to catch its breath before continuing.
             */
            // self.delay(200).then(() => {
            //     boardObserver.observe($content[0], conf);
            // })
            setTimeout(() => {
                boardObserver.observe($content[0], conf);
            }, 200);
        },

        /**
         *
         */
        boardChanged(boardId) {
            if (debug) {
                console.info(`INITIALIZING NEW BOARD: ${boardId} (old board ID: ${currentBoardId})`);
            }
            self.connectObservers(boardId);
        },

        // /**
        //  * https://stackoverflow.com/questions/34255351/is-there-a-version-of-settimeout-that-returns-an-es6-promise
        //  */
        // delay(ms) {
        //     let ctr;
        //     let rej;
        //     let p = new Promise(function(resolve, reject) {
        //         ctr = setTimeout(resolve, ms);
        //         rej = reject;
        //     });
        //     p.cancel = function() {
        //         clearTimeout(ctr);
        //         rej(Error("Cancelled"));
        //     };
        //     return p;
        // },

        //#region EVENT MANAGEMENT

        /**
         *
         */
        connectObservers(boardId, attemptCount = 1) {
            let $content = $("DIV#board");

            if (!$content.length) {
                if (attemptCount < 3) {
                    setTimeout(() => {
                        console.log(`Trying to find DIV#board again (attempt ${attemptCount + 1})`);
                        self.connectObservers(boardId, attemptCount + 1);
                    }, 100);
                    return;
                }
                throw ReferenceError(`DIV#board not found after ${attemptCount} attempts`);
            }
            self.connectBoardObserver($content);
            self.connectListObserver();

            const oldBoardId = currentBoardId;
            currentBoardId = boardId;
            handler.emit(EventHandler.BOARD_CHANGED, oldBoardId, currentBoardId);
        },

        /**
         * Setting up the observer to check for added and removed lists by looking for
         * added and removed children to `DIV#board` having the CSS class `list-wrapper`.
         */
        connectBoardObserver($content) {
            let boardObserver = new MutationObserver(function (mutations) {
                for (let m of mutations) {
                    // console.log("BOARD OBSERVER MUTATION", m);
                    if (m.addedNodes.length === 1 &&
                        $(m.addedNodes[0]).hasClass("list-wrapper")) {
                        handler.emit(EventHandler.LIST_ADDED, m.addedNodes[0]);
                    } else if (m.removedNodes.length === 1 &&
                        $(m.removedNodes[0]).hasClass("list-wrapper")) {
                        handler.emit(EventHandler.LIST_REMOVED, m.removedNodes[0]);
                    }
                }
            });

            let conf = {
                attributes: false,
                childList: true,
                characterData: false,
                subtree: false,
            };

            boardObserver.observe($content[0], conf);
        },

        /**
         *
         */
        connectListObserver() {
            let $lists = $("div.list");

            if ($lists.length === 0) {
                return;
            }

            let listObserver = new MutationObserver(function (mutations) {
                mutations.forEach((m) => {
                    // console.log("LIST OBSERVER MUTATION", m);
                    if (m.addedNodes.length > 0 &&
                        m.addedNodes[0].localName === "a" &&
                        $(m.addedNodes[0]).hasClass("list-card")) {
                        handler.emit(EventHandler.CARD_ADDED, m.addedNodes[0]);
                        handler.emit(EventHandler.LIST_MODIFIED, $(m.target).parent()[0]);
                    } else if (m.removedNodes.length > 0 &&
                        m.removedNodes[0].localName === "a" &&
                        $(m.removedNodes[0]).hasClass("list-card")) {
                        handler.emit(EventHandler.CARD_REMOVED, m.removedNodes[0]);
                        handler.emit(EventHandler.LIST_MODIFIED, $(m.target).parent()[0]);
                    } else if (m.addedNodes.length === 2 &&
                        m.removedNodes.length === 2 &&
                        m.addedNodes[1].parentElement.localName === "span" &&
                        $(m.addedNodes[1].parentElement).hasClass("list-card-title")) {
                        handler.emit(EventHandler.CARD_MODIFIED, $(m.target).closest("a")[0],
                            m.addedNodes[1].textContent, m.removedNodes[1].textContent);
                    } else if ($(m.target).hasClass("list-header-name-assist") && m.addedNodes.length === 1) {
                        handler.emit(EventHandler.LIST_TITLE_MODIFIED, $(m.target).closest("div.list"),
                            m.addedNodes[0].textContent);
                    }
                });
            });

            let conf = {
                attributes: false,
                childList: true,
                characterData: false,
                subtree: true,
            };

            $lists.each(function () {
                listObserver.observe(this, conf);
            });
        },

        get events() {
            // ? Is this needed - should use convenience methods instead
            return EventHandler;
        },

        /**
         *
         */
        onBoardChanged(callback) {
            handler.addListener(EventHandler.BOARD_CHANGED, callback);
        },

        /**
         *
         */
        onListModified(callback) {
            handler.addListener(EventHandler.LIST_MODIFIED, callback);
        },

        /**
         *
         * @param {Function} callback
         */
        onListAdded(callback) {
            handler.addListener(EventHandler.LIST_ADDED, callback);
        },

        /**
         *
         * @param {Function} callback
         */
        onCardAdded(callback) {
            handler.addListener(EventHandler.CARD_ADDED, callback);
        },

        /**
         *
         */
        onCardModified(callback) {
            handler.addListener(EventHandler.CARD_MODIFIED, callback);
        },

        onListTitleModified(callback) {
            handler.addListener(EventHandler.LIST_TITLE_MODIFIED, callback);
        },

        //#endregion EVENT MANAGEMENT


        /**
         * Extracts the board ID from the URL.
         * Assuming the URL has the following format `https://trello.com/b/[BOARD-ID]/[BOARD-NAME]`
         *
         * @returns {String} Board ID
         */
        getBoardIdFromUrl() {
            let url = document.URL.split("/");
            if (url.length < 2) {
                throw new RangeError(`Unexpected URL: ${url}`);
            }
            return url[url.length - 2];
        },

        /**
         * Gets the `div.list` element for the list containing the given element.
         *
         * @param {Element} card The card whose list to get
         * @returns {Element} The containing list element
         */
        getContainingList(card) {
            return $(card).closest("div.list")[0];
        },

        /**
         * Given a parent element, returns the name of the list.
         *
         * @param {Element} el Parent element
         * @returns {String} The name of the list
         */
        getListName(el) {
            if (!el) {
                throw new TypeError("Parameter [el] undefined");
            }
            let nameElement = $(el).find("h2.list-header-name-assist");
            if (nameElement.length === 0) {
                throw new ReferenceError("No [H2.list-header-name-assist] tag found");
            }
            if (nameElement.length !== 1) {
                throw new RangeError("More than one [H2.list-header-name-assist] tag found");
            }
            return nameElement.text();
        },

        /**
         * Gets all **DIV.js-list-content** elements matching the given parameters.
         *
         * @param {String} name String that name of list should contain
         * @param {Array} filter Array of strings that name of list should *not* contain
         * @returns {jQuery} A jQuery object with the elements
         */
        getLists(name, filter) {
            let jLists;

            if (name instanceof RegExp) {
                jLists = $("div.js-list-content").filter(function () {
                    return name.test($(this).find("h2").text());
                });
            } else {
                jLists = $("div.js-list-content").has(`h2:contains('${name||""}')`);
            }

            if (filter !== undefined) {
                jLists = jLists.filter(function () {
                    let titleText = $(this).find("h2").text();
                    for (let i = 0; i < filter.length; ++i) {
                        if (titleText.search(filter[i]) !== -1) {
                            return false;
                        }
                    }
                    return true;
                });
            }

            return jLists;
        },

        /**
         * Gets the title of a card by stripping all children
         * and returning the text inside the `span.list-card-title` element.
         *
         * @param {jQuery} $card A jQuery object containing a Trello card
         * @returns {String} The card title
         */
        getCardName($card) {
            let $span = $card.find("span.list-card-title");
            if ($span.length === 0) {
                throw new TypeError("Could not find SPAN tag");
            }
            let title = $card.find("span.list-card-title")
                .clone() //clone the element
                .children() //select all the children
                .remove() //remove all the children
                .end() //again go back to selected element
                .text();
            return title;
        },

        getCardsInList(list, name) {
            if (!name) {
                throw new TypeError();
            }
            let jCards = $(list).find("a.list-card").filter(function () {
                let title = self.getCardName($(this));
                return title.indexOf(name) !== -1;
            });
            return jCards;
        },

        /**
         * Gets all cards with a specific string in the title.
         *
         * @returns {jQuery} jQuery object with card DOM elements or <code>null</code> if no cards found
         * @throws {TypeError} when missing parameter
         */
        getCardsByName(name, exactMatch = false) {
            if (!name) {
                throw new TypeError();
            }
            let jCards = $("a.list-card").filter(function () {
                let title = self.getCardName($(this));
                if (exactMatch) {
                    return title === name;
                }
                return title.indexOf(name) !== -1;
            });
            // if (jCards.length === 0) {
            //     return null;
            // }
            return jCards;
        },

        /**
         * Count cards in list.
         *
         * @param {Element} list The containing list
         * @param {Stringt} filter Cards containing filter will be excluded
         * @returns {Number} Number of cards found
         */
        countCards(list, filter) {
            let $cards = $(list).find("a.list-card").filter(function () {
                const title = self.getCardName($(this));
                if (filter) {
                    return title.indexOf(filter) === -1;
                }
                return true;
            });
            return $cards.length;
        },

        /**
         * Get a count for all labels used in a list.
         *
         * @param {jQuery} jLists Lists to count labels in
         * @param {Array} filter An array with strings. Labels will be excluded if they contain any of the strings
         * @returns {Array} An associative array with labels and their respective count
         */
        countListLabels(jLists, filter) {
            if (!jLists) {
                throw new TypeError("Parameter [jLists] not defined");
            }
            if (filter && !(filter instanceof Array)) {
                throw new TypeError("Parameter [filter] undefined or not of type Array");
            }

            let cardLabels = [];

            jLists.find("span.card-label").each(function () {
                let title = $(this).attr("title");
                if (filter) {
                    for (let i = 0; i < filter.length; ++i) {
                        if (title.indexOf(filter[i]) > -1) {
                            return;
                        }
                    }
                }
                if (cardLabels[title] === undefined) {
                    cardLabels[title] = 0;
                }
                cardLabels[title]++;
            });

            return cardLabels;
        },

        /**
         * Get the labels for a specific card.
         *
         * @param {Element} el The card item
         * @param {Array} filter An array with strings. Labels will be excluded if they contain any of the strings
         * @returns {Array} An array with card labels
         */
        getCardLabels(el, filter) {
            if (!el) {
                throw new TypeError("Parameter [el] not defined");
            }
            if (filter && !(filter instanceof Array)) {
                throw new TypeError("Parameter [filter] undefined or not of type Array");
            }
            let labels = [];
            $(el).find("span.card-label").each(function () {
                let title = $(this).attr("title");
                if (filter) {
                    for (let i = 0; i < filter.length; ++i) {
                        if (title.indexOf(filter[i]) > -1) {
                            return;
                        }
                    }
                }
                labels.push(title);
            });
            return labels;
        },

        /**
         * Gets an associative array with the fields for a given card, e.g.
         * `{"fieldName": "fieldValue", ...}`
         *
         * @param {Element} cardEl The *DIV.list-card-details* element for the card
         * @returns {Object} Associative array with field names and values
         */
        getCardFields(cardEl) {
            if (!cardEl) {
                throw new TypeError("Parameter [cardEl] not defined");
            }

            let fields = [];

            $(cardEl).find("span.badge-text").each(function () {
                let title = $(this).text();
                let f = title.split(": ");
                // Make sure it's a custom field
                if (f.length !== 2) {
                    return;
                }
                let fName = f[0];
                let fVal = f[1];
                fields[fName] = fVal;
            });
            return fields;
        },

        /**
         * Returns an associative array with the count for each label in that list, e.g.
         * ```
         * {
         *     "Label 1": 3,
         *     "Label 2": 2
         * }
         * ```
         *
         * @param {Element} listEl The list to check
         * @param {Array} filter An optional filter with labels to exclude
         * @returns {Object} Label count for the given list
         */
        countLabelsInList(listEl, filter) {
            if (!listEl) {
                throw new TypeError("Parameter [listEl] not defined");
            }
            if (filter && !(filter instanceof Array)) {
                throw new TypeError("Parameter [filter] undefined or not of type Array");
            }

            let labels = [];

            $(listEl).find("span.card-label").each(function () {
                let title = $(this).attr("title");
                // FIXME Implement filter
                // if (mainRolesOnly && (title === "concern" || title.indexOf("*") !== -1)) {
                //     return;
                // }
                if (labels[title] === undefined) {
                    labels[title] = 0;
                }
                labels[title]++;
            });
            return labels;
        },

        /**
         * Returns an associative array with label names and the color code as RGB(), e.g.
         * ```
         * {
         *     "Label 1": "rgb(128,128,128)",
         *     "Label 2": "rgb(255,128,128)"
         * }
         * ```
         *
         * @returns {Object} Associative arrow with label names as property names and color codes as values
         */
        getLabelColors() {
            let labelColors = [];
            $("div.board-canvas").find("span.card-label").each(function () {
                let title = $(this).attr("title");
                let bgCol = $(this).css("backgroundColor");
                labelColors[title] = bgCol;
            });
            return labelColors;
        },

        /**
         *
         */
        getCardsByLabels(title, filter) {
            throw 'Not implemented'; // TODO Implement
            // This could be used by tfolds.countTeamMembers()
        },

    };

    return self;
}));