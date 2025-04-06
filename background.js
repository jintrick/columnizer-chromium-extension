import { ContentScript } from "./ContentScript.js";
import { crm } from "./Crm.js";

// 定数定義
const CONTEXT_MENU_ID = "COLUMNIZER_CONTEXT_MENU";

// コンテキストメニューの作成
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: "この部分をColumnizerで表示 (v4)",
        contexts: ["page", "selection", "link", "image", "video", "audio"]
    });
    console.log("Columnizer: コンテキストメニューを作成しました。");
});

// メイン処理フロー
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.menuItemId === CONTEXT_MENU_ID || !tab?.id) {
        return;
    }

    console.log("Columnizer: コンテキストメニューがクリックされました。", info);

    try {
        // contents.jsよりbody要素のouterHTMLを取得（スタート要素にマーク済み）
        const contentScript = ContentScript.fromContextMenuClick(info, tab);
        const htmlContent = await contentScript.execCommand("markStartElement");
    } catch (error) {
        console.error("Columnizer: コンテンツスクリプトから応答を得られませんでした。:", error);
        return;
    }
    try {
        // multicol.htmlにouterHTMLを渡す
        const newTab = await crm.createNewTab("multicol.html");
        await newTab.feed(htmlContent);
    } catch (error) {
        console.error("Columnizer: muticol.htmlから応答を得られませんでした。:", error);
    }
});

