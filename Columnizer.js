// import { ReverseTreeDOM } from "./ReverseTreeDOM.js";
// import { crm } from "./Crm.js";
import { object } from "webidl-conversions";
import { MulticolPaginator } from "./MulticolPaginator.v0.3.js";
import { NakedHTML } from "./NakedHTML.js";


const Status = Object.freeze({
    WAIT_FOR_ACTION: 'WAIT_FOR_ACTION',

    CANNOT_WIDEN: 'CANNOT_WIDEN',
    CANNOT_NARROW: 'CANNOT_NARROW',
    CANNOT_GO_PREV: 'CANNOT_GO_PREV',
    CANNOT_GO_NEXT: 'CANNOT_GO_NEXT',

    WIDEN_SUCCESS: 'WIDEN_SUCCESS',
    NARROW_SUCCESS: 'NARROW_SUCCESS',
    GO_PREV_SUCCESS: 'GO_PREV_SUCCESS',
    GO_NEXT_SUCCESS: 'GO_NEXT_SUCCESS',

    TOAST_ACTIVE: 'TOAST_ACTIVE', //トーストコンポーネントにてメッセージ表示中（約１秒前後）
    TOAST_IDLE: 'TOAST_IDLE'
});

const Events = Object.freeze({
    USER_WIDEN: 'USER_WIDEN',
    USER_NARROW: 'USER_NARROW',
    USER_GO_PREV: 'USER_GO_PREV',
    USER_GO_NEXT: 'USER_GO_NEXT'
});


HTMLElement.prototype.ancestors = function () {
    const ancestors = [];
    let el = this;
    while (el instanceof Element) {
        ancestors.push(el);
        el = el.parentNode;
    }
    return ancestors;
};

/**
 * ユーザーはビューを通じてControllerを操作し、閲覧範囲を決定する
 * 閲覧範囲はControllerがRtDOMを使ってwalkメソッドで開始位置から祖先にさかのぼり、
 * getHTMLメソッドで取得したHTMLソースをViewに渡し、
 * ユーザーはさらにさかのぼるかどうかを選択。最終的に閲覧範囲が決定する。
 * Controllerは決定した範囲をMulticolPaginatorに渡し、ページを分割させる
 * Controllerは1ページ目を初期表示する
 * ユーザーはビューを通じてControllerを操作し、ページを選択する
 */
export class Columnizer {
    constructor(bodyHtml) {

        const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';

        this.StateManager = new StateManager({
            range: Status.WAIT_FOR_ACTION,
            page: Status.WAIT_FOR_ACTION,
            toast: Status.TOAST_IDLE
        }, Events);

        this.StateManager.subscribe(state => {
            switch (state.event) {
                case Events.USER_GO_NEXT:
                    if (state.page === Status.CANNOT_GO_NEXT) {
                        this.toast('<strong style="font-size: 5em;">&gt;|</strong>');
                    }
                    break;
                case Events.USER_GO_PREV:
                    if (state.page === Status.CANNOT_GO_PREV) {
                        this.toast('<strong style="font-size: 5em;">|&lt;</strong>');
                    }
                    break;
                case Events.USER_NARROW:
                    if (state.range === Status.CANNOT_NARROW) {
                        this.toast('Min');
                    }
                    break;
                case Events.USER_WIDEN:
                    if (state.range === Status.CANNOT_WIDEN) {
                        this.toast('Max');
                    }
                    break;
            }
        })

        const naked = NakedHTML.fromString(bodyHtml);
        naked.removeNodes();
        naked.removeAttributes();
        naked.removeWrappers();
        naked.processBreaks();

        const nakedHtml = naked.toString();

        console.log(`Initializing ReversTreeDOM...searching attr <${START_ELEMENT_ATTR}>`);

        this.RtDOM = new ReverseTreeDOM(nakedHtml, fragment => {
            return fragment.querySelector(`[${START_ELEMENT_ATTR}]`);
        }, document);

        this.Paginator = null; // ユーザーが閲覧範囲を決定してからセットされる

        this.View = new View();

        this._metricsDiv = document.body.querySelector('#metrics-container');

        document.addEventListener('keydown', event => {
            const action = {
                'ArrowLeft': this.prev,
                'ArrowRight': this.next,
                'ArrowUp': this.widen,
                'ArrowDown': this.narrow
            }[event.key];

            if (action) {
                event.preventDefault();
                action.call(this);
            }
        });

    }
    main() {
        this.View.stdout = this.RtDOM.currentElement.cloneNode(true);
    }
    widen() {
        const walkResult = this.RtDOM.walk(1);
        if (walkResult.isTerminal) {
            this.state.range = Status.CANNOT_WIDEN;
        } else {
            this.View.stdout = walkResult.currentElement.cloneNode(true);
            this.state.range = Status.WIDEN_SUCCESS;
        }
    }
    narrow() {
        const walkResult = this.RtDOM.walk(-1);
        if (walkResult.isTerminal) {
            this.state.range = Status.CANNOT_NARROW
        } else {
            this.View.stdout = walkResult.currentElement.cloneNode(true);
            this.state.range = Status.NARROW_SUCCESS;
        }
    }
    columnize() {
        // paginatorを初期化する（1ページ目が生成される）
        this.Paginator = new MulticolPaginator(this.RtDOM.getHTML(), this._metricsDiv);
        this.View.stdout = this.Paginator.currentPage();
    }
    prev() {
        const page = this.Paginator.prevPage();
        if (page) {
            this.View.stdout = page;
        } else {
            this.state.page = Status.CANNOT_GO_PREV;
        }
    }
    next() {
        const page = this.Paginator.nextPage();
        if (page) {
            this.View.stdout = this.Paginator.nextPage();
        } else {
            this.state.page = Status.CANNOT_GO_NEXT;
        }
    }
    async toast(message) {
        this.status.toast = Status.TOAST_ACTIVE;

        await this.View.popupToast(message);

        this.status.toast = Status.TOAST_IDLE;
    }

    get state() {
        return this.StateManager.state
    }
}


class StateManager {
    /**
     * @constructor
     * @param {Object} initialStatus - 初期状態オブジェクト
     * @param {Object} events - イベント定数のオブジェクト
     */
    constructor(initialStatus, events) {
        this.state = new Proxy(initialStatus, {
            /**
             * プロパティの変更時に通知を発火
             * @param {Object} target - 変更対象のオブジェクト
             * @param {string} key - 変更したプロパティ名
             * @param {*} value - 新しい値
             * @returns {boolean} - 変更が成功したかどうか
             */
            set: (target, key, value) => {
                target[key] = value;
                this.notifySubscribers(); // 状態変更時に通知
                if (key in events) {
                    target[key] = null; // イベントは「消費」される
                }
                return true;
            }
        });
        this._events = events


        this.subscribers = []; // 更新関数のリスト
    }

    /**
     * ビューの更新関数を登録する
     * @param {Function} callback - 状態変更時に実行する関数
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    }

    /**
     * 登録された更新関数をすべて実行する
     */
    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.state));
    }

}

// // 使用例
// const stateManager = new StateManager({ isActive: false });

// stateManager.subscribe(state => {
//   document.getElementById("view").style.display = state.isActive ? "block" : "none";
// });

// document.getElementById("toggleButton").addEventListener("click", () => {
//   stateManager.state.isActive = !stateManager.state.isActive;
// });



/**
 * RtDOMはHTMLオリジナルソース（サニタイズ後）を保持し、
 * walkメソッドで読書範囲を変更、
 * getHTMLメソッドでHTMLソースを返すModel。
 */
class ReverseTreeDOM {
    #startElement;
    #ancestors;
    #currentIndex;

    /**
     * 
     * @param {*} html 
     * @param {Function} callBack - ルートノードDocumentFragmentを引数として開始要素を返すコールバック関数
     * @param {Document} ownerDoc 
     */
    constructor(html, callBack, ownerDoc = document) {

        const fragment = ownerDoc.createDocumentFragment();
        if (typeof html === 'string') {
            fragment.innerHTML = html;
        } else if (html instanceof ownerDoc.defaultView.HTMLElement) {
            fragment.append(html);
        } else if (html instanceof ownerDoc.defaultView.NodeList) {
            fragment.append(...html);
        } else {
            throw new TypeError("与えられたソースからはDOMを構築できません");
        }

        this.#startElement = (() => {
            const el = callBack(fragment);
            if (!el) throw new Error("開始要素を特定できません");
            return el;
        })();

        this.#ancestors = this.#startElement.ancestors();
        this.#currentIndex = 0;
    }

    get currentElement() {
        return this.#ancestors[this.#currentIndex];
    }

    /**
     * ツリーを上下して現在の要素を変更する
     * @param {1|-1} direction - ツリー移動の方向（1で親へ, -1で子へ）
     */
    walk(direction) {
        const i = this.#currentIndex;
        const nextIndex = i + direction;
        const isTerminal = nextIndex in this.#ancestors;
        if (isTerminal) {
            this.#currentIndex = i;
        } else {
            this.#currentIndex = nextIndex;
        }
        return { isTerminal, currentElement: this.currentElement };
    }

    /**
     * 現在要素の子ノードたちのHTMLコードを返す
     * @returns String
     */
    getHTML() {
        const nl = this.currentElement.cloneNode(true).childNodes
        const fragment = document.createDocumentFragment();
        fragment.append(...nl);
        return fragment.innerHTML;
    }
}



class View {
    constructor() {
        if (!customElements.get('toast-div')) {
            customElements.define('toast-div', ToastDiv);
        }
        this._toast = null;
        this._stdout = document.querySelector('#output-container');
        this._virout = document.body.querySelector('#metrics-container');
    }
    async popupToast(message, fadeOutDuration = 1.0) {
        if (!this._toast) {
            this._toast = new ToastDiv();
        }
        this.connectDOM(this._toast);
        await this._toast.popup(message, fadeOutDuration);
        this.disconnectDOM(this._toast);

    }

    connectDOM(component, connector = document.body) {
        if (component.isConnected) return;
        connector.append(component);
    }

    disconnectDOM(component) {
        if (!component.isConnected) return;
        component.remove();
    }

    get stdout() { // ユーザーに結果を表示する標準出力
        return this._stdout.innerHTML;
    }
    set stdout(html) {
        if (typeof html === 'string') {
            this._stdout.innerHTML = html;
        } else if (html instanceof Node) {
            this._stdout.replaceChildren(html);
        } else if (html instanceof NodeList) {
            this._stdout.replaceChildren(...html);
        }
    }
    get virout() { // 計算用の仮想出力
        return this._virout;
    }
}

class ToastDiv extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' }).innerHTML = `
            <style>
                :host {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 1000;
                    pointer-events: none; /* クリックを透過させる */
                }
                div {
                    font-size: 4em;
                    white-space: nowrap;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 5px;
                }
            </style>
            <div></div>
        `;
        this._messageContainer = this.shadowRoot.querySelector('div');

        this.timerID = null;
        this._currentPopupResolve = null;
    }

    connectedCallback() {
        // DOMに接続されたときに、常に初期状態にリセット
        this.clearFadeOut();
    }

    disconnectedCallback() {
        this.clearTimer();
        this.clearFadeOut();
    }

    // popup()が連続して呼ばれたり、disconnectedCallbackで使うためのヘルパー
    clearTimer() {
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
        if (this._currentPopupResolve) {
            this._currentPopupResolve();
            this._currentPopupResolve = null;
        }
    }

    /**
     * トーストをメッセージで更新し、その瞬間からフェードアウトを開始する。
     * フェードアウト完了時にPromiseを解決する。
     * @param {string} message - 表示するメッセージ (innerHTML)
     * @param {number} fadeOutDuration - フェードアウトにかかる秒数
     * @returns {Promise<void>} フェードアウトが完了したときに解決されるPromise
     */
    async popup(message, fadeOutDuration = 1.0) {

        this.clearTimer();
        this.message = message;
        this.clearFadeOut(); // フェードアウトスタイルをクリア
        this.reflow(); // 再描画
        this.fadeOut(fadeOutDuration); // フェードアウトスタイルを適用

        return new Promise(resolve => {
            this._currentPopupResolve = resolve;

            this.timerID = setTimeout(() => {
                this._currentPopupResolve = null;
                this.timerID = null;
                resolve();
            }, (fadeOutDuration * 1000) + 50);
        });
    }

    clearFadeOut() {
        this.style.transition = 'none';
        this.style.opacity = '1';
    }
    reflow() {
        this.offsetHeight;
    }
    fadeOut(duration) {
        this.style.transition = `opacity ${duration}s ease-out`;
        this.style.opacity = '0';
    }
    get message() {
        return this._messageContainer.innerHTML;
    }
    set message(message) {
        this._messageContainer.innerHTML = message;
    }
}