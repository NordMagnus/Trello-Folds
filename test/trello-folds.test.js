/* eslint-disable max-statements */
/* eslint-disable no-magic-numbers */
const fs = require('fs');
// const { request } = require('http');
const path = require('path');
const TDOM = require('../extension/tdom');
const TFolds = require('../extension/trello-folds');
const html = fs.readFileSync(path.resolve(__dirname, './trello-folds-test-board.html'), 'utf8');
const each = require('jest-each').default;

global.tdom = new TDOM();

global.$ = (a, b) => (typeof a === 'string' ? document.querySelector(a) : a.querySelector(b));
global.$$ = (a, b) => {
  return Array.from(typeof a === 'string' ? document.querySelectorAll(a) : a.querySelectorAll(b));
};
global._$ = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

// #region CARD TEMPLATES

const normalCard = `<div class="list-card-details js-card-details">
                            <div class="list-card-labels js-card-labels"></div>
                            <span class="list-card-title js-card-name" dir="auto">
                                <span class="card-short-id hide">#12</span>
                                C2
                            </span>
                            <div class="badges">
                                <span class="js-badges"></span>
                                <span class="custom-field-front-badges js-custom-field-badges">
                                    <span></span>
                                </span>
                                <span class="js-plugin-badges"><span></span></span>
                            </div>
                            <div class="list-card-members js-list-card-members"></div>
                        </div>`;
const blockedCard = `<div class="list-card-details js-card-details">
                            <div class="list-card-labels js-card-labels"></div>
                            <span class="list-card-title js-card-name blocked-title" dir="auto">
                                <span class="card-short-id hide">#1</span>
                                C1
                            </span>
                            <div class="badges">
                                <span class="js-badges"></span>
                                <span class="custom-field-front-badges js-custom-field-badges">
                                    <span>
                                        <div class="badge">
                                            <span class="icon-sm icon-selection-mode blocked-badges"></span>
                                            <span class="badge-text blocked-badges">Blocked</span>
                                        </div>
                                        <div class="badge">
                                            <span class="badge-text blocked-badges">Team: Team Foo</span>
                                        </div>
                                    </span>
                                </span>
                                <span class="js-plugin-badges">
                                    <span></span>
                                </span>
                            </div>
                            <div class="list-card-members js-list-card-members"></div>
                        </div>`;
const commentCard = `<div class="list-card-details js-card-details comment-card">
                            <div class="list-card-labels js-card-labels"></div>
                            <span class="list-card-title js-card-name" dir="auto">
                                <span class="card-short-id hide">#12</span>
                                // C2
                            </span>
                            <div class="badges">
                                <span class="js-badges"></span>
                                <span class="custom-field-front-badges js-custom-field-badges">
                                    <span></span>
                                </span>
                                <span class="js-plugin-badges"><span></span></span>
                            </div>
                            <div class="list-card-members js-list-card-members"></div>
                        </div>`;
const sectionCard = `<a class="list-card js-member-droppable ui-droppable section-card" href="">
                            <span class="icon-expanded"></span>
                            <span id="section-title">Beta Section 1</span>
                            <div class="list-card-cover js-card-cover"></div>
                            <span class="icon-sm icon-edit list-card-operation dark-hover js-open-quick-card-editor js-card-menu"></span>
                            <div class="list-card-stickers-area js-stickers-area hide">
                                <div class="stickers js-card-stickers"></div>
                            </div>
                            <div class="list-card-details js-card-details">
                                <div class="list-card-labels js-card-labels"></div>
                                <span class="list-card-title js-card-name" dir="auto" style="display: none;">
                                    <span class="card-short-id hide">#6</span>
                                    ## Beta Section 1
                                </span>
                                <div class="badges">
                                    <span class="js-badges"></span>
                                    <span class="custom-field-front-badges js-custom-field-badges">
                                        <span></span>
                                    </span>
                                    <span class="js-plugin-badges">
                                        <span></span>
                                    </span>
                                </div>
                                <div class="list-card-members js-list-card-members"></div>
                            </div>
                            <p class="list-card-dropzone">Drop files to upload.</p>
                            <p class="list-card-dropzone-limited">Too many attachments.</p>
                            <p class="list-card-dropzone-restricted">Not allowed by your enterprise.</p>
                        </a>`;

// #endregion CARD TEMPLATES

describe('tFolds', () => {
  // const tdom = new TDOM();
  const tfolds = new TFolds();
  const tdom = new TDOM();
  const sections1 = [
    '## Section',
    '## Section ##',
    '### Section ###',
    'Section ##',
    '  ## Section ##',
  ];
  const sections2 = [
    '** Section',
    '*** Section ***',
    'Section **',
  ];

  beforeAll(() => {
    document.documentElement.innerHTML = html.toString();
  });

  beforeEach(() => {
    tfolds.sectionCharacter = '#';
    tfolds.sectionRepeat = 2;
    // sinon.stub(console, "info");
    // requestAnimationFrame.resetHistory();
  });


  describe('verify test board HTML', () => {
    it('should have a list named Alpha containing 5 cards', () => {
      const lists = tdom.getLists('Alpha');
      expect(lists).toHaveLength(1);
      expect(tdom.countCards(lists[0])).toBe(5);
    });
  });

  describe('sectionIdentifier', () => {
    it('should return ## as default', () => {
      expect(tfolds.sectionIdentifier).toBe('##');
    });

    it('should return whatever the character is set to twice', () => {
      tfolds.sectionCharacter = '*';
      expect(tfolds.sectionIdentifier).toBe('**');
    });
  });

  describe('isSection()', () => {
    it('should return true for any string with the dedicated char repeated N times', () => {
      sections1.forEach(s => {
        expect(tfolds.isSection(s)).toStrictEqual(true);
      });
    });
  });

  describe('listModified()', () => {
    it('should output error msg if parameter missing', () => {
      jest.spyOn(console, 'error');
      jest.spyOn(tfolds, 'showWipLimit');
      expect(tfolds).toBeInstanceOf(TFolds);
      tfolds.listModified();
      expect(tfolds.showWipLimit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
      jest.restoreAllMocks();
    });

    it('should call showWipLimit if param is list', () => {
      jest.spyOn(console, 'error');
      jest.spyOn(tfolds, 'showWipLimit');
      const list = tdom.getLists('Alpha');
      tfolds.listModified(list[0]);
      expect(console.error).not.toHaveBeenCalled();
      expect(tfolds.showWipLimit).toHaveBeenCalledTimes(1);
      jest.restoreAllMocks();
    });
  });

  describe('listRemoved()', () => {
    beforeAll(() => {
      jest.spyOn(tfolds, 'isSubList')
          .mockReturnValueOnce(true)
          .mockReturnValue(false);
    });

    afterAll(() => {
      tfolds.isSubList.mockRestore();
    });

    beforeEach(() => {
      jest.spyOn(tfolds, 'redrawCombinedLists')
          .mockImplementation(() => undefined);
    });

    afterEach(() => {
      tfolds.redrawCombinedLists.mockRestore();
    });

    it('should call redrawCombinedLists', () => {
      tfolds.listRemoved(tdom.getLists('Delta.Sub2')[0]);
      expect(tfolds.redrawCombinedLists).toHaveBeenCalledTimes(1);
    });

    it('should NOT call redrawCombinedLists', () => {
      tfolds.listRemoved(tdom.getLists('Delta.Sub2')[0]);
      expect(tfolds.redrawCombinedLists).not.toHaveBeenCalled();
    });
  });

  describe('formatCard()', () => {
    describe('[Comment Card]', () => {
      it('should add specific class for comment cards', () => {
        /* Assign */
        const commentCard = document.createElement('div');
        commentCard.innerHTML = "<span class='list-card-title'>// Comment card</span>";
        /* Act */
        tfolds.formatCard(commentCard);
        /* Assert */
        expect(commentCard).toHaveClass('comment-card');
      });
    });

    describe('[Normal Card]', () => {
      let normalCard;

      beforeEach(() => {
        normalCard = document.createElement('div');
        normalCard.innerHTML = "<span class='list-card-title'>Normal card</span>";
      });

      it('should not add extra styles', () => {
        /* Assign */
        /* Act */
        tfolds.formatCard(normalCard);
        /* Assert */
        expect(normalCard).not.toHaveClass('comment-card');
        expect(normalCard).not.toHaveClass('blocked-card');
      });

      it('should contain span with .list-card-title)', () => {
        /* Assign */
        /* Act */
        tfolds.formatCard(normalCard);
        /* Assert */
        const containedSpan = normalCard.querySelector('span');
        expect(containedSpan).toHaveClass('list-card-title');
      });

      it('should not call requestAnimationFrame()', () => {
        /* Assign */
        const mockedRequestAnimationFrame = jest.spyOn(global, 'requestAnimationFrame');
        /* Act */
        tfolds.formatCard(normalCard);
        /* Assert */
        expect(mockedRequestAnimationFrame).not.toBeCalled();
      });
    });

    describe('[Blocked Card]', () => {
      it('should add blocked-card class', () => {
        /* Assign */
        const blockedCard = document.createElement('div');
        blockedCard.innerHTML = "<span class='list-card-title'>"
          + "<span class='badge-text'>blocked</span>Blocked card</span>";
        /* Act */
        tfolds.formatCard(blockedCard);
        /* Assert */
        expect(blockedCard).toHaveClass('blocked-card');
      });
    });
  });

  describe('getStrippedTitle()', () => {
    it('should remove string identifier chars', () => {
      /* Assign */
      /* Act */
      /* Assert */
      sections1.forEach((s) => {
        expect(tfolds.getStrippedTitle(s)).toBe('Section');
      });
    });

    it('should not strip sections with too few sectio chars', () => {
      /* Assign */
      tfolds.sectionRepeat = 3;
      /* Act */
      const strippedWith3 = tfolds.getStrippedTitle(sections1[2]);
      const strippedWith2 = tfolds.getStrippedTitle(sections1[1]);
      /* Assert */
      expect(strippedWith2).toBe('## Section ##');
      expect(strippedWith3).toBe('Section');
    });

    it('should return stripped titles after changing section char', () => {
      /* Assign */
      tfolds.sectionCharacter = '*';
      tfolds.sectionRepeat = 2;
      /* Act */
      /* Assert */
      sections2.forEach(s => {
        expect(tfolds.getStrippedTitle(s)).toBe('Section');
      });
    });
  });

  describe('areListsRelated()', () => {
    it('should find 3 lists named Delta.xxxx in the test board', () => {
      /* Assign */
      /* Act */
      const lists = tdom.getLists('Delta');
      /* Assert */
      expect(lists).toBeArrayOfSize(3);
    });

    it('should return true for lists with same prefix (until first dot)', () => {
      /* Assign */
      const lists = tdom.getLists('Delta');
      /* Act */
      const isRelated = tfolds.areListsRelated(lists[0], lists[1]);
      /* Assert */
      expect(isRelated).toBeTrue();
    });

    it('should return false for lists not having same prefix', () => {
      /* Assign */
      const l1 = tdom.getLists('Alpha');
      const l2 = tdom.getLists('Bravo');
      /* Act */
      const isRelated = tfolds.areListsRelated(l1[0], l2[0]);
      /* Assert */
      expect(isRelated).toBeFalse();
    });
  });

  describe('showWipLimit()', () => {
    describe('[no WiP limit]', () => {
      let list;

      beforeEach(() => {
        [list] = tdom.getLists('Alpha');
      });

      afterEach(() => {
        tfolds.alwaysCount = false;
        tfolds.showWipLimit(list);
      });

      it('should not add any visuals when no WiP limit', () => {
        /* Assign */
        tfolds.alwaysCount = false;
        /* Act */
        tfolds.showWipLimit(list);
        /* Assert */
        expect(list)
            .not.toHaveClass('wip-limit-reached')
            .not.toHaveClass('wip-limit-exceeded');
        expect(list.querySelector('span.wip-limit-title')).toBeNull();
      });

      it('should show WiP limit if alwaysCount is enabled', () => {
        /* Assign */
        tfolds.alwaysCount = true;
        /* Act */
        tfolds.showWipLimit(list);
        /* Assert */
        expect(list)
            .not.toHaveClass('wip-limit-reached')
            .not.toHaveClass('wip-limit-exceeded');
        expect(list.querySelector('span.wip-limit-title')).not.toBeNull();
      });
    });

    describe('[WiP limit defined]', () => {
      it('should add styling when reaching WiP limit', () => {
        /* Assign */
        const [list] = tdom.getLists('Charlie');
        /* Act */
        tfolds.showWipLimit(list);
        /* Assert */
        expect(list)
            .toHaveClass('wip-limit-reached')
            .not.toHaveClass('wip-limit-exceeded');
        expect(list.querySelector('span.wip-limit-title')).not.toBeNull();
      });

      it('should add styling when exceeding WiP limit', () => {
        /* Assign */
        const [list] = tdom.getLists('Bravo');
        /* Act */
        tfolds.showWipLimit(list);
        /* Assert */
        expect(list)
            .toHaveClass('wip-limit-exceeded')
            .not.toHaveClass('wip-limit-reached');
        expect(list.querySelector('span.wip-limit-title')).not.toBeNull();
      });
    });
  });

  describe('extractWipLimit()', () => {
    it('should return null if no WiP limit', () => {
      /* Assign */
      const [list] = tdom.getLists('Alpha');
      /* Act */
      const wipLimit = tfolds.extractWipLimit(list);
      /* Assert */
      expect(wipLimit).toBeNull();
    });

    it('should return integer with WiP limit if exists', () => {
      /* Assign */
      const [list] = tdom.getLists('Bravo');
      /* Act */
      const wipLimit = tfolds.extractWipLimit(list);
      /* Assert */
      expect(wipLimit).toBe(3);
    });
  });

  describe('addWipLimit()', () => {
    let list;

    beforeEach(() => {
      [list] = tdom.getLists('Alpha');
    });

    it('should contain span.wip-limit-title', () => {
      /* Assign */
      /* Act */
      tfolds.addWipLimit(list, 5);
      /* Assert */
      const span = list.querySelector('span.wip-limit-title');
      expect(span)
          .not.toBeNull()
          .toHaveTextContent('Alpha');
    });

    it('should always add child span', () => {
      /* Assign */
      tfolds.alwaysCount = true;
      /* Act */
      tfolds.addWipLimit(list, 5);
      const span = list.querySelector('span.wip-limit-badge');
      /* Assert */
      expect(span).not.toBeNull();
      expect(list).toContainElement(span);
      expect(span.textContent).toBe('5');
    });

    it('should replace existing span', () => {
      /* Assign */
      /* Act */
      tfolds.addWipLimit(list, 3, 6);
      const span = list.querySelector('span.wip-limit-badge');
      /* Assert */
      expect(list).toContainElement(span);
      expect(span.textContent).toBe('3 / 6');
    });

    describe('[sub lists]', () => {
      beforeAll(() => {
        tfolds.alwaysCount = true;
        list.dataset.sublistindex = 0;
      });

      afterAll(() => {
        tfolds.alwaysCount = false;
        delete list.dataset.sublistindex;
      });

      it('should display count', () => {
        /* Assign */
        /* Act */
        tfolds.addWipLimit(list, 5);
        const span = list.querySelector('span.wip-limit-badge');
        /* Assert */
        expect(list).toContainElement(span);
        expect(span.textContent).toBe('5');
      });

      it('should not display limit', () => {
        /* Assign */
        /* Act */
        tfolds.addWipLimit(list, 3, 6);
        const span = list.querySelector('span.wip-limit-badge');
        /* Assert */
        expect(list).toContainElement(span);
        expect(span.textContent).toBe('3');
      });
    });
  });

  describe('cardModified()', () => {
    describe('[comment]', () => {
      beforeAll(() => {
        jest.spyOn(tfolds, 'showWipLimit').mockImplementation(() => undefined);
      });

      afterAll(() => {
        jest.restoreAllMocks();
      });

      it('should not add comment-card class when title does not start with //', () => {
        /* Assign */
        const card1 = $(normalCard);
        const card2 = $(normalCard);
        const card3 = $(normalCard);
        const card4 = $(normalCard);
        const card5 = $(normalCard);
        /* Act */
        tfolds.cardModified(card1, 'No comment', '// Comment');
        tfolds.cardModified(card2, '/No comment/', '// Comment');
        tfolds.cardModified(card3, 'No Comment/', '// Comment');
        tfolds.cardModified(card4, 'No /Comment', '// Comment');
        tfolds.cardModified(card5, 'comment //', '// Comment');
        /* Assert */
        expect(card1.classList).not.toContain('comment-card');
        expect(card2.classList).not.toContain('comment-card');
        expect(card3.classList).not.toContain('comment-card');
        expect(card4.classList).not.toContain('comment-card');
        expect(card5.classList).not.toContain('comment-card');
      });

      it('should add comment-card class if title starts with //', () => {
        /* Assign */
        const card1 = $(normalCard);
        const card2 = $(normalCard);
        const card3 = $(normalCard);
        /* Act */
        tfolds.cardModified(card1, '// comment', 'Comment');
        tfolds.cardModified(card2, '// Comment //', '// Comment');
        tfolds.cardModified(card3, '//// Comment', '// Comment');
        /* Assert */
        expect(card1.classList).toContain('comment-card');
        expect(card2.classList).toContain('comment-card');
        expect(card3.classList).toContain('comment-card');
      });

      it('should remove comment-card class if title does not start with //', () => {
        /* Assign */
        const card = $(commentCard);
        /* Act */
        tfolds.cardModified(card, 'comment', '// Comment');
        /* Assert */
        expect(card.classList).not.toContain('comment-card');
      });
    });
  });

  describe('checkSectionChange()', () => {
    beforeAll(() => {
      jest.spyOn(tfolds, 'removeSectionFormatting');
      jest.spyOn(tfolds, 'formatAsSection');
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    describe('[non-section --> non-section]', () => {
      it('should do nothing', () => {
        /* Assign */
        /* Act */
        /* Assert */
        expect(() => {
          tfolds.checkSectionChange(null, 'new', 'old');
        }).not.toThrow();
      });

      it('should not call anything', () => {
        /* Assign */
        const card = $(normalCard);
        /* Act */
        tfolds.checkSectionChange(card, 'new', 'old');
        /* Assert */
        expect(tfolds.removeSectionFormatting).not.toBeCalled();
        expect(tfolds.formatAsSection).not.toBeCalled();
      });
    });

    describe('[section --> section]', () => {
      it('should contain section-title with stripped title', () => {
        /* Assign */
        const card = $(sectionCard);
        const newTitle = '## New Title';
        const oldTitle = '## Beta Section 1';
        /* Act */
        tfolds.checkSectionChange(card, newTitle, oldTitle);
        /* Assert */
        expect($(card, '#section-title').textContent).toBe('New Title');
      });
    });

    describe('[section --> non-section]', () => {
      let card;
      const newTitle = 'No section now baby!';
      const oldTitle = '## Beta Section 1';

      beforeEach(() => {
        card = $(sectionCard);
      });

      it('should call removeSectionFormatting()', () => {
        /* Assign */
        /* Act */
        tfolds.checkSectionChange(card, newTitle, oldTitle);
        /* Assert */
        expect(tfolds.removeSectionFormatting).toBeCalled();
      });

      it('should remove section-card class', () => {
        /* Assign */
        /* Act */
        tfolds.checkSectionChange(card, newTitle, oldTitle);
        /* Assert */
        expect(card.classList).not.toContain('section-card');
      });
    });

    describe('[non-section --> section]', () => {
      let card;
      const newTitle = '## New title';
      const oldTitle = 'Old title';

      beforeAll(() => {
        card = $(normalCard);
      });

      it('should call formatAsSection()', () => {
        /* Assign */
        /* Act */
        tfolds.checkSectionChange(card, newTitle, oldTitle);
        /* Assert */
        expect(tfolds.formatAsSection).toBeCalled();
      });

      it('should add section-card class', () => {
        /* Assign */
        /* Act */
        tfolds.checkSectionChange(card, newTitle, oldTitle);
        /* Assert */
        expect(card.classList).toContain('section-card');
      });
    });
  });

  describe('setupBoard()', () => {
    it('should throw error if called with 3', () => {
      /* Assign */
      const canvas = $('div.board-canvas');
      canvas.classList.remove('board-canvas');
      /* Act */
      /* Assert */
      expect(() => {
        tfolds.setupBoard(3);
      }).toThrow(ReferenceError);
    });
  });

  describe('combineLists()', () => {
    afterEach(() => {
      tfolds.enableCombiningLists = true;
      jest.restoreAllMocks();
    });

    it('should not do anything when enablingCombiningLists setting off', () => {
      /* Assign */
      jest.spyOn(tdom, 'getLists');
      tfolds.enableCombiningLists = false;
      /* Act */
      tfolds.combineLists();
      /* Assert */
      expect(tdom.getLists).not.toBeCalled();
    });

    it('should call createCombinedList() once', () => {
      /* Assign */
      jest.spyOn(tfolds, 'createCombinedList').mockImplementation(() => undefined);
      /* Act */
      tfolds.combineLists();
      /* Assert */
      expect(tfolds.createCombinedList).toBeCalledTimes(1);
    });
  });

  describe('createCombinedList()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return null if list already has class "sub-list"', () => {
      /* Assign */
      const [list] = tdom.getLists('Delta.Sub2');
      /* Act */
      const returnVal = tfolds.createCombinedList(list);
      /* Assert */
      expect(returnVal).toBeNull();
    });

    it('should add data prop numOfSubLists', () => {
      /* Assign */
      jest.spyOn(tfolds, 'convertToSubList').mockReturnValue(2);
      jest.spyOn(tfolds, 'addSuperList').mockReturnValue(undefined);
      const [list] = tdom.getLists('Delta.Sub2');
      /* Act */
      const retVal = tfolds.createCombinedList(list);
      /* Assert */
      expect(retVal).toBe(3);
      expect(list.dataset.numOfSubLists).toBe('3');
    });
  });

  describe('convertToSubList()', () => {
    afterEach(() => {
      tfolds.debug = false;
      jest.restoreAllMocks();
    });

    afterAll(() => {
      const [list] = tdom.getLists('Alpha');
      tfolds.restoreSubList(list);
    });

    it('should return 0 and output warning when called with sub list', () => {
      /* Assign */
      const [list] = tdom.getLists('Delta.Sub2');
      tfolds.debug = true;
      jest.spyOn(console, 'warn');
      /* Act */
      const retval = tfolds.convertToSubList(list);
      /* Assert */
      expect(retval).toBeNull();
      expect(console.warn).toBeCalledTimes(1);
    });

    it('should add sub-list class to target list', () => {
      /* Assign */
      const [list] = tdom.getLists('Alpha');
      /* Act */
      const retval = tfolds.convertToSubList(list, 0, 43);
      /* Assert */
      expect(retval).toBe(43);
      expect(list.classList).toContain('sub-list');
      expect(list.dataset.sublistindex).toBe('43');
    });
  });

  describe('attachListResizeDetector()', () => {
    let mockedRequestAnimationFrame;
    let list;

    beforeEach(() => {
      mockedRequestAnimationFrame = jest.spyOn(global, 'requestAnimationFrame');
      [list] = tdom.getLists('Bravo');
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete list.dataset.hasDetector;
    });

    it('should add data property and attach detector to animation frame', () => {
      /* Assign */
      /* Act */
      tfolds.attachListResizeDetector(list);
      /* Assert */
      expect(list.dataset.hasDetector).toBe('true');
      expect(mockedRequestAnimationFrame).toBeCalledTimes(1);
    });

    it('should only attach detector once', () => {
      /* Assign */
      jest.spyOn(console, 'log');
      tfolds.attachListResizeDetector(list);
      /* Act */
      tfolds.attachListResizeDetector(list);
      /* Assert */
      expect(list.dataset.hasDetector).toBe('true');
      expect(console.log).toBeCalledTimes(1);
      expect(mockedRequestAnimationFrame).toBeCalledTimes(1);
    });
  });

  describe('listWidth', () => {
    afterEach(() => {
      tfolds.compactMode = false;
    });

    it('should return default width if compact mode disabled', () => {
      /* Assign */
      tfolds.compactMode = false;
      /* Act */
      const width = tfolds.listWidth;
      /* Assert */
      expect(width).toBe(TFolds.NORMAL_LIST_WIDTH);
    });

    it('should return set compact width when set and compact mode enabled', () => {
      /* Assign */
      tfolds.compactMode = true;
      tfolds.settings.compactListWidth = 3;
      /* Act */
      const width = tfolds.listWidth;
      /* Assert */
      expect(width).toBe(3);
    });

    it('should return default compact width if not set and compact mode enabled', () => {
      /* Assign */
      tfolds.compactMode = true;
      delete tfolds.settings.compactListWidth;
      /* Act */
      const width = tfolds.listWidth;
      /* Assert */
      expect(width).toBe(TFolds.DEFAULT_COMPACT_WIDTH);
    });
  });

  describe('toggleVisibility()', () => {
    it('should return undefined if element param not set', () => {
      /* Assign */
      const element = null;
      /* Act */
      const retval = tfolds.toggleVisibility(element, true);
      /* Assert */
      expect(retval).toBeUndefined();
    });

    each([
      [true, 'none', true],
      [true, 'block', true],
      [true, '', true],
      [true, 'none', undefined],
      [false, 'block', undefined],
      [false, '', undefined],
      [false, 'none', false],
      [false, 'block', false],
      [false, '', false],
    ]).test(
        'should return %s when "display: %s" and visible == %s',
        (expected, disp, visible) => {
          const el = {
            style: { display: disp },
            dataset: {},
          };
          expect(tfolds.toggleVisibility(el, visible)).toBe(expected);
        });
  });

  describe('findSiblingsUntil()', () => {
    it('should return siblings until matching query', () => {
      /* Assign */
      // const firstSpan = $(html, '#first');
      const listHeaderTarget = $('.list-header-target');
      /* Act */
      const siblings = tfolds.findSiblingsUntil(listHeaderTarget, '.list-header-num-cards');
      /* Assert */
      expect(siblings).toBeArrayOfSize(3);
      expect(siblings[2]).toHaveClass('list-header-extras');
    });

    it('should return siblings until matching test function', () => {
      /* Assign */
      const listHeaderTarget = $('.list-header-target');
      const testFunc = (el) => {
        return el.innerHTML.includes('href="#"');
      };
      /* Act */
      const siblings = tfolds.findSiblingsUntil(listHeaderTarget, testFunc);
      /* Assert */
      expect(siblings).toBeArrayOfSize(2);
      expect(siblings[1].tagName).toBe('TEXTAREA');
    });
  });

  describe('boardChanged()', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log');
      jest.spyOn(tfolds, 'initStorage').mockReturnValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      tfolds.debug = false;
    });

    it('should log IDs when debug enabled', () => {
      /* Assign */
      const boardId = '123';
      const oldId = '456';
      tfolds.debug = true;
      /* Act */
      tfolds.boardChanged(boardId, oldId);
      /* Assert */
      expect(console.log)
          .toBeCalledTimes(1)
          .toBeCalledWith(expect.stringMatching(/(123).+(456)/));
    });

    it('should call initStorage()', () => {
      /* Assign */
      /* Act */
      tfolds.boardChanged();
      /* Assert */
      expect(tfolds.initStorage).toBeCalledTimes(1);
    });
  });

  // NOTE Test mostly added because I plan to refactor listAdded()
  describe('listAdded()', () => {
    beforeEach(() => {
      jest.spyOn(tfolds, 'addFoldingButton').mockReturnValue(undefined);
      jest.spyOn(tfolds, 'addCollapsedList').mockReturnValue(undefined);
      jest.spyOn(tfolds, 'showWipLimit').mockReturnValue(undefined);
      jest.spyOn(tfolds, 'redrawCombinedLists').mockReturnValue(undefined);
      jest.spyOn(console, 'error');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should not call anything with no arg', () => {
      tfolds.listAdded();
      expect(tfolds.addFoldingButton).not.toHaveBeenCalled();
      expect(console.error)
          .toHaveBeenCalled()
          .toBeCalledWith('[listEl] not defined');
    });

    it('should call stuff()', () => {
      /* Assign */
      const [list] = tdom.getLists('Alpha');
      /* Act */
      tfolds.listAdded(list);
      /* Assert */
      expect(tfolds.addFoldingButton).toBeCalledTimes(1);
      expect(tfolds.addCollapsedList).toBeCalledTimes(1);
      expect(tfolds.showWipLimit).toBeCalledTimes(1);
      expect(tfolds.redrawCombinedLists).toBeCalledTimes(1);
    });
  });

  describe('listDragged()', () => {
    beforeEach(() => {
      jest.spyOn(tfolds, 'restoreSubList').mockReturnValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should restore sub lists if dragged list is one', () => {
      /* Assign */
      const listWrapper = tdom.getListWrapperByIndex(3);
      /* Act */
      tfolds.listDragged(listWrapper);
      /* Assert */
      expect(tfolds.restoreSubList).toBeCalledTimes(3);
    });

    it('should not call restoreSubLists if passed list is not sub list', () => {
      /* Assign */
      const listWrapper = tdom.getListWrapperByIndex(0);
      /* Act */
      tfolds.listDragged(listWrapper);
      /* Assert */
      expect(tfolds.restoreSubList).not.toBeCalled();
    });
  });

  describe('listDropped', () => {
    it('should redraw combined lists', () => {
      /* Assign */
      jest.spyOn(tfolds, 'redrawCombinedLists').mockReturnValue(undefined);
      /* Act */
      tfolds.listDropped();
      /* Assert */
      expect(tfolds.redrawCombinedLists).toHaveBeenCalledTimes(1);
      jest.restoreAllMocks();
    });
  });

  describe('redrawCombinedLists', () => {
    it('should result in combined lists', () => {
      /* Assign */
      /* Act */
      tfolds.redrawCombinedLists();
      const [alpha] = tdom.getLists('Alpha');
      const [delta] = tdom.getLists('Delta.Sub1');
      const superList = tfolds.getMySuperList(delta);
      /* Assert */
      expect(tfolds.isSubList(alpha)).toBeFalse();
      expect(tfolds.isSubList(delta)).toBeTrue();
      expect(superList).toHaveClass('super-list');
      expect(delta.dataset.numOfSubLists).toBe('3');
    });
  });

  describe('cardAdded()', () => {
    beforeAll(() => {
      jest.spyOn(tfolds, 'formatCard').mockReturnValue(undefined);
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should call formatCard after a timeout', () => {
      /* Assign */
      const [alpha] = tdom.getLists('Alpha');
      const [card] = tdom.getCardsInList(alpha);
      /* Act */
      tfolds.cardAdded(card);
      jest.runAllTimers();
      /* Assert */
      expect(setTimeout)
          .toHaveBeenCalledTimes(1)
          .toHaveBeenLastCalledWith(expect.any(Function), 100);
      expect(tfolds.formatCard).toHaveBeenCalledTimes(1);
    });
  });

  describe('cardRemoved()', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should not toggle if expanded section', () => {
      /* Assign */
      jest.spyOn(tfolds, 'toggleSection').mockReturnValue(undefined);
      const [bravo] = tdom.getLists('Bravo');
      const [sectionCard] = tdom.getCardsInList(bravo, 'Beta Section 1');
      /* Act */
      tfolds.cardRemoved(sectionCard);
      /* Assert */
      expect(tfolds.toggleSection).toHaveBeenCalledTimes(0);
    });

    it('should toggle contained cards if collapsed section', () => {
      /* Assign */
      const [bravo] = tdom.getLists('Bravo');
      const [sectionCard] = tdom.getCardsInList(bravo, 'Beta Section 1');
      // const sectionIcon = $(sectionCard, '.icon-expanded');
      /* Act */
      tfolds.toggleSection(sectionCard, false);
      jest.spyOn(tfolds, 'toggleSection').mockReturnValue(undefined);
      tfolds.cardRemoved(sectionCard);
      /* Assert */
      expect(tfolds.toggleSection).toHaveBeenCalledTimes(1);
    });
  });

  describe('cardBadgesModified', () => {
    it('should add "blocked-card" class to cards with blocked badge', () => {
      /* Assign */
      const [charlie] = tdom.getLists('Charlie');
      const [blockedCard] = tdom.getCardsInList(charlie, 'C1');
      /* Act */
      tfolds.cardBadgesModified(blockedCard);
      /* Assert */
      expect(blockedCard).toHaveClass('blocked-card');
    });

    it('should remove "blocked-card" class from card with no blocked badge', () => {
      /* Assign */
      const [charlie] = tdom.getLists('Charlie');
      const [noBlockedCard] = tdom.getCardsInList(charlie, 'C2');
      /* Act */
      tfolds.cardBadgesModified(noBlockedCard);
      /* Assert */
      expect(noBlockedCard).not.toHaveClass('blocked-card');
    });
  });

  describe('formatLists()', () => {
    it('should call specific functions', () => {
      /* Assign */
      jest.spyOn(tfolds, 'redrawCombinedLists').mockReturnValue(undefined);
      jest.spyOn(tfolds, 'makeListsFoldable').mockReturnValue(undefined);
      jest.spyOn(tfolds, 'addWipLimits').mockReturnValue(undefined);
      /* Act */
      tfolds.formatLists();
      /* Assert */
      expect(tfolds.redrawCombinedLists).toHaveBeenCalledTimes(1);
      expect(tfolds.makeListsFoldable).toHaveBeenCalledTimes(1);
      expect(tfolds.addWipLimits).toHaveBeenCalledTimes(1);
    });
  });

  describe('should*AddWip()', () => {
    each([
      [true, null, true],
      [true, 0, true],
      [true, 1, true],
      [true, 2, true],
      [false, null, false],
      [true, 0, false],
      [true, 1, false],
      [true, 2, false],
    ]).test(
        'should return %s when "display: %s" and visible == %s',
        (expected, wipLimit, alwaysCount) => {
          tfolds.settings.alwaysCount = alwaysCount;
          expect(tfolds.shouldAddWip(wipLimit)).toBe(expected);
        });
  });
});

