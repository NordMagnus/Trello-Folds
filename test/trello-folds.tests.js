
const requirejs = require('requirejs');
const chai = require('chai');
const chaiJquery = require('chai-jquery');
const chaiSinon = require('chai-sinon');
const sinon = require('sinon');
const { describe } = require('mocha');
const { expect } = chai;

requirejs.config({
  baseUrl: '.',
  paths: {
    tdom: 'extension/tdom',
    tfolds: 'extension/trello-folds',
  },
});

describe('tfolds', () => {
  const jsdom = require('jsdom');
  const { JSDOM } = jsdom;
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

  before(() => {
    return JSDOM.fromFile('test/trello-folds-test-board.html', {
      url: 'https://trello.com/b/waii4PCH/trello-folds-test-board-do-not-modify',
    }).then((dom) => {
      global.window = dom.window;
      global.jQuery = global.$ = require('jquery');
      chai.use(chaiJquery);
      chai.use(chaiSinon);
      global.tdom = requirejs('tdom');
      global.tfolds = requirejs('tfolds');
      tfolds.debug = false;
      /* Removed callsArg below as it causes an infinite loop in
               tfolds.attachResizeDetector() */
      global.requestAnimationFrame = sinon.stub();// .callsArg(0);
    });
  });

  beforeEach(() => {
    tfolds.sectionCharacter = '#';
    tfolds.sectionRepeat = 2;
    // sinon.stub(console, "info");
    requestAnimationFrame.resetHistory();
  });

  afterEach(() => {
    // console.info.restore();
  });

  describe('Verify test board HTML', () => {
    it('should have a list named Alpha containing 5 cards', () => {
      const $l = TDom.getLists('Alpha');
      expect($l).to.have.lengthOf(1);
      expect(TDom.countCards($l[0])).to.equal(5);
    });
  });

  describe('sectionIdentifier', () => {
    it('should return ## as default', () => {
      expect(tfolds.sectionIdentifier).to.equal('##');
    });
    it('should return whatever the character is set to twice', () => {
      tfolds.sectionCharacter = '*';
      expect(tfolds.sectionIdentifier).to.equal('**');
    });
  });

  describe('isSection()', () => {
    it('should return true for any string with the dedicated char repeated N times', () => {
      sections1.forEach((s) => {
        expect(tfolds.isSection(s)).to.be.true;
      });
    });
  });

  describe('listModified()', () => {
    beforeEach(() => {
      sinon.stub(tfolds, 'showWipLimit');
      sinon.stub(console, 'error');
    });

    afterEach(() => {
      tfolds.showWipLimit.restore();
      console.error.restore();
    });

    it('should output error msg if parameter missing', () => {
      tfolds.listModified();
      expect(console.error).to.have.been.calledOnce;
      expect(tfolds.showWipLimit).to.not.have.been.called;
    });
    it('should call showWipLimit if parameter is a list', () => {
      const $l = TDom.getLists('Alpha');
      tfolds.listModified($l[0]);
      expect(console.error).to.not.be.called;
      expect(tfolds.showWipLimit).to.be.calledOnce;
    });
  });

  describe('listRemoved()', () => {
    before(() => {
      sinon.stub(tfolds, 'isSubList');
      tfolds.isSubList.onCall(0).returns(true);
      tfolds.isSubList.returns(false);
    });
    beforeEach(() => {
      sinon.stub(tfolds, 'redrawCombinedLists');
    });
    afterEach(() => {
      tfolds.redrawCombinedLists.restore();
    });
    after(() => {
      tfolds.isSubList.restore();
    });

    it('should call redrawCombinedLists if param is sub list', () => {
      tfolds.listRemoved(TDom.getLists('Delta.Sub2')[0]);
      expect(tfolds.redrawCombinedLists).to.be.calledOnce;
    });
    it('should not call redrawCombinedLists if param is not sub list', () => {
      tfolds.listRemoved(TDom.getLists('Delta.Sub2')[0]);
      expect(tfolds.redrawCombinedLists).to.not.be.called;
    });
  });

  describe('listAdded()', () => {
    before(() => {
      sinon.stub(tfolds, 'addFoldingButton');
      sinon.stub(tfolds, 'addCollapsedList');
      sinon.stub(tfolds, 'showWipLimit');
      sinon.stub(tfolds, 'redrawCombinedLists');
      sinon.stub(console, 'error');
    });
    after(() => {
      tfolds.addFoldingButton.restore();
      tfolds.addCollapsedList.restore();
      tfolds.showWipLimit.restore();
      tfolds.redrawCombinedLists.restore();
      console.error.restore();
    });

    it('should not call anything without no argument', () => {
      tfolds.listAdded();
      expect(tfolds.addFoldingButton).to.not.be.called;
      expect(console.error).to.be.calledWith('[listEl] not defined');
    });
    it('should call other functions when provided a list', () => {
      const listEl = 34;
      tfolds.listAdded(listEl);
      expect(tfolds.addFoldingButton).to.be.calledWith(34);
      expect(tfolds.addCollapsedList).to.be.calledWith(34);
      expect(tfolds.showWipLimit).to.be.calledOnce;
      expect(tfolds.redrawCombinedLists).to.be.calledOnce;
    });
  });

  describe('listDragged()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('listDropped()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('redrawCombinedLists()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('formatCard()', () => {
    let $normalCard;
    context('[normal cards]', () => {
      beforeEach(() => {
        $normalCard = $("<div><span class='list-card-title'>Normal card</span></div>");
      });
      it('should contain a span with style list-card-title', () => {
        tfolds.formatCard($normalCard[0]);
        expect($normalCard.find('span')).to.have.class('list-card-title');
      });
      it('should not invoke requestAnimationFrame()', () => {
        tfolds.formatCard($normalCard[0]);
      });
      it('should not add extra styles', () => {
        expect($normalCard).to.not.have.class('comment-card');
        expect($normalCard).to.not.have.class('blocked-card');
      });
    });
    context('[comment cards]', () => {
      it('should add comment-card class for comment cards', () => {
        const $commentCard = $("<div><span class='list-card-title'>// Comment card</span></div>");
        tfolds.formatCard($commentCard[0]);
        expect($commentCard).to.have.class('comment-card');
      });
    });
    context('[blocked cards]', () => {
      it('should add blocked-card class for blocked cards', () => {
        const $blockedCard = $(`<div><span class='list-card-title'>
                                          <span class='badge-text'>blocked</span>
                                          Blocked card</span></div>`);
        tfolds.formatCard($blockedCard[0]);
        expect($blockedCard).to.have.class('blocked-card');
      });
    });
  });

  describe('getStrippedTitle()', () => {
    it('should return a string with all section dedicated chars removed', () => {
      sections1.forEach((s) => {
        expect(tfolds.getStrippedTitle(s)).to.equal('Section');
      });
    });
    it('should not strip sections with too few section chars', () => {
      /*
             * Setting sectionRepeat to 3 means
             * "## Section ##" is not stripped but "### Section ###" is.
             */
      tfolds.sectionRepeat = 3;
      expect(tfolds.getStrippedTitle(sections1[2])).to.equal('Section');
      expect(tfolds.getStrippedTitle(sections1[1])).to.not.equal('Section');
    });
    it('should return stripped titles when changing section char', () => {
      tfolds.sectionCharacter = '*';
      tfolds.sectionRepeat = 2;
      sections2.forEach((s) => {
        expect(tfolds.getStrippedTitle(s)).to.equal('Section');
      });
    });
  });

  describe('areListsRelated()', () => {
    it('should be two lists named Delta.xxxx in the test board', () => {
      const $lists = TDom.getLists('Delta');
      expect($lists).to.have.lengthOf(2);
    });
    it('should return true for lists with same prefix', () => {
      const $lists = TDom.getLists('Delta');
      expect(tfolds.areListsRelated($lists[0], $lists[1])).to.be.true;
    });
    it('should return false for lists not having same prefix', () => {
      const $l1 = TDom.getLists('Alpha');
      const $l2 = TDom.getLists('Bravo');
      expect($l1).to.have.lengthOf(1);
      expect($l2).to.have.lengthOf(1);
      expect(tfolds.areListsRelated($l1, $l2)).to.be.false;
    });
  });

  describe('showWipLimit()', () => {
    context('[no wip limit]', () => {
      it('should not add any visuals when no WiP limit', () => {
        const $l = TDom.getLists('Alpha');
        tfolds.alwaysCount = false;
        expect($l).to.have.lengthOf(1);
        tfolds.showWipLimit($l[0]);
        $l.data('subList', false);
        expect($l).to.not.have.class('wip-limit-reached');
        expect($l).to.not.have.class('wip-limit-exceeded');
        expect($l.find('span.wip-limit-title')).to.have.length(0);
      });

      it('should show WiP limit if settings.alwaysCount is true', () => {
        const $l = TDom.getLists('Alpha');
        tfolds.alwaysCount = true;
        expect($l).to.have.lengthOf(1);
        tfolds.showWipLimit($l[0]);
        expect($l).to.not.have.class('wip-limit-reached');
        expect($l).to.not.have.class('wip-limit-exceeded');
        expect($l.find('span.wip-limit-title')).to.have.length(1);
        tfolds.alwaysCount = false;
        tfolds.showWipLimit($l[0]); // Remove wip limit badge
      });
    });

    context('[wip limit defined]', () => {
      it('should add wip-limit-reached style when num of Cards == limit', () => {
        const $l = TDom.getLists('Charlie');
        expect($l).to.have.length(1);
        tfolds.showWipLimit($l[0]);
        expect($l).to.have.class('wip-limit-reached');
        expect($l).to.not.have.class('wip-limit-exceeded');
        expect($l.find('span.wip-limit-title')).to.have.length(1);
      });

      it('should add wip-limit-exceeded style when num of cards > limit', () => {
        const $l = TDom.getLists('Bravo');
        expect($l).to.have.length(1);
        tfolds.showWipLimit($l[0]);
        expect($l).to.not.have.class('wip-limit-reached');
        expect($l).to.have.class('wip-limit-exceeded');
        expect($l.find('span.wip-limit-title')).to.have.length(1);
      });
    });
  });

  describe('extractWipLimit()', () => {
    it("should return 'null' if no WiP limit (i.e. no [x] in title)", () => {
      const $l = TDom.getLists('Alpha');
      const wipLimit = tfolds.extractWipLimit($l[0]);
      expect(wipLimit).to.be.null;
    });

    it('should return an integer with the WiP limit if it exists', () => {
      const $l = TDom.getLists('Bravo');
      const wipLimit = tfolds.extractWipLimit($l[0]);
      expect(wipLimit).to.equal(3);
    });
  });

  describe('addWipLimit()', () => {
    let $l;
    let $span;

    before(() => {
      $l = TDom.getLists('Alpha');
    });

    it('should contain a span.wip-limit-title with the title', () => {
      $l.data('subList', false);
      tfolds.addWipLimit($l, 5);
      const titleEl = $l.find('span.wip-limit-title');
      expect($(titleEl)).to.contain('Alpha');
    });

    /*
         * addWipLimit() is only called when a badge should be displayed
         * so a span.wip-limit-badge should always be created after calling this method.
         */
    it('should always add a span.wip-limit-badge', () => {
      $l.data('subList', false);
      tfolds.alwaysCount = true;
      tfolds.addWipLimit($l, 5);
      expect($l).to.have.descendants('span.wip-limit-badge');
      $span = $l.find('span.wip-limit-badge');
      expect($span).to.have.lengthOf(1);
      expect($span).to.have.text('5');
    });

    it('should replace existing span', () => {
      tfolds.addWipLimit($l, 3, 6);
      expect($l).to.have.descendants('span.wip-limit-badge');
      $span = $l.find('span.wip-limit-badge');
      expect($span).to.have.lengthOf(1);
      expect($span).to.have.text('3 / 6');
    });

    context('[sub list]', () => {
      before(() => {
        tfolds.alwaysCount = true;
        $l.data('subList', true);
      });

      after(() => {
        tfolds.alwaysCount = false;
        $l.data('subList', false);
      });

      it('should display count', () => {
        tfolds.addWipLimit($l, 5);
        expect($l).to.have.descendants('span.wip-limit-badge');
        $span = $l.find('span.wip-limit-badge');
        expect($span).to.have.lengthOf(1);
        expect($span).to.have.text('5');
      });

      it('should display count but not display limit', () => {
        // tfolds.addWipLimit($l, 3, 6);
        // expect($l).to.have.descendants("span.wip-limit-badge");
        // $span = $l.find("span.wip-limit-badge");
        // expect($span).to.have.lengthOf(1);
        // expect($span).to.have.text("3");
      });
    });
  });

  describe('cardBadgesModified()', () => {
    it('should add blocked-card class if blocked', () => {
      const $c = $(blockedCard);
      tfolds.cardBadgesModified($c);
      expect($c).to.have.class('blocked-card');
    });

    it('should not add blocked-card class if not blocked', () => {
      const $c = $(normalCard);
      tfolds.cardBadgesModified($c);
      expect($c).to.not.have.class('blocked-card');
    });
  });

  describe('cardModified()', () => {
    context('[comment]', () => {
      before(() => {
        sinon.stub(tfolds, 'showWipLimit');
      });

      after(() => {
        tfolds.showWipLimit.restore();
      });

      it('should not add comment-card class if not beginning with //', () => {
        const $c = $(normalCard);
        tfolds.cardModified($c[0], 'No Comment', '// Comment');
        expect($c).to.not.have.class('comment-card');
        tfolds.cardModified($c[0], '/No Comment/', '// Comment');
        expect($c).to.not.have.class('comment-card');
        tfolds.cardModified($c[0], 'No Comment/', '// Comment');
        expect($c).to.not.have.class('comment-card');
        tfolds.cardModified($c[0], 'No /Comment', '// Comment');
        expect($c).to.not.have.class('comment-card');
        tfolds.cardModified($c[0], 'No Comment', '// Comment');
        expect($c).to.not.have.class('comment-card');
        tfolds.cardModified($c[0], 'Comment //', '// Comment');
        expect($c).to.not.have.class('comment-card');
      });

      it('should add comment-card class if beginning with //', () => {
        const $c = $(commentCard);
        expect($c).to.have.class('comment-card');
        $c.removeClass('comment-card');
        tfolds.cardModified($c[0], '// Comment', 'Comment');
        expect($c).to.have.class('comment-card');
        $c.removeClass('comment-card');
        tfolds.cardModified($c[0], '// Comment //', '// Comment');
        expect($c).to.have.class('comment-card');
        $c.removeClass('comment-card');
        tfolds.cardModified($c[0], '//// Comment', '// Comment');
        expect($c).to.have.class('comment-card');
      });

      it('should remove comment-card class if title changed from comment', () => {
        const $c = $(commentCard);
        expect($c).to.have.class('comment-card');
        const $t = $c.find('span.list-card-title');
        const $shortId = $t.find('span.card-short-id');
        const oldTitle = TDom.getCardName($c);
        $t.html('New title').prepend($shortId);
        tfolds.cardModified($c[0], 'New title', oldTitle);
        expect($c).to.not.have.class('comment-card');
      });
    });
  });

  describe('checkSectionChange()', () => {
    before(() => {
      sinon.spy(tfolds, 'removeSectionFormatting');
      sinon.spy(tfolds, 'formatAsSection');
    });

    after(() => {
      tfolds.removeSectionFormatting.restore();
      tfolds.formatAsSection.restore();
    });

    context('[non-section --> non-section]', () => {
      it('should not do anything', () => {
        expect(() => {tfolds.checkSectionChange(null, 'new', 'old')}).to.not.throw;
      });

      it('should not call removeSectionFormatting() or formatAsSection()', () => {
        const $c = $(normalCard);
        tfolds.checkSectionChange($c, 'new', 'old');
        expect(tfolds.removeSectionFormatting).to.not.be.called;
        expect(tfolds.formatAsSection).to.not.be.called;
      });
    });

    context('[section --> section]', () => {
      it('should contain a section-title with stripped title', () => {
        const $c = $(sectionCard);
        const newTitle = '## New title';
        tfolds.checkSectionChange($c, newTitle, '## Beta Section 1');
        expect($c.find('#section-title')).to.have.text('New title');
      });
    });

    context('[section --> non-section]', () => {
      let $c;
      const newTitle = 'No section now baby!';

      beforeEach(() => {
        $c = $(sectionCard);
      });

      it('should call removeSectionFormatting()', () => {
        tfolds.checkSectionChange($c, newTitle, '## Beta Section 1');
        expect(tfolds.removeSectionFormatting).to.be.called;
      });

      it('should remove section-card class', () => {
        tfolds.checkSectionChange($c, newTitle, '## Beta Section 1');
        expect($c).to.not.have.class('section-card');
      });
    });

    context('[non-section --> section]', () => {
      let $c;
      const newTitle = '## New title';

      before(() => {
        $c = $(normalCard);
      });

      it('should call formatAsSection()', () => {
        tfolds.checkSectionChange($c, newTitle, 'old');
        expect(tfolds.formatAsSection).to.be.called;
      });

      it('should add section-card class', () => {
        tfolds.checkSectionChange($c, newTitle, 'old');
        expect($c).to.have.class('section-card');
      });
    });
  });

  describe('listTitleModified()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('setupBoard()', () => {
    it('should throw error if called with 3', () => {
      const $canvas = $('div.board-canvas');
      $canvas.removeClass('board-canvas');
      expect(() => { tfolds.setupBoard(3) }).to.throw(ReferenceError);
      $canvas.addClass('board-canvas');
    });
  });

  describe('combineLists()', () => {
    it('should not do anything when enableCombiningLists === false', () => {
      sinon.spy(TDom, 'getLists');
      tfolds.enableCombiningLists = false;
      tfolds.combineLists();
      expect(TDom.getLists).to.not.be.called;
      tfolds.enableCombiningLists = true;
      TDom.getLists.restore();
    });

    it('should call combineListWithNext() once', () => {
      // sinon.spy(tfolds, "combineListWithNext");
      // tfolds.combineLists();
      // expect(tfolds.combineListWithNext).to.be.calledOnce;
      // tfolds.combineListWithNext.restore();
    });
  });

  describe('createCombinedList()', () => {
    it("should return null if list already has class 'sub-list'", () => {
      const $l = TDom.getLists('Delta.Sub2');
      const result = tfolds.createCombinedList($l);
      expect(result).to.be.null;
    });

    it('should add data property numOfSubLists', () => {
      sinon.stub(tfolds, 'convertToSubList');
      tfolds.convertToSubList.returns(2);
      sinon.stub(tfolds, 'addSuperList');

      const $l = TDom.getLists('Delta.Sub2');
      const result = tfolds.createCombinedList($l);

      expect(result).to.equal(3);
      expect($l.data('numOfSubLists')).to.equal(3);

      tfolds.convertToSubList.restore();
      tfolds.addSuperList.restore();
    });
  });

  describe('convertToSubList()', () => {
    it('should return 0 and output warning when called with sub list', () => {
      const $l = TDom.getLists('Delta.Sub2');
      expect($l.hasClass('sub-list')).to.be.true;
      tfolds.debug = true;
      sinon.stub(console, 'warn');
      const result = tfolds.convertToSubList($l);
      expect(result).to.equal(0);
      expect(console.warn).to.be.calledOnce;
      tfolds.debug = false;
      console.warn.restore();
    });
    it('should add sub-list class to target list', () => {
      const $l = TDom.getLists('Alpha');
      expect($l.hasClass('sub-list')).to.be.false;
      const result = tfolds.convertToSubList($l, 0, 43);
      expect(result).to.equal(0);
      expect($l.hasClass('sub-list')).to.be.true;
      expect($l.attr('data-id')).to.equal('43');
    });
  });

  describe('attachListResizeDetector()', () => {
    it('should only add detector once', () => {
      const $l = TDom.getLists('Beta');
      tfolds.attachListResizeDetector($l);
      // ?
      // expect($l.data("hasDetector")).to.be.true;
      expect(requestAnimationFrame).to.be.calledOnce;
      // tfolds.attachListResizeDetector($l);
      // expect(requestAnimationFrame).to.be.calledOnce;
    });
  });

  describe('splitLists()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('isFirstSubList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('restoreSubList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('isSubList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('addSuperList()', () => {
    it('should add a DIV.super-list tag containing header elements before the left list');
    it('should add a collapsed version of the super list');
    it('should update super list WiP information and height');
  });

  describe('addCollapsedSuperList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('updateSuperListHeight()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('findSuperListHeight()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('getMySuperList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('updateSuperList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('updateWidths()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('updateCollapsedSuperList()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('makeListsFoldable()', () => {
    it('NO TESTS WRITTEN YET');
  });

  describe('listWidth()', () => {
    after(() => {
      tfolds.compactMode = false;
    });
    it('should return 272 when compact mode disabled', () => {
      tfolds.compactMode = true;
      expect(tfolds.listWidth).to.equal(200);
    });
    it('should return 200 when compact mode enabled', () => {
      tfolds.compactMode = false;
      expect(tfolds.listWidth).to.equal(272);
    });
  });
});
