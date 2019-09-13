
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
        return JSDOM.fromFile("test/trello-folds-test-board.html", {
            url: "https://trello.com/b/aBcdEfGH/trello-folds-test-board",
        }).then((dom) => {
            global.window = dom.window;
            global.document = dom.window.document;
            global.$ = require('jquery');
            global.tdom = requirejs("tdom");
        });
    });

    describe("dom", function() {
        it("should have a list called 'Alpha'", function() {
            let jName = $.find("h2.js-list-name-assist:contains('Alpha')");
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
        it("should return 'Alpha' when called with first js-list DIV", function() {
            let $lists = $("div.js-list-content");
            let jList = $lists[0];
            expect(tdom.getListName(jList)).to.equal("Alpha");
        });

    });

    describe("getLists()", function() {
        it("should return a jQuery object with length 9 without parameters", function() {
            let jLists = tdom.getLists();
            expect(jLists).to.be.instanceOf($);
            expect(jLists).to.have.lengthOf(9);
        });
        /*
         * Test page has three lists with 'List' in title
         */
        it("should return an object with length 5 with parameter 'Sub'", function() {
            expect(tdom.getLists("Sub")).to.have.lengthOf(5);
        });
        /*
         * The test page has one list not having 'List' in the title
         */
        it("should return an object with length 4 with parameters '' and ['Sub']", function() {
            expect(tdom.getLists("", ["Sub"])).to.have.lengthOf(4);
        });
    });

    describe("getCardName()", function() {
        it("should throw TypeError if given argument does not contain a SPAN.list-card-title element", function() {
            expect(tdom.getCardName).to.throw(TypeError);
            expect(() => tdom.getCardName("string")).to.throw(TypeError);
        });
        it("should return undefined if span not found", function() {
            expect(tdom.getCardName($("<span>blaha<p>foo</p></span>"))).to.be.undefined;
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
        it("should return a jQuery object with length 1 with argument 'A1'", function() {
            expect(tdom.getCardsByName("A1")).to.have.lengthOf(1);
        });
        it("should return an empty jQuery object with arg 'A' with exact match true", function() {
            expect(tdom.getCardsByName("A", true)).to.have.lengthOf(0);
        });
        it("should return DOM elements of type 'a.list-card'", function() {
            let jCards = tdom.getCardsByName("A1");
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
        it("should only look at beginning if pos specified");
    });

    describe("countListLabels()", function() {
        it("should throw an error if no parameter", function() {
            expect(tdom.countListLabels).to.throw(TypeError);
        });
        it("should return an array with length 5 without a filter'", function() {
            let jLists = $("div.list");
            let labels = tdom.countListLabels(jLists);
            expect(Object.keys(labels)).to.have.lengthOf(5);
            expect(labels["label1"]).to.equal(5);
            expect(labels["label5"]).to.equal(1);
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
        it("should return an array with length 1 for 'Alpha'=>'A1'", function() {
            let cardEl = tdom.getCardsByName("A1")[0];
            let labels = tdom.getCardLabels(cardEl);
            expect(labels).to.have.lengthOf(1);
        });
        it("should return an array with length 2 for 'Alpha'=>'A3' and filter '2'", function () {
            let cardEl = tdom.getCardsByName("A3")[0];
            let labels = tdom.getCardLabels(cardEl, ["2"]);
            expect(labels).to.has.lengthOf(2);
        });
    });

    describe("getCardFields()", function() {
        it("should return Blocked and Team props Card C1", function() {
            let jCard = tdom.getCardsByName("C1");
            expect(jCard).to.be.an("object").with.lengthOf(1);
            let fields = tdom.getCardFields(jCard[0]);
            expect(fields).to.be.an("array").with.property("Blocked", "true");
            expect(fields).to.be.an("array").with.property("Team", "Team Foo");
        });
    });

    describe("countLabelsInList()", function() {
        it("should return an empty array for a list without labels", function() {
            let jList = tdom.getLists("Bravo");
            let labels = tdom.countLabelsInList(jList);
            expect(labels).to.be.empty;
        });
        it("should return an array with label counts for 'Alpha'", function() {
            let jList = tdom.getLists("Alpha");
            let labels = tdom.countLabelsInList(jList);
            expect(labels).to.haveOwnProperty("label1");
            expect(labels).to.haveOwnProperty("label2");
            expect(labels).to.haveOwnProperty("label3");
            expect(labels).to.haveOwnProperty("label4");
            expect(labels).to.haveOwnProperty("label5");
            expect(labels["label1"]).to.equal(5);
            expect(labels["label2"]).to.equal(4);
            expect(labels["label3"]).to.equal(3);
            expect(labels["label4"]).to.equal(2);
            expect(labels["label5"]).to.equal(1);
        });
    });

    describe("containsAny()", function() {
        it("should return false if filter not found", function() {
            const testString = "Why do cars have breaks?";
            /*
             * Using strings for filtering
             */
            expect(tdom.containsAny(testString, "foo")).to.be.false;
            expect(tdom.containsAny(testString, "why")).to.be.false;
            expect(tdom.containsAny(testString, "??")).to.be.false;
            expect(tdom.containsAny(testString, "have  ")).to.be.false;
            expect(tdom.containsAny(testString, "w")).to.be.false;
            /*
            * Using array for filtering
            */
           expect(tdom.containsAny(testString, ["foo"])).to.be.false;
           expect(tdom.containsAny(testString, ["w"])).to.be.false;
           expect(tdom.containsAny(testString, ["w", "??", "hoozit"])).to.be.false;
        });
        it("should return true if filter found", function() {
            const testString = "Why do cars have breaks?";
            /*
             * Using strings for filtering
             */
            expect(tdom.containsAny(testString, "Why")).to.be.true;
            expect(tdom.containsAny(testString, "")).to.be.true;
            expect(tdom.containsAny(testString, " ")).to.be.true;
            expect(tdom.containsAny(testString, "car")).to.be.true;
            /*
             * Using array for filtering
             */
            expect(tdom.containsAny(testString, ["Why", "do", "cars"])).to.be.true;
            expect(tdom.containsAny(testString, ["Why"])).to.be.true;
            expect(tdom.containsAny(testString, ["", "", ""])).to.be.true;
            expect(tdom.containsAny(testString, ["?"])).to.be.true;
            expect(tdom.containsAny(testString, ["??", "?"])).to.be.true;
        });
    });
});
