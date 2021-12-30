/* eslint-disable max-statements */
// eslint-disable-next-line no-unused-vars

class EventHandler {

  constructor() {
    this.listeners = new Map();
  }

  addListener(label, callback) {
    this.listeners.has(label) || this.listeners.set(label, []);
    this.listeners.get(label).push(callback);
  }

  removeListener(label, callback) {
    const listeners = this.listeners.get(label);

    if (listeners && listeners.length) {
      const index = listeners.reduce((i, listener, index) => {
        return ((typeof listener === 'function') && listener === callback) ? index : i;
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
    const listeners = this.listeners.get(label);
    if (listeners && listeners.length) {
      listeners.forEach((listener) => {
        listener(...args);
      });
      return true;
    }
    return false;
  }

}

EventHandler.BOARD_CHANGED = Symbol('board_changed');
EventHandler.CARD_ADDED = Symbol('card_added');
EventHandler.CARD_REMOVED = Symbol('card_removed');
EventHandler.CARD_MODIFIED = Symbol('card_modified');
EventHandler.LIST_ADDED = Symbol('list_added');
EventHandler.LIST_REMOVED = Symbol('list_removed');
EventHandler.LIST_MODIFIED = Symbol('list_modified');
EventHandler.LIST_TITLE_MODIFIED = Symbol('list_title_modified');
EventHandler.LIST_DRAGGED = Symbol('list_dragged');
EventHandler.LIST_DROPPED = Symbol('list_dropped');
EventHandler.BADGES_MODIFIED = Symbol('badges_modified');
EventHandler.REDRAW_BOARD_HEADER = Symbol('redraw_board_header');

Object.freeze(EventHandler);

// eslint-disable-next-line no-unused-vars
class TDOM {

  constructor() {
    this.handler = new EventHandler();
    this.currentBoardId = undefined;
    this.oldBoardId = undefined;
    this._debug = false;
    this.newMutations = false;
    this.loadTimeout = 100;

    // Mutation Observers
    this.loadObserver = undefined;
    this.boardObserver = undefined;
    this.headerObserver = undefined;
    this.listObserver = undefined;

    this.boardCompletelyLoaded = false;
  }

  get debug() {
    return this._debug;
  }

  set debug(d) {
    this._debug = d;
  }

  get boardId() {
    return this.currentBoardId;
  }
  /* =================================================================================

          DESCRIPTION OF BOARD INITIALIZATION STEPS

          1. First wait for the ready state "complete"                init()
          2. Ensure DIV#content exists otherwise retry three times    initialize()
                  with a 100 ms wait inbetween
          3. Connect an observer that listens to board changes        initialize()
          4. When a board change is identified start watching         watchForMutations()
                  for mutations to the DOM                            connectObservers()
          5. As long as new mutations are found and until the
                  last card is modified asynchronously keep waiting
                  (only needed if changing board from within Trello)
                  and call connectObservers() again every 100 ms
          6. Finally emit BOARD_CHANGED event

          ================================================================================= */

  /**
   * Called by client/consumer to init library.
   */
  init({ loadTimeout = 1500 }) {
    this.loadTimeout = loadTimeout;
    window.addEventListener('pageshow', () => {
      this.initialize();
    });
  }

  /**
   * Initializes a mutation observer that listens to board being changed/loaded.
   * Also disconnects other observers used to track changes within the board.
   */
  initialize(attemptCount = 0) {
    // const $content = $('DIV#content');
    const content = $('div#content');
    this.debug && console.log(`initialize, attempt=${attemptCount}`);
    if (!content) {
      if (attemptCount < TDOM.MAX_LOAD_ATTEMPTS) {
        const delay = TDOM.RETRY_BASE_TIME * (TDOM.RETRY_TIME_FACTOR ** (attemptCount+1));
        setTimeout(() => {
          console.warn(`Trying to find DIV#content (attempt ${attemptCount + 1})`);
          this.initialize(attemptCount + 1);
          console.log(`Trying again in ${delay}ms`);
        }, delay);
        return;
      }
      throw ReferenceError(`DIV#content not found after ${attemptCount} attempts`);
    }

    const initObserver = new MutationObserver(((mutations) => {
      if (this.debug) {
        console.log('Init observer invoked');
      }

      // NOTE
      if (mutations.length !== 0 && mutations[mutations.length - 1].addedNodes) {
        const boardId = this.getBoardIdFromUrl();

        if (this.currentBoardId !== boardId) {
          if (this.loadObserver) {
            if (this.debug) {
              console.log('Disconnecting load observer');
            }
            this.loadObserver.disconnect();
          }
          if (this.boardObserver) {
            if (this.debug) {
              console.log('Disconnecting board observer');
            }
            this.boardObserver.disconnect();
          }
          if (this.headerObserver) {
            if (this.debug) {
              console.log('Disconnecting header observer');
            }
            this.headerObserver.disconnect();
          }
          if (this.listObserver) {
            if (this.debug) {
              console.log('Disconnecting list observer');
            }
            this.listObserver.disconnect();
          }
          this.boardChanged(boardId);
        }
      }
    }));

    const conf = {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: false,
    };

    this.boardChanged(this.getBoardIdFromUrl());

    initObserver.observe(content, conf);
  }

  /**
   * Called when a board change is detected. Shows some console output and
   * initializes the board loading process.
   */
  boardChanged(boardId) {
    this.oldBoardId = this.currentBoardId;

    console.info(
        `%cINITIALIZING NEW BOARD: ${boardId} (old board ID: ${this.oldBoardId})`,
        'font-weight: bold;');
    this.watchForMutations(boardId);

    this.currentBoardId = boardId;
  }

  /**
   * Connects a mutation observer detecting when a board is fully loaded, and starts
   * watching for mutations to the board.
   */
  watchForMutations(boardId, attemptCount = 1) {
    this.debug && console.log(`watchForMutations, attemptCount=${attemptCount}`);
    const content = $('div#board');

    if (!content) {
      if (attemptCount < TDOM.MAX_LOAD_ATTEMPTS) {
        const delay = TDOM.LOAD_RETRY_TIMEOUT * (TDOM.RETRY_TIME_FACTOR ** attemptCount);
        setTimeout(() => {
          console.log(`Trying to find DIV#board again in ${delay}ms (attempt ${attemptCount + 1})`);
          this.watchForMutations(boardId, attemptCount + 1);
        }, delay);
        return;
      }
      throw ReferenceError(`DIV#board not found after ${attemptCount} attempts`);
    }

    this.connectLoadObserver(content);

    /*
     * Setting newMutations to true to force at least one 100 ms delay before completing.
     */
    this.newMutations = true;
    /*
     * Setting boardCompletelyLoaded to false when changing board (opposite to loading
     * the first board)
     */
    // this.boardCompletelyLoaded = (this.oldBoardId === undefined);
    this.boardCompletelyLoaded = false;
    this.connectObservers();
  }

  /**
   * Once no new mutations are detected during board load connects observers to track
   * changes within board (e.g. to lists, cards, etc.).
   *
   * If changes _are_ detected it will wait for 100 ms and try again.
   */
  connectObservers(numCalls = 1) {
    if (!this.newMutations && this.boardCompletelyLoaded) {
      if (this.debug) {
        console.log(`Connecting observers - NO NEW MUTATIONS (after ${numCalls} calls)`);
      }
      this.loadObserver.disconnect();
      this.connectBoardObserver($('div#board'));
      this.connectHeaderObserver();
      this.connectListObserver();

      setTimeout(() => {
        if (this.debug) {
          console.log('Emitting BOARD_CHANGED event');
        }
        this.handler.emit(EventHandler.BOARD_CHANGED, this.currentBoardId, this.oldBoardId);
      }, this.loadTimeout);
      return;
    }
    this.newMutations = false;
    setTimeout(() => {
      if (this.debug) {
        // eslint-disable-next-line max-len
        console.log(`%cWaiting for board to load... (newMutations=${this.newMutations},boardCompletelyLoaded=${this.boardCompletelyLoaded})`,
            'font-style: italic; color: #808080;');
      }
      this.connectObservers(numCalls+1);
    }, TDOM.DEFAULT_TIMEOUT);
  }

  connectLoadObserver(content) {
    if (this.debug) {
      console.log('%c  Looking for DOM mutations during board change  ',
          'font-weight: bold; color: #40a022; background-color: #f0f0f0;');
    }

    this.loadObserver = new MutationObserver(((mutations) => {
      this.newMutations = true;
      if (this.boardCompletelyLoaded) {
        return;
      }
      for (const m of mutations) {
        if (m.addedNodes.length === 1 && m.target.className === 'js-plugin-badges'
                  && m.target.closest('a').nextSibling === null) {
          const theList = this.getContainingList(m.target);
          let nextList = this.getNextList(theList);
          let done = true;
          while (nextList !== null) {
            if (this.countCards(nextList) !== 0) {
              done = false;
              break;
            }
            nextList = this.getNextList(nextList);
          }
          this.boardCompletelyLoaded = done;
          if (done) {
            console.info('%c  BOARD COMPLETELY LOADED!  ',
                'font-weight: bold; color: #40a022; background-color: #f0f0f0;');
          }
        }
      }
    }));

    const conf = {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: true,
    };

    this.loadObserver.observe(content, conf);
  }

  /**
   * Setting up the observer to check for added and removed lists by looking for
   * added and removed children to `DIV#board` having the CSS class `list-wrapper`.
   */
  connectBoardObserver(content) {
    this.boardObserver = new MutationObserver(((mutations) => {
      let isDropped = false;
      let addedList;

      for (const m of mutations) {
        if (m.addedNodes.length === 1
            && m.addedNodes[0].localName === 'div'
            && m.addedNodes[0].classList.contains('placeholder')) {
          const draggedList = $('body .ui-sortable-helper');
          console.log({ draggedList });
          this.handler.emit(EventHandler.LIST_DRAGGED, draggedList);
        } else if (m.removedNodes.length === 1
                      && m.removedNodes[0].localName === 'div'
                      && m.removedNodes[0].classList.contains('placeholder')) {
          isDropped = true;
        } else if (m.addedNodes.length === 1
                      && m.addedNodes[0].classList.contains('list-wrapper')) {
          [addedList] = m.addedNodes;
        } else if (m.removedNodes.length === 1
                      && m.removedNodes[0].classList.contains('list-wrapper')) {
          const l = $(m.removedNodes[0], 'div.js-list-content');
          this.handler.emit(EventHandler.LIST_REMOVED, l);
        }
      }
      if (addedList) {
        if (isDropped) {
          this.handler.emit(EventHandler.LIST_DROPPED, addedList);
        } else {
          this.handler.emit(EventHandler.LIST_ADDED, addedList);
        }
      }
    }));

    const conf = {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: false,
    };

    this.boardObserver.observe(content, conf);
  }

  connectHeaderObserver() {
    const header = $('div.board-header');
    if (!header) {
      console.error('Board header not found');
      return;
    }

    this.headerObserver = new MutationObserver(((mutations) => {
      mutations.forEach((m) => {
        if (m.addedNodes.length === 1) {
          if (m.addedNodes[0].classList.contains('board-header-plugin-btns')) {
            this.handler.emit(EventHandler.REDRAW_BOARD_HEADER);
          }
        }
      });
    }));

    const conf = {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: true,
    };

    this.headerObserver.observe(header, conf);
  }

  /**
   *
   */
  connectListObserver() {
    const lists = $$('div.list');

    if (this.debug) {
      console.log('connectListObserver()', `# of lists: ${lists.length}`);
    }

    if (lists.length === 0) {
      return;
    }

    this.listObserver = new MutationObserver(((mutations) => {
      mutations.forEach((m) => {
        // console.dir(m);
        if (m.addedNodes.length === 1
                      && m.target.classList.contains('custom-field-front-badges')) {
          this.handler.emit(EventHandler.BADGES_MODIFIED, m.target.closest('a'));
        } else if (m.addedNodes.length > 0
                      && m.addedNodes[0].localName === 'a'
                      && m.addedNodes[0].classList.contains('list-card')) {
          if (!m.addedNodes[0].classList.contains('placeholder')) {
            this.handler.emit(EventHandler.CARD_ADDED, m.addedNodes[0]);
          }
          this.handler.emit(EventHandler.LIST_MODIFIED, m.target.parentNode);
        } else if (m.removedNodes.length > 0
                      && m.removedNodes[0].localName === 'a'
                      && m.removedNodes[0].classList.contains('list-card')) {
          this.handler.emit(EventHandler.CARD_REMOVED, m.removedNodes[0]);
          const { target } = m;
          if (target.parentNode) {
            this.handler.emit(EventHandler.LIST_MODIFIED, target.closest('div.list'));
          }
        } else if (m.addedNodes.length === 2
                      && m.removedNodes.length === 2
                      && m.addedNodes[1].parentNode.localName === 'span'
                      && m.addedNodes[1].parentNode.classList.contains('list-card-title')) {
          this.handler.emit(EventHandler.CARD_MODIFIED, m.target.closest('a'),
              m.addedNodes[1].textContent, m.removedNodes[1].textContent);
        } else if (m.target.classList.contains('list-header-name-assist')
          && m.addedNodes.length === 1) {
          this.handler.emit(EventHandler.LIST_TITLE_MODIFIED, m.target.closest('div.list'),
              m.addedNodes[0].textContent);
        }
      });
    }));

    const conf = {
      attributes: false,
      childList: true,
      characterData: false,
      subtree: true,
    };

    lists.forEach(l => {
      this.listObserver.observe(l, conf);
    });
  }
  // #region EVENT MANAGEMENT

  get events() {
    // ? Is this needed - should use convenience methods instead
    return EventHandler;
  }

  /**
   *
   */
  onBoardChanged(callback) {
    this.handler.addListener(EventHandler.BOARD_CHANGED, callback);
  }

  /**
   *
   */
  onListModified(callback) {
    this.handler.addListener(EventHandler.LIST_MODIFIED, callback);
  }

  /**
   *
   * @param {Function} callback
   */
  onListAdded(callback) {
    this.handler.addListener(EventHandler.LIST_ADDED, callback);
  }

  onListRemoved(callback) {
    this.handler.addListener(EventHandler.LIST_REMOVED, callback);
  }

  /**
   *
   */
  onListDragged(callback) {
    this.handler.addListener(EventHandler.LIST_DRAGGED, callback);
  }

  /**
   *
   * @param {Function} callback
   */
  onListDropped(callback) {
    this.handler.addListener(EventHandler.LIST_DROPPED, callback);
  }

  /**
   *
   * @param {Function} callback
   */
  onCardAdded(callback) {
    this.handler.addListener(EventHandler.CARD_ADDED, callback);
  }

  /**
   *
   * @param {Function} callback
   */
  onCardRemoved(callback) {
    this.handler.addListener(EventHandler.CARD_REMOVED, callback);
  }

  /**
   *
   */
  onCardModified(callback) {
    this.handler.addListener(EventHandler.CARD_MODIFIED, callback);
  }

  /**
   *
   */
  onBadgesModified(callback) {
    this.handler.addListener(EventHandler.BADGES_MODIFIED, callback);
  }

  /**
   *
   * @param {*} callback
   */
  onListTitleModified(callback) {
    this.handler.addListener(EventHandler.LIST_TITLE_MODIFIED, callback);
  }

  onRedrawBoardHeader(callback) {
    this.handler.addListener(EventHandler.REDRAW_BOARD_HEADER, callback);
  }
  // #endregion EVENT MANAGEMENT


  /**
   * Extracts the board ID from the URL.
   * Assuming the URL has the following format `https://trello.com/b/[BOARD-ID]/[BOARD-NAME]`
   *
   * @returns {String} Board ID
   */
  getBoardIdFromUrl() {
    const url = document.URL.split('/');
    if (url.length < 2) {
      throw new RangeError(`Unexpected URL: ${url}`);
    }
    return url[url.length - 2];
  }

  /**
   * Gets the `div.list` element for the list containing the given element.
   *
   * @param {Element} card The card whose list to get
   * @returns {Element} The containing list element
   */
  getContainingList(card) {
    return card.closest('div.list');
  }

  /**
   * Given a parent element, returns the name of the list.
   *
   * @param {Element} el Parent element
   * @returns {String} The name of the list
   */
  getListName(el) {
    if (!el) {
      throw new TypeError('Parameter [el] undefined');
    }
    const nameElement = $(el, 'h2.list-header-name-assist');
    if (!nameElement) {
      console.error('No [H2.list-header-name-assist] found', el);
      throw new ReferenceError('No [H2.list-header-name-assist] tag found');
    }
    return nameElement.textContent.trim();
  }

  /**
   * Gets all **DIV.js-list-content** elements matching the given parameters.
   *
   * @param {String|RegExp} name String that name of list should contain
   * @param {Array} filter Array of strings that name of list should *not* contain
   * @returns {Array} A jQuery object with the elements
   */
  getLists(name, filter) {
    let jLists;
    jLists = $$('#board div.js-list-content');
    jLists = [...jLists].filter(l => {
      const title = $(l, 'h2').textContent;
      if (name instanceof RegExp) {
        return name.test(title);
      }
      return title.includes(name || '');
    });

    if (filter !== undefined) {
      jLists = jLists.filter(l => {
        const title = $(l, 'h2').textContent;
        for (let i = 0; i < filter.length; ++i) {
          if (title.search(filter[i]) !== -1) {
            return false;
          }
        }
        return true;
      });
    }

    return jLists;
  }

  /**
   * Given a list element, tries to find the previous list.
   *
   * @param {Element} listEl List whos predecessor to get
   * @returns {Element} List element or ``null`` if not found
   */
  getPrevList(listEl) {
    // const $prev = $(listEl).parent().prev().find('div.js-list-content');
    // @ts-ignore
    return $(listEl.parentNode.previousElementSibling, 'div.js-list-content');
    // return prev.length ? $prev[0]: null;
  }

  /**
   * Given a list element, tries to find the following list.
   *
   * @param {Element} listEl List whos successor to get
   * @returns {Element} List element or ``null`` if not found
   */
  getNextList(listEl) {
    // @ts-ignore
    return $(listEl.parentNode.nextElementSibling, 'div.js-list-content');
    // const $next = $(listEl).parent().next().find('div.js-list-content');
    // return $next.length === 1 ? $next[0] : null;
  }

  /**
   * Gets the title of a card by stripping all children
   * and returning the text inside the `span.list-card-title` element.
   *
   * @param {Element} card A jQuery object containing a Trello card
   * @returns {String} The card title
   */
  getCardName(card) {
    if (!card) {
      throw new TypeError('Parameter [card] undefined');
    }
    if (!(card instanceof HTMLElement)) {
      throw new TypeError('Parameter [card] does not seem to be an HTML element');
    }
    const span = card.querySelector('span.list-card-title');
    if (!span) {
      return '';
    }
    const title = this.extractTextContent(span);
    return title;
  }

  extractTextContent(element) {
    for (let i = 0; i < element.childNodes.length; ++i) {
      if (element.childNodes[i].nodeType === TDOM.TEXT_NODE) {
        return element.childNodes[i].textContent;
      }
    }
    return '';
  }

  getCardsInList(list, name) {
    // if (!name) {
    //   throw new TypeError();
    // }

    // const cards = list.querySelectorAll('a.list-card');
    const cards = $$(list, 'a.list-card');
    if (name) {
      return [...cards].filter(c => {
        const title = this.getCardName(c);
        return title.includes(name);
      });
    }
    return cards;
    // return cards;
    // const jCards = $(list).find('a.list-card').filter(function () {
    //   const title = this.getCardName(this);
    //   return title.indexOf(name) !== -1;
    // });
    // return jCards;
  }

  /**
   * Gets all cards with a specific string in the title.
   *
   * @returns {Array} jQuery object with card DOM elements or <code>null</code> if no cards found
   * @throws {TypeError} when missing parameter
   */
  getCardsByName(name, exactMatch = false) {
    if (name === undefined) {
      throw new TypeError();
    }

    const cards = document.querySelectorAll('#board a.list-card');
    const filteredCards = Array.from(cards).filter(c => {
      const title = this.getCardName(c);
      if (exactMatch) {
        return title === name;
      }
      return title.includes(name);
    });
    return filteredCards;
  }

  /**
   * Count cards in list.
   *
   * @param {Element} list The containing list
   * @param {String} [filter] Cards containing filter will be excluded
   * @param {Number} [pos] Start position
   * @returns {Number} Number of cards found
   */
  countCards(list, filter, pos) {
    // const self = this;
    const cards = $$(list, 'a.list-card').filter(c => {
    // const $cards = $(list).find('a.list-card').filter(function () {
      const title = this.getCardName(c);
      if (filter && title) {
        if (pos !== undefined) {
          return !this.beginsWith(title, filter, pos);
        }
        return !this.containsAny(title, filter);
      }
      return true;
    });
    return cards.length;
  }

  /**
   * Looks for instances of one string within another.
   *
   * @param {String} string The string to search
   * @param {*} filter Either a string or an array to look for
   * @returns ``true`` if filter found in string, otherwise ``false``
   */
  containsAny(string, filter) {
    if (typeof filter === 'string') {
      return string.includes(filter);
    }
    if (!Array.isArray(filter)) {
      throw new TypeError();
    }
    for (const f of filter) {
      if (string.includes(f)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if the string starts with any of the strings in filter.
   *
   * @param {String} string The string to search
   * @param {*} filter Either a string or an array to look for
   */
  beginsWith(string, filter, pos) {
    let needle;
    if (typeof filter === 'string') {
      needle = [filter];
    } else {
      needle = filter;
    }
    for (const n of needle) {
      if (string.startsWith(n, pos)) {
        return true;
      }
    }
    return false;
  }

  // /**
  //  * Get a count for all labels used in a list.
  //  *
  //  * @param {jQuery} jLists Lists to count labels in
  //  * @param {Array} filter Array with strings. Labels will be excluded if they contain any
  //  *      of the strings
  //  * @returns {Array} An associative array with labels and their respective count
  //  */
  // countListLabels(jLists, filter) {
  //   if (!jLists) {
  //     throw new TypeError('Parameter [jLists] not defined');
  //   }
  //   if (filter && !(filter instanceof Array)) {
  //     throw new TypeError('Parameter [filter] undefined or not of type Array');
  //   }

  //   const cardLabels = [];

  //   jLists.find('span.card-label').each(function () {
  //     const title = $(this).attr('title');
  //     if (filter) {
  //       for (let i = 0; i < filter.length; ++i) {
  //         if (title.indexOf(filter[i]) > -1) {
  //           return;
  //         }
  //       }
  //     }
  //     if (cardLabels[title] === undefined) {
  //       cardLabels[title] = 0;
  //     }
  //     cardLabels[title]++;
  //   });

  //   return cardLabels;
  // }

  /**
   * Get the labels for a specific card.
   *
   * @param {Element} el The card item
   * @param {Array} filter An array with strings. Labels will be excluded if they
   *    contain any of the strings
   * @returns {Array} An array with card labels
   */
  getCardLabels(el, filter) {
    if (!el) {
      throw new TypeError('Parameter [el] not defined');
    }
    if (filter && !Array.isArray(filter)) {
      throw new TypeError('Parameter [filter] not an array');
    }
    const labels = [];
    $$(el, 'span.card-label').forEach(lbl => {
      const title = lbl.getAttribute('title');
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
  }

  /**
   *
   * @param {*} idx
   * @returns {Element} Wrapper element
   */
  getListWrapperByIndex(idx) {
    const boardEl = document.getElementById('board');
    const listEl = boardEl.children[idx];
    return listEl;
  }

}

TDOM.MAX_LOAD_ATTEMPTS = 7;
TDOM.LOAD_RETRY_TIMEOUT = 50;
TDOM.DEFAULT_TIMEOUT = 100;
TDOM.TEXT_NODE = 3;
TDOM.RETRY_TIME_FACTOR = 2;
TDOM.RETRY_BASE_TIME = 50;

try {
  module.exports = TDOM;
} catch (e) { /* Delib empty */ }

