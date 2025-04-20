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
     * このタブにaction名"feedData"でデータを送信します（タブのhtml側はcrm.waitDataFromBackgroundのコールバックで受け取ります）。
     * @param {any} data 送信するデータ
     * @param {number} [timeout=5000] タイムアウトまでのミリ秒数
     * @returns {Promise<any>} コンテンツスクリプトからの応答
     */
    async feed(data, timeout = 5000) {
        try {
            console.log(`Tab ${this._tab.id}: Sending feed data...`);
            return await this.sendMessage({ action: "feedData", data: data });
        } catch (error) {
            console.error(`タブ ${this._tab.id} へのデータ送信に失敗しました:`, error);
            throw error;
        }
    }

    async _waitForReady(timeout) {
        return new Promise((resolve, reject) => {
            console.log(`Crm (background): Starting _waitForReady for tab ${this._tab.id}`);
            const timeoutId = setTimeout(() => {
                chrome.runtime.onMessage.removeListener(listener);
                console.log(`Crm (background): Timeout for tab ${this._tab.id}`);
                reject(new Error(`タブ ${this._tab.id} の準備完了をタイムアウトしました。`));
            }, timeout);

            const listener = (request, sender, sendResponse) => {
                console.log(`Crm (background): Received message for tab ${this._tab.id}:`, request, sender);
                if (!sender.tab) {
                    console.log(`Crm (background): Ignoring message with no tab:`, request);
                    return;
                }
                if (sender.tab.id !== this._tab.id) {
                    console.log(`Crm (background): Ignoring message from wrong tab ${sender.tab.id}, expected ${this._tab.id}`);
                    return;
                }
                if (request.action !== "readyCheck") {
                    console.log(`Crm (background): Ignoring non-readyCheck message:`, request.action);
                    return;
                }

                console.log(`Crm (background): Processing readyCheck for tab ${this._tab.id}`);
                clearTimeout(timeoutId);
                chrome.runtime.onMessage.removeListener(listener);
                resolve();
                sendResponse({ ready: true });
                return true;
            };

            chrome.runtime.onMessage.addListener(listener);
            console.log(`Crm (background): Listener added for tab ${this._tab.id}`);
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
     * @version 20250420
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
     * Registers a callback to handle incoming feedData messages from the background script.
     * The callback is invoked with the data when a message with action "feedData" is received.
     * 
     * @param {function(string): void} callBack - The callback function to process the received data.
     *   It receives the HTML content as a string and performs the desired action (e.g., rendering).
     * @returns {void}
     * @example
     * crm.waitDataFromBackground((html) => {
     *   console.log("Received HTML:", html);
     *   document.body.innerHTML = html;
     * });
     */
    waitDataFromBackground(callBack) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action !== "feedData") return;
            callBack(request.data);
            sendResponse({ status: "success" });
        });
        document.addEventListener("DOMContentLoaded", async () => {
            // console.log("DOM fully loaded, signaling ready.");
            try {
                // console.log("Sending readyCheck...");
                await this.signalReady();
                // console.log("Ready signal sent successfully.");
            } catch (e) {
                console.error("Error sending ready signal:", e);
            }
        });
    }

}

const crm = new Crm();
export { crm };