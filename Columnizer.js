// import { ReverseTreeDOM } from "./ReverseTreeDOM.js";
import { crm } from "./Crm.js";

export class Columnizer {
    constructor(bodyHtml) {
        const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';
        this.source = bodyHtml;
        this.treeDOM = new ReverseTreeDOM(bodyHtml, fragment => {
            return fragment.querySelector(`[${START_ELEMENT_ATTR}]`);
        });
        this.state = new StateManager(); // Mediator
        this.ranger = new MulticolRanger(this.state); // UI Controller
        this.pager = new MulticolPager(this.state); // UI Controller
        this.view = new MulticolViewer(this.state); // Viewport Controller


    }
}


class StateManager {
    constructor() {

    }
    send(state_code) {

    }
}


HTMLElement.prototype.xpath = function (expression, resultType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE) {
    const evaluator = new XPathEvaluator();
    const result = evaluator.evaluate(expression, this, null, resultType, null);
    return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i));
};

Object.defineProperty(DocumentFragment.prototype, innerHTML, {
    set: function (newValue) {
        const div = document.createElement("DIV");
        div.innerHTML = newValue;
        while (div.firstChild) {
            this.appendChild(div.firstChild);
        }
    },
    get: function () {
        const div = document.createElement("DIV");
        div.appendChild(this.cloneNode(true));
        return div.innerHTML;
    },
    enumerable: false,
    configurable: false
});


class ReverseTreeDOM {
    /**
     * ツリー状のソースDOMの操作と参照に責務を負うクラス
     * @param {*} html - HTMLコード断片, DOM, またはNodeList
     * @param {Function} callBack - 開始要素を特定するコールバック関数
     * @param {Function} callBack.fragment - 開始要素を検索する対象のルートノード
     */
    constructor(html, callBack) {
        // ライトDOMに運ぶためのノード
        this.fragment = document.createDocumentFragment();
        if (typeof html === 'string') {
            this.fragment.innerHTML = html;

        } else if (html instanceof HTMLElement) {
            this.fragment.appendChild(html);

        } else if (html instanceof NodeList) {
            html.forEach(node => this.fragment.appendChild(node));

        } else {
            throw new TypeError("与えられたソースからはDOMを構築できません");
        }

        // ユーザーがツリー探索の開始点として選択した要素
        this.startElement = (() => {
            const el = callBack(this.fragment);
            if (!el) throw new Error("開始要素を特定できません");
            return el;
        })();

        // ユーザーの選択過程の要素
        this.currentElement = this.startElement;

        // ユーザーが最終的に選択した要素
        this.endElelemnt = null;

        // ユーザーの選択しうる要素の配列
        this.ancestors = this.startElement.xpath("ancestor-or-self::*");

    }

    /**
     * ツリーを上下して現在の要素を変更する
     * @param {1|-1} direction - ツリー移動の方向（1で親へ, -1で子へ）
     */
    walk(direction) {
        const ancestors = this.ancestors;
        const i = ancestors.indexOf(this.currentElement);
        this.currentElement = ancestors[i + direction] || this.currentElement;
    }
}


// ReverseTreeDOMのrootElementを確定する責務を負う（ユーザーに選択させるGUIの提供）
class MulticolRanger {
    #ui = `
<button is="widen-button" class="enable" title="${crm.i18n('widen')}">範囲を広げる</button>
<button is="undo-button" class="disable" title="${crm.i18n('undo')}">元に戻す</button>`
    /** 
    * @param {ReverseTreeDOM} treeDom
    * @param {StateManager} state
    */
    constructor(treeDom, state) {
        // カスタム要素の定義
        const WidenButton = class extends HTMLButtonElement {
            constructor(parent) {
                super();
                this.addEventListener('click', parent.widen);
            }
        }
        const UndoButton = class extends HTMLButtonElement {
            constructor(parent) {
                super();
                this.addEventListener('click', parent.undo);
            }
        }
        // カスタム要素の登録
        customElements.define("widen-button", WidenButton);
        customElements.define("undo-button", UndoButton);

        const df = document.createDocumentFragment();
        df.innerHTML = this.#ui;

        this.fragment = df;
        this.dom = treeDom;
        this.state = state;
    }
    // マルチカラム対象要素を広げる（親要素に遡及）
    widen() {
        treeDom.walk(1);

    }
    // 元に戻す（子要素に戻る）
    undo() {
        treeDom.walk(-1);
    }
}

// rootElement確定後のページングの論理的責務を負う
class MulticolPager {
    next() { }
    prev() { }
}

// 
class MulticolViewer {
    /**
     * 
     * @param {Document} lightDom 
     */
    #ui = `
<body>
    <multicol-div></multicol-div>
    <controller-div></controller-div>
</body>`
    construcor(lightDom) {
        const ControllerDiv = class extends HTMLElement {
            constructor() {
                super();
            }
        }
        const MulticolDiv = class extends HTMLElement {
            constructor() {
                super();
            }
        }
        this.lightDom = lightDom;
        customElements.define('controller-div', ControllerDiv);
        customElements.define('multicol-div', MulticolDiv);

        const df = this.lightDom.createDocumentFragment();
        df.innerHTML = this.#ui;
        this.lightDom.body.replaceWith(df.firstChild);
        this.multicolDiv = this.lightDom.querySelector('multicol-div');
        this.controllerDiv = this.lightDom.querySelector('controller-div');
    }

    /**
     * 
     * @param {Node} node - appendChildするノード（DocumentFragment推奨）
     */
    setController(node) {
        this.controllerDiv.appendChild(node);
    }
}

class UIController {

}

