// standalone版


// このスクリプトでは2つのコールバックをイベントに登録すること「しか」しない
let contextElement = null; // 右クリックされた場所のElementオブジェクトを保持する変数
const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';



// コールバック登録：右クリックイベント時
document.addEventListener('contextmenu', setContextElement, true); // キャプチャフェーズで捕捉 (より確実に)

// コールバック登録：ブラウザ経由のメッセージ受信時
// chrome.runtime.onMessage.addListener(markStartElement);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("contents.js: メッセージ受信:", request, "sender:", sender);
    markStartElement(request, sender, sendResponse);
    return true; // 非同期応答を有効化
});

console.log("contents.js: リスナー登録完了");

// 右クリック時のコンテクスト要素を特定
function setContextElement(event) {
    contextElement = event.target;
    console.log('Columnizer: contextmenu target set:', contextElement); // デバッグ用
}



// コンテクスト要素にマーク付けしつつbody要素を取得してbackground.jsに返却
async function markStartElement(request, sender, sendResponse) {

    if (request.action !== 'markStartElement') return;

    if (!contextElement || !(contextElement instanceof Element)) {
        debugger; console.warn("Columnizer: 起点となる要素が見つかりませんでした。");
        return sendResponse({ data: "起点要素が見つかりません。ページ上で右クリックしてからメニューを選択してください。", status: "error" });
    }

    const body = contextElement.ownerDocument?.body

    if (!body) {
        debugger; console.warn("Columnizer: body要素の取得に失敗しました");
        return sendResponse({ data: "このウェブページはマルチカラム化できません（HTML文書ではありません）", status: "error" });
    }

    contextElement.setAttribute(START_ELEMENT_ATTR, "");

    // 開始要素にdata-*属性をつけたbody要素をクリーンアップしてbackground.jsに送信
    // ……しようと考えていたがモジュールのインポートが面倒なのでやめた
    // const nakedHtml = new NakedHTML(body.cloneNode(true));
    // nakedHtml.removeWrappers();
    // nakedHtml.removeAttributes();
    // sendResponse({ data: nakedHtml.toString(), status: "success" });
    const responseObj = { data: body.outerHTML, status: 'success' };
    sendResponse(responseObj);

    console.log('Columnizer: 加工済みHTMLをbackgroundに送信しました。');
    contextElement.removeAttribute(START_ELEMENT_ATTR);

};





