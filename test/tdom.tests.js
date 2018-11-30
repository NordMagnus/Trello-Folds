
/*
 * requirejs, assert, mocha and jquery installed via node
 */

const requirejs = require('requirejs');
const chai = require('chai');
// const assert = chai.assert;
const {expect} = chai;

requirejs.config({
    baseUrl: ".",
    paths: {
        tdom: "extension/tdom",
    },
});

describe('tdom', function() {

    const jsdom = require("jsdom");
    const { JSDOM } = jsdom;
    // var window;
    // var $;
    // var tdom;
    // const $ = require("jquery");

    before(function() {
        return JSDOM.fromFile("test/squadification-board.html", {
            url: "https://trello.com/b/aBcdEfGH/trello-folds-test-board",
        }).then((dom) => {
            global.window = dom.window;
            global.document = dom.window.document;
            global.$ = require('jquery');
            global.tdom = requirejs("tdom");
        });
    });

    describe("dom", function() {
        it("should have a list called 'List Alpha'", function() {
            let jName = $.find("h2.js-list-name-assist:contains('List Alpha')");
            expect(jName).to.exist;
            expect(jName.length).to.equal(1);
        });
    });

    describe("definition", function() {

        it("should not be undefined", function() {
            expect(tdom).to.exist;
        });

    });

    describe("events", function() {
        it("should have an event named CARD_ADDED", function() {
            expect(tdom.events.CARD_ADDED).to.be.a("Symbol");
        });
    });

    describe("EventHandler", function() {

        it("should call an added listener", function() {
            let handler = new tdom.events;
            let calls = 0;
            let arg;
            let myListener = (data) => {
                calls++;
                arg = data;
            };
           handler.addListener(handler.CARD_ADDED, myListener);
           expect(calls).to.equal(0);
           handler.emit(handler.CARD_ADDED, "foo");
           expect(calls).to.equal(1);
           expect(arg).to.equal("foo");
           handler.removeListener(handler.CARD_ADDED, myListener);
           handler.emit(handler.CARD_ADDED, "bar");
           expect(calls).to.equal(1);
           expect(arg).to.equal("foo");
        });

    });

    describe("getBoardIdFromUrl()", function() {
        it("should return the second to last part of a forward slash separated string", function() {
            expect(tdom.getBoardIdFromUrl()).to.equal("aBcdEfGH");
        });
    });

    describe("getContainingList()", function() {
        it("should return null if no div.list found", function() {
        });
    });

    describe("getListName()", function() {

        it("should throw an error when no parameter given", function() {
            expect(tdom.getListName).to.throw(TypeError);
        });
        it("should return 'List Alpha' when called with first js-list DIV", function() {
            let jList = $("div.list")[0];
            expect(tdom.getListName(jList)).to.equal("List Alpha");
        });

    });

    describe("getLists()", function() {
        it("should return a jQuery object with length 4 without parameters", function() {
            let jLists = tdom.getLists();
            expect(jLists).to.be.instanceOf($);
            expect(jLists).to.have.lengthOf(4);
        });
        /*
         * Test page has three lists with 'List' in title
         */
        it("should return an object with length 3 with parameter 'List'", function() {
            expect(tdom.getLists("List")).to.have.lengthOf(3);
        });
        /*
         * The test page has one list not having 'List' in the title
         */
        it("should return an object with length 1 with parameters '' and ['List']", function() {
            expect(tdom.getLists("", ["List"])).to.have.lengthOf(1);
        });
    });

    describe("getCardName()", function() {
        it("should throw TypeError if given argument does not contain a SPAN.list-card-title element", function() {
            expect(tdom.getCardName).to.throw(TypeError);
            expect(() => tdom.getCardName("string")).to.throw(TypeError);
            expect(() => tdom.getCardName($("<span>blaha<p>foo</p></span>"))).to.throw(TypeError);
        });
        it("should return the text inside the SPAN.list-card-title element", function() {
            const html = "<span class='list-card-title'><p>no</p>yes<div>no</div></span>";
            expect(tdom.getCardName($(`<div>${html}</div>`))).to.equal("yes");
            expect(() => tdom.getCardName(html)).to.throw(TypeError);
        });
    });

    describe("getCardsInList()", function() {
        it("should throw TypeError with wrong arguments", function() {
            expect(tdom.getCardsInList).to.throw(TypeError);
            expect(() => tdom.getCardsInList("<div></div>")).to.throw(TypeError);
        });
        it("should return an empty jQuery object given an empty element", function() {
            expect(tdom.getCardsInList("<div></div>", "foo")).to.be.instanceOf($);
        });
        // TODO Add test to look for card in specific list in test file
    });

    describe("getCardsByName()", function() {

        it("should return an empty jQuery object when no card found", function() {
            expect(tdom.getCardsByName("No card")).to.have.lengthOf(0);
        });
        it("should throw an error when no argument given", function() {
            expect(tdom.getCardsByName).to.throw(TypeError);
        });
        it("should return a jQuery object with length 2 with argument 'Twins'", function() {
            expect(tdom.getCardsByName("Twins")).to.have.lengthOf(2);
        });
        it("should return a jQuery object with length 1 with argument 'Card A1'", function() {
            expect(tdom.getCardsByName("Card A1")).to.have.lengthOf(1);
        });
        it("should return an empty jQuery object with arg 'Card A' with exact match true", function() {
            expect(tdom.getCardsByName("Card A", true)).to.have.lengthOf(0);
        });
        it("should return DOM elements of type 'a.list-card'", function() {
            let jCards = tdom.getCardsByName("Card A1");
            expect(jCards[0].tagName).to.equal("A");
            expect(jCards[0].classList.contains("list-card")).to.be.true;
        });
    });

    describe("countCards()", function() {
        it("should return zero for an empty tag", function() {
            const html = "<div></div>";
            expect(tdom.countCards(html, "")).to.equal(0);
        });
        it("should return only cards with titles containing given filter", function() {
            const html = "<div><a class='list-card'><span class='list-card-title'>foo bar</span></a></div>";
            expect(tdom.countCards(html, "foo")).to.equal(0);
            expect(tdom.countCards(html, "bar")).to.equal(0);
            expect(tdom.countCards(html, "")).to.equal(1);
            expect(tdom.countCards(html)).to.equal(1);
            expect(tdom.countCards(html, "hoozit")).to.equal(1);
        });
    });

    describe("countListLabels()", function() {
        it("should throw an error if no parameter", function() {
            expect(tdom.countListLabels).to.throw(TypeError);
        });
        it("should return an array with length 6 without a filter'", function() {
            let jLists = $("div.list");
            let labels = tdom.countListLabels(jLists);
            expect(Object.keys(labels)).to.have.lengthOf(6);
            expect(labels["Label A"]).to.equal(2);
            expect(labels["Label B"]).to.equal(1);
        });
        it("should return an array with length 5 with filter 'C' for 'List Alpha'", function() {
            let jLists = $("div.list");
            let labels = tdom.countListLabels(jLists, ["C"]);
            expect(Object.keys(labels)).to.have.lengthOf(5);
        });
    });

    describe("getCardLabels()", function() {
        it("should throw an error if no parameter", function() {
            expect(tdom.getCardLabels).to.throw(TypeError);
        });
        it("should return an array with length 3 for 'List Alpha'=>'Card A1'", function() {
            let cardEl = tdom.getCardsByName("Card A1")[0];
            let labels = tdom.getCardLabels(cardEl);
            expect(labels).to.have.lengthOf(3);
        });
        it("should return an array with length 2 for 'List Alpha'=>'Card A1' and filter 'B'", function () {
            let cardEl = tdom.getCardsByName("Card A1")[0];
            let labels = tdom.getCardLabels(cardEl, ["B"]);
            expect(labels).to.has.lengthOf(2);
        });
    });

    describe("getCardFields()", function() {
        it("should return Field1 => F1.Option1 for Card C1", function() {
            let jCard = tdom.getCardsByName("Card C1");
            expect(jCard).to.be.an("object").with.lengthOf(1);
            let fields = tdom.getCardFields(jCard[0]);
            expect(fields).to.be.an("array").with.property("Field1", "F1.Option1");
        });
    });

    describe("countLabelsInList()", function() {
        it("NO TESTS WRITTEN YET");
    });

    describe("getLabelColors()", function() {
        it("NO TESTS WRITTEN YET");
    });

    describe("getCardsByLabels()", function() {
        it("NO TESTS WRITTEN YET");
    });

});
