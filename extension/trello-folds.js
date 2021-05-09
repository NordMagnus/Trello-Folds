// eslint-disable-next-line no-unused-vars
/* global chrome */
import { tdom } from './tdom.js';

class tfolds {

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
    this.compactMode = false;
    this.storage = {};
    this.boardId = undefined;
    this.config = {
      debug: true,
      collapsedIconUrl: null,
      expandedIconUrl: null,
    };
  }

  get config() {
    return this.config;
  }

  get debug() {
    return this.config.debug;
  }

  /**
       * Sets the debug flag. The module will output messages to the console
       * when set to `true`.
       *
       * @param {boolean} debug `true` to spam console, otherwise `false`
       */
  set debug(debug) {
    this.config.debug = debug;
  }

  get boardId() {
    return this.boardId;
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
    return this.compactMode;
  }

  set compactMode(status) {
    this.compactMode = status;
  }

  get listWidth() {
    let width = tfolds.NORMAL_LIST_WIDTH;
    if (this.compactMode) {
      width = this.settings.compactListWidth || tfolds.DEFAULT_COMPACT_WIDTH;
    }
    return Number(width);
  }

  initialize() {
    tdom.debug = this.config.debug;
    tdom.onBoardChanged(this.boardChanged);
    tdom.onListModified(this.listModified);
    tdom.onListAdded(this.listAdded);
    tdom.onListRemoved(this.listRemoved);
    tdom.onCardAdded(this.cardAdded);
    tdom.onCardRemoved(this.cardRemoved);
    tdom.onCardModified(this.cardModified);
    tdom.onListTitleModified(this.listTitleModified);
    tdom.onListDragged(this.listDragged);
    tdom.onListDropped(this.listDropped);
    tdom.onBadgesModified(this.cardBadgesModified);
    tdom.onRedrawBoardHeader(this.redrawHeader);
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
    if (this.isSubList($(listEl))) {
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
    // TODO Make functions take $ param instead
    this.addFoldingButton(listEl);
    this.addCollapsedList(listEl);
    this.showWipLimit($(listEl).find('.js-list-content')[0]);
    this.redrawCombinedLists();
  }

  listDragged(listEl) {
    const $list = $(listEl).find('.js-list-content');
    if (this.isSubList($list)) {
      const $subs = this.getSubLists($list);
      $subs.each(function () {
        this.restoreSubList($(this));
      });
    }
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
      this.formatAsSection($c);
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
    this.setCompactMode(this.compactMode);

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
    $lists.each(function () {
      const $l = $(this);
      const $sections = tdom.getCardsInList(this, this.sectionIdentifier);
      const sectionStates = this.retrieve(tdom.getListName($l), 'sections');
      if (!sectionStates) {
        return;
      }
      $sections.each(function () {
        const cardName = tdom.getCardName($(this));
        if (sectionStates[this.getStrippedTitle(cardName)] === true) {
          const $section = $(this).find('.icon-expanded');
          this.toggleSection($section[0], false);
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
    this.store(tfolds.GLOBAL_BOARD_SETTING_STRING, key, value);
  }

  /**
       * Retrieves a board wide setting.
       *
       * @param {String} key the preference to retrieve
       * @see #storeGlobalBoardSetting()
       * @see #retrieve()
       */
  retrieveGlobalBoardSetting(key) {
    return this.retrieve(tfolds.GLOBAL_BOARD_SETTING_STRING, key);
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
        const numInSet = this.createCombinedList($lists.eq(i));
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
       * - _subListIndex_ holds the sub list index in the set
       * - _firstList_ holds a reference to the first list in the set, i.e the list this method
       *   is called with. The first list holds a reference to itthis for convenience purposes.
       *
       * @param {jQuery} $list The leftmost list in the combined set to create
       * @returns {Number} The number of lists in the set
       */
  createCombinedList($list) {
    const numOfSubLists = this.convertToSubList($list) + 1;
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
    this.addSuperList($list);
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
  convertToSubList($list, idx = 0, id = 0, $firstList) {
    if ($list.hasClass('sub-list')) {
      if (this.debug) {
        console.warn(`List [${tdom.getListName($list[0])}] already combined with other list`);
      }
      return idx;
    }
    const myId = id || Date.now();
    $list.addClass('sub-list');
    $list.data('subListIndex', idx);
    $list.data('firstList', $firstList || $list);
    $list.attr('data-id', myId);
    this.removeFoldingButton($list);
    this.showWipLimit($list);

    this.attachListResizeDetector($list);

    const nextEl = tdom.getNextList($list);
    if (nextEl) {
      const $nextList = $(nextEl);
      if ($nextList !== null && this.areListsRelated($list, $nextList)) {
        return this.convertToSubList($nextList, idx + 1, myId, $firstList || $list);
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

    // let ts = Date.now();
    function callback() { // timestamp
      // if (Date.now() - ts > 2000) {
      //     ts = Date.now();
      //     if (tdom.getListName($list) === "Delta.Sub2") {
      //         console.log("Change detector invoked");
      //     }
      // }
      /*
                * If list not visible or not a sub list anymore, stop tracking
                * height changes
                */
      if (!jQuery.contains(document, $list[0])) {
        if (this.debug) {
          console.log(`Detaching resize detector (list no longer in DOM): [${tdom.getListName($list[0])}]`);
        }
        $list.data('hasDetector', false);
        return;
      }
      if (!$list.is(':visible') || $list.data('subListIndex') === undefined) {
        if (this.debug) {
          console.log(`Detaching resize detector (no longer sub list): [${tdom.getListName($list[0])}]`);
        }
        $list.data('hasDetector', false);
        return;
      }
      if ($list.height() !== $list.data('oldHeight')) {
        console.log(`HEIGHT CHANGE:${tdom.getListName($list)}`);
        $list.data('oldHeight', $list.height());
        this.getMySuperList($list).trigger('resized', $list[0]);
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
    return name1.includes('.') && (name1.substr(0, name1.indexOf('.')) === name2.substr(0, name2.indexOf('.')));
  }

  splitAllCombined() {
    let $subLists = $('.sub-list');
    let n = 0;
    while ($subLists.length > 0 && n < 100) {
      const $sls = this.getSubLists($subLists.eq(0));
      $sls.each(function () {
        this.restoreSubList($(this));
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
    if (!this.isSubList($list)) {
      console.warn("Called splitLists() with a list that isn't a sublist", $list);
      return false;
    }

    let $leftList;
    let $rightList;

    if (this.isFirstSubList($list)) {
      $leftList = $list;
      $rightList = $list.parent().next().find('.js-list-content');
      console.info($rightList);
      if (!this.isSubList($rightList)) {
        console.warn('List to right not a sub list');
        return false;
      }
    } else {
      $rightList = $list;
      $leftList = $list.parent().prev().find('.js-list-content');
      console.info($leftList);
      if (!this.isSubList($leftList)) {
        console.warn('List to left not a sub list');
        return false;
      }
    }

    if (this.areListsRelated($leftList, $rightList)) {
      return false;
    }

    this.restoreSubList($leftList);
    this.restoreSubList($rightList);

    return true;
  }

  /**
       * Checks if the specified list is the first sub list of a set of
       * combined lists.
       *
       * @param {jQuery} $list The target list
       * @returns `true` if first sub list of set otherwise `false`
       */
  isFirstSubList($list) {
    return ($list.data('subListIndex') === tfolds.LEFTMOST_SUBLIST);
  }

  /**
       * Restores the target list to a "normal" list by removing all sub list
       * related data and restoring the folding button and WiP limit stuff.
       *
       * @param {jQuery} $list The target list
       */
  restoreSubList($list) {
    if ($list.data('subListIndex') === 0) {
      $list.parent().find('.super-list,.super-list-collapsed').remove();
    }
    $list.removeData(['subListIndex', 'firstList']);
    $list.removeClass('sub-list');
    this.addFoldingButton($list[0]);
    this.showWipLimit($list[0]);
  }

  /**
       * Checks whether the target list is part of a combined list set.
       *
       * @param {jQuery} $l The list
       * @returns `true` if it is a sub list otherwise `false`
       */
  isSubList($l) {
    if (!$l) {
      throw new TypeError('Parameter [$l] undefined');
    }
    return $l.data('subListIndex') !== undefined;
  }

  addSuperList($list) {
    // let $canvas = $("div#board");
    // let $leftList = $(leftList);
    const $superList = $('<div class="super-list"></div>');
    const $title = $('<span class="super-list-header"></span>');
    const $extras = $('<div class="list-header-extras"></div>');

    $title.append($extras);

    $superList.data('superList', true);

    /*
          * Make list same height as contained lists. This height is also
          * tweaked using CSS padding.
          */
    $superList.append($title);

    this.addFoldingButton($superList[0]);

    $list.parent().prepend($superList);

    this.addCollapsedSuperList($superList);

    this.updateSuperList($list);

    $superList.on('resized', (event, subListEl) => {
      this.updateSuperListHeight($(subListEl));
    });
  }

  /**
       *
       */
  addCollapsedSuperList($superList) {
    try {
      const $collapsedList = $(`<div style="display: none" class="super-list-collapsed list"><span class="list-header-name">EMPTY</span></div>`);
      $superList.parent().prepend($collapsedList);
      $collapsedList.click(() => {
        tfolds.expandSuperList($collapsedList);
        return false;
      });
      if (this.settings.rememberViewStates) {
        const collapsed = this.retrieve(tdom.getListName($superList.siblings('.js-list-content')), 'super-list-collapsed');
        if (collapsed === true) {
          this.collapseSuperList($superList);
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
    if (!this.isSubList($list)) {
      throw new TypeError('Parameter [$l] not sublist');
    }
    const height = this.findSuperListHeight($list);
    const $superList = this.getMySuperList($list);
    $superList.css('height', height);
  }

  findSuperListHeight($list) {
    let $l = $list.data('firstList');
    let maxHeight = 0;
    do {
      if ($l.height() > maxHeight) {
        maxHeight = $l.height();
      }
      $l = $(tdom.getNextList($l[0]));
    } while ($l.data('subListIndex') > 0);
    return maxHeight;
  }

  /**
       * Finds the super list DIV associated with the sub list.
       *
       * @param {jQuery} $subList The sub list
       * @returns {jQuery} The super list DIV element jQuery object
       */
  getMySuperList($subList) {
    let $l;
    if ($subList.data('subListIndex') === tfolds.LEFTMOST_SUBLIST) {
      $l = $subList;
    } else {
      $l = $subList.data('firstList');
    }
    return $l.siblings('div.super-list');
  }

  updateSuperList($subList) {
    let $sl;
    $sl = $subList.data('firstList');

    const $superList = this.getMySuperList($sl);
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
    $lists.each(function () {
      this.addFoldingButton(this);
      this.addCollapsedList(this);
    });
  }

  /**
       *
       */
  addFoldingButton(listEl) {
    const $l = $(listEl);

    if ($l.find('.js-list-content').data('subListIndex') > 0) {
      return;
    }

    const $header = $l.find('div.list-header-extras');
    $header.find('.icon-close').parent().remove();
    const $foldIcon = this.createFoldIcon();

    $foldIcon.click(function () {
      // console.log($(this).closest(".list"));
      const $l = $(this).closest('.list');
      if ($l.length === 1) {
        this.collapseList($l);
      } else {
        if ($l.length !== 0) {
          console.error('Expected to find ONE list or super list');
          return;
        }
        this.collapseSuperList($(this).closest('.super-list'));
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
    const $span = $list.find('div.list-header-extras > a > span.icon-close');
    $span.parent().remove();
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
          this.collapseList($l.find('.list').first().next());
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
    $wipLists.each(function () {
      this.showWipLimit(this);
    });
  }

  /**
       *
       */
  showWipLimit(listEl) {
    const $l = $(listEl);
    const numCards = this.countWorkCards(listEl);
    const wipLimit = this.extractWipLimit(listEl);
    const subList = $l.data('subListIndex');
    this.removeWipLimit($l);
    if (subList !== undefined) {
      this.addWipLimit($l, numCards);
      this.updateSuperList($l);
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

    if (this.isSubList($l)) {
      strippedTitle = strippedTitle.substr(strippedTitle.indexOf('.') + 1);
    }

    this.addWipListTitle($l, numCards, !this.isSubList($l) ? wipLimit : null, strippedTitle);
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
    $cards.each(function () {
      this.formatCard(this);
    });
    if (this.config.debug) {
      console.groupEnd();
    }
  }

  /**
       *
       */
  formatCard(cardEl) {
    const $c = $(cardEl);

    const cardName = tdom.getCardName($c);
    if (cardName.indexOf(this.sectionIdentifier) === 0) {
      if (this.config.debug) {
        console.info(`Card [${cardName}] is a section`);
      }
      this.formatAsSection($c);
    } else if (cardName.indexOf('//') === 0) {
      if (this.config.debug) {
        console.info(`Card [${cardName}] is a comment`);
      }
      $c.addClass('comment-card');
    } else if ($c.find(".badge-text:contains('Blocked'),.badge-text:contains('blocked')").length !== 0) {
      if (this.config.debug) {
        console.info(`Card [${cardName}] is blocked`);
      }
      $c.addClass('blocked-card');
      $c.find('.list-card-title').addClass('blocked-title');
      $c.find('div.badge').children().addClass('blocked-badges');
    }
  }

  /**
       *
       */
  formatAsSection($card) {
    if (this.debug) {
      console.log(`Formatting as section: ${tdom.getCardName($card)}`);
    }
    if ($card.find('#section-title').length !== 0) {
      if (this.debug) {
        console.log('Section title already exists');
      }
      return;
    }
    const $icon = $('<span class="icon-expanded"/>');
    $icon.click(function () {
      tfolds.toggleSection(this);
      return false;
    });
    const strippedTitle = this.getStrippedTitle(tdom.getCardName($card));

    $card.prepend(`<span id="section-title">${strippedTitle}</span>`);
    $card.prepend($icon);
    $card.find('span.list-card-title').hide();
    $card.addClass('section-card');
  }

  /**
       *
       */
  collapseList($list) {
    $list.toggle().prev().toggle().parent().css('width', '40px');
    $list.prev().find('.list-header-name').text(tdom.getListName($list[0]));
    this.store(tdom.getListName($list), 'collapsed', true);
  }

  getSubLists($list) {
    let $firstList;
    if (!this.isSubList($list)) {
      $firstList = $list.siblings('.sub-list');
    } else {
      $firstList = $list.data('firstList');
    }
    const id = $firstList.attr('data-id');
    const $sls = $(`.sub-list[data-id="${id}"]`);
    return $sls;
  }

  /**
       * When collapsing a super list the first contained list's is hidden,
       * and subsequent lists' wrappers are hidden.
       *
       * @param {jQuery} $superList The super list to collapse
       */
  collapseSuperList($superList) {
    $superList.toggle().siblings('.super-list-collapsed').toggle().parent().css('width', '40px').next().hide();
    const $sls = this.getSubLists($superList);
    $sls.eq(0).hide();
    $sls.not(':eq(0)').parent().hide();
    this.store(tdom.getListName($superList.siblings('.js-list-content')), 'super-list-collapsed', true);
  }

  /**
       *
       */
  expandList($list) {
    $list.toggle().next().toggle().parent().css('width', `${this.listWidth}px`);
    // TODO Instead of storing "false" remove setting(?)
    this.store(tdom.getListName($list.next()), 'collapsed', false);
  }

  /**
       *
       */
  expandSuperList($collapsedList) {
    const $superList = $collapsedList.toggle().siblings('.super-list');
    $superList.toggle().parent().css('width', `${this.listWidth}px`).next().show();

    const $sls = this.getSubLists($superList);
    $sls.eq(0).show();
    $sls.not(':eq(0)').parent().show();
    this.store(tdom.getListName($superList.siblings('.js-list-content')), 'super-list-collapsed', false);
    this.updateSuperList($sls.eq(0));
  }

  /**
       *
       */
  toggleSection(section, updateStorage = true) {
    let $l;
    const $s = $(section);
    let $cards;

    $s.toggleClass('icon-collapsed icon-expanded');

    const $placeholder = $('a.list-card.placeholder');
    const ident = this.sectionIdentifier;

    if ($placeholder.length !== 0) {
      if (this.debug) {
        console.log('A section was just dragged');
      }
      $l = $(tdom.getContainingList($placeholder[0]));
      $cards = $placeholder.closest('a').nextUntil(`a:contains('${ident}'),div.card-composer`);
    } else {
      $l = $(tdom.getContainingList(section));
      $cards = $s.closest('a').nextUntil(`a.section-card,div.card-composer`);
    }

    $cards.toggle();

    if (updateStorage === true) {
      let listSections = this.retrieve(tdom.getListName($l), 'sections');
      if (!listSections) {
        listSections = {};
      }
      const title = $s.next().text();
      listSections[title] = $s.hasClass('icon-collapsed');
      this.store(tdom.getListName($l), 'sections', listSections);
    }
  }

}

tfolds.LEFTMOST_SUBLIST = 0;
tfolds.DEFAULT_COMPACT_WIDTH = 200;
tfolds.NORMAL_LIST_WIDTH = 272;
tfolds.GLOBAL_BOARD_SETTING_STRING = 'trello-folds-board-settings';

export default tfolds;
