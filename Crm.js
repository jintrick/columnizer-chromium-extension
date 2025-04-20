export class Tab {
    /**
     * ChromeのTabを抽象化するクラス
     * @version 20250417
     * @params {chrome.tabs.Tab} tab
     */
    constructor(tab) {
        this._tab = tab;
        this._url = null;
        this.title = tab.title;
    }
    get id() {
        return this._tab.id;
    }
    get url() {
        return this._url || (this._url = new URL(this._tab.url));
    }

    /**
     * このタブにメッセージを送信します。
     * @param {object} message 送信するメッセージオブジェクト
     * @returns {Promise<any>} コンテンツスクリプトからの応答
     */
    sendMessage(message) {
        return chrome.tabs.sendMessage(this._tab.id, message);
    }

    /**
     * このタブにaction名"feedData"でデータを送信します（タブのhtml側はcrm.getRequestで受け取ります）。
     * @param {any} data 送信するデータ
     * @param {number} [timeout=5000] タイムアウトまでのミリ秒数
     * @returns {Promise<any>} コンテンツスクリプトからの応答
     */
    async feed(data, timeout = 5000) {
        try {
            await this._waitForReady(timeout);
            return await this.sendMessage({ action: "feedData", data: data });
        } catch (error) {
            console.error(`タブ ${this._tab.id} へのデータ送信に失敗しました:`, error);
            throw error;
        }
    }

    async _waitForReady(timeout) {
        return new Promise((resolve, reject) => {
            let isReadySignaled = false; // ★ フラグを追加 ★

            const timeoutId = setTimeout(() => {
                if (!isReadySignaled) { // ★ フラグを確認してタイムアウト判定 ★
                    console.error(`Tab ${this._tab.id} の準備完了をタイムアウトしました。`); // ログを追加
                    chrome.runtime.onMessage.removeListener(listener);
                    reject(new Error(`タブ ${this._tab.id} の準備完了をタイムアウトしました。`));
                }
            }, timeout);

            const listener = (request, sender, sendResponse) => {
                // 特定のタブからの readyCheck メッセージのみを処理
                if (sender.tab && sender.tab.id === this._tab.id && request.action === "readyCheck") {
                    console.log(`Crm (background): Received readyCheck from tab ${this._tab.id}`); // ログを追加
                    isReadySignaled = true; // ★ フラグを立てる ★
                    clearTimeout(timeoutId); // タイマーをクリア

                    // リスナーを削除
                    chrome.runtime.onMessage.removeListener(listener);

                    // プロミスを解決
                    resolve();

                    // タブに応答を返す
                    sendResponse({ ready: true });
                    return true; // 非同期応答のために必要

                }
            };
            // リスナー登録はPromise作成後すぐに行う
            chrome.runtime.onMessage.addListener(listener);

            // タブに対して準備完了信号を送るように促すメッセージを送信（現在の設計の場合）
            // このメッセージがなくても、タブが起動時にreadyCheckを送る設計でも良い
            // this.sendMessage({ action: "readyCheckTrigger" }); // ← 現在のコードにはないが、設計によっては必要
        });
    }
    async _waitForReady__(timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`タブ ${this._tab.id} の準備完了をタイムアウトしました。`));
            }, timeout);

            const listener = (request, sender, sendResponse) => {
                if (sender.tab && sender.tab.id === this._tab.id && request.action === "readyCheck") {
                    clearTimeout(timeoutId);
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve();
                    sendResponse({ ready: true });
                }
            };
            chrome.runtime.onMessage.addListener(listener);

            this.sendMessage({ action: "readyCheck" });
        });
    }
}


class Crm {
    /**
     * ChromeのUIを抽象化するクラス
     * @version 20250407
     */
    constructor() {

    }

    /**
     * 新しいタブを作成し、準備完了を確認後に Tab オブジェクトを返します。
     * @param {string} url 開くタブのURL
     * @param {number} [timeout=5000] 準備完了確認のタイムアウトまでのミリ秒数
     * @returns {Promise<Tab>} 作成され、準備完了した Tab オブジェクト
     */
    async createNewTab(url, timeout = 5000) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url: url }, async (tab) => {
                if (chrome.runtime.lastError || !tab?.id) {
                    reject(chrome.runtime.lastError || "タブの作成に失敗しました。");
                    return;
                }
                const newTab = new Tab(tab);
                try {
                    await newTab._waitForReady(timeout);
                    resolve(newTab);
                } catch (error) {
                    console.error(`タブ ${tab.id} の準備完了に失敗しました:`, error);
                    // 作成に失敗したタブは閉じる
                    // chrome.tabs.remove(tab.id);
                    reject(error);
                }
            });
        });
    }

    /**
     * アクティブタブを取得する（コンテクストなし）
     * @returns {Promise<Tab>}
     */
    async getActiveTab() {
        let queryOptions = { active: true, currentWindow: true };
        let [tab_] = await chrome.tabs.query(queryOptions);
        return new Tab(tab_);
    }

    /**
     * タブを取得する(chrome.tabs.Tabオブジェクトより)
     * @param {chrome.tabs.Tab} tab 
     */
    getTab(tab) {
        return new Tab(tab);
    }

    i18n(message, substitute = undefined) {
        return chrome.i18n.getMessage(message, substitute);
    }

    /**
     * バックグラウンドスクリプトに対して「準備完了(readyCheck)」メッセージを送信し、応答を待ちます。
     * タブスクリプト(multicol.jsなど)での使用を想定しています。
     * @returns {Promise<any>} バックグラウンドスクリプトからの応答
     */
    async signalReady() {
        console.log('Crm (from tab): Signaling readiness to background.');
        // chrome.runtime.sendMessage は、コールバックを省略するとPromiseを返します（レシーバーがsendResponseを呼んだ場合）
        // バックグラウンドスクリプト側の _waitForReady リスナーが sendResponse を呼ぶことを期待
        return chrome.runtime.sendMessage({ action: "readyCheck" });
    }


    /**
     * バックグラウンドスクリプトとの初期通信シーケンスを実行し、供給されるデータを取得します。
     * (1. 準備完了を通知し、2. データ供給メッセージを待ち受ける)。
     * タブスクリプト(multicol.jsなど)での使用を想定しています。
     * @param {number} [timeout=10000] データ待ち受けのタイムアウト（ミリ秒）。準備完了通知の待ち時間も含む全体のタイムアウトと考える方が良いかもしれません。
     * @returns {Promise<any>} バックグラウンドスクリプトから供給されたデータ（feedData の request.data）。
     * @throws {Error} 通信シーケンス中にエラーが発生した場合（タイムアウトなど）。
     */
    async getDataFromBackground(timeout = 10000) {
        console.log('Crm (from tab): Starting data acquisition sequence from background...');

        try {
            // 準備完了を通知し、バックグラウンドからの応答を待つ
            const readyResponse = await this.signalReady();
            console.log('Crm (from tab): Ready signal sent, received response:', readyResponse);

            // バックグラウンドからデータが送られてくるのを待つ
            const data = await this.getRequest("feedData", timeout);
            console.log('Crm (from tab): Received feedData.');

            return data;

        } catch (error) {
            console.error('Crm (from tab): Error during data acquisition sequence:', error);
            // エラーは呼び出し元(multicol.js)で捕捉できるよう再スロー
            throw error;
        }
    }

    getRequest(actionName, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                chrome.runtime.onMessage.removeListener(listener);
                reject(new Error(`アクション "${actionName}" の待機がタイムアウトしました。`));
            }, timeout);

            const listener = (request, sender, sendResponse) => {
                if (request && request.action === actionName) {
                    clearTimeout(timer);
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve(request.data);
                    sendResponse({ status: "received" });
                    return true;
                }
            };

            chrome.runtime.onMessage.addListener(listener);
        });
    }

}

const crm = new Crm();
export { crm };