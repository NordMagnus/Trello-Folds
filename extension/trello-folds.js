/* global chrome */
// import { tdom } from './tdom.js';
// import { $, jQuery } from 'jquery';
class TFolds {

  constructor() {
    this.settings = {
      sectionChar: '#',
      sectionRepeat: 2,
      enableTopBars: true,
      rememberViewStates: true,
      alwaysCount: false,
      enableCombiningLists: true,
      compactListWidth: 200,
    };
    this._compactMode = false;
    this.storage = {};
    this._boardId = undefined;
    this._config = {
      debug: true,
      collapsedIconUrl: null,
      expandedIconUrl: null,
      verbose: false,
    };
  }

  get config() {
    return this._config;
  }

  get debug() {
    return this._config.debug;
  }

  /**
   * Sets the debug flag. The module will output messages to the console
   * when set to `true`.
   *
   * @param {boolean} debug `true` to spam console, otherwise `false`
   */
  set debug(debug) {
    this._config.debug = debug;
  }

  get verbose() {
    return this._config.verbose;
  }

  get boardId() {
    return this._boardId;
  }

  set boardId(id) {
    this._boardId = id;
  }

  get sectionCharacter() {
    return this.settings.sectionChar;
  }

  get sectionRepeat() {
    return this.settings.sectionRepeat;
  }

  set sectionRepeat(repeat) {
    this.settings.sectionRepeat = repeat;
  }

  set sectionCharacter(identifier) {
    this.settings.sectionChar = identifier;
  }

  get sectionIdentifier() {
    return this.settings.sectionChar.repeat(this.settings.sectionRepeat);
  }

  get alwaysCount() {
    return this.settings.alwaysCount;
  }

  set alwaysCount(alwaysCount) {
    this.settings.alwaysCount = alwaysCount;
  }

  get enableCombiningLists() {
    return this.settings.enableCombiningLists;
  }

  set enableCombiningLists(enableCombiningLists) {
    this.settings.enableCombiningLists = enableCombiningLists;
  }

  get compactMode() {
    return this._compactMode;
  }

  set compactMode(status) {
    this._compactMode = status;
  }

  get listWidth() {
    let width = TFolds.NORMAL_LIST_WIDTH;
    if (this.compactMode) {
      width = this.settings.compactListWidth || TFolds.DEFAULT_COMPACT_WIDTH;
    }
    return Number(width);
  }

  initialize() {
    tdom.debug = this.debug;

    // Load from storage here

    tdom.onBoardChanged((oldId, newId) => {
      this.boardChanged(oldId, newId);
    });
    tdom.onListModified((listEl) => {
      this.listModified(listEl);
    });
    tdom.onListAdded((listEl) => {
      this.listAdded(listEl);
    });
    tdom.onListRemoved((listEl) => {
      this.listRemoved(listEl);
    });
    tdom.onCardAdded((cardEl) => {
      this.cardAdded(cardEl);
    });
    tdom.onCardRemoved((cardEl) => {
      this.cardRemoved(cardEl);
    });
    tdom.onCardModified((cardEl, title, oldTitle) => {
      this.cardModified(cardEl, title, oldTitle);
    });
    tdom.onListTitleModified(() => {
      this.listTitleModified();
    });
    tdom.onListDragged((listEl) => {
      this.listDragged(listEl);
    });
    tdom.onListDropped(() => {
      this.listDropped();
    });
    tdom.onBadgesModified((cardEl) => {
      this.cardBadgesModified(cardEl);
    });
    tdom.onRedrawBoardHeader(() => {
      this.redrawHeader();
    });
    tdom.init();

    /*
     * Get icon URLs
     */
    this.config.expandedIconUrl = chrome.runtime.getURL('img/icons8-sort-down-16.png');
    this.config.collapsedIconUrl = chrome.runtime.getURL('img/icons8-sort-right-16.png');
  }

  // #region EVENT HANDLERS

  /**
   * Called when the board changes.
   *
   * @param {String} boardId
   * @param {String} oldBoardId
   */
  boardChanged(boardId, oldBoardId) {
    this.debug && console.log(`boardId=${boardId},oldId=${oldBoardId}`);
    this.initStorage();
  }

  /**
   * @param {Element} listEl
   */
  listModified(listEl) {
    if (!listEl) {
      console.error('[listEl] not defined');
      return;
    }
    this.showWipLimit(listEl);
  }

  /**
   * @param {Element} listEl
   */
  listRemoved(listEl) {
    if (this.isSubList(listEl)) {
      this.redrawCombinedLists();
    }
  }

  /**
   * @param {Element} listEl
   */
  listAdded(listEl) {
    if (!listEl) {
      console.error('[listEl] not defined');
      return;
    }
    this.addFoldingButton(listEl);
    this.addCollapsedList(listEl);
    this.showWipLimit($(listEl, '.js-list-content'));
    this.redrawCombinedLists();
  }

  /**
   * @param {Element} listEl
   */
  listDragged(listEl) {
    this.debug && console.log('List dragged');
    const list = listEl.querySelector('.js-list-content');
    const isSubList = this.isSubList(list);
    if (isSubList) {
      const subs = this.getSubLists(list);
      subs.forEach((e) => {
        this.restoreSubList(e);
      });
    }
  }

  listDropped() {
    this.debug && console.log('List dropped');
    this.redrawCombinedLists();
  }

  redrawCombinedLists() {
    this.splitAllCombined();
    this.combineLists();
  }

  /**
   *
   */
  cardAdded(cardEl) {
    setTimeout(() => {
      this.formatCard(cardEl);
    }, TFolds.FORMAT_CARD_TIMEOUT);
  }

  /**
   * Called when a card is removed from a list. In practice this method
   * is invoked when a card is dragged and used to expand cards when a section
   * card is moved.
   *
   * @param {Element} cardEl
   */
  cardRemoved(cardEl) {
    if (cardEl.classList.contains('section-card')) {
      $(cardEl, 'div.list-card-details').style.opacity = '0.0';
      if (this.isSectionCollapsed(cardEl)) {
        this.toggleSection(cardEl);
      }
    }
  }

  cardBadgesModified(cardEl) {
    if (this.isBlocked(cardEl)) {
      cardEl.classList.add('blocked-card');
      $(cardEl, '.list-card-title').classList.add('blocked-title');
      $$(cardEl, 'div.badge > *').forEach(e => e.classList.add('blocked-badges'));
      return;
    }
    cardEl.classList.remove('blocked-card');
    $(cardEl, '.list-card-title').classList.remove('blocked-title');
    $$(cardEl, 'div.badge > *').forEach(e => e.classList.remove('blocked-badges'));
  }

  isBlocked(card) {
    const badges = $$(card, '.badge-text');
    return badges.some(b => {
      return b.textContent.toLowerCase().includes('blocked');
    });
  }

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
    this.verbose && console.debug('cardModified()');
    cardEl.classList.remove('comment-card');

    this.checkSectionChange(cardEl, title, oldTitle);

    if (!this.isSection(title)) {
      if (title.indexOf('//') === 0) {
        cardEl.classList.add('comment-card');
      }
    }

    this.showWipLimit(tdom.getContainingList(cardEl));
  }

  /**
   * Checks if section state changed. There are basically
   * three changes that we need to handle:
   *   1. A section card's title changed
   *   2. A card was changed __from__ a section to a normal card
   *   3. A card was changed __into__ a section
   * In addition for item 2 and 3 above the list WIP has to be updated
   */
  checkSectionChange(card, title, oldTitle) {
    if (!this.isSection(title) && !this.isSection(oldTitle)) {
      return;
    }

    /*
     * Case 1: Only title changed (was, and still is, a section)
     */
    if (this.isSection(title) && this.isSection(oldTitle)) {
      $(card, '#section-title').textContent = this.getStrippedTitle(title);
      // card.querySelector('#section-title').text(this.getStrippedTitle(title));
      return;
    }

    /*
     * Case 2: A card was changed from a section
     */
    if (!this.isSection(title)) {
      this.removeSectionFormatting(card);
      return;
    }
    /*
      * Case 3: Was a normal card now a section
      */
    this.formatAsSection(card);
  }

  /**
   * Removes any section formatting for the specified card.
   *
   * @param {Element} card The card to strip
   */
  removeSectionFormatting(card) {
    this.verbose && console.debug('removeSectionFormatting()');
    card.querySelector('span.section-icon')?.remove();
    card.querySelector('span#section-title')?.remove();
    card.querySelector('span.list-card-title')?.remove();
    card.querySelector('div.list-card-details').style.opacity = '1.0';
    card.classList.remove('section-card');
  }

  /**
   *
   */
  listTitleModified(/* list, title*/) {
    this.redrawCombinedLists();
  }

  redrawHeader() {
    this.addBoardIcons();
    this.updateCompactModeButtonState(this.compactMode);
  }

  // #endregion EVENT HANDLERS

  /**
   *
   */
  isSection(title) {
    return title.indexOf(this.sectionIdentifier) !== -1;
  }

  /**
   *
   */
  getStrippedTitle(title) {
    let ch = this.sectionCharacter;
    if (['*', '^', '$', '.', '+', '?', '|', '\\'].indexOf(ch) !== -1) {
      ch = `\\${ch}`;
    }
    const re = new RegExp(`(${ch})\\1{${this.sectionRepeat - 1},}`, 'g');
    return title.replace(re, '').trim();
  }

  // HACK This is dirty as he11. Change to promise or refactor other way
  /**
   *
   */
  async initStorage() {
    this.boardId = tdom.getBoardIdFromUrl();

    const result = await chrome.storage.sync.get(['settings', this.boardId]);

    this.storage = {};

    if (result) {
      this.debug && console.table(result.settings);
      if (result.settings['rememberViewStates'] === true) {
        console.table(result[this.boardId]);
      }
      if (result['settings']) {
        this.settings = result['settings'];
      }
      this.storage = result[this.boardId];
    }

    this.setupBoard();
  }

  /**
   *
   * @param { } attemptCount
   * @returns
   */
  /**
   * This method is called when the extension is first loaded and when
   * a new board is loaded.
   */
  setupBoard(attemptCount = 1) {
    const canvas = document.querySelector('div.board-canvas');
    if (!canvas) {
      /*
       * Trying to find the board again in 100 ms if not found directly.
       * Should not happen after changes to ``tdom.js`` but let's play it safe and
       * keep it - changing log level to warn.
       */
      if (attemptCount < TFolds.MAX_ATTEMPTS) {
        setTimeout(() => {
          console.warn(`Trying to find DIV.board-canvas again (attempt ${attemptCount + 1})`);
          this.setupBoard(attemptCount + 1);
        }, TFolds.ATTEMPT_TIMEOUT);
        return;
      }
      throw ReferenceError(`DIV.board-canvas not found after ${attemptCount} attempts`);
    }

    this.debug && console.info('%cSetting up board', 'font-weight: bold;');

    this.cleanupStorage();
    this.formatLists();
    this.formatCards();
    this.addBoardIcons();

    this.compactMode = this.retrieveGlobalBoardSetting('compactMode');

    if (this.settings.rememberViewStates) {
      setTimeout(() => {
        this.restoreSectionsViewState();
      }, TFolds.RESTORE_VIEWSTATE_TIMEOUT);
    } else {
      this.clearViewState();
    }
  }

  /**
   * Adds board wide buttons to the top bar.
   */
  addBoardIcons() {
    const buttonContainer = $('div.board-header-btns.mod-right');
    const divider = this.createNode({ tag: 'span', classes: ['board-header-btn-divider'] });
    buttonContainer.prepend(divider);

    /*
     * COMPACT MODE
     */
    const compactModeButton = this.createNode({
      tag: 'a',
      id: 'toggle-compact-mode',
      classes: ['board-header-btn', 'board-header-btn-without-icon', 'board-header-btn-text',
        'compact-mode-disabled'],
    });
    compactModeButton.append(this.createNode({
      tag: 'span', content: 'Compact Mode',
    }));
    compactModeButton.onclick = () => {
      this.setCompactMode(!this.compactMode);
    };

    buttonContainer.prepend(compactModeButton);

    /*
     * REDRAW BOARD
     */
    const redrawButton = this.createNode({
      tag: 'a',
      id: 'redraw-board',
      classes: ['board-header-btn', 'board-header-btn-without-icon', 'board-header-btn-text',
        'compact-mode-disabled'],
    });
    redrawButton.append(this.createNode({
      tag: 'span', content: 'Redraw',
    }));
    redrawButton.onclick = () => {
      this.formatLists();
      this.formatCards();
    };

    buttonContainer.prepend(redrawButton);
  }

  /**
   * Sets the compact mode for the current board and stores the setting.
   *
   * @param {boolean} enabled `true` if compact mode should be enabled, otherwise `false`
   */
  setCompactMode(enabled) {
    this.compactMode = enabled;
    this.updateCompactModeButtonState(enabled);
    this.updateWidths();
    this.storeGlobalBoardSetting('compactMode', enabled);
  }

  updateCompactModeButtonState(enabled) {
    const btn = document.querySelector('a#toggle-compact-mode');
    if (enabled) {
      btn.classList.add('compact-mode-enabled');
      btn.classList.remove('compact-mode-disabled');
    } else {
      btn.classList.add('compact-mode-disabled');
      btn.classList.remove('compact-mode-enabled');
    }
  }

  /**
   *
   */
  cleanupStorage() {
    // console.log("cleanupStorage()", storage);
    if (this.settings.enableCombiningLists === false) {
      // TODO Add function to clear super list states
    }
  }

  /**
   * Removes the view state for the board. Called when board is setup
   * if the `store view state` has been disabled.
   */
  clearViewState() {
    chrome.storage.sync.remove(this.boardId);
  }

  /**
   * Iterates section formatted cards and restores stored view states.
   * Called at board setup.
   */
  restoreSectionsViewState() {
    const lists = tdom.getLists();
    const self = this;
    lists.forEach(l => {
      const sectionStates = self.retrieve(tdom.getListName(l), 'sections');
      if (!sectionStates) {
        return;
      }
      const sections = tdom.getCardsInList(l, this.sectionIdentifier);
      sections.forEach(() => {
        const cardName = tdom.getCardName(l);
        if (sectionStates[self.getStrippedTitle(cardName)] === true) {
          // FIXME Change to dataset etc. etc. 💣
          const section = l.querySelector('.icon-expanded');
          // TODO Test that section is not null 😨
          console.assert(section !== null, 'Section is null, oopsie');
          self.toggleSection(section, false);
        }
      });
    });
  }

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
    this.store(TFolds.GLOBAL_BOARD_SETTING_STRING, key, value);
  }

  /**
   * Retrieves a board wide setting.
   *
   * @param {String} key the preference to retrieve
   * @see #storeGlobalBoardSetting()
   * @see #retrieve()
   */
  retrieveGlobalBoardSetting(key) {
    return this.retrieve(TFolds.GLOBAL_BOARD_SETTING_STRING, key);
  }

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
    if (!this.boardId) {
      throw new ReferenceError('Board ID not set');
    }

    const setting = this.storage[listName] || {};
    setting[key] = value;
    this.storage[listName] = setting;
    const boardStorage = {};
    boardStorage[this.boardId] = this.storage;
    chrome.storage.sync.set(boardStorage, () => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
      }
    });
  }

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
      value = this.storage[listName][key];
    } catch (e) {
      // if (config.debug) {
      //     console.warn(`Setting [${key}] for list [${listName}] not set`);
      // }
    }
    return value;
  }

  /**
   * Applies extension specific formatting to all lists in the board.
   */
  formatLists() {
    this.redrawCombinedLists();
    this.makeListsFoldable();
    this.addWipLimits();
  }

  // #region COMBINED LISTS

  /**
   * Assuming feature is not disabled, and the current list has same
   * prefix as next list combines them. Does so for all subsequent lists
   * with same prefix.
   *
   * Also removes sub list properties for lists if they are not part of
   * a combined set.
   */
  combineLists() {
    if (this.settings.enableCombiningLists === false) {
      return;
    }
    const lists = tdom.getLists();
    for (let i = 0; i < lists.length; ++i) {
      if (tdom.getListName(lists[i]).indexOf('.') === -1 || i === lists.length - 1) {
        this.restoreSubList(lists[i]);
        continue;
      }
      if (this.areListsRelated(lists[i], lists[i + 1])) {
        const numInSet = this.createCombinedList(lists[i], i);
        i += numInSet - 1;
      } else {
        this.restoreSubList(lists[i]);
      }
    }
  }

  /**
   * Creates a set of combined lists. The set has associated metadata
   * identifying them as a sub list.
   *
   * - _sublistindex_ holds the sub list index in the set
   * - _firstList_ holds a reference to the first list in the set, i.e the list this method
   *   is called with. The first list holds a reference to itthis for convenience purposes.
   *
   * @param {jQuery} $list The leftmost list in the combined set to create
   * @returns {Number} The number of lists in the set
   */
  createCombinedList(list, superListIndex) {
    const numOfSubLists = this.convertToSubList(list, superListIndex) + 1;
    this.debug && console.log(`numOfSubLists=${numOfSubLists}`);
    if (numOfSubLists < 2) {
      this.debug && console.error('Expected number of lists to be combined to be at least two');
      return null;
    }
    list.dataset.numOfSubLists = numOfSubLists;
    this.addSuperList(list);
    return numOfSubLists;
  }

  /**
   * Called by `createCombinedList()` and then by itthis recursively to
   * convert a number of adjacent lists into a set.
   *
   * @param {jQuery} $list List to convert
   * @param {Number} idx Current index
   * @param {Number} id Unique identifier (timestamp)
   * @param {jQuery} $firstList Reference to first list
   */
  convertToSubList(list, superListIndex, idx = 0) {
    if (list.classList.contains('sub-list')) {
      this.debug && console.warn(
          `List [${tdom.getListName(list)}] already combined with other list`);
      return null;
    }

    list.setAttribute('data-sublistindex', idx);
    list.setAttribute('data-super-list-index', superListIndex);
    list.classList.add('sub-list');
    this.removeFoldingButton(list);
    this.showWipLimit(list);

    this.attachListResizeDetector(list);

    const nextList = tdom.getNextList(list);
    if (nextList) {
      if (this.areListsRelated(list, nextList)) {
        return this.convertToSubList(nextList, superListIndex, idx + 1);
      }
    }
    return idx;
  }

  /**
   * Attaches a "height change detector" to the target list. It triggers
   * a `resized` event if a change is detected.
   *
   * The detector detaches  when the list is no longer a sub list
   * and when the list is no longer in the DOM.
   *
   * If the method is called several times on same list no additional
   * detectors are added.
   *
   * TODO Replace with resize observer? https://web.dev/resize-observer/
   * @param {jQuery} $list The target list
   */
  attachListResizeDetector(list) {
    // const list = $list[0];

    // FIXME Fix resizing when section expanded/collapsed
    if (list.dataset.hasDetector === 'true') {
      console.log('Detector already exists: ', tdom.getListName(list));
      return;
    }
    this.debug && console.log('Attaching resize detector: ', tdom.getListName(list));

    list.dataset.hasDetector = true;

    const resizeDetector = () => {
      /*
       * If list not visible or not a sub list anymore, stop tracking
       * height changes
       */

      if (!list.isConnected) {
        if (this.debug) {
          console.log(
              `Detaching resize detector (list no longer in DOM): [${tdom.getListName(list)}]`);
        }
        delete list.dataset.hasDetector;
        return;
      }

      if (list.style.display === 'none' || list.dataset.sublistindex === undefined) {
        if (this.debug) {
          console.log(
              `Detaching resize detector (no longer sub list): [${tdom.getListName(list)}]`);
        }
        delete list.dataset.hasDetector;
        return;
      }

      Promise.resolve(1).then(() => {
        const height = String(list.getBoundingClientRect().height);
        if (height !== list.dataset.oldHeight) {
          list.dataset.oldHeight = height;
          const superList = this.getMySuperList(list);
          if (superList) {
            // TODO Add sublist parameter to this ...trigger('resized', $list[0]);
            this.updateSuperListHeight(list);
            // superList.dispatchEvent(new Event('resize'));
          }
        }
      });

      requestAnimationFrame(resizeDetector);
    };

    const height = String(list.getBoundingClientRect().height);
    list.dataset.oldHeight = height;

    requestAnimationFrame(resizeDetector);
  }

  /**
   * Determines if two lists are related, i.e. have same dot separated prefix.
   * For example
   *
   * `listigt.sub1 listigt.sub2`
   *
   * will return `true`.
   *
   * @param {jQuery} l1 The first list
   * @param {jQuery} l2 The second list
   */
  areListsRelated(l1, l2) {
    const name1 = tdom.getListName(l1);
    const name2 = tdom.getListName(l2);
    return name1.includes('.')
      && (name1.substr(0, name1.indexOf('.')) === name2.substr(0, name2.indexOf('.')));
  }

  splitAllCombined() {
    let subLists = $$('.sub-list');
    let n = 0;
    while (subLists.length > 0 && n < TFolds.MAX_LISTS_IN_BOARD) {
      const sublists = this.getSubLists(subLists[0]);
      sublists.forEach(e => {
        this.restoreSubList(e);
      });
      subLists = $$('.sub-list');
      n++;
    }
    if (n === TFolds.MAX_LISTS_IN_BOARD) {
      console.error('Something went wrong splitting sub lists');
      console.trace();
      console.log(subLists);
    }
  }

  /**
   * Restores the target list to a "normal" list by removing all sub list
   * related data and restoring the folding button and WiP limit stuff.
   *
   * @param {jQuery} $list The target list
   */
  restoreSubList(list) {
    if (list.dataset.sublistindex === '0') {
      const superLists = list.parentNode.querySelectorAll('.super-list');
      superLists.forEach(e => e.remove());
      list.parentNode.querySelectorAll('.super-list-collapsed').forEach(e => e.remove());
    }
    delete list.dataset.sublistindex;
    list.classList.remove('sub-list');
    this.addFoldingButton(list);
    this.showWipLimit(list);
  }

  /**
   * Checks whether the target list is part of a combined list set.
   *
   * @param {Element} listEl The list
   * @returns `true` if it is a sub list otherwise `false`
   */
  isSubList(listEl) {
    if (!listEl) {
      throw new TypeError('Parameter [$l] undefined');
    }
    return listEl.dataset.sublistindex !== undefined;
  }

  /**
    *
    * @param {Element} listEl
    */
  addSuperList(listEl) {
    const superList = this.createNode({ tag: 'div', classes: 'super-list' });
    const title = this.createNode({ tag: 'span', classes: 'super-list-header' });
    const extras = this.createNode({ tag: 'div', classes: 'list-header-extras' });

    title.appendChild(extras);
    superList.dataset.superList = true;
    superList.appendChild(title);

    this.addFoldingButton(superList);

    listEl.parentNode.prepend(superList);
    this.addCollapsedSuperList(superList);

    this.updateSuperList(listEl);

    // FIXME
    // $superList.on('resized', (event, subListEl) => {
    //   this.updateSuperListHeight($(subListEl));
    // });
  }

  /**
       *
       */
  addCollapsedSuperList(superList) {
    try {
      const collapsedList = this.createNode({
        tag: 'div',
        style: { display: 'none' },
        classes: ['super-list-collapsed', 'list'],
      });
      collapsedList.append(this.createNode(
          { tag: 'span', classes: 'list-header-name', content: 'EMPTY' }));

      collapsedList.onclick = (event) => {
        this.expandSuperList(event.currentTarget);
        event.stopPropagation();
      };
      superList.parentNode.prepend(collapsedList);

      if (this.settings.rememberViewStates) {
        const collapsed = this.retrieve(
            tdom.getListName(
                superList.parentNode.querySelector('.js-list-content')), 'super-list-collapsed');
        if (collapsed === true) {
          this.collapseSuperList(superList);
        }
      }
    } catch (e) {
      // Deliberately empty
    }
  }

  /**
   *
   * @param {*} $subList
   */
  updateSuperListHeight(list) {
    if (!list) {
      throw new TypeError('Parameter [$l] undefined');
    }
    if (!this.isSubList(list)) {
      throw new TypeError('Parameter [$l] not sublist');
    }
    const superList = this.getMySuperList(list);
    if (superList) {
      const height = this.findSuperListHeight(list);
      superList.style.height = `${height}px`;
    }
  }

  findSuperListHeight(list) {
    const { superListIndex } = list.dataset;
    const listWrapper = tdom.getListWrapperByIndex(superListIndex);
    let listEl = listWrapper.querySelector(`[data-super-list-index="${superListIndex}"]`);
    let maxHeight = 0;
    do {
      if (listEl.clientHeight > maxHeight) {
        maxHeight = listEl.clientHeight;
      }
      listEl = tdom.getNextList(listEl);
    } while (listEl?.dataset.sublistindex > 0);
    return maxHeight;
  }

  /**
       * Finds the super list DIV associated with the sub list.
       *
       * @param {jQuery} subList The sub list
       * @returns {jQuery} The super list DIV element jQuery object
       */
  getMySuperList(subList) {
    const { superListIndex } = subList.dataset;
    const wrapper = tdom.getListWrapperByIndex(superListIndex);
    const superList = wrapper.querySelector('div.super-list');
    return superList;
  }

  /**
   *
   * @param {*} subList
   * @returns
   */
  updateSuperList(subList) {
    const listIndex = subList.dataset.superListIndex;
    const wrapper = tdom.getListWrapperByIndex(listIndex);
    const sl = $(wrapper, `[data-super-list-index="${listIndex}"]`);
    // const $superList = $(this.getMySuperList(subList));
    // console.assert($superList.length !== 0, 'Nada superlisto !!!');
    const superList = this.getMySuperList(subList);
    let $title;
    if (superList) {
      $title = $(superList, 'span.super-list-header');
      $($title, 'span.wip-limit-title')?.remove();
    }

    /*
     * Get the WiP limit from the left list
     */
    const wipLimit = this.extractWipLimit(sl);

    /*
     * Calculate tot # of cards
     */
    // const n = $sl.data('numOfSubLists');
    const n = sl.dataset.numOfSubLists;
    let totNumOfCards = 0;
    // let [listEl] = $sl;
    let listEl = sl;
    for (let i = 0; i < n; ++i) {
      totNumOfCards += this.countWorkCards(listEl);
      listEl = tdom.getNextList(listEl);
    }

    let title = tdom.getListName(sl);
    title = title.substr(0, title.indexOf('.'));
    const wipTitle = this.createWipTitle(title, totNumOfCards, wipLimit);
    this.updateWipBars(superList, totNumOfCards, wipLimit);
    $title?.append(wipTitle);
    this.updateSuperListHeight(sl);
    this.updateCollapsedSuperList(superList, wipTitle.cloneNode(true));

    this.updateWidths();

    return wipTitle;
  }

  /**
   * Updates the width of every list and super list. Ensures lists are drawn correctly in
   * compact mode and that combined list backdrops are rendered correctly.
   */
  updateWidths() {
    const lists = document.querySelectorAll('div.list-wrapper');
    lists.forEach(l => {
      const collapsedList = l.querySelector(
          'div.list-collapsed:not([style*="none"]),div.super-list-collapsed:not([style*="none"])');
      if (!collapsedList) {
        l.style.width = `${this.listWidth}px`;
      }
    });

    const supersets = document.querySelectorAll('div.super-list');
    supersets.forEach(s => {
      const n = s.parentNode.querySelector('div.js-list-content').dataset.numOfSubLists;
      const w = ((this.listWidth + TFolds.LIST_PADDING) * n) - TFolds.LIST_PADDING;
      s.style.width = `${w}px`;
    });
  }

  // updateCollapsedSuperList($superList, $wipTitle) {
  //   const $header = $superList.parent().find('.super-list-collapsed > span.list-header-name');
  //   $header.empty().append($wipTitle);
  // }

  /**
   *
   */
  updateCollapsedSuperList(superList, wipTitle) {
    if (!superList) {
      return;
    }
    const header = superList.parentNode.querySelector(
        '.super-list-collapsed > span.list-header-name');
    header.innerHTML = '';
    header.append(wipTitle);
  }
  // #region COMBINED LISTS

  /**
   *
   */
  makeListsFoldable() {
    const lists = document.querySelectorAll('div.list-wrapper');
    lists.forEach(e => {
      this.addFoldingButton(e);
      this.addCollapsedList(e);
    });
  }

  /**
   *
   */
  addFoldingButton(listEl) {
    if (listEl.querySelector('.js-list-content')?.dataset.sublistindex !== undefined) {
      return;
    }

    const header = listEl.querySelector('div.list-header-extras');
    if (!header) {
      return;
    }
    header.querySelector('.icon-close')?.parentNode.remove();

    const foldIcon = this.createFoldIcon();

    foldIcon.onclick = (event) => {
      const l = event.currentTarget.closest('.list');
      if (l) {
        this.collapseList(l);
      } else {
        const superList = event.currentTarget.closest('.super-list');
        if (!superList) {
          console.error('Expected to find a list or a super list');
          return;
        }
        this.collapseSuperList(superList);
      }
      event.stopPropagation();
    };

    header.append(foldIcon);
  }

  createFoldIcon() {
    const link = this.createNode({ tag: 'a', classes: ['list-header-extras-menu', 'dark-hover'] });
    const icon = this.createNode({ tag: 'span', classes: ['icon-sm', 'icon-close', 'dark-hover'] });

    link.href = '#';
    link.append(icon);

    return link;
  }

  /**
       *
       */
  removeFoldingButton(list) {
    const foldingButton = list.querySelector('span.icon-close');
    if (!foldingButton) {
      this.debug && console.log(`Folding button not found for list: ${tdom.getListName(list)}`);
      return;
    }
    foldingButton.parentNode.remove();
  }

  /**
   *
   */
  addCollapsedList(listEl) {
    if (listEl.classList.contains('js-add-list')) {
      return;
    }

    /*
     * If list already contains an element with list-collapsed class
     * this method is called from "redraw"
     */
    if (listEl.querySelector('.list-collapsed')) {
      this.debug && console.log("There's already a list-collapsed elementish");
      return;
    }
    listEl.style.position = 'relative';
    try {
      const name = tdom.getListName(listEl);
      const collapsedList = this.createNode({
        tag: 'div',
        classes: ['list-collapsed', 'list'],
        style: { display: 'none' },
      });
      const nameSpan = this.createNode({
        tag: 'span',
        classes: 'list-header-name',
        content: name,
      });
      collapsedList.append(nameSpan);
      collapsedList.onclick = (event) => {
        this.expandList(event.currentTarget);
        event.stopPropagation();
      };
      listEl.prepend(collapsedList);
      if (this.settings.rememberViewStates) {
        const collapsed = this.retrieve(tdom.getListName(listEl), 'collapsed');
        if (collapsed === true) {
          this.collapseList(listEl.querySelector('.list > *').nextSibling);
        }
      }
    } catch (e) {
      // Deliberately empty
    }
  }

  /**
   *
   */
  addWipLimits() {
    this.verbose && console.debug('addWipLimits()');
    let wipLists;
    if (this.settings.alwaysCount === true) {
      wipLists = tdom.getLists();
    } else {
      wipLists = tdom.getLists(/\[([0-9]*?)\]/);
    }
    wipLists.forEach(l => {
      this.showWipLimit(l);
    });
  }

  /**
   *
   */
  showWipLimit(listEl) {
    this.verbose && console.debug('showWipLimits()');
    const numCards = this.countWorkCards(listEl);
    const wipLimit = this.extractWipLimit(listEl);
    const subList = listEl?.dataset.sublistindex;
    this.removeWipLimit(listEl);
    if (subList !== undefined) {
      this.addWipLimit(listEl, numCards);
      this.updateSuperList(listEl);
      listEl.classList.remove('wip-limit-reached', 'wip-limit-exceeded');
      listEl.previousElementSibling?.classList.remove(
          'collapsed-limit-reached', 'collapsed-limit-exceeded');
    } else if (wipLimit !== null) {
      this.addWipLimit(listEl, numCards, wipLimit);
      this.updateWipBars(listEl, numCards, wipLimit);
    } else if (this.settings.alwaysCount === true) {
      this.addWipLimit(listEl, numCards);
    }
  }

  /**
   * Counts cards representing work in the specified list.
   * In other words, count all cards except those representing sections or notes.
   *
   * @param {Element} listEl The list for which to count cards
   */
  countWorkCards(listEl) {
    // TODO Replace "//" with setting
    return tdom.countCards(listEl, [this.sectionIdentifier, '//'], 0);
  }

  /**
   *
   */
  updateWipBars(listEl, numCards, wipLimit) {
    if (!listEl) {
      return;
    }
    if (typeof wipLimit === 'number' && this.settings.enableTopBars) {
      const collapsed = listEl.parentNode.querySelectorAll(
          '.list-collapsed,.super-list-collapsed');
      if (numCards === wipLimit) {
        listEl.classList.add('wip-limit-reached');
        listEl.classList.remove('wip-limit-exceeded');
        collapsed.forEach(e => {
          e.classList.add('collapsed-limit-reached');
          e.classList.remove('collapsed-limit-exceeded');
        });
        return;
      }
      if (numCards > wipLimit) {
        listEl.classList.add('wip-limit-exceeded');
        listEl.classList.remove('wip-limit-reached');
        collapsed.forEach(e => {
          e.classList.add('collapsed-limit-exceeded');
          e.classList.remove('collapsed-limit-reached');
        });
        return;
      }
    }
    this.removeWipBar(listEl);
  }

  /**
   *
   */
  removeWipLimit(listEl) {
    const title = listEl.querySelector('span.wip-limit-title');
    title?.remove();
    // if (title) {
    //   title.remove();
    // }
    const textarea = listEl.querySelector('.list-header > textarea');
    this.toggleVisibility(textarea, true);
    this.removeWipBar(listEl);
  }

  // removeWipLimit(listEl) {
  //   const $l = $(listEl);
  //   $l.find('span.wip-limit-title').remove();
  //   const $header = $l.find('.list-header');
  //   $header.find('textarea').show();
  //   this.removeWipBar($l[0]);
  // }

  /**
   *
   */
  removeWipBar(listEl) {
    listEl.classList.remove('wip-limit-reached', 'wip-limit-exceeded');
    listEl.previousElementSibling?.classList.remove(
        'collapsed-limit-reached',
        'collapsed-limit-exceeded');
  }

  /**
   *
   * @param {*} listEl
   */
  extractWipLimit(listEl) {
    const title = tdom.getListName(listEl);
    const matches = title.match(/\[([0-9]*?)\]/);

    if (matches && matches.length > 1) {
      return parseInt(matches[1]);
    }

    return null;
  }

  /**
   *
   * @param {*} $l
   * @param {*} numCards
   * @param {*} wipLimit
   */
  addWipLimit(listEl, numCards, wipLimit = null) {
    let strippedTitle;

    const wipLimitTitle = listEl.querySelector('span.wip-limit-title');
    wipLimitTitle?.remove();
    const title = tdom.getListName(listEl);

    if (title.indexOf('[') !== -1) {
      strippedTitle = title.substr(0, title.indexOf('[')).trim();
    } else {
      strippedTitle = title;
    }

    if (this.isSubList(listEl)) {
      strippedTitle = strippedTitle.substr(strippedTitle.indexOf('.') + 1);
    }

    this.addWipListTitle({
      listEl,
      numCards,
      wipLimit: !this.isSubList(listEl) ? wipLimit : null,
      strippedTitle,
    });
  }

  /**
   *
   * @param {*} listEl
   * @param {*} numCards
   * @param {*} wipLimit
   * @param {*} strippedTitle
   */
  addWipListTitle({ listEl, numCards, wipLimit, strippedTitle }) {
    let wipTitle;
    const header = listEl.querySelector('.list-header');

    wipTitle = this.createWipTitle(strippedTitle, numCards, wipLimit);

    const collapsedList = listEl.parentNode.querySelector('div.list-collapsed');
    if (collapsedList) {
      collapsedList.innerHTML = '';
      collapsedList.append(wipTitle);
    }
    wipTitle = wipTitle.cloneNode(true);
    header.onclick = (event) => {
      const textarea = event.currentTarget.querySelector('textarea');
      const wipLimitTitle = event.currentTarget.querySelector('.wip-limit-title');
      this.toggleVisibility(wipLimitTitle, false);
      if (textarea) {
        this.toggleVisibility(textarea, true);
        textarea.select();
      }
      if (event.currentTarget.classList.contains('wip-limit-badge')) {
        event.stopPropagation();
      }
    };
    this.toggleVisibility(header.querySelector('textarea'), false);
    header.querySelector('textarea').onblur = () => {
      this.showWipLimit(listEl);
    };
    header.append(wipTitle);
  }

  /**
   *
   */
  createWipTitle(title, numCards, wipLimit) {
    let countBadge = null;

    if (wipLimit === null && this.settings.alwaysCount) {
      countBadge = this.createNode({
        tag: 'span',
        classes: 'wip-limit-badge',
        content: numCards,
      });
    } else if (wipLimit !== null) {
      countBadge = this.createNode({
        tag: 'span',
        classes: 'wip-limit-badge',
        content: `${numCards} / ${wipLimit}`,
      });
      if (numCards === wipLimit) {
        countBadge.style.backgroundColor = '#fb7928';
      }
      if (numCards > wipLimit) {
        countBadge.style.backgroundColor = '#b04632';
      }
    }

    const wipTitle = this.createNode({
      tag: 'span',
      classes: 'wip-limit-title',
      content: title,
    });
    if (this.shouldAddWip(wipLimit)) {
      wipTitle.append(countBadge);
    }
    return wipTitle;
  }

  shouldAddWip(wipLimit) {
    return this.settings.alwaysCount || wipLimit !== null;
  }

  /**
   *
   */
  formatCards() {
    const cards = tdom.getCardsByName('', false);
    this.debug && console.groupCollapsed('Formatting cards');
    cards.forEach(c => this.formatCard(c));
    this.debug && console.groupEnd();
  }

  /**
   *
   */
  formatCard(cardEl) {
    const cardName = tdom.getCardName(cardEl);

    if (cardName.indexOf(this.sectionIdentifier) === 0) {
      if (this.debug) {
        console.info(`Card [${cardName}] is a section`);
      }
      this.formatAsSection(cardEl);
      return;
    }
    if (cardName.indexOf('//') === 0) {
      if (this.debug) {
        console.info(`Card [${cardName}] is a comment`);
      }
      cardEl.classList.add('comment-card');
      return;
    }
    const badgeLabels = $$(cardEl, '.badge-text');
    if (badgeLabels.some(l => l.textContent.includes('blocked'))) {
      if (this.debug) {
        console.info(`Card [${cardName}] is blocked`);
      }
      cardEl.classList.add('blocked-card');
      cardEl.querySelector('.list-card-title').classList.add('blocked-title');
      cardEl.querySelectorAll('div.badge > *').forEach(e => e.classList.add('blocked-badges'));
    }
  }

  /**
   *
   */
  formatAsSection(card) {
    if (this.debug) {
      console.log(`Formatting as section: ${tdom.getCardName(card)}`);
    }
    if (card.querySelector('#section-title')) {
      this.debug && console.log('Section title already exists');
      return;
    }
    const icon = this.createNode({ tag: 'span', classes: 'section-icon' });
    icon.style.backgroundImage = `url(${this.config.expandedIconUrl})`;
    icon.onclick = (event) => {
      this.toggleSection(event.currentTarget);
      event.stopPropagation();
      return false;
    };

    const strippedTitle = this.getStrippedTitle(tdom.getCardName(card));

    console.log(strippedTitle);

    const strippedTitleEl = this.createNode({
      tag: 'span',
      id: 'section-title',
      content: strippedTitle,
    });

    card.insertBefore(strippedTitleEl, card.firstChild);
    card.insertBefore(icon, card.firstChild);
    this.toggleVisibility(card.querySelector('span.list-card-title'), false);
    card.classList.add('section-card');

    console.log(card);
  }

  /**
   * Collapse one list.
   *
   * @param {Element} listEl List element to collapse
   */
  collapseList(listEl) {
    this.toggleVisibility(listEl);
    this.toggleVisibility(listEl.previousSibling);
    listEl.parentNode.style.width = '40px';
    this.store(tdom.getListName(listEl), 'collapsed', true);
  }

  /**
   * Returns all sub lists related to the passed element. This means
   * either the passed list plus its sibling sub lists, or the sub lists with same ID as speciifed
   * by the super list firstList attribute.
   *
   * @param {Element} list Either a sub list or a super list
   * @returns {Array} Sub list elements
   */
  getSubLists(list) {
    let firstSubList;

    if (!this.isSubList(list)) {
      firstSubList = list.parentNode.querySelector('.sub-list');
    } else {
      const idx = list.dataset.superListIndex;
      firstSubList = $(`#board [data-super-list-index="${idx}"]`);
    }

    console.assert(firstSubList, 'firstSubList not defined');

    const { superListIndex } = firstSubList.dataset;
    const subLists = document.querySelectorAll(
        `.sub-list[data-super-list-index="${superListIndex}"]`);
    return subLists;
  }

  /**
   * When collapsing a super list the first contained list's is hidden,
   * and subsequent lists' wrappers are hidden.
   *
   * @param {Element} superList The super list to collapse
   */
  collapseSuperList(superList) {
    this.toggleVisibility(superList);
    this.toggleVisibility(superList.parentNode.querySelector('.super-list-collapsed'));
    superList.parentNode.style.width = '40px';
    superList.parentNode.nextSibling.style.display = 'none';

    const subLists = this.getSubLists(superList);
    subLists[0].style.display = 'none';
    Array.from(subLists).slice(1).forEach(e => e.parentNode.style.display = 'none');
    this.store(
        tdom.getListName(superList.parentNode.querySelector('.js-list-content')),
        'super-list-collapsed',
        true);
  }

  /**
   *
   */
  expandList(listEl) {
    this.toggleVisibility(listEl);
    this.toggleVisibility(listEl.nextSibling);
    listEl.parentNode.style.width = `${this.listWidth}px`;
    // TODO Instead of storing "false" remove setting(?)
    this.store(tdom.getListName(listEl.nextSibling), 'collapsed', false);
  }

  /**
   *
   */
  expandSuperList(collapsedList) {
    // const [collapsedList] = $collapsedList;
    this.toggleVisibility(collapsedList);
    const superList = collapsedList.parentNode.querySelector('.super-list');
    this.toggleVisibility(superList);
    superList.parentNode.style.width = `${this.listWidth}px`;
    superList.parentNode.nextSibling.style.display = '';

    const subLists = this.getSubLists(superList);
    subLists[0].style.display = '';
    Array.from(subLists).slice(1).forEach(e => e.parentNode.style.display = '');
    this.store(
        tdom.getListName(superList.parentNode.querySelector('.js-list-content')),
        'super-list-collapsed',
        false);
    this.updateSuperList(subLists[0]);
  }

  /**
   * Toggles a section card. Triggered either when the section icon is
   * clicked or when a section is dragged, in which case it is expanded so that
   * contained cards don't mystically disappear.
   *
   * @param {Element} icon The clicked element (i.e. the icon span)
   * @param {Boolean} updateStorage Whether or not to store state in extension storage
   */
  toggleSection(section, updateStorage = true) {
    let listEl;
    let cards;

    this.toggleSectionIcon(section);

    const placeholderEl = document.querySelector('a.list-card.placeholder');
    const ident = this.sectionIdentifier;

    if (placeholderEl) {
      if (this.debug) {
        console.log('A section was just dragged');
      }
      listEl = tdom.getContainingList(placeholderEl);
      cards = this.findSiblingsUntil(
          placeholderEl.closest('a'),
          (el) => {
            if (el.tagName === 'A' && el.textContent.includes(ident)) {
              return true;
            }
            if (el.classList.contains('card-composer')) {
              return true;
            }
            return false;
          });
    } else {
      // FIXME section is not connected here 💣
      console.log({ section, connected: section.isConnected });
      listEl = tdom.getContainingList(section);
      cards = this.findSiblingsUntil(
          section.closest('a'),
          `a.section-card,div.card-composer`);
    }

    cards.forEach(c => this.toggleVisibility(c));

    // FIXME This might be broken 🔥
    if (updateStorage === true) {
      console.log({ listEl });
      const listName = tdom.getListName(listEl);
      let listSections = this.retrieve(listName, 'sections');
      if (!listSections) {
        listSections = {};
      }
      const title = section.nextElementSibling.textContent;
      listSections[title] = section.classList.contains('icon-collapsed');
      this.store(listName, 'sections', listSections);
    }
  }

  toggleSectionIcon(section) {
    const icon = $(section.parentNode, '.section-icon');
    if (this.isSectionCollapsed(section)) {
      icon.dataset.collapsed = false;
      icon.style.backgroundImage = `url(${this.config.expandedIconUrl})`;
      return;
    }
    icon.dataset.collapsed = true;
    icon.style.backgroundImage = `url(${this.config.collapsedIconUrl})`;
  }

  isSectionCollapsed(section) {
    const icon = $(section.parentNode, '.section-icon');
    return icon.dataset.collapsed === 'true';
  }

  /**
   * Returns an array with siblings following the passed element up until but not including
   * the first element matching the test.
   *
   * The test can be either a query selector string or a test function that takes the an
   * element as input and returns a boolean. (See query selector test function in the function.)
   *
   * @param {Element} element starting element
   * @param {*} test Either a selector string or a test function
   * @returns Array with matching elements
   */
  findSiblingsUntil(element, test) {
    const siblings = [];
    let testFunc;

    if (typeof test === 'string') {
      testFunc = (el) => el.matches(test);
    } else {
      testFunc = test;
    }

    let el = element.nextElementSibling;
    while (el && !testFunc(el)) {
      siblings.push(el);
      el = el.nextElementSibling;
    }
    return siblings;
  }

  /**
   * Toggles visibility of an element, indicating the end state with a boolean.
   *
   * @param {Element} element An element to toggle
   * @param {Boolean} visible Force state to be visible or hidden
   * @returns {Boolean} True if visibility turned on, otherwise false
   */
  toggleVisibility(element, visible) {
    if (!element) {
      return undefined;
    }
    if (visible === true || (element.style.display === 'none' && visible === undefined)) {
      element.style.display = element.dataset.displayState ?? '';
      return true;
    }
    element.dataset.displayState = element.style.display;
    element.style.display = 'none';
    return false;
  }

  /**
   * Helper function to create a node of the given type with optional
   * CSS classes, ID and text content.
   *
   * @param {Object} node An object with node properties
   * @returns The created element
   */
  createNode({ tag, classes = [], style = {}, id = undefined, content = undefined }) {
    const el = document.createElement(tag);
    if (id) {
      el.id = id;
    }
    if (typeof classes === 'string') {
      el.classList.add(classes);
    } else {
      classes.forEach((c) => el.classList.add(c));
    }

    Object.assign(el.style, style);
    // el.style = style;
    if (content !== undefined) {
      el.textContent = content;
    }
    return el;
  }

}

TFolds.LIST_PADDING = 8;
TFolds.MAX_LISTS_IN_BOARD = 100;
TFolds.RESTORE_VIEWSTATE_TIMEOUT = 200;
TFolds.MAX_ATTEMPTS = 3;
TFolds.ATTEMPT_TIMEOUT = 100;
TFolds.FORMAT_CARD_TIMEOUT = 100;
TFolds.LEFTMOST_SUBLIST = 0;
TFolds.DEFAULT_COMPACT_WIDTH = 200;
TFolds.NORMAL_LIST_WIDTH = 272;
TFolds.GLOBAL_BOARD_SETTING_STRING = 'trello-folds-board-settings';

try {
  module.exports = TFolds;
} catch (e) { /* Delib empty */ }
