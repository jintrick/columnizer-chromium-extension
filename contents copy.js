import { NakedHTML } from "./NakedHTML.js";
// contents.js - ページに注入され、DOM操作や加工を行う
// このスクリプトでは2つのコールバックをイベントに登録すること「しか」しない
let contextElement = null; // 右クリックされた場所のElementオブジェクトを保持する変数
const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';



// コールバック登録：右クリックイベント時
document.addEventListener('contextmenu', setContextElement, true); // キャプチャフェーズで捕捉 (より確実に)

// コールバック登録：ブラウザ経由のメッセージ受信時
chrome.runtime.onMessage.addListener(main);

// 右クリック時のコンテクスト要素を特定
function setContextElement(event) {
    contextElement = event.target;
    console.log('Columnizer: contextmenu target set:', contextElement); // デバッグ用
}


// contents.js の main 関数
function main(request, sender, sendResponse) {
    if (request.action !== 'markStartElement') {
        return false; // 関連しないメッセージなので処理しない
    }

    // 非同期応答の準備ができていることをChromeに伝える
    // エラーハンドリングを行うため、最初にtrueを返しておく
    let responseSent = false; // 応答が送信されたか追跡するためのフラグ

    // 非同期処理（ここではsendResponseの呼び出し）を後で行う可能性があるのでtrueを返す
    // ただし、エラーハンドリングでsendResponseを呼ぶ可能性があるため、
    // どのようなケースでも最後にsendResponseかエラー報告を行うように設計する
    // ここではtrueを返してチャンネルを開いておくのが安全です。
    const asyncSendResponse = true;

    (async () => { // エラーハンドリングのために非同期即時実行関数で囲む
        try {
            if (!contextElement || !(contextElement instanceof Element)) {
                console.warn("Columnizer: 起点となる要素が見つかりませんでした。");
                sendResponse({ data: "起点要素が見つかりません。ページ上で右クリックしてからメニューを選択してください。", status: "error" });
                responseSent = true;
                return;
            }

            const body = contextElement.ownerDocument?.body;

            if (!body) {
                sendResponse({ data: "このウェブページはマルチカラム化できません（HTML文書ではありません）", status: "error" });
                responseSent = true;
                return;
            }

            const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';
            contextElement.setAttribute(START_ELEMENT_ATTR, "");

            console.log('Columnizer: NakedHTML処理開始'); // --- 追加ログ ---
            // 開始要素にdata-*属性をつけたbody要素をクリーンアップしてbackground.jsに送信
            // NakedHTMLの処理が重い可能性
            const nakedHtml = new NakedHTML(body.cloneNode(true));
            nakedHtml.removeWrappers();
            nakedHtml.removeAttributes();
            console.log('Columnizer: NakedHTML処理完了'); // --- 追加ログ ---

            const processedHtml = nakedHtml.toString();
            console.log('Columnizer: sendResponse直前'); // --- 追加ログ ---

            // sendResponse を呼ぶ
            sendResponse({ data: processedHtml, status: "success" });
            responseSent = true;

            console.log('Columnizer: 加工済みHTMLをbackgroundに送信しました。');
            contextElement.removeAttribute(START_ELEMENT_ATTR);

        } catch (error) {
            console.error('Columnizer: contents.jsでのエラー:', error); // --- エラーログ ---
            // エラーが発生した場合も応答を返すことでチャンネルを閉じ、エラーを報告する
            if (!responseSent) { // まだ応答を送信していない場合のみ
                sendResponse({ data: `処理中にエラーが発生しました: ${error.message}`, status: "error", error: error.toString() });
                responseSent = true; // ★ エラー応答を送った場合もフラグを立てる
            }
            // ここでエラーを再スローする必要はない（リスナー関数からは返さない）
        }
    })(); // 即時実行関数を呼び出し

    // sendResponse が try/catch ブロック内で後で呼び出される可能性があるので true を返す
    return asyncSendResponse;
};

// コンテクスト要素にマーク付けしつつbody要素を取得してサニタイズし、シリアライズしてbackground.jsに返却
async function main___(request, sender, sendResponse) {

    const { NakedHTML } = await import(chrome.runtime.getURL("./NakedHTML.js"));

    if (request.action !== 'markStartElement') return;

    if (!contextElement || !(contextElement instanceof Element)) {
        console.warn("Columnizer: 起点となる要素が見つかりませんでした。");
        sendResponse({ data: "起点要素が見つかりません。ページ上で右クリックしてからメニューを選択してください。", status: "error" });
        return;
    }

    const body = contextElement.ownerDocument?.body

    if (!body) {
        sendResponse({ data: "このウェブページはマルチカラム化できません（HTML文書ではありません）", status: "error" });
        return;
    }

    const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';
    contextElement.setAttribute(START_ELEMENT_ATTR, "");

    // 開始要素にdata-*属性をつけたbody要素をクリーンアップしてbackground.jsに送信
    const nakedHtml = new NakedHTML(body.cloneNode(true));
    nakedHtml.removeWrappers();
    nakedHtml.removeAttributes();
    sendResponse({ data: nakedHtml.toString(), status: "success" });

    console.log('Columnizer: 加工済みHTMLをbackgroundに送信しました。');
    contextElement.removeAttribute(START_ELEMENT_ATTR);

    // Chromeに対し、sendResponse が非同期または後で呼び出されたことを伝える
    return true;
    // これにより、background.js 側の sendMessage の Promise が解決される

};



