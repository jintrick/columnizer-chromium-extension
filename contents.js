// contents.js - ページに注入され、DOM操作や加工を行う
// このスクリプトでは2つのコールバックをイベントに登録すること「しか」しない
import { NakedHTML } from "NakedHTML.js";
import { crm } from "./Crm.js";

let contextElement = null; // 右クリックされた場所のElementオブジェクトを保持する変数
const START_ELEMENT_ATTR = 'data-net-jintrick-columnizer-start-elemet';

// background.jsでは要素を特定できないため、ウェブページ側でイベントリスナーを設定
// 流れとしては……
// 1. ユーザーが右クリック
// 2. contents.jsで設定したコンテクストメニューのイベントリスナーが呼ばれ、contextElementがセットされる
// 3. コンテクストメニューに選択肢が表示され、ユーザーがメニューアイテムを選択
// 4. background.jsでコンテクストメニューに設定したイベントリスナーが呼ばれ、現在のタブにsendMessage
// 5. contents.jsのonMessageでsendMessageを受け取り、mainコールバックが実行され、処理結果がbackground.jsにsendResponseされる
// 6. background.jsでそれを中継的に受け取って、新規タブに送信する
// くっそめんどいwww

// コールバック登録：右クリックイベント時
document.addEventListener('contextmenu', setContextElement, true); // キャプチャフェーズで捕捉 (より確実に)

// コールバック登録：ブラウザ経由のメッセージ受信時
chrome.runtime.onMessage.addListener(main);

// 右クリック時のコンテクスト要素を特定
function setContextElement(event) {
    contextElement = event.target;
    console.log('Columnizer: contextmenu target set:', contextElement); // デバッグ用
}

// コンテクスト要素にマーク付けしつつbody要素を取得してサニタイズし、シリアライズしてbackground.jsに返却
function main(request, sender, sendResponse) {
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

    // 開始要素にdata-*属性をつけたbody要素をクリーンアップしてbackground.jsに送信
    const nakedHtml = new NakedHTML(body.cloneNode(true));
    nakedHtml.removeWrappers();
    nakedHtml.removeAttributes();
    sendResponse({ processedHtml: nakedHtml.toString() });

    console.log('Columnizer: 加工済みHTMLをbackgroundに送信しました。');
    contextElement.removeAttribute(START_ELEMENT_ATTR);
};



