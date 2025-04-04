// background.js - Columnizer拡張機能のバックグラウンド処理

// 選択された要素のHTMLとその親要素のマッピングを保持
let contentHtml = null;
let parentMapping = new Map();

// コンテキストメニューの作成
chrome.contextMenus.create({
    id: "columnizerStart",
    title: "この要素からColumnizerを起動",
    contexts: ["all"]
});

// コンテキストメニュークリック時の処理
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "columnizerStart") {
        // クリックされた要素のHTMLを取得
        chrome.tabs.sendMessage(tab.id, { action: "getClickedElement" }, response => {
            if (response && response.element) {
                // HTMLを解析して親要素も含めて保存
                processHtml(response.element);

                // 新しいタブでmulticol.htmlを開く
                chrome.tabs.create({ url: chrome.runtime.getURL("multicol.html") });
            }
        });
    }
});

// HTMLを解析して親階層を構築
function processHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Columnizer開始要素を特定
    const startElement = doc.querySelector('[data-net_jintrick_columnizer_startElement]');

    if (!startElement) {
        console.error('開始要素が見つかりません');
        return;
    }

    // 親階層をマッピング（最初は開始要素の親を表示）
    let current = startElement;
    let depth = 0;

    parentMapping.clear();

    while (current && current.parentElement) {
        const parent = current.parentElement;

        // 開始要素から親に遡る際に各要素のHTMLをキャッシュ
        parentMapping.set(depth, {
            element: parent.cloneNode(true),
            html: parent.outerHTML
        });

        depth++;
        current = parent;

        // body要素に達したら終了
        if (parent.tagName === 'BODY') break;
    }

    // 初期表示用コンテンツを設定（開始要素の親）
    contentHtml = parentMapping.get(0)?.html || startElement.outerHTML;
}

// multicol.htmlからのメッセージ処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getContentData") {
        // 保存されたHTMLを返す
        sendResponse({ content: contentHtml });
        return true;
    }

    // 親要素に拡大するリクエスト
    if (request.action === "expandContent") {
        // 現在の深さを特定
        const currentDepth = findCurrentDepth();

        // 次の親要素があれば、それを返す
        if (parentMapping.has(currentDepth + 1)) {
            contentHtml = parentMapping.get(currentDepth + 1).html;
            // 新しいコンテンツで更新を知らせる
            chrome.tabs.sendMessage(sender.tab.id, {
                action: "contentUpdated",
                content: contentHtml
            });
        }

        sendResponse({ success: true });
        return true;
    }
});

// 現在表示している深さを特定
function findCurrentDepth() {
    for (const [depth, data] of parentMapping.entries()) {
        if (data.html === contentHtml) {
            return depth;
        }
    }
    return -1; // 見つからない場合
}