import { crm } from "./Crm.js";
import { NakedHTML } from "./NakedHTML.js";
import { Columnizer } from "./Columnizer.js";

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
crm.waitDataFromBackground((bodyHtml => {
    try {
        const nHtml = NakedHTML.fromString(bodyHtml);
        nHtml.removeNodes();
        nHtml.removeAttributes();
        nHtml.removeWrappers();
        debugger;
        const columnizer = new Columnizer(nHtml.toString());
        columnizer.main();
    } catch (error) {
        console.error("multicol.js: コンテンツ処理に失敗しました:", error);
        document.body.textContent = "コンテンツを読み込めませんでした。このタブを閉じて取得操作をやり直して下さい。";
    }
}));


document.addEventListener("DOMContentLoaded", async () => {
    console.log("multicol.js: DOM fully loaded, signaling ready.");
    try {
        // console.log("multicol.js: Sending readyCheck...");
        await crm.signalReady();
        // console.log("multicol.js: Ready signal sent successfully.");
        document.body.textContent = "Ready signal sent.";
    } catch (e) {
        // console.error("multicol.js: Error sending ready signal:", e);
        document.body.textContent = "Error sending ready signal: " + e.message;
    }
});

