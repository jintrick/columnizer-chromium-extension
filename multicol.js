import { crm } from "./Crm.js";
import { Columnizer } from "./Columnizer.js"

// multicol.js - Columnizer拡張機能のマルチカラム表示と分割処理を担当

chrome.runtime.onMessage()

try {
    const bodyHtml = await crm.getRequest("feedData", timeout = 3000);

    // Modelを初期化
    const columnizer = new Columnizer(bodyHtml);

} catch (error) {
    console.error('コンテンツデータを取得できませんでした');
    document.getElementById('content-container').innerHTML =
        '<div class="error">コンテンツを読み込めませんでした。取得操作をやり直して下さい。</div>';
}
