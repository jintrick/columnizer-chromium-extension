import { crm } from "./Crm.js";
// このスクリプトでは2つのコールバックをイベントに登録すること「しか」しない

// background.jsでは要素を特定できないため、ウェブページ側でイベントリスナーを設定
// 流れとしては……
// 1. ユーザーが右クリック
// 2. contents.jsで設定したコンテクストメニューのイベントリスナーが呼ばれ、contextElementがセットされる
// 3. コンテクストメニューに選択肢が表示され、ユーザーがメニューアイテムを選択
// 4. background.jsでコンテクストメニューに設定したイベントリスナーが呼ばれ、現在のタブにsendMessage
// 5. contents.jsのonMessageでsendMessageを受け取り、mainコールバックが実行され、処理結果がbackground.jsにsendResponseされる
// 6. background.jsでそれを中継的に受け取って、新規タブに送信する
// くっそめんどいwww

// 定数定義
const CONTEXT_MENU_ID = "net-jintrick-columnizer";

// コンテキストメニューの作成
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "マルチカラムで表示",
        contexts: ["page", "selection", "link", "image", "video", "audio"]
    });
    console.log("background: コンテキストメニューを作成しました。");
});

// コンテクストメニューにイベントリスナーを登録
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) {
        return;
    }

    console.log("background: コンテキストメニューがクリックされました。", info);

    let result;

    try {
        const Tab = crm.getTab(tab);
        result = await Tab.sendMessage({ action: "markStartElement" });
        if (result.status === "error") {
            console.error(result.data);
            return;
        }
    } catch (error) {
        console.error("background: コンテンツスクリプトから応答を得られませんでした。:", error);
        return;
    }

    try {
        // multicol.htmlにouterHTMLを渡す
        const bodyHtml = result.data
        const newTab = await crm.createNewTab("./multicol.html", 15000);
        await newTab.feed(bodyHtml, 10000);
    } catch (error) {
        console.error("background: muticol.htmlから応答を得られませんでした。:", error);
    }

});

