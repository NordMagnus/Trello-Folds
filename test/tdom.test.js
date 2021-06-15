/* eslint-disable max-statements */
/* eslint-disable no-magic-numbers */

const fs = require('fs');
const path = require('path');
const TDOM = require('../extension/tdom');
const html = fs.readFileSync(path.resolve(__dirname, './trello-folds-test-board.html'), 'utf8');

const each = require('jest-each').default;

global.$ = (a, b) => (typeof a === 'string' ? document.querySelector(a) : a.querySelector(b));
global.$$ = (a, b) => {
  return Array.from(typeof a === 'string' ? document.querySelectorAll(a) : a.querySelectorAll(b));
};
global._$ = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

describe('tdom', () => {
  const tdom = new TDOM();

  beforeAll(() => {
    document.documentElement.innerHTML = html.toString();
  });

  describe('events', () => {
    it('should have an event named CARD_ADDED', () => {
      expect(typeof tdom.events.CARD_ADDED).toBe('symbol');
    });
  });

  describe('debug', () => {
    afterEach(() => {
      tdom._debug = false;
    });

    it('should get debug status', () => {
      /* Assign */
      /* Act */
      const { debug } = tdom;
      /* Assert */
      expect(debug).toBeFalse();
    });

    it('should set debug status', () => {
      /* Assign */
      tdom._debug = true;
      /* Act */
      const { debug } = tdom;
      /* Assert */
      expect(debug).toBeTrue();
    });
  });

  describe('boardId', () => {
    it('should get current board ID', () => {
      /* Assign */
      /* Act */
      const { boardId } = tdom;
      /* Assert */
      expect(boardId).toBeUndefined();
    });
  });

  describe('EventHandler', () => {
    it('should call an added listener', () => {
      const handler = new tdom.events;
      let calls = 0;
      let arg;
      const myListener = (data) => {
        calls++;
        arg = data;
      };
      handler.addListener(handler.CARD_ADDED, myListener);
      expect(calls).toBe(0);
      handler.emit(handler.CARD_ADDED, 'foo');
      expect(calls).toBe(1);
      expect(arg).toBe('foo');
      handler.removeListener(handler.CARD_ADDED, myListener);
      handler.emit(handler.CARD_ADDED, 'bar');
      expect(calls).toBe(1);
      expect(arg).toBe('foo');
    });

    each([
      [tdom.events.BOARD_CHANGED, () => { tdom.onBoardChanged() }],
      [tdom.events.LIST_MODIFIED, () => { tdom.onListModified() }],
      [tdom.events.LIST_ADDED, () => { tdom.onListAdded() }],
      [tdom.events.LIST_REMOVED, () => { tdom.onListRemoved() }],
      [tdom.events.LIST_DRAGGED, () => { tdom.onListDragged() }],
      [tdom.events.LIST_DROPPED, () => { tdom.onListDropped() }],
      [tdom.events.CARD_ADDED, () => { tdom.onCardAdded() }],
      [tdom.events.CARD_REMOVED, () => { tdom.onCardRemoved() }],
      [tdom.events.CARD_MODIFIED, () => { tdom.onCardModified() }],
      [tdom.events.BADGES_MODIFIED, () => { tdom.onBadgesModified() }],
      [tdom.events.LIST_TITLE_MODIFIED, () => { tdom.onListTitleModified() }],
      [tdom.events.REDRAW_BOARD_HEADER, () => { tdom.onRedrawBoardHeader() }],
      // [tdom.events.BOARD_CHANGED, () => { tdom.onCardRemoved() }],
    ]).test('should create event %s when calling method "%s"',
        (expected, helperFunction) => {
          jest.spyOn(tdom.handler, 'addListener').mockImplementation(()=>undefined);
          helperFunction();
          expect(tdom.handler.addListener).toHaveBeenCalledWith(expected, undefined);
          tdom.handler.addListener.mockReset();
        });
  });

  describe('getBoardIdFromUrl()', () => {
    it('should extract the board ID from the URL', () => {
      /* Assign */
      /* Act */
      expect(tdom.getBoardIdFromUrl()).toBe('aBcdEfGH');
      /* Assert */
    });
  });

  describe('getContainingList()', () => {
    it('should return list element if found', () => {
      /* Assign */
      const el = $('.list-card-details');
      /* Act */
      const list = tdom.getContainingList(el);
      /* Assert */
      expect(list).toHaveClass('list');
    });

    it('should return null if list not found', () => {
      /* Assign */
      const el = $('#board');
      /* Act */
      const list = tdom.getContainingList(el);
      /* Assert */
      expect(list).toBeNull();
    });
  });

  describe('getListName()', () => {
    it('should throw when parameter missing', () => {
      /* Assign */
      /* Act */
      /* Assert */
      expect(tdom.getListName).toThrowError();
    });

    it('should return list name when called with list element', () => {
      /* Assign */
      const list = $('div.js-list-content');
      /* Act */
      const name = tdom.getListName(list);
      /* Assert */
      expect(name).toBe('Alpha');
    });
  });

  describe('getLists()', () => {
    it('should return 9 lists', () => {
      /* Assign */
      /* Act */
      const lists = tdom.getLists();
      /* Assert */
      expect(lists).toHaveLength(8);
    });

    it('should return 3 lists with "Sub" in title', () => {
      /* Assign */
      /* Act */
      const lists = tdom.getLists('Sub');
      /* Assert */
      expect(lists).toHaveLength(3);
    });
  });

  describe('getCardName()', () => {
    it('should throw if arg missing', () => {
      /* Assign */
      /* Act */
      /* Assert */
      expect(tdom.getCardName).toThrowError();
    });

    it('should throw if arg not element', () => {
      /* Assign */
      const notElement = {};
      /* Act */
      /* Assert */
      expect(() => {
        tdom.getCardName(notElement);
      }).toThrowError();
    });

    it('should return "undefined" if "span.list-card-title" not found', () => {
      /* Assign */
      const el = $('.card-short-id');
      /* Act */
      const name = tdom.getCardName(el);
      /* Assert */
      expect(name).toBeUndefined();
    });

    it('should return the card content if passed a valid element', () => {
      /* Assign */
      const el = $('a.list-card'); // Should get first card in board
      /* Act */
      const name = tdom.getCardName(el);
      /* Assert */
      expect(name).toBe('A1');
    });
  });

  describe('extractTextContent()', () => {
    it('should get the content of containing text node', () => {
      /* Assign */
      const html = _$('<div><span>not this</span>But this<p></p></div>');
      /* Act */
      const text = tdom.extractTextContent(html);
      /* Assert */
      expect(text).toBe('But this');
    });

    it('should return empty string if no text node found', () => {
      /* Assign */
      const html = _$('<div><span>not this</span><p></p></div>');
      /* Act */
      const text = tdom.extractTextContent(html);
      /* Assert */
      expect(text).toBe('');
    });
  });

  describe('getCardsInList()', () => {
    it('should throw when missing arg', () => {
      /* Assign */
      /* Act */
      /* Assert */
      expect(tdom.getCardsInList).toThrowError();
    });

    it('should return empty array when no cards found', () => {
      /* Assign */
      const html = _$('<div></div>');
      /* Act */
      const cards = tdom.getCardsInList(html);
      /* Assert */
      expect(cards).toBeArrayOfSize(0);
    });
  });

  describe('getCardsByName()', () => {
    it('should return empty array when no cards found', () => {
      /* Assign */
      const needle = 'Evaporated';
      /* Act */
      const cards = tdom.getCardsByName(needle);
      /* Assert */
      expect(cards).toBeArrayOfSize(0);
    });

    it('should throw when missing arg', () => {
      expect(tdom.getCardsByName).toThrowError();
    });

    it('should return one card when arg == "A1"', () => {
      /* Assign */
      const needle = 'A1';
      /* Act */
      const cards = tdom.getCardsByName(needle);
      /* Assert */
      expect(cards).toBeArrayOfSize(1);
      expect(cards[0]).toHaveClass('list-card');
      expect(cards[0]).toHaveTextContent('A1');
    });

    it('should only return cards with exact title when exactMatch true', () => {
      /* Assign */
      const needle = 'A';
      const exactMatch = true;
      /* Act */
      const cards = tdom.getCardsByName(needle, exactMatch);
      /* Assert */
      expect(cards).toBeArrayOfSize(0);
    });
  });

  describe('countCards()', () => {
    const html
        = _$("<div><a class='list-card'><span class='list-card-title'>foo bar</span></a></div>");

    it('should return zero (0) for empty element', () => {
      /* Assign */
      const emptyDiv = _$('<div></div>');
      /* Act */
      const count = tdom.countCards(emptyDiv);
      /* Assert */
      expect(count).toBe(0);
    });

    each([
      [0, 'foo', undefined],
      [0, 'bar', undefined],
      [1, '', undefined],
      [1, undefined, undefined],
      [1, 'hoozit', undefined],
      [0, 'foo', 0],
      [1, 'bar', 0],
      [1, '', 0],
      [1, undefined, 0],
      [1, 'hoozit', 0],
      [0, 'bar', 4],
    ]).test('should return %s when filter="%s", pos="%s"',
        (expected, excludeFilter, pos) => {
          expect(tdom.countCards(html, excludeFilter, pos)).toBe(expected);
        });
  });

  describe('containsAny()', () => {
    const testString = 'Why do cars have breaks?';

    it('should throw if filter not array or string', () => {
      /* Assign */
      const filter = {};
      /* Act */
      /* Assert */
      expect(() => {
        tdom.containsAny(testString, filter);
      }).toThrowError();
    });

    each([
      [false, 'foo'],
      [false, 'why'],
      [false, '??'],
      [false, 'have  '],
      [false, 'w'],
      [false, ['foo']],
      [false, ['w']],
      [false, ['w', '??', 'hoozit']],
      [true, 'Why'],
      [true, ''],
      [true, ' '],
      [true, 'car'],
      [true, ['Why', 'do', 'cars']],
      [true, ['Why']],
      [true, ['', '', '']],
      [true, ['?']],
      [true, ['??', '?']],
    ]).test('should return %s when filter="%s", pos="%s"',
        (expected, includeFilter) => {
          expect(tdom.containsAny(testString, includeFilter)).toBe(expected);
        });
  });

  describe('getCardLabels()', () => {
    it('should throw error if no arg', () => {
      /* Assign */
      expect(tdom.getCardLabels).toThrowError('not defined');
      /* Act */
      /* Assert */
    });

    it('should return "Alpha" for card "A1"', () => {
      /* Assign */
      const card = $('a.list-card'); // Should get first card in board
      /* Act */
      const labels = tdom.getCardLabels(card);
      /* Assert */
      expect(labels)
          .toBeArrayOfSize(1)
          .toContain('label1');
    });

    it('should exclude labels that contains any string in filter', () => {
      /* Assign */
      const [,,, card] = $$('a.list-card'); // Item A4
      const excludeFilter = ['2', '4'];
      /* Act */
      const labels = tdom.getCardLabels(card, excludeFilter);
      /* Assert */
      expect(labels)
          .toBeArrayOfSize(2)
          .toEqual(expect.arrayContaining(['label1', 'label3']));
    });

    it('should throw error if passed filter not array', () => {
      /* Assign */
      const card = $('a.list-card'); // Should get first card in board
      /* Act */
      /* Assert */
      expect(() => {
        tdom.getCardLabels(card, {});
      }).toThrowError('not an array');
    });
  });

  describe('getListWrapperByIndex', () => {
    it('should return list "Bravo" for index 1', () => {
      /* Assign */
      const index = 1;
      /* Act */
      const wrapper = tdom.getListWrapperByIndex(index);
      /* Assert */
      expect(wrapper.innerHTML).toInclude('Bravo');
    });
  });
});
