Node.prototype.getParentChain_ = function (root) {
    // root（HTMLElement型）までの祖先要素のリスト（document-order）を返す
    const chain = [];
    if (this.nodeType === Node.ELEMENT_NODE) {
        chain.push(this);
    }
    let current = this.parentNode;
    if (!root) root = this.ownerDocument.body;

    while (current && current !== root) {
        chain.unshift(current); // 親→子の順で保持
        current = current.parentNode;
    }

    return chain;
};
Node.prototype.cloneNode_ = function (weakMap, reverseMap) {
    // シャロークローンしつつクローン元とのマッピングを行う点がcloneNodeとの違い
    const nodeClone = this.cloneNode(false);
    weakMap.set(this, nodeClone);
    reverseMap.set(nodeClone, this);
    return nodeClone;
}
Element.prototype.xpath_ = function (expression, resultType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE) {
    const evaluator = new XPathEvaluator();
    const result = evaluator.evaluate(expression, this, null, resultType, null);
    return Array.from({ length: result.snapshotLength }, (_, i) => result.snapshotItem(i));
};
Object.defineProperty(DocumentFragment.prototype, 'innerHTML', {
    set: function (newValue) {
        const div = document.createElement("DIV");
        div.innerHTML = newValue;
        this.append(...div.childNodes);
    },
    get: function () {
        const div = document.createElement("DIV");
        div.append(this.cloneNode(true));
        return div.innerHTML;
    },
    enumerable: false,
    configurable: false
});

const Status = Object.freeze({
    JUST_RIGHT: 1,
    HUNGRY: 2,
    FULL: 3
});


/**
 * 高さ測定用のカスタム要素。コンテンツを追加してページ高さを判定。
 * eatメソッドでHTMLを「食べさせる」（残りの断片を返す）
 * vomitであふれたHTMLを「吐かせる」（ページの高さをうわまわる部分のみ）
 * eatは追加で食べさせることもできるようにする予定。
 * 最初から食べさせたい場合は new PageDivで新しいインスタンスを作ること。
 * 例えばviewportが変わったときに現在表示中のPageDivと、前のPageDivはeat/vomitで微調整できるが、
 * 次のページは開始点から構築しなおさなければならないので new PageDiv。
 */
class PageDiv extends HTMLElement {
    /**
     * 
     * @param {number} pageIndex - ページ番号
     * @param {number} height - コンテンツ量を決定する高さ（px）
     */
    constructor(pageIndex, height) {
        super();
        // マルチカラムは高さが指定されていると横に拡がっていく特性を持っている
        // 幅だけが指定されていると高さが広がっていく。
        // 幅も高さも指定されていると、横に拡がっていく。
        this.style.display = 'block';
        this.style.overflowX = 'auto'; // 実際にはスクロールバーが出ないようにコンテンツ量が調整される
        this.style.height = height + 'px';
        this.style.columnWidth = '25em';
        this.style.wordBreak = 'break-word';
        this.style.overflowWrap = 'break-word';
        this.contentEditable = true;

        // プロパティ
        this.pageIndex = pageIndex;

        this._foodRoot = document.createElement('div'); // ソースをReadOnlyなメモリ上のDOMに保持する
        this._cloneRoot = this.appendChild(document.createElement('div')); // _foodsのクローン。ライトDOMに接続する。

        this._foodMap = new WeakMap(); // WeakMap（DOM内のクローンから対応するf_foods内のNodeを参照するためのマップ）
        this._cloneMap = new WeakMap(); // WeakMap（_foods内のNodeから対応するクローンを参照するためのマップ）

        this._foodMap.set(this._cloneRoot, this._foodRoot);
        this._cloneMap.set(this._foodRoot, this._cloneRoot);

        this._terminalNode = null // _leftOverの分岐点として使用されるfood内のノード
        this._state = Status.HUNGRY; // getter/setterあり

        this.LeftOverGenerator = null; // foodDOM内を走査するTreeWalkerのラッパージェネレータ。ノードの追加を可能にする。
    }

    /**
     * 対象となるHTMLソースを「消化」し、無名divに包まれた残りのHTMLコードを返す。テキストノードは二分探索。
     * @param {String} foodHtml - 処理対象のHTMLソース（ルート要素を持つとは限らない）
     * @returns {String|null} - 食べ残した残りのHTML（開始タグを適切につけて）
     */
    eat(foodHtml) {

        if (this.state !== Status.HUNGRY) return null;

        // DOMに接続されていなければ測定できないためエラー
        if (!this.parentNode) {
            throw new Error("<page-div> is not attached to a valid DOM element.");
        }

        this._foodRoot.innerHTML = foodHtml;

        this.LeftOverGenerator = this._generateLeftOvers();

        const leftOver = this.LeftOverGenerator.next();

        return leftOver.done ? null : leftOver.value;

    }

    *_generateLeftOvers(isFoward = true) {
        // 満腹になるまでfoodの複製を食べ続ける
        // 空腹状態になったら食事は再開される

        let walker = document.createTreeWalker(
            this._foodRoot, // トラバースを開始するルートノード
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null
        );

        while (walker.nextNode()) {

            const node = walker.currentNode;

            switch (node.nodeType) {

                case Node.ELEMENT_NODE:
                    const cloneEl = node.cloneNode_(this._cloneMap, this._foodMap); // シャロークローンしつつクローン元とのマッピングを行う

                    switch (this._tryConnectDom(cloneEl, node)) {

                        case Status.FULL:
                            walker.previousNode(); // 次回ジェネレータ呼び出しのためにカレントノードを一つ前（ぎりぎりHUNGLYを実現したノード）に戻しておく
                            yield this._leftOver();
                            break;

                        case Status.HUNGRY:
                            this._terminalNode = node; // 暫定的にターミナルノードとして記録 -> nextNode()でFULLなら確定
                            break;

                    }
                    break;

                case Node.TEXT_NODE:
                    if (node.nodeValue.trim() === '') break;

                    const cloneText = node.cloneNode_(this._cloneMap, this._foodMap);

                    switch (this._tryConnectDom(cloneText, node)) {

                        case Status.FULL:
                            this._terminalNode = this._handleTextNode(cloneText);
                            walker.previousNode(); // 次回ジェネレータ呼び出しのためにカレントノードを一つ前（ぎりぎりHUNGLYを実現したノード）に戻しておく
                            yield this._leftOver();
                            break;

                        case Status.HUNGRY:
                            this._terminalNode = node;
                    }
            }
        }

    }

    _tryConnectDom(nodeClone, nodeOriginal) {
        // ノード断片のDOM接続を「試す」
        // つまりFULLの場合はDOM接続はリセットされる
        const domConnector = this._cloneMap.get(nodeOriginal.parentNode);
        domConnector.appendChild(nodeClone);
        const state = this.state;
        switch (state) {
            case Status.FULL:
                nodeClone.remove();
        }
        return state;
    }

    /**
     * eatとは逆の操作
     * FULLの状態になっていたら吐き戻す
     */
    vomit() {
        if (this.state !== Status.FULL) {
            return null;
        }


    }

    /**
     * 追加でつまむ
     */
    nibble() {
        if (this.state !== Status.HUNGRY) {
            return null;
        }
        const leftOver = this.LeftOverGenerator.next();
        return leftOver.done ? null : leftOver.value;
    }

    /**
     * 食べきれなかった残りのHTMLを戻す
     * @returns {String} - ページからあふれた残りのHTML（開始タグを適切に付けて）
     */
    _leftOver() {
        // マーカーコメントを挿入

        const terminalNode = this._terminalNode;

        const marker = document.createComment("split-marker");
        terminalNode.parentNode.insertBefore(marker, terminalNode.nextSibling);

        // 終了タグ・開始タグのセットを生成
        const parentChain = terminalNode.getParentChain_(this._foodRoot);

        let openingTags = '';

        parentChain.forEach((parent) => {
            const tagName = parent.tagName.toLowerCase();
            const attributesStr = Array.from(parent.attributes)
                .map(attr => `${attr.name}="${attr.value}"`)
                .join(' ');

            openingTags = `<${tagName}${attributesStr ? ' ' + attributesStr : ''}>` + openingTags;
        });

        const wholeHtml = this._foodRoot.innerHTML;
        const zengo = wholeHtml.split(`<!--${marker.nodeValue}-->`); // <!-- が X3C!-- に化けるので回避

        return openingTags + zengo[1];
    }

    /**
     * 
     * @param {Text} textNode - DOMに接続済みのテキストノード
     * @returns {Text} - JUST_RIGHTなテキストノード
     */
    _handleTextNode(textNode) {
        // ターミナルノードを決定する責務を持つ。
        // 二分探索法でテキストノードのコンテンツ量を増減して、適切な位置を決定
        // food内の対応するテキストノードも分割する
        const originalText = textNode.textContent; // テキスト全体をメモリに確保
        let left = 0; // 開始位置
        let right = originalText.length; // 終了位置
        let bestPosition = 0;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            textNode.textContent = originalText.substring(0, mid);

            switch (this.state) {
                case Status.HUNGRY:
                    bestPosition = mid;
                    left = mid + 1;
                    break;
                case Status.FULL:
                    right = mid - 1;
                    break;
            }
        }
        // bestPositionで割った２つのテキストノードを作成
        const before = document.createTextNode(originalText.substring(0, bestPosition));
        const after = document.createTextNode(originalText.substring(bestPosition));

        // food内の対応するテキストノードを分割しておく
        const foodText = this._foodMap.get(textNode);
        const fragment = document.createDocumentFragment();

        fragment.append(before, after);
        foodText.replaceWith(fragment);

        // DOM接続側は前半だけでOK（後半は捨てるので）
        textNode.replaceWith(before.cloneNode_(this._cloneMap, this._foodMap));

        // food側の前半テキストノードがterminalNodeになる
        return before;
    }

    get state() {
        if (this.clientWidth < this.scrollWidth) {
            return Status.FULL;
        } else {
            return Status.HUNGRY;
        }
    }

    set state(value) {
        this._state = value;
    }
}

customElements.define('page-div', PageDiv);

/**
 * @class MulticolPaginator
 * @classdesc HTMLコンテンツをビューポートの高さに基づいて複数ページに分割し
 * currentPage, nextPage, prevPageを通じてページ要素（<page-div>要素）を返す
 * 
 * 高さ測定のため、カスタム要素 <page-div> (PageDiv クラス) を利用する。
 * ページ分割ロジックはこのカスタム要素を定義するクラスPageDivの責務となっている
 * 測定には相応のレンダリングコストが発生するため、ページ生成はジェネレーターを使用
 */
export class MulticolPaginator {
    /**
     * @param {string} originalHTML - HTMLのソース
     * @param {HTMLElement} domConnector - ページの計算に使用する、高さが指定されたDiv要素であり、<page-div>を一時的にappendChildするDOM接続先
     * domConnectorは実際に表示されるコンテナである必要はないが、width/heightは同じでなければ意味がない。
     */
    constructor(originalHTML, domConnector) {
        this.pageIndex = 0;
        this.originalHTML = originalHTML;
        this.domConnector = domConnector;
        this.viewportHeight = domConnector.clientHeight;
        this._pages = [];
        this.PageGenerator = this._generatePages();
        this.PageGenerator.next(); // 初期化時に最初のページを生成
    }

    /**
     * セレクタからインスタンスを生成。
     * @param {string} originalHTML - HTMLのソース
     * @param {string} domConnectorSelector - DOM接続に使用する要素を特定するセレクター文字列（例：'#dom-connector'）
     * @returns {MulticolPaginator|null} インスタンスまたはnull
     */
    static fromSelectors(originalHTML, domConnectorSelector) {
        const domConnector = document.querySelector(domConnectorSelector);
        if (!domConnector) {
            console.error("Invalid selectors provided.");
            return null;
        }
        return new MulticolPaginator(originalHTML, domConnector);
    }


    /**
     * コンテンツをページ単位のHTMLに分割して生成。
      * @yields {PageDiv} 各ページ（<page-div>要素）
     */
    *_generatePages() {
        let remainHTML = this.originalHTML;
        while (remainHTML) {
            const pageDiv = new PageDiv(this._pages.length, this.domConnector.clientHeight);
            // DOMに接続
            this.domConnector.replaceChildren(pageDiv); // 子ノードを消去してpageDivに置き換え
            remainHTML = pageDiv.eat(remainHTML); // eatメソッドは食った残りのHTMLを吐き戻す（おえーｗ）
            this._pages.push(pageDiv);
            yield pageDiv;
        }
    }

    /**
     * 次のページを返す
     * @returns {PageDiv|null} - 次のページ（存在しなければnull）
     */
    nextPage() {
        let page = this._pages[this.pageIndex + 1];
        if (page) {
            this.pageIndex++;
            return page;
        } else {
            const result = this.PageGenerator.next();
            if (!result.done) {
                this.pageIndex++;
                return this._pages[this.pageIndex];
            } else {
                return null;
            }
        }
    }
    /**
     * 前のページを返す
     * @returns {PageDiv|null} - 前のページ（存在しなければnull）
     */
    prevPage() {
        let page = this._pages[this.pageIndex - 1];
        if (page) {
            this.pageIndex--;
            return page;
        } else {
            return null;
        }
    }
    /**
     * @return {PageDiv} - 現在のページ
     */
    get currentPage() {
        return this._pages[this.pageIndex];
    }


}
