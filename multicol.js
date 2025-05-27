import { crm } from "./Crm.js";
import { Columnizer } from "./Columnizer.js";
import { NakedHTML } from "./NakedHTML.js";

// console.log("multicol.js: Script loaded, initializing...");

// 即リスナー登録
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     // console.log("multicol.js: Received message:", request);
//     if (request.action === "feedData") {
//         // console.log("multicol.js: Processing feedData:", request.data);

//         document.body.innerHTML = request.data;

//         sendResponse({ status: "success" });
//         return true;
//     }
// });


// contents.js -> background.js -> multicol.js と渡ってくるbody.outerHTMLを処理するコールバックを登録
crm.waitDataFromBackground((bodyHtml) => {
    try {
        const columnizer = new Columnizer(bodyHtml);

        columnizer.main();

    } catch (error) {
        console.error('multicol.js: コンテンツデータを取得できませんでした:', error);
        document.body.textContent = bodyHtml;
    }


});

// 注意: multicol.html はコンテンツスクリプトではないため、chrome.tabs.sendMessage は使えません。
// バックグラウンドスクリプトとの通信には chrome.runtime.sendMessage/onMessage を使用します。
// Crm.js の getRequest は runtime.onMessage を使用しているので、feedData の受信はこれでOKです。