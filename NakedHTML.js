Element.prototype.setTinyText = function (text, maxLength = 20) {
    if (text.length > 20) {
        this.title = text;
        text = text.slice(0, 20) + "...";
    }
    this.innerText = text;
};
Element.prototype.replaceWith_ = function (node) {
    console.log(`${this.nodeName} is replaced with ${node.nodeName}`, this, node);
    this.replaceWith(node);
};
Node.prototype.remove_ = function () {
    console.log(`${this.nodeName} is removed.`, this);
    this.remove();
};

export class NakedHTML {
    // マルチカラム用に加工するHTMLをDocumentFragment内で扱うクラス

    #ATTRIBUTES_TO_KEEP = ['href', 'alt', 'title', 'lang', 'src'];
    #WRAPPERS_TO_KEEP = ['TABLE', 'UL', 'OL', 'SVG', 'VIDEO', 'A'];
    #NODE_TO_REMOVE = ['SCRIPT', 'STYLE', '#comment'];
    constructor(rootElement) {
        this.root = rootElement;
        this.result = {
            removeNodes: [],
            removeAttributes: [],
            removeWrappers: []
        }
    }

    toString() {
        return this.root.outerHTML;
    }

    removeNodes(target = this.#NODE_TO_REMOVE) {
        // 削除対象を先に収集する
        const nodesToRemove = [];
        const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);

        let el = walker.currentNode;
        while (el) {
            if (this.#NODE_TO_REMOVE.includes(el.nodeName)) {
                nodesToRemove.push(el);
            }
            el = walker.nextNode();
        }

        // 収集したノードを削除する
        nodesToRemove.forEach(node => {
            try {
                node.remove_();
            } catch (error) {
                console.warn(error);
            }
        });
    }

    removeAttributes(exeption = this.#ATTRIBUTES_TO_KEEP) {
        // TreeWalkerの作成
        const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT);

        // 各ノードを巡回
        let el = this.root;
        while (el) {
            // 各属性をチェックし、保持リストにないものを削除
            Array.from(el.attributes).forEach(attr => {
                const attrName = attr.name;
                if (!this.#ATTRIBUTES_TO_KEEP.includes(attrName)) {
                    el.removeAttribute(attrName);
                }
            });
            el = walker.nextNode();
        }
    }

    removeWrappers(parent = this.root, exeption = this.#WRAPPERS_TO_KEEP) {
        // 子ノードのリストを作成（ライブコレクションの変更を避けるため）
        const children = Array.from(parent.childNodes);

        // 各子ノードを処理
        for (const node of children) {

            // 要素ノードだけを処理
            if (node.nodeType !== Node.ELEMENT_NODE
                || this.#WRAPPERS_TO_KEEP.includes(node.nodeName)) continue;

            // 末端から再帰的に処理
            this.removeWrappers(node);

            //要素別のハンドラを呼び出し
            let handler
            if (handler = this[`_handle_${node.nodeName}`]) {
                handler(node);
            }
            // 空要素を削除
            if (!handler && node.childNodes.length === 0) {
                node.remove_();
            }
            // ラッパー要素と判断する条件:
            // 1. 子ノードが1つだけ
            // 2. その子ノードがElement
            const child = node.firstChild
            const hasOneChild = node.childNodes.length === 1;
            const hasElementChild = child && child.nodeType === Node.ELEMENT_NODE;
            if (hasOneChild && hasElementChild) { // && !hasSpecialAttributes) {
                node.replaceWith_(child);
            }
        }
    }

    _handle_SCRIPT(script) {
        script.remove();
    }

    _handle_STYLE(style) {
        style.remove();
    }

    _handle_IMG(img) {
        let src;
        if (!(src = img.src)) return;

        const text = img.alt ? img.alt : src;
        const a = img.ownerDocument.createElement('a');

        a.setTinyText(text);
        a.href = img.src;
        a.setAttribute('data-role', 'img')
        a.setAttribute('data-width', img.width);
        a.setAttribute('data-height', img.height);
        img.replaceWith(a);
    }

    _handle_IFRAME(iframe) {
        let src;
        let title;
        if (!(src = iframe.src)) return;
        if (!(title = iframe.contentDocument?.title)) return;

        const a = iframe.ownerDocument.createElement('a');

        a.setTinyText(title);
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

        a.setTinyText(text);
        a.href = src;
        a.setAttribute('data-role', 'video');

        if (video.poster) {
            a.setAttribute('data-poster', video.poster);
        }

        video.replaceWith(a);
    }
    _result() {

    }
}
