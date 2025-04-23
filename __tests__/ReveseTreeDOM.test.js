import { TextEncoder, TextDecoder } from 'util';
import { JSDOM } from 'jsdom';
import { ReverseTreeDOM } from '../Columnizer.js';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('ReverseTreeDOM', () => {
    let dom, document, testElement;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><div id="test"><p>Child1</p><p>Child2</p></div>');
        document = dom.window.document;
        testElement = document.getElementById('test');
    });

    test('コンストラクタが正しくDOM要素を受け取る', () => {
        const reverseTree = new ReverseTreeDOM(testElement);
        expect(reverseTree.root).toBe(testElement);
    });

    test('walkメソッドが子要素を逆順に処理する', () => {
        const reverseTree = new ReverseTreeDOM(testElement);
        const result = [];
        reverseTree.walk(node => result.push(node.textContent));
        expect(result).toEqual(['Child2', 'Child1']);
    });
});