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
    try {
        this.remove();
    } catch (error) {
        console.warn("Error removing node:", error, this);
    }
};

export class NakedHTML {
    // マルチカラム用に加工するHTMLをDocumentFragment内で扱うクラス

    #ATTRIBUTES_TO_KEEP = ['href', 'alt', 'title', 'lang', 'src']; // 保全したい属性
    // #WRAPPERS_TO_KEEP = ['TABLE', 'UL', 'OL', 'VIDEO', 'A']; // ラッパー的に使われるものの、論理性のある要素
    #WRAPPERS = ['DIV', 'SPAN', 'SECTION', 'ARTICLE', 'ASIDE'];
    #ELEMENTS_TO_KEEP = ['SVG']; // 保全したい要素（子孫含め）
    #NODE_TO_REMOVE = ['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', '#comment']; // 削除したい要素（子孫含め）
    constructor(rootNode, ownerDoc = document) {
        this.doc = ownerDoc;
        this.root = rootNode;
        this.result = {
            removeNodes: [],
            removeAttributes: [],
            removeWrappers: []
        }
    }

    static fromString(text, ownerDoc = document) {
        const div = ownerDoc.createElement('div');
        try {
            div.innerHTML = text;
        } catch (error) {
            console.error('NakedHTMLを初期化できません: innerHTMLへのセットに失敗しました');
            return null;
        }
        const df = ownerDoc.createDocumentFragment();
        div.childNodes.forEach(node => df.appendChild(node));
        return new NakedHTML(df, ownerDoc);
    }

    toString() {
        if (this.root instanceof DocumentFragment) {
            const tempDiv = this.root.ownerDocument.createElement('div');
            tempDiv.appendChild(this.root.cloneNode(true));
            return tempDiv.innerHTML;
        } else {
            return this.root.outerHTML;
        }
    }

    // 不要な要素を削除する（使うなら他のメソッドに先行して呼ぶことを推奨）
    removeNodes(target = this.#NODE_TO_REMOVE, exception = this.#ELEMENTS_TO_KEEP) {

        const nodesToRemove = [];
        rec_CollectTarget(this.root);
        nodesToRemove.forEach(node => node.remove());

        function rec_CollectTarget(node) {
            // 保全対象ノードの場合
            if (node.nodeType === Node.ELEMENT_NODE && exception.includes(node.nodeName)) {
                return;
            }
            // 削除対象のノードタイプの場合
            if (target.includes(node.nodeName)) {
                nodesToRemove.push(node);
                return;
            }
            // 子ノードを再帰的に走査する
            node.childNodes.forEach(child => {
                rec_CollectTarget(child);
            });
        }

    }


    removeAttributes(exeption = this.#ATTRIBUTES_TO_KEEP) {
        // TreeWalkerの作成
        const walker = this.doc.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT);

        // 各ノードを巡回
        let el = this.root instanceof DocumentFragment ? walker.nextNode() : this.root;
        while (el) {
            // 各属性をチェックし、保持リストにないものを削除
            Array.from(el.attributes).forEach(attr => {
                const attrName = attr.name;
                if (!exeption.includes(attrName)) {
                    el.removeAttribute(attrName);
                }
            });
            el = walker.nextNode();
        }
    }

    removeWrappers(parent = this.root, target = this.#WRAPPERS, exception = this.#ELEMENTS_TO_KEEP) {
        // 保全対象要素はスキップ
        if (exception.includes(parent.nodeName)) return;

        // 子ノードのリストを作成（ライブコレクションの変更を避けるため）
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
                handler(node);
                continue;
            }
            // 空要素を削除
            const isEmpty = node.childNodes.length === 0 && !node.hasAttributes();
            if (isEmpty) {
                node.remove_();
                continue;
            }
            // ここからは指定されたtarget要素のみが対象（デフォルトはコンテナ要素）
            if (!target.includes(node.nodeName)) continue;

            // ラッパー要素と判断する条件:
            // 1. ノード名が引数targetの配列に含まれている
            // 2. 子ノードが1つだけ
            // 3. その子ノードがElement
            const child = node.firstChild
            const hasOneChild = node.childNodes.length === 1;
            const hasElementChild = child && child.nodeType === Node.ELEMENT_NODE;
            if (hasOneChild && hasElementChild) {
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
