export class Tab {
    constructor(tab_) {
        this._tab = tab_;
        this._url = null;
        this.title = tab_.title;
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
     * このタブにデータを送信し、処理を依頼します（内部的に準備完了確認を行います）。
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
        this._messageListeners = {};
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
                    chrome.tabs.remove(tab.id);
                    reject(error);
                }
            });
        });
    }

    async getActiveTab() {
        let queryOptions = { active: true, currentWindow: true };
        let [tab_] = await chrome.tabs.query(queryOptions);
        return new Tab(tab_);
    }

    async getRequest(actionName) {
        return new Promise((resolve) => {
            const listener = (request, sender, sendResponse) => {
                if (request && request.action === actionName) {
                    chrome.runtime.onMessage.removeListener(listener);
                    resolve(request);
                }
            };
            chrome.runtime.onMessage.addListener(listener);
        });
    }
}

const crm = new Crm();
export { crm };