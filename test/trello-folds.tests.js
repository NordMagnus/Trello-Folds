
const requirejs = require('requirejs');
const chai = require('chai');
// const assert = chai.assert;
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
            global.$ = require('jquery');
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
});