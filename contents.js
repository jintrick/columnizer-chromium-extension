// content.js - ページに注入され、DOM操作や加工を行う

let contextElement = null; // 右クリックされた要素を保持する変数

// --- 右クリックイベントを捕捉 ---
// run_at: document_start と組み合わせることで、ページの早い段階でリスナーを設定
document.addEventListener('contextmenu', (event) => {
    contextElement = event.target;
    console.log('Columnizer: contextmenu target set:', contextElement); // デバッグ用
}, true); // キャプチャフェーズで捕捉 (より確実に)

// --- Background Script からのメッセージを処理 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'markStartElement') return;

    if (!contextElement || !(contextElement instanceof Element)) {
        console.warn("Columnizer: 起点となる要素が見つかりませんでした。");
        sendResponse({ error: "起点要素が見つかりません。ページ上で右クリックしてからメニューを選択してください。" });
        return;
    }
    const body = contextElement.ownerDocument?.body

    if (!body) {
        sendResponse({ error: "このウェブページはマルチカラム化できません（HTML文書ではありません）" });
        return;
    }

    const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';
    contextElement.setAttribute(START_ELEMENT_ATTR, "");

    // 開始要素にdata-*属性をつけたbody要素のコードをbackground.jsに送信
    sendResponse({ processedHtml: body.cloneNode(true).outerHTML });

    console.log('Columnizer: 加工済みHTMLをbackgroundに送信しました。');
    contextElement.removeAttribute(START_ELEMENT_ATTR);
});

