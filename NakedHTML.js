
class NakedHTML {
    // HTMLから不要な要素、属性を取り除く
    static #INLINE_ELEMENTS = [
        'A', 'SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'MARK', 'SMALL', 'DEL', 'INS', 'SUB', 'SUP',
        'CODE', 'Q', 'CITE', 'DFN', 'ABBR', 'DATA', 'TIME', 'VAR', 'SAMP', 'KBD', 'IMG', 'BR',
        'WBR', 'RUBY', 'RT', 'RP', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'MAP', 'OBJECT',
        'IFRAME', 'VIDEO', 'AUDIO', 'CANVAS', 'EMBED', 'SCRIPT', 'NOSCRIPT', 'FONT'
    ];
    static #BLOCK_ELEMENTS = [
        "ADDRESS",
        "ARTICLE",
        "ASIDE",
        "BLOCKQUOTE",
        "BODY",
        "BR", // br.split_メソッドにてブロック要素として扱う必要があるため
        "CANVAS",
        "CAPTION",
        "CENTER",        // 非推奨
        "COL",
        "COLGROUP",
        "DD",
        "DIR",           // 非推奨
        "DIV",
        "DL",
        "DT",
        "FIELDSET",
        "FIGCAPTION",
        "FIGURE",
        "FOOTER",
        "FORM",
        "FRAME",         // 非推奨
        "FRAMESET",      // 非推奨
        "H1", "H2", "H3", "H4", "H5", "H6",
        "HEADER",
        "HR",
        "IFRAME",
        "LEGEND",
        "LI",
        "MAIN",
        "MENU",          // context menu ではなくリストとして使用されたもの（非推奨）
        "NAV",
        "NOFRAMES",      // 非推奨
        "NOSCRIPT",
        "OL",
        "P",
        "PRE",
        "SECTION",
        "TABLE",
        "TBODY",
        "TD",
        "TFOOT",
        "TH",
        "THEAD",
        "TR",
        "UL",
        "VIDEO"
    ];

    static #ATTRIBUTES_TO_KEEP = ['href', 'alt', 'title', 'lang', 'src', 'name']; // 保全したい属性
    static #WRAPPERS = ['DIV', 'SPAN', 'SECTION', 'ARTICLE', 'ASIDE'];
    static #ELEMENTS_TO_KEEP = ['SVG']; // 保全したい要素（子孫・属性含め）
    static #NODE_TO_REMOVE = ['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', '#comment']; // 削除したい要素（子孫含め）
    static #TINY_TEXT_LENGTH = 20;

    constructor(rootNode, ownerDoc = document) {
        this.doc = ownerDoc;
        this.root = rootNode;
        this.result = {
            removedNodes: [],
            removedAttributes: []
        }
        const self = this;
        ownerDoc.defaultView.Node.prototype.remove_ = function () {
            try {
                this.remove();
                self.result.removedNodes.push(this.nodeName);
            } catch (error) {
                console.warn("Error removing node:", error, this);
            }
        };
        ownerDoc.defaultView.Node.prototype.isInlineElement_ = function () {
            return NakedHTML.#INLINE_ELEMENTS.includes(this.nodeName);
        };
        ownerDoc.defaultView.Node.prototype.isBlockElement_ = function () {
            return NakedHTML.#BLOCK_ELEMENTS.includes(this.nodeName);
        };
        ownerDoc.defaultView.Node.prototype.nextSibling_ = function () {
            '空白のテキストノードを無視したnextSibling'
            let node = this;
            while (node = node.nextSibling) {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === '') {
                    continue;
                } else {
                    break;
                }
            }
            return node;
        };
        ownerDoc.defaultView.Node.prototype.previousSibling_ = function () {
            '空白のテキストノードを無視したnextSibling'
            let node = this;
            while (node = node.previousSibling) {
                if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === '') {
                    continue;
                } else {
                    break;
                }
            }
            return node;
        };
        ownerDoc.defaultView.Element.prototype.replaceTag_ = function (tagName, copyAttr = false) {
            const newEl = document.createElement(tagName);
            // 属性もコピー
            if (copyAttr) {
                Array.from(this.attributes).forEach(attr => {
                    newEl.setAttribute(attr.name, attr.value);
                });
            }
            newEl.append(...this.childNodes);
            this.replaceWith(newEl);
            return newEl; // メソッドチェーン用
        };
        ownerDoc.defaultView.Element.prototype.unwrap_ = function () {
            const children = this.childNodes;
            if (!children.length) return false;

            const fragment = this.ownerDocument.createDocumentFragment();

            fragment.append(...children);
            this.replaceWith(fragment);
        };
        ownerDoc.defaultView.Element.prototype.setTinyText_ = function (text, maxLength) {
            if (text.length > 20) {
                this.title = text;
                text = text.slice(0, 20) + "...";
            }
            this.innerText = text;
        };
        ownerDoc.defaultView.HTMLBRElement.prototype.split_ = function () {
            // BRの前後兄弟のインライン要素をそれぞれP要素に移動し、ブロック要素として分割する

            const doc = this.ownerDocument;
            const fragment = doc.createDocumentFragment();
            const beforeP = doc.createElement('P');
            const afterP = doc.createElement('P');
            const parent = this.parentNode;

            fragment.append(beforeP, afterP);

            // Move nodes before <br> to beforeP
            let node = this;
            const befores = [];
            while (node = node.previousSibling_()) {
                if (node.isBlockElement_()) {
                    // BR要素も例外的にブロック要素扱いとすることで連続したBR要素でも問題なく動作する
                    break;
                } else {
                    befores.unshift(node); // 配列の先頭に追加していく
                }
            }
            if (befores.length > 0) {
                beforeP.append(...befores); // DOMから隔離
            } else {
                beforeP.remove();
            }

            // Move nodes after <br> to afterP
            node = this;
            const afters = [];
            while (node = node.nextSibling_()) {
                if (node.isBlockElement_()) {
                    break;
                } else {
                    afters.push(node);
                }
            }
            if (afters.length > 0) {
                afterP.append(...afters); // DOMから隔離
            } else {
                afterP.remove();
            }


            // 親ノードがPの場合Pを子にもてないため、親をDIVにタグチェンジしておく
            if (parent.nodeName === 'P') {
                parent.replaceTag_('div', true); // true:属性を引き継ぐ
            }

            this.replaceWith(fragment);

        }
    }
    get inlineElements() {
        return NakedHTML.#INLINE_ELEMENTS;
    }
    get attrsToKeep() {
        return NakedHTML.#ATTRIBUTES_TO_KEEP;
    }
    get wrappers() {
        return NakedHTML.#WRAPPERS;
    }
    get elsToKeep() {
        return NakedHTML.#ELEMENTS_TO_KEEP;
    }
    get nodeToRemove() {
        return NakedHTML.#NODE_TO_REMOVE;
    }

    static fromString(htmlText, ownerDoc = document) {
        const div = ownerDoc.createElement('div');
        try {
            div.innerHTML = htmlText;
        } catch (error) {
            console.error('NakedHTMLを初期化できません: innerHTMLへのセットに失敗しました', htmlText);
            return null;
        }
        const df = ownerDoc.createDocumentFragment();
        df.append(...div.cloneNode(true).childNodes);
        return new NakedHTML(df, ownerDoc);
    }

    static fromElement(el) {
        return new NakedHTML(el, el.ownerDocument);
    }

    toString() {
        if (this.root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            const tempDiv = this.root.ownerDocument.createElement('div');
            tempDiv.append(this.root.cloneNode(true));
            return tempDiv.innerHTML;
        } else {
            console.log('this.root is not a DocumentFragment');
            return this.root.outerHTML;
        }
    }


    // 不要な要素を削除する（使うなら他のメソッドに先行して呼ぶことを推奨）
    removeNodes(target = NakedHTML.#NODE_TO_REMOVE, exception = NakedHTML.#ELEMENTS_TO_KEEP) {

        const rec_CollectTarget = (node) => {
            // 保全対象ノードは除外
            if (node.nodeType === Node.ELEMENT_NODE && exception.includes(node.nodeName)) {
                return;
            }
            // 削除対象のノードをpush
            if (target.includes(node.nodeName)) {
                nodesToRemove.push(node);
                return;
            }
            // テキストノード（タグ成型用の空白文字）をpush
            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === '') {
                nodesToRemove.push(node);
                return;
            }

            // 子ノードを再帰的に走査する
            node.childNodes.forEach(child => {
                rec_CollectTarget(child);
            });
        };

        const nodesToRemove = [];
        rec_CollectTarget(this.root);
        nodesToRemove.forEach(node => node.remove());
    }
    removeAttributes(exceptionAttrs = NakedHTML.#ATTRIBUTES_TO_KEEP, exceptionElements = NakedHTML.#ELEMENTS_TO_KEEP) {

        const rec_removeAttrs = (node) => {

            if (exceptionElements.includes(node.nodeName)) return;

            [...(node.attributes ?? [])].forEach(attr => {
                const attrName = attr.name;
                if (!exceptionAttrs.includes(attrName) && attrName.slice(0, 5) !== 'data-') {
                    node.removeAttribute(attrName);
                }
            });

            node.children.forEach(child => rec_removeAttrs(child));
        };

        rec_removeAttrs(this.root);
    }
    removeWrappers(parent = this.root, target = NakedHTML.#WRAPPERS, exception = NakedHTML.#ELEMENTS_TO_KEEP) {
        // 保全対象要素はスキップ
        if (exception.includes(parent.nodeName)) return;

        // 子ノードのリストを作成
        const children = Array.from(parent.childNodes);

        // 各子ノードを処理
        for (const node of children) {
            const isElement = node.nodeType === Node.ELEMENT_NODE;
            // 要素ノードだけを処理
            if (!isElement) continue;

            // 末端から再帰的に処理
            this.removeWrappers(node);

            //要素別のハンドラを呼び出し
            const handler = this[`_handle_${node.nodeName}`];
            if (handler) {
                handler.call(this, node);
                continue;
            }
            // ラッパー要素のみを処理
            if (!target.includes(node.nodeName)) continue;

            const children = node.childNodes;
            switch (children.length) {
                case 0: // 空のラッパー要素は不要
                    node.remove_();
                    break;
                case 1: // ただ一つの要素を包んでいるだけのラッパーは不要
                    const firstChild = node.firstElementChild;
                    if (firstChild) node.replaceWith(firstChild);
                    break;
                default: // 複数の子ノードがあったとしてもそれがラッパー要素のみなら不要
                    const hasWrappersOnly = [...children].every(child => {
                        target.includes(child);
                    });
                    if (hasWrappersOnly) {
                        node.unwrap_();
                    }
            }
        }
    }
    processBreaks(parent = this.root) {

        const srcBrs = parent.querySelectorAll('br');
        const removeBrs = [];
        // 単独BR消去、連続BRをひとつにまとめる
        srcBrs.forEach(br => {
            const brs = [br];

            const prev = br.previousSibling_(); // 空白のテキストノードをスキップするpreviousSibling
            if (prev?.nodeName === 'BR') return;

            // 次のBRを先読み（currentNodeを移動させない）
            let next = br; // 空白のテキストノードをスキップするnextSibling
            while ((next = next.nextSibling_()) && next.nodeName === 'BR') {
                brs.push(next);
            }

            if (brs.length >= 2) {
                removeBrs.push(...brs.slice(1));
            } else {
                removeBrs.push(brs[0]);
            }
        });

        removeBrs.forEach(br => br.remove());

        // br要素を起点にインライン要素の集団を2つのP要素に分割
        parent.querySelectorAll('br').forEach(br => br.split_());
    }

    getResult() {
        return privates_.get(this).result;
    }

    _handle_IMG(img) {
        let src;
        if (!(src = img.src)) return;

        const text = img.alt ? img.alt : src;
        const a = img.ownerDocument.createElement('a');

        a.setTinyText_(text, NakedHTML.#TINY_TEXT_LENGTH);
        a.href = img.src;
        a.setAttribute('data-role', 'img')
        if (img.width > 0) a.setAttribute('data-width', img.width);
        if (img.height > 0) a.setAttribute('data-height', img.height);
        img.replaceWith(a);
    }

    _handle_IFRAME(iframe) {
        let src;
        if (!(src = iframe.src)) return;

        const title = iframe.contentDocument?.title || 'Iframe Content Title'; // フォールバック
        const a = iframe.ownerDocument.createElement('a');

        a.setTinyText_(title, NakedHTML.#TINY_TEXT_LENGTH);
        a.href = iframe.src;
        a.setAttribute('data-role', 'iframe');
        iframe.replaceWith(a);
    }

    _handle_VIDEO(video) {
        let src;
        if (!(src = video.src)) return;

        // 代替テキストの取得（例）
        let text;
        if (!(text = video.title)) {
            text = src;
        }
        const a = video.ownerDocument.createElement('a');

        a.setTinyText_(text, NakedHTML.#TINY_TEXT_LENGTH);
        a.href = src;
        a.setAttribute('data-role', 'video');

        if (video.poster) {
            a.setAttribute('data-poster', video.poster);
        }

        video.replaceWith(a);
    }
}




