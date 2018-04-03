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

    const self = {

        /**
         * Given a parent element, returns the name of the list.
         *
         * @param {Element} el Parent element
         * @returns {String} The name of the list
         */
        getListName(el) {
            if (!el) {
                throw new TypeError();
            }
            let nameElement = $(el).find("h2.js-list-name-assist");
            if (nameElement.length === 0) {
                throw new ReferenceError("No js-list-name-assist H2 tag found");
            }
            if (nameElement.length !== 1) {
                throw new RangeError("More than one js-list-name-assist H2 tag found");
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

            jLists = $("div.js-list-content").has(`h2:contains('${name||""}')`);

            if (filter !== undefined) {
                jLists = jLists.filter(function () {
                    let titleText = $(this).find("h2").text();
                    for (let i = 0; i < filter.length; ++i) {
                        if (titleText.indexOf(filter[i]) !== -1) {
                            return false;
                        }
                    }
                    return true;
                });
            }

            return jLists;
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
                let title = $(this).find("span.list-card-title")
                    .clone() //clone the element
                    .children() //select all the children
                    .remove() //remove all the children
                    .end() //again go back to selected element
                    .text();
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