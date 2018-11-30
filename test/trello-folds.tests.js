
const requirejs = require('requirejs');
const chai = require('chai');
const chaiJquery = require('chai-jquery');
const {expect} = chai;

requirejs.config({
    baseUrl: ".",
    paths: {
        tdom: "extension/tdom",
        tfolds: "extension/trello-folds",
    },
});

describe('tfolds', function() {

    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    const sections1 = [
        "## Section",
        "## Section ##",
        "### Section ###",
        "Section ##",
        "  ## Section ##",
    ];
    const sections2 = [
        "** Section",
        "*** Section ***",
        "Section **",
    ];

    before(function() {
        return JSDOM.fromFile("test/squadification-board.html").then((dom) => {
            global.window = dom.window;
            global.jQuery = global.$ = require('jquery');
            chai.use(chaiJquery);
            global.tdom = requirejs("tdom");
            global.tfolds = requirejs("tfolds");
        });
    });

    beforeEach(function() {
        tfolds.sectionCharacter = "#";
        tfolds.sectionRepeat = 2;
    });

    describe("sectionIdentifier", function() {
        it("should return ## as default", function() {
            expect(tfolds.sectionIdentifier).to.equal("##");
        });
        it("should return whatever the character is set to twice", function() {
            tfolds.sectionCharacter = "*";
            expect(tfolds.sectionIdentifier).to.equal("**");
            tfolds.sectionCharacter = "#";
        });
    });

    describe("isSection()", function() {
        it("should return true for any string with the dedicated char repeated N times", function() {
            sections1.forEach((s) => {
                expect(tfolds.isSection(s)).to.be.true;
            });
        });
    });

    describe("getStrippedTitle()", function() {
        it("should return a string with all section dedicated chars removed", function() {
            sections1.forEach((s) => {
                expect(tfolds.getStrippedTitle(s)).to.equal("Section");
            });

            tfolds.sectionRepeat = 3;
            expect(tfolds.getStrippedTitle(sections1[2])).to.equal("Section");
            expect(tfolds.getStrippedTitle(sections1[1])).to.not.equal("Section");

            tfolds.sectionCharacter = "*";
            tfolds.sectionRepeat = 2;
            sections2.forEach((s) => {
                expect(tfolds.getStrippedTitle(s)).to.equal("Section");
            });

        });
    });

    describe("showWipLimit()", function() {
        it("should not show WiP limit when not defined for list", function() {
            /*
             * List A does not have a WiP limit defined,
             * e.g. does not end with [x]
             */
            let $l = tdom.getLists("List Alpha");
            expect($l).to.have.lengthOf(1);
            tfolds.showWipLimit($l[0]);
            expect($l).to.not.have.class("wip-limit-reached");
            expect($l).to.not.have.class("wip-limit-exceeded");
            expect($l.find("span.wip-limit-title")).to.have.lengthOf(0);
        });
        it("should show WiP limit if settings.alwaysCount is true", function() {
            tfolds.alwaysCount = true;
            let $l = tdom.getLists("List Alpha");
            expect($l).to.have.lengthOf(1);
            tfolds.showWipLimit($l[0]);
            expect($l).to.not.have.class("wip-limit-reached");
            expect($l).to.not.have.class("wip-limit-exceeded");
            expect($l.find("span.wip-limit-title")).to.have.lengthOf(1);
            tfolds.alwaysCount = false;
            tfolds.showWipLimit($l[0]); // Remove wip limit badge
        });
    });

    describe("extractWipLimit()", function() {
        it("should return 'null' if now WiP limit (i.e. no [x] in title)", function() {
            let $l = tdom.getLists("List Alpha");
            let wipLimit = tfolds.extractWipLimit($l[0]);
            expect(wipLimit).to.be.null;
        });
        it("should return an integer with the WiP limit if it exists");
    });

    describe("addWipLimit()", function() {
        it("should contain a span.wip-limit-title with the title", function() {
            let $l = tdom.getLists("List Alpha");

            $l.data("subList", false);

            tfolds.addWipLimit($l, 5);
            let titleEl = $l.find("span.wip-limit-title");

            expect($(titleEl)).to.contain("List Alpha");
        });
        /*
         * addWipLimit() is only called when a badge should be displayed
         * so a span.wip-limit-badge should always be created after calling this method.
         */
        it("should always add a span.wip-limit-badge", function() {
            let $l = tdom.getLists("List Alpha");
            let $span;

            $l.data("subList", false);

            tfolds.addWipLimit($l, 5);
            expect($l).to.have.descendants("span.wip-limit-badge");
            $span = $l.find("span.wip-limit-badge");
            expect($span).to.have.lengthOf(1);
            expect($span).to.have.text("5");

            /*
             * Calling the method again should replace any existing span.
             */
            tfolds.addWipLimit($l, 3, 6);
            expect($l).to.have.descendants("span.wip-limit-badge");
            $span = $l.find("span.wip-limit-badge");
            expect($span).to.have.lengthOf(1);
            expect($span).to.have.text("3 / 6");
        });
        /*
         * If it is a sub list the limit should be applied to the parent
         * list instead and never displayed.
         */
        it("should never display a limit for sub lists", function() {
            let $l = tdom.getLists("List Alpha");
            let $span;

            $l.data("subList", true);
            tfolds.addWipLimit($l, 5);
            expect($l).to.have.descendants("span.wip-limit-badge");
            $span = $l.find("span.wip-limit-badge");
            expect($span).to.have.lengthOf(1);
            expect($span).to.have.text("5");

            tfolds.addWipLimit($l, 3, 6);
            expect($l).to.have.descendants("span.wip-limit-badge");
            $span = $l.find("span.wip-limit-badge");
            expect($span).to.have.lengthOf(1);
            expect($span).to.have.text("3");
        });
    });
});