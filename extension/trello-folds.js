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

  // TODO Replace ...args with actual arguments?
  initialize() {
    tdom.debug = this.config.debug;
    tdom.onBoardChanged((...args) => {
      this.boardChanged(...args);
    });
    tdom.onListModified((...args) => {
      this.listModified(...args);
    });
    tdom.onListAdded((...args) => {
      this.listAdded(...args);
    });
    tdom.onListRemoved((...args) => {
      this.listRemoved(...args);
    });
    tdom.onCardAdded((...args) => {
      this.cardAdded(...args);
    });
    tdom.onCardRemoved((...args) => {
      this.cardRemoved(...args);
    });
    tdom.onCardModified((...args) => {
      this.cardModified(...args);
    });
    tdom.onListTitleModified((...args) => {
      this.listTitleModified(...args);
    });
    tdom.onListDragged((...args) => {
      this.listDragged(...args);
    });
    tdom.onListDropped((...args) => {
      this.listDropped(...args);
    });
    tdom.onBadgesModified((...args) => {
      this.cardBadgesModified(...args);
    });
    tdom.onRedrawBoardHeader((...args) => {
      this.redrawHeader(...args);
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
   *
   */
  boardChanged(boardId, oldId) {
    if (this.debug) {
      console.log(`boardId=${boardId},oldId=${oldId}`);
    }
    this.initStorage();
  }

  /**
   *
   */
  listModified(listEl) {
    if (!listEl) {
      console.error('[listEl] not defined');
      return;
    }
    this.showWipLimit(listEl);
  }

  listRemoved(listEl) {
    if (this.isSubList(listEl)) {
      this.redrawCombinedLists();
    }
  }

  /**
   *
   */
  listAdded(listEl) {
    if (!listEl) {
      console.error('[listEl] not defined');
      return;
    }
    this.addFoldingButton(listEl);
    this.addCollapsedList(listEl);
    this.showWipLimit($(listEl).find('.js-list-content')[0]);
    this.redrawCombinedLists();
  }

  listDragged(listEl) {
    const list = listEl.querySelector('.js-list-content');
    if (this.isSubList(list)) {
      const $subs = this.getSubLists(list);
      const self = this;
      $subs.each(function () {
        self.restoreSubList($(this));
      });
    }
    // const $list = $(listEl).find('.js-list-content');
    // if (this.isSubList($list)) {
    // }
  }

  listDropped() {
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
    }, 100);
  }

  /**
   * Called when a card is removed from a list. In practice this method
   * is invoked when a card is dragged and used to expand cards when a section
   * card is moved.
   *
   * @param {Element} cardEl
   */
  cardRemoved(cardEl) {
    const $cardEl = $(cardEl);
    if ($cardEl.hasClass('section-card')) {
      $cardEl.find('div.list-card-details').css('opacity', '0.0');
      // $cardEl.find("span#section-title").css("background-color", "#dfe3e6");
      const $section = $cardEl.find('.icon-collapsed');
      if ($section.length !== 0) {
        this.toggleSection($section[0]);
      }
    }
  }

  cardBadgesModified(cardEl) {
    const $c = $(cardEl);
    if ($c.find(".badge-text:contains('Blocked'),.badge-text:contains('blocked')").length !== 0) {
      $c.addClass('blocked-card');
      $c.find('.list-card-title').addClass('blocked-title');
      $c.find('div.badge').children().addClass('blocked-badges');
    } else {
      $c.removeClass('blocked-card');
      $c.find('.list-card-title').removeClass('blocked-title');
      $c.find('div.badge').children().removeClass('blocked-badges');
    }
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
    const $c = $(cardEl);

    $c.removeClass('comment-card');

    this.checkSectionChange($c, title, oldTitle);

    if (!this.isSection(title)) {
      if (title.indexOf('//') === 0) {
        $c.addClass('comment-card');
      }
    }

    this.showWipLimit(tdom.getContainingList(cardEl));
  }

  /**
   * Checks if section state changed. There are basically
   * three changes that we need to handle:
   * 1. A section card's title changed
   * 2. A card was changed __into__ a section
   * 3. A card was changed __from__ a section to a normal card
   * In addition for item 2 and 3 above the list WIP has to be updated
   */
  checkSectionChange($c, title, oldTitle) {
    if (!this.isSection(title) && !this.isSection(oldTitle)) {
      return;
    }

    /*
     * Case 1: Only title changed (was, and still is, a section)
     */
    if (this.isSection(title) && this.isSection(oldTitle)) {
      $c.find('#section-title').text(this.getStrippedTitle(title));
      return;
    }

    /*
     * Case 3: A card was changed from a section
     */
    if (!this.isSection(title)) {
      this.removeSectionFormatting($c);
    } else {
      /*
       * Case 2: Was a normal card now a section
       */
      this.formatAsSection($c[0]);
    }
  }

  /**
   * Removes any section formatting for the specified card.
   *
   * @param {jQuery} $card The card to strip
   */
  removeSectionFormatting($card) {
    $card.find('span.icon-expanded,span.icon-collapsed').remove();
    $card.find('span#section-title').remove();
    $card.find('span.list-card-title').show();
    $card.find('div.list-card-details').css('opacity', '1.0');
    $card.removeClass('section-card');
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

  /**
   *
   */
  initStorage() {
    this.boardId = tdom.getBoardIdFromUrl();

    chrome.storage.sync.get(['settings', this.boardId], result => {
      if (this.config.debug) {
        console.table(result.settings);
        if (result.settings['rememberViewStates'] === true) {
          console.table(result[this.boardId]);
        }
      }
      if (result['settings']) {
        this.settings = result['settings'];
      }
      this.storage = result[this.boardId] || {};
      this.setupBoard();
    });
  }

  /**
   * This method is called when the extension is first loaded and when
   * a new board is loaded.
   */
  setupBoard(attemptCount = 1) {
    const $canvas = $('div.board-canvas');
    if (!$canvas.length) {
      /*
       * Trying to find the board again in 100 ms if not found directly.
       * Should not happen after changes to ``tdom.js`` but let's play it safe and
       * keep it - changing log level to warn.
       */
      if (attemptCount < 3) {
        setTimeout(() => {
          console.warn(`Trying to find DIV.board-canvas again (attempt ${attemptCount + 1})`);
          this.setupBoard(attemptCount + 1);
        }, 100);
        return;
      }
      throw ReferenceError(`DIV.board-canvas not found after ${attemptCount} attempts`);
    }

    if (this.config.debug) {
      console.info('%cSetting up board', 'font-weight: bold;');
    }

    this.cleanupStorage();
    this.formatCards();

    this.formatLists();

    this.addBoardIcons();

    this.compactMode = this.retrieveGlobalBoardSetting('compactMode');

    if (this.settings.rememberViewStates) {
      setTimeout(() => {
        this.restoreSectionsViewState();
      }, 200);
    } else {
      this.clearViewState();
    }
  }

  /**
   * Adds board wide buttons to the top bar.
   */
  addBoardIcons() {
    const $boardBtns = $('div.board-header-btns.mod-right');

    $boardBtns.prepend('<span class="board-header-btn-divider"></span>');

    /*
            * COMPACT MODE
            */
    $boardBtns.prepend(`<a id='toggle-compact-mode' class='board-header-btn board-header-btn-without-icon board-header-btn-text compact-mode-disabled'>
                                              <span class=''>Compact Mode</span></a>`);
    $('a#toggle-compact-mode').click(() => {
      this.setCompactMode(!this.compactMode);
    });

    /*
            * REDRAW BOARD
            */
    $boardBtns.prepend(`<a id='redraw-board' class='board-header-btn board-header-btn-without-icon board-header-btn-textboard-header-btn board-header-btn-without-icon board-header-btn-text'>
                                              <span class=''>Redraw</span></a>`);
    $('a#redraw-board').click(() => {
      this.formatLists();
      this.formatCards();
    });
  }

  /**
   * Sets the compact mode for the current board and stores the setting.
   *
   * @param {boolean} enabled `true` if compact mode should be enabled, otherwise `false`
   */
  setCompactMode(enabled) {
    this.updateCompactModeButtonState(enabled);
    this.updateWidths();
    this.storeGlobalBoardSetting('compactMode', enabled);
  }

  updateCompactModeButtonState(enabled) {
    const $btn = $('a#toggle-compact-mode');
    if (enabled) {
      $btn.addClass('compact-mode-enabled');
      $btn.removeClass('compact-mode-disabled');
    } else {
      $btn.addClass('compact-mode-disabled');
      $btn.removeClass('compact-mode-enabled');
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
    const $lists = tdom.getLists();
    const self = this;
    $lists.each(function () {
      const $l = $(this);
      const $sections = tdom.getCardsInList(this, self.sectionIdentifier);
      const sectionStates = self.retrieve(tdom.getListName($l), 'sections');
      if (!sectionStates) {
        return;
      }
      $sections.each(function () {
        const cardName = tdom.getCardName($(this));
        if (sectionStates[self.getStrippedTitle(cardName)] === true) {
          const $section = $(this).find('.icon-expanded');
          self.toggleSection($section[0], false);
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
    this.splitAllCombined();
    this.combineLists();
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
    const $lists = tdom.getLists();
    for (let i = 0; i < $lists.length; ++i) {
      if (tdom.getListName($lists[i]).indexOf('.') === -1 || i === $lists.length - 1) {
        this.restoreSubList($lists.eq(i));
        continue;
      }
      if (this.areListsRelated($lists[i], $lists[i + 1])) {
        const numInSet = this.createCombinedList($lists.eq(i), i);
        i += numInSet - 1;
      } else {
        this.restoreSubList($lists.eq(i));
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
  createCombinedList($list, superListIndex) {
    const numOfSubLists = this.convertToSubList($list, superListIndex) + 1;
    if (this.debug) {
      console.log(`numOfSubLists=${numOfSubLists}`);
    }
    if (numOfSubLists < 2) {
      if (this.debug) {
        console.warn('Expected number of lists to be combined to be at least two');
      }
      return null;
    }
    $list.data('numOfSubLists', numOfSubLists);
    this.addSuperList($list[0]);
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
  convertToSubList($list, superListIndex, idx = 0) {
    console.log({ $list, superListIndex, idx });
    if ($list.hasClass('sub-list')) {
      if (this.debug) {
        console.warn(`List [${tdom.getListName($list[0])}] already combined with other list`);
      }
      throw new Error();
    }
    $list[0].setAttribute('data-sublistindex', idx);
    $list[0].setAttribute('data-super-list-index', superListIndex);
    $list.addClass('sub-list');
    $list.data('sublistindex', idx);
    this.removeFoldingButton($list);
    this.showWipLimit($list);

    this.attachListResizeDetector($list);

    const nextEl = tdom.getNextList($list);
    if (nextEl) {
      const $nextList = $(nextEl);
      if ($nextList !== null && this.areListsRelated($list, $nextList)) {
        console.log('Attaching to next list', idx);
        return this.convertToSubList($nextList, superListIndex, idx + 1);
      }
    }
    return idx;
  }

  /**
   * Attaches a "height change detector" to the target list. It triggers
   * a `resized` event if a change is detected.
   *
   * The detector detaches itthis when the list is no longer a sub list
   * and when the list is no longer in the DOM.
   *
   * If the method is called several times on same list no additional
   * detectors are added.
   *
   * @param {jQuery} $list The target list
   */
  attachListResizeDetector($list) {
    if ($list.data('hasDetector') === true) {
      console.log('Detector already exists: ', tdom.getListName($list[0]));
      return;
    }
    if (this.debug) {
      console.log('Attaching resize detector: ', tdom.getListName($list[0]));
    }
    $list.data('hasDetector', true);

    const self = this;
    function callback() {
      /*
       * If list not visible or not a sub list anymore, stop tracking
       * height changes
       */
      if (!jQuery.contains(document, $list[0])) {
        if (self.debug) {
          console.log(
              `Detaching resize detector (list no longer in DOM): [${tdom.getListName($list[0])}]`);
        }
        $list.data('hasDetector', false);
        return;
      }
      if (!$list.is(':visible') || $list.data('sublistindex') === undefined) {
        if (self.debug) {
          console.log(
              `Detaching resize detector (no longer sub list): [${tdom.getListName($list[0])}]`);
        }
        $list.data('hasDetector', false);
        return;
      }
      if ($list.height() !== $list.data('oldHeight')) {
        console.log(`HEIGHT CHANGE:${tdom.getListName($list)}`);
        $list.data('oldHeight', $list.height());
        $(self.getMySuperList($list)).trigger('resized', $list[0]);
      }
      requestAnimationFrame(callback);
    }

    $list.data('oldHeight', $list.height());

    requestAnimationFrame(callback);
  }

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
    console.log({ name1, name2 });
    return name1.includes('.')
      && (name1.substr(0, name1.indexOf('.')) === name2.substr(0, name2.indexOf('.')));
  }

  splitAllCombined() {
    let $subLists = $('.sub-list');
    let n = 0;
    const self = this;
    while ($subLists.length > 0 && n < 100) {
      const $sls = self.getSubLists($subLists[0]);
      $sls.forEach(e => {
        this.restoreSubList(e);
      });
      $subLists = $('.sub-list');
      n++;
    }
    if (n === 100) {
      console.error('Something went wrong splitting sub lists');
      console.trace();
      console.log($subLists);
    }
  }

  // /**
  //  * Splits the lists into two ordinary lists assuming they are combined
  //  * and no longer matches.
  //  *
  //  * This would typically happen if a list is moved around or its title changed.
  //  *
  //  * @param {jQuery} $list The list object for the list being modified
  //  * @return {boolean} `true` if lists split, otherwise `false`
  //  */
  // splitLists($list) {
  //   if (!this.isSubList($list)) {
  //     console.warn("Called splitLists() with a list that isn't a sublist", $list);
  //     return false;
  //   }

  //   let $leftList;
  //   let $rightList;

  //   if (this.isFirstSubList($list)) {
  //     $leftList = $list;
  //     $rightList = $list.parent().next().find('.js-list-content');
  //     console.info($rightList);
  //     if (!this.isSubList($rightList)) {
  //       console.warn('List to right not a sub list');
  //       return false;
  //     }
  //   } else {
  //     $rightList = $list;
  //     $leftList = $list.parent().prev().find('.js-list-content');
  //     console.info($leftList);
  //     if (!this.isSubList($leftList)) {
  //       console.warn('List to left not a sub list');
  //       return false;
  //     }
  //   }

  //   if (this.areListsRelated($leftList, $rightList)) {
  //     return false;
  //   }

  //   this.restoreSubList($leftList);
  //   this.restoreSubList($rightList);

  //   return true;
  // }

  /**
   * Checks if the specified list is the first sub list of a set of
   * combined lists.
   *
   * @param {jQuery} $list The target list
   * @returns `true` if first sub list of set otherwise `false`
   */
  isFirstSubList($list) {
    return ($list.data('sublistindex') === TFolds.LEFTMOST_SUBLIST);
  }

  /**
   * Restores the target list to a "normal" list by removing all sub list
   * related data and restoring the folding button and WiP limit stuff.
   *
   * @param {jQuery} $list The target list
   */
  restoreSubList(list) {
    const $list = $(list);
    if ($list.data('sublistindex') === 0) {
      $list.parent().find('.super-list,.super-list-collapsed').remove();
    }
    $list.removeData(['sublistindex']);
    $list.removeClass('sub-list');
    this.addFoldingButton($list[0]);
    this.showWipLimit($list[0]);
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
    const superList = document.createElement('div');
    superList.className = 'super-list';
    const title = document.createElement('span');
    title.className = 'super-list-header';
    const extras = document.createElement('div');
    extras.className = 'list-header-extras';

    title.appendChild(extras);
    superList.dataset.superList = true;
    superList.appendChild(title);

    this.addFoldingButton(superList);

    listEl.parentNode.insertBefore(superList, listEl.parentNode.firstChild);

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
    const $superList = $(superList);
    try {
      const $collapsedList
        = $(`<div style="display: none" class="super-list-collapsed list"><span class="list-header-name">EMPTY</span></div>`);
      $superList.parent().prepend($collapsedList);
      $collapsedList.click(() => {
        this.expandSuperList($collapsedList);
        return false;
      });
      if (this.settings.rememberViewStates) {
        const collapsed = this.retrieve(
            tdom.getListName($superList.siblings('.js-list-content')), 'super-list-collapsed');
        if (collapsed === true) {
          this.collapseSuperList($superList[0]);
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
  updateSuperListHeight($list) {
    if (!$list) {
      throw new TypeError('Parameter [$l] undefined');
    }
    if (!this.isSubList($list[0])) {
      throw new TypeError('Parameter [$l] not sublist');
    }
    const height = this.findSuperListHeight($list);
    const $superList = $(this.getMySuperList($list));
    $superList.css('height', height);
  }

  findSuperListHeight($list) {
    const { superListIndex } = $list[0].dataset;
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
       * @param {jQuery} $subList The sub list
       * @returns {jQuery} The super list DIV element jQuery object
       */
  getMySuperList($subList) {
    // let $l;
    const { superListIndex } = $subList[0].dataset;
    return tdom.getListWrapperByIndex(superListIndex).querySelector('div.super-list');
    // if ($subList.data('sublistindex') === TFolds.LEFTMOST_SUBLIST) {
    //   $l = $subList;
    // } else {
    //   $l = $subList.data('firstList');
    // }
    // return $l.siblings('div.super-list');
  }

  /**
   *
   * @param {*} subList
   * @returns
   */
  updateSuperList(subList) {
    const $subList = $(subList);
    // let $sl;
    // $sl = $subList.data('firstList');
    const listIndex = subList.dataset.superListIndex;
    const wrapper = tdom.getListWrapperByIndex(listIndex);
    const $sl = $(wrapper.querySelector(`[data-super-list-index="${listIndex}"]`));
    const $superList = $(this.getMySuperList($subList));
    const $title = $superList.find('span.super-list-header');

    $title.find('span.wip-limit-title').remove();

    /*
     * Get the WiP limit from the left list
     */
    const wipLimit = this.extractWipLimit($sl);

    /*
     * Calculate tot # of cards
     */
    const n = $sl.data('numOfSubLists');
    let totNumOfCards = 0;
    let listEl = $sl[0];
    for (let i = 0; i < n; ++i) {
      totNumOfCards += this.countWorkCards(listEl);
      listEl = tdom.getNextList(listEl);
    }

    let title = tdom.getListName($sl);
    title = title.substr(0, title.indexOf('.'));
    let $wipTitle;
    $wipTitle = this.createWipTitle(title, totNumOfCards, wipLimit);
    this.updateWipBars($superList, totNumOfCards, wipLimit);
    $title.append($wipTitle);
    this.updateSuperListHeight($sl);
    this.updateCollapsedSuperList($superList, $wipTitle.clone());

    this.updateWidths();

    return $wipTitle;
  }

  /**
       * Updates the width of every list and super list. Ensures lists are drawn correctly in compact mode
       * and that combined list backdrops are rendered correctly.
       */
  updateWidths() {
    $('div.list-wrapper:not(:has(>div.list-collapsed:visible)):not(:has(>div.super-list-collapsed:visible))').css('width', `${this.listWidth}px`);

    const $supersets = $('div.super-list');
    for (let i = 0; i < $supersets.length; ++i) {
      const $ss = $supersets.eq(i);
      const n = $ss.siblings('div.js-list-content').data('numOfSubLists');
      const w = (this.listWidth + 8) * n - 8;
      $ss.css('width', `${w}px`);
    }
  }

  /**
       *
       */
  updateCollapsedSuperList($superList, $wipTitle) {
    const $header = $superList.parent().find('.super-list-collapsed > span.list-header-name');
    $header.empty().append($wipTitle);
  }

  // #region COMBINED LISTS

  /**
       *
       */
  makeListsFoldable() {
    const $lists = $('div.list-wrapper');
    const self = this;
    $lists.each(function () {
      self.addFoldingButton(this);
      self.addCollapsedList(this);
    });
  }

  /**
   *
   */
  addFoldingButton(listEl) {
    const $l = $(listEl);

    if ($l.find('.js-list-content').data('sublistindex') !== undefined) {
      return;
    }

    const $header = $l.find('div.list-header-extras');
    $header.find('.icon-close').parent().remove();
    const $foldIcon = this.createFoldIcon();

    const self = this;
    $foldIcon.click(function () {
      const $l = $(this).closest('.list');
      if ($l.length === 1) {
        self.collapseList($l[0]);
      } else {
        if ($l.length !== 0) {
          console.error('Expected to find ONE list or super list');
          return;
        }
        self.collapseSuperList($(this).closest('.super-list')[0]);
      }
      return false;
    });
    $header.append($foldIcon);
  }

  createFoldIcon() {
    return $('<a class="list-header-extras-menu dark-hover" href="#"><span class="icon-sm icon-close dark-hover"/></a>');
  }

  /**
       *
       */
  removeFoldingButton($list) {
    const [listEl] = $list;
    const foldingButton = listEl.querySelector('span.icon-close');
    if (!foldingButton) {
      this.debug && console.log(`Folding button not found for list: ${tdom.getListName(listEl)}`);
      return;
    }
    foldingButton.parentNode.remove();
  }

  /**
   *
   */
  addCollapsedList(listEl) {
    const $l = $(listEl);
    if ($l.hasClass('js-add-list')) {
      return;
    }
    /*
     * If list already contains an element with list-collapsed class
     * this method is called from "redraw"
     */
    if ($l.find('.list-collapsed').length !== 0) {
      if (this.debug) {
        console.log("There's already a list-collapsed elementish");
      }
      return;
    }
    $l.css({
      'position': 'relative',
    });
    try {
      const name = tdom.getListName(listEl);
      const $collapsedList = $(`<div style="display: none" class="list-collapsed list"><span class="list-header-name">${name}</span></div>`);
      $collapsedList.click(() => {
        /*
                    * Call expandList with the list wrapper as argument
                    */
        this.expandList($collapsedList);
        return false;
      });
      $l.prepend($collapsedList);
      if (this.settings.rememberViewStates) {
        const collapsed = this.retrieve(tdom.getListName($l), 'collapsed');
        if (collapsed === true) {
          this.collapseList($l.find('.list').first().next()[0]);
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
    let $wipLists;
    if (this.settings.alwaysCount === true) {
      $wipLists = tdom.getLists();
    } else {
      $wipLists = tdom.getLists(/\[([0-9]*?)\]/);
    }
    const self = this;
    $wipLists.each(function () {
      self.showWipLimit(this);
    });
  }

  /**
   *
   */
  showWipLimit(listEl) {
    let $l;
    let lEl;
    if (listEl instanceof jQuery) {
      $l = listEl;
      lEl = listEl[0];
    } else {
      $l = $(listEl);
      lEl = listEl;
    }
    const numCards = this.countWorkCards(lEl);
    const wipLimit = this.extractWipLimit(lEl);
    const subList = $l.data('sublistindex');
    this.removeWipLimit($l);
    if (subList !== undefined) {
      this.addWipLimit($l, numCards);
      this.updateSuperList(lEl);
      $l.removeClass('wip-limit-reached').removeClass('wip-limit-exceeded');
      $l.prev().removeClass('collapsed-limit-reached').removeClass('collapsed-limit-exceeded');
    } else if (wipLimit !== null) {
      this.addWipLimit($l, numCards, wipLimit);
      this.updateWipBars($l, numCards, wipLimit);
    } else if (this.settings.alwaysCount === true) {
      this.addWipLimit($l, numCards);
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
  updateWipBars($l, numCards, wipLimit) {
    if (typeof wipLimit === 'number' && this.settings.enableTopBars) {
      if (numCards === wipLimit) {
        $l.addClass('wip-limit-reached').removeClass('wip-limit-exceeded');
        $l.siblings('.list-collapsed,.super-list-collapsed').addClass('collapsed-limit-reached').removeClass('collapsed-limit-exceeded');
        return;
      } else if (numCards > wipLimit) {
        $l.removeClass('wip-limit-reached').addClass('wip-limit-exceeded');
        $l.siblings('.list-collapsed,.super-list-collapsed').removeClass('collapsed-limit-reached').addClass('collapsed-limit-exceeded');
        return;
      }
    }
    this.removeWipBar($l);
  }

  /**
   *
   */
  removeWipLimit($l) {
    $l.find('span.wip-limit-title').remove();
    const $header = $l.find('.list-header');
    $header.find('textarea').show();
    this.removeWipBar($l);
  }

  /**
   *
   */
  removeWipBar($l) {
    $l.removeClass('wip-limit-reached').removeClass('wip-limit-exceeded');
    $l.prev().removeClass('collapsed-limit-reached').removeClass('collapsed-limit-exceeded');
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
  addWipLimit($l, numCards, wipLimit) {
    let strippedTitle;

    $l.find('span.wip-limit-title').remove();
    const title = tdom.getListName($l[0]);

    if (title.indexOf('[') !== -1) {
      strippedTitle = title.substr(0, title.indexOf('['));
    } else {
      strippedTitle = title;
    }

    if (this.isSubList($l[0])) {
      strippedTitle = strippedTitle.substr(strippedTitle.indexOf('.') + 1);
    }

    this.addWipListTitle($l, numCards, !this.isSubList($l[0]) ? wipLimit : null, strippedTitle);
  }

  /**
   *
   * @param {*} $l
   * @param {*} numCards
   * @param {*} wipLimit
   * @param {*} strippedTitle
   */
  addWipListTitle($l, numCards, wipLimit, strippedTitle) {
    let $wipTitle;
    const $header = $l.find('.list-header');

    $wipTitle = this.createWipTitle(strippedTitle, numCards, wipLimit);

    $l.parent().find('div.list-collapsed').empty().append($wipTitle);
    $wipTitle = $wipTitle.clone();
    $header.off('click').click(function (e) {
      $(this).find('.wip-limit-title').hide();
      $(this).find('textarea').show().select();
      return !$(e.target).hasClass('wip-limit-badge');
    });
    $header.find('textarea').hide().off('blur').blur(() => {
      this.showWipLimit($l);
    });
    $header.append($wipTitle);
  }

  /**
   *
   */
  createWipTitle(title, numCards, wipLimit) {
    let $wipTitle;

    if (!(typeof wipLimit === 'number')) {
      const countBadge = this.settings.alwaysCount ? `<span class="wip-limit-badge">${numCards}</span>` : '';
      $wipTitle = $(`<span class="wip-limit-title">${title} ${countBadge}</span>`);
    } else {
      $wipTitle = $(`<span class="wip-limit-title">${title} <span class="wip-limit-badge">${numCards} / ${wipLimit}</span></span>`);
      if (numCards === wipLimit) {
        $wipTitle.find('.wip-limit-badge').css('background-color', '#fb7928');
      } else if (numCards > wipLimit) {
        $wipTitle.find('.wip-limit-badge').css('background-color', '#b04632');
      }
    }

    return $wipTitle;
  }

  /**
   *
   */
  formatCards() {
    const $cards = tdom.getCardsByName('', false);
    if (this.config.debug) {
      console.groupCollapsed('Formatting cards');
    }
    const self = this;
    $cards.each(function () {
      self.formatCard(this);
    });
    if (this.config.debug) {
      console.groupEnd();
    }
  }

  /**
   *
   */
  formatCard(cardEl) {
    const cardName = tdom.getCardName($(cardEl));

    if (cardName.indexOf(this.sectionIdentifier) === 0) {
      if (this.config.debug) {
        console.info(`Card [${cardName}] is a section`);
      }
      this.formatAsSection(cardEl);
    } else if (cardName.indexOf('//') === 0) {
      if (this.config.debug) {
        console.info(`Card [${cardName}] is a comment`);
      }
      cardEl.classList.add('comment-card');
    } else if ($(cardEl).find(
        ".badge-text:contains('Blocked'),.badge-text:contains('blocked')").length !== 0) {
      if (this.config.debug) {
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
      console.log(`Formatting as section: ${tdom.getCardName($(card))}`);
    }
    if (card.querySelector('#section-title')) {
      this.debug && console.log('Section title already exists');
      return;
    }
    const icon = document.createElement('span');
    icon.className = 'icon-expanded';
    icon.onclick = (event) => {
      console.log(event.target);
      this.toggleSection(event.target);
      event.stopPropagation();
      return false;
    };

    const strippedTitle = this.getStrippedTitle(tdom.getCardName($(card)));

    const strippedTitleEl = document.createElement('span');
    strippedTitleEl.id = 'section-title';
    strippedTitleEl.textContent = strippedTitle;

    card.insertBefore(strippedTitleEl, card.firstChild);
    card.insertBefore(icon, card.firstChild);
    this.toggleVisibility(card.querySelector('span.list-card-title'), false);
    card.classList.add('section-card');
  }

  /**
   * Collapse one list.
   *
   * @param {Element} listEl List element to collapse
   */
  collapseList(listEl) {
    console.log({ listEl });
    this.toggleVisibility(listEl);
    this.toggleVisibility(listEl.previousSibling);
    listEl.parentNode.style.width = '40px';
    console.log(listEl.previousSibling);
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
      const listEl = tdom.getListWrapperByIndex(idx);
      firstSubList = listEl.querySelector(`[data-super-list-index="${idx}"]`);
    }

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
  expandList($list) {
    const [listEl] = $list;

    this.toggleVisibility(listEl);
    this.toggleVisibility(listEl.nextElementSibling);
    listEl.parentNode.style.width = `${this.listWidth}px`;
    // TODO Instead of storing "false" remove setting(?)
    this.store(tdom.getListName($list.next()), 'collapsed', false);
  }

  /**
   *
   */
  expandSuperList($collapsedList) {
    const [collapsedList] = $collapsedList;
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
   * @param {Element} section The card element
   * @param {Boolean} updateStorage Whether or not to store state in extension storage
   */
  toggleSection(section, updateStorage = true) {
    let listEl;
    let cards;

    section.classList.toggle('icon-collapsed');
    section.classList.toggle('icon-expanded');

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
      listEl = tdom.getContainingList(section);
      cards = this.findSiblingsUntil(
          section.closest('a'),
          `a.section-card,div.card-composer`);
    }

    cards.forEach(c => this.toggleVisibility(c));

    if (updateStorage === true) {
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
    if (visible === true || (element.style.display === 'none' && visible === undefined)) {
      element.style.display = element.dataset.displayState ?? '';
      return;
    }
    element.dataset.displayState = element.style.display;
    element.style.display = 'none';
  }

}

TFolds.LEFTMOST_SUBLIST = 0;
TFolds.DEFAULT_COMPACT_WIDTH = 200;
TFolds.NORMAL_LIST_WIDTH = 272;
TFolds.GLOBAL_BOARD_SETTING_STRING = 'trello-folds-board-settings';
