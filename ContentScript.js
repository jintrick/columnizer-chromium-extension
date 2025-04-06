export class ContentScript {
    /**
     * コンテンツスクリプトとの通信を抽象化するクラス
     * @version 20250406
     * @param {number} tabId - 通信対象のタブID
     * @param {number} frameId - フレームID (デフォルト: 0)
     */
    constructor(tabId, frameId = 0) {
        if (!tabId || typeof tabId !== 'number') {
            throw new Error('有効なタブIDが提供されていません');
        }

        this.tabId = tabId;
        this.frameId = frameId;
    }

    /**
     * コンテキストメニューのコールバックパラメータからインスタンスを作成
     * @param {object} info - chrome.contextMenus.onClickedイベントから渡されるinfoオブジェクト
     * @param {object} tab - chrome.contextMenus.onClickedイベントから渡されるtabオブジェクト
     * @returns {ContentScript} 新しいContentScriptインスタンス
     */
    static fromContextMenuClick(info, tab) {
        if (!tab?.id) {
            throw new Error('コンテキストメニュークリック: 有効なタブが提供されていません');
        }
        return new ContentScript(tab.id, info?.frameId || 0);
    }

    /**
     * タブオブジェクトからインスタンスを作成
     * @param {object} tab - chrome.tabs APIから取得したタブオブジェクト
     * @param {number} frameId - フレームID (デフォルト: 0)
     * @returns {ContentScript} 新しいContentScriptインスタンス
     */
    static fromTab(tab, frameId = 0) {
        if (!tab?.id) {
            throw new Error('タブオブジェクト: 有効なタブIDが見つかりません');
        }
        return new ContentScript(tab.id, frameId);
    }

    /**
     * 現在アクティブなタブからインスタンスを作成（Promise形式）
     * @param {number} frameId - フレームID (デフォルト: 0)
     * @returns {Promise<ContentScript>} ContentScriptインスタンスを解決するPromise
     */
    static async fromActiveTab(frameId = 0) {
        const tabs = await new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });

        if (!tabs || !tabs[0]?.id) {
            throw new Error('アクティブなタブが見つかりません');
        }

        return new ContentScript(tabs[0].id, frameId);
    }

    /**
     * コンテンツスクリプトにコマンドを送信し、結果を待機
     * @param {string} actionName - 実行するアクション名
     * @param {object} [additionalData={}] - アクションに追加で送信するデータ
     * @param {number} maxAttempts - 最大再試行回数（デフォルト: 1 = 再試行なし）
     * @param {number} retryDelayMs - 再試行間の遅延（ミリ秒）
     * @returns {Promise<object>} - コンテンツスクリプトからの応答
     */
    async execCommand(actionName, additionalData = {}, maxAttempts = 1, retryDelayMs = 500) {
        if (!this.tabId) {
            throw new Error('有効なタブIDがありません');
        }

        if (maxAttempts < 1) {
            throw new Error('maxAttemptsは1以上である必要があります');
        }

        const message = { action: actionName, ...additionalData };
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // メッセージ送信とレスポンス待機
                const response = await this._sendMessage(message);
                return response;
            } catch (error) {
                lastError = error;
                console.warn(`Columnizer: メッセージ送信失敗 (${attempt}/${maxAttempts})`, error);

                // 最後の試行でなければ、遅延後に再試行
                if (attempt < maxAttempts) {
                    await this._delay(retryDelayMs);
                }
            }
        }

        // 全ての試行が失敗
        throw new Error(`コンテンツスクリプトへのメッセージ送信に失敗しました (${maxAttempts}回試行): ${lastError?.message || '不明なエラー'}`);
    }

    /**
     * 指定されたミリ秒だけ遅延するPromiseを返す
     * @param {number} ms - 遅延時間（ミリ秒）
     * @returns {Promise<void>}
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Chrome拡張APIを使用してメッセージを送信する
     * @param {object} message - 送信するメッセージ
     * @returns {Promise<any>} - 応答
     * @private
     */
    _sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(this.tabId, message, { frameId: this.frameId }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }

                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }

                resolve(response);
            });
        });
    }
}