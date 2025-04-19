import { crm } from "./Crm.js";
import { Columnizer } from "./Columnizer.js"


try {
    // Crm.getRequest はメッセージを受け取るまで待機する
    const bodyHtml = await crm.getDataFromBackground(timeout = 10000);
    console.log('multicol.js: Received content data.');
    // Modelを初期化
    const columnizer = new Columnizer(bodyHtml);
    columnizer.main();
    // Columnizerによる表示処理などをここに記述
    // 例: document.body.innerHTML = bodyHtml; // (これはNakedHTMLの内容によります)

} catch (error) {
    console.error('multicol.js: コンテンツデータを取得できませんでした:', error);
    document.body.textContent = 'コンテンツを読み込めませんでした。このタブを閉じて取得操作をやり直して下さい。';
}

// 注意: multicol.html はコンテンツスクリプトではないため、chrome.tabs.sendMessage は使えません。
// バックグラウンドスクリプトとの通信には chrome.runtime.sendMessage/onMessage を使用します。
// Crm.js の getRequest は runtime.onMessage を使用しているので、feedData の受信はこれでOKです。