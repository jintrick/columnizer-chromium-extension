import { NakedHTML } from "./NakedHTML.js";

// multicol.js - Columnizer拡張機能のマルチカラム表示と分割処理を担当

class ContentSplitter {
    constructor(containerId, contentData) {
        this.container = document.getElementById(containerId);
        this.contentData = contentData;
        this.currentPage = 0;
        this.totalPages = 1;
        this.originalContent = null;
        this.pageSize = { width: 0, height: 0 };
        this.columnGap = 20; // カラム間の余白
        this.columnWidth = '25em'; // カラム幅のデフォルト値
        this.pages = []; // 明示的に初期化
        this.estimatedColumnCount = 1; // 明示的に初期化
        this.pageInfoElement = null; // 明示的に初期化

        // 初期設定
        this.init();
    }

    init() {
        // 元のコンテンツをパース
        const parser = new DOMParser();
        const doc = parser.parseFromString(this.contentData, 'text/html');
        this.originalContent = doc.body.firstChild;

        // 初期表示
        this.renderContent();

        // リサイズ検知
        this.setupResizeObserver();

        // ページングコントロールの追加
        this.setupPagingControls();

        // UIコントロールの設定
        this.setupUIControls();
    }

    renderContent() {
        // コンテナをリセット
        this.container.innerHTML = '';

        // コンテンツを複製して表示
        const contentClone = this.originalContent.cloneNode(true);
        this.container.appendChild(contentClone);

        // マルチカラム設定を適用
        this.applyMultiColumnLayout();

        // ページサイズを更新
        this.updatePageSize();

        // スクロールバーがあれば分割処理を行う
        if (this.needsSplitting()) {
            this.splitContent();
            this.showPage(this.currentPage);
        }
    }

    applyMultiColumnLayout() {
        // コンテナにマルチカラムスタイルを適用（カラム幅ベース）
        this.container.style.columnWidth = this.columnWidth;
        this.container.style.columnGap = `${this.columnGap}px`;
        this.container.style.columnFill = 'auto';
        this.container.style.height = '100vh';
        this.container.style.width = '100%';
        this.container.style.overflow = 'hidden'; // コンテナ自体のスクロールは無効化
    }

    setupResizeObserver() {
        // 要素のサイズ変更を監視
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                // サイズが変わったらレイアウトを再適用
                this.updatePageSize();
                this.renderContent();
            }
        });

        resizeObserver.observe(this.container);
    }

    needsSplitting() {
        // コンテンツがコンテナをはみ出しているかチェック
        const contentHeight = this.container.scrollHeight;
        const containerHeight = this.container.clientHeight;
        return contentHeight > containerHeight;
    }

    updatePageSize() {
        // 現在のページサイズを取得
        const computedStyle = window.getComputedStyle(this.container);
        // 実際のカラム幅を取得
        const actualColumnWidth = parseFloat(computedStyle.columnWidth) || parseFloat(this.columnWidth) || 400;

        this.pageSize = {
            width: actualColumnWidth,
            height: this.container.clientHeight
        };

        // 現在のカラム数を計算（コンテンツ分割処理用）
        const containerWidth = this.container.clientWidth;
        const columnGap = parseFloat(computedStyle.columnGap) || this.columnGap;
        const estimatedColumnCount = Math.max(1, Math.floor((containerWidth + columnGap) / (actualColumnWidth + columnGap)));

        // 分割処理で使用するカラム数を更新
        this.estimatedColumnCount = estimatedColumnCount;
    }

    splitContent() {
        const pages = [];
        let currentPageContent = document.createElement('div');
        pages.push(currentPageContent);

        // コンテンツを要素単位で分割
        this.splitElement(this.originalContent, currentPageContent, pages);

        // 分割したページを保存
        this.pages = pages;
        this.totalPages = pages.length;

        // ページネーションUIを更新
        this.updatePaginationUI();
    }

    splitElement(sourceElement, targetElement, pages) {
        // 子要素ごとに処理
        Array.from(sourceElement.childNodes).forEach(child => {
            // テキストノードの場合
            if (child.nodeType === Node.TEXT_NODE) {
                this.splitTextNode(child, targetElement, pages);
                return;
            }

            // 要素ノードの場合
            if (child.nodeType === Node.ELEMENT_NODE) {
                // 要素の種類に基づいて処理
                if (this.isBlockElement(child)) {
                    this.splitBlockElement(child, targetElement, pages);
                } else {
                    this.splitInlineElement(child, targetElement, pages);
                }
            }
        });
    }

    splitTextNode(textNode, targetElement, pages) {
        // テキストノードをそのまま追加
        const clone = textNode.cloneNode(true);
        targetElement.appendChild(clone);

        // ページのオーバーフローをチェック
        if (this.isOverflowing(targetElement)) {
            // 新しいページを作成
            targetElement.removeChild(clone);
            let currentPageContent = document.createElement('div');
            pages.push(currentPageContent);
            currentPageContent.appendChild(clone);
        }
    }

    splitBlockElement(element, targetElement, pages) {
        // ブロック要素のクローン（子なし）を作成
        const elementClone = element.cloneNode(false);
        targetElement.appendChild(elementClone);

        // 子要素を再帰的に処理
        this.splitElement(element, elementClone, pages);

        // 空の要素は削除
        if (!elementClone.hasChildNodes()) {
            targetElement.removeChild(elementClone);
        }

        // オーバーフローチェック
        if (this.isOverflowing(targetElement)) {
            // 新しいページに移動
            const lastElement = targetElement.lastChild;
            targetElement.removeChild(lastElement);

            let currentPageContent = document.createElement('div');
            pages.push(currentPageContent);
            currentPageContent.appendChild(lastElement);
        }
    }

    splitInlineElement(element, targetElement, pages) {
        // インライン要素のクローン（子なし）を作成
        const elementClone = element.cloneNode(false);
        targetElement.appendChild(elementClone);

        // 子要素を再帰的に処理
        this.splitElement(element, elementClone, pages);

        // 空の要素は削除
        if (!elementClone.hasChildNodes()) {
            targetElement.removeChild(elementClone);
        }
    }

    isBlockElement(element) {
        // ブロック要素かどうかを判定
        const blockElements = ['DIV', 'P', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE'];
        return blockElements.includes(element.nodeName);
    }

    isOverflowing(element) {
        // 要素が現在のページをはみ出しているかチェック
        const testElement = element.cloneNode(true);
        const testContainer = document.createElement('div');

        // テスト用のコンテナにマルチカラムスタイルを適用
        testContainer.style.columnWidth = this.columnWidth;
        testContainer.style.columnGap = `${this.columnGap}px`;
        testContainer.style.height = `${this.pageSize.height}px`;
        testContainer.style.width = `${this.pageSize.width * this.estimatedColumnCount}px`;
        testContainer.style.position = 'absolute';
        testContainer.style.left = '-9999px';
        testContainer.style.overflow = 'hidden';

        testContainer.appendChild(testElement);
        document.body.appendChild(testContainer);

        const isOverflow = testContainer.scrollHeight > testContainer.clientHeight;

        // テスト用要素を削除
        document.body.removeChild(testContainer);

        return isOverflow;
    }

    showPage(pageIndex) {
        if (pageIndex < 0 || pageIndex >= this.totalPages) {
            return false;
        }

        // コンテナをクリア
        this.container.innerHTML = '';

        // 指定ページを表示
        const pageContent = this.pages[pageIndex].cloneNode(true);
        this.container.appendChild(pageContent);

        // マルチカラムレイアウトを再適用
        this.applyMultiColumnLayout();

        // カレントページを更新
        this.currentPage = pageIndex;
        this.updatePaginationUI();

        return true;
    }

    nextPage() {
        return this.showPage(this.currentPage + 1);
    }

    prevPage() {
        return this.showPage(this.currentPage - 1);
    }

    setupPagingControls() {
        // ナビゲーションボタンの作成
        const nav = document.createElement('div');
        nav.className = 'columnizer-nav';
        nav.style.position = 'fixed';
        nav.style.bottom = '20px';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.textAlign = 'center';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '前のページ';
        prevBtn.onclick = () => this.prevPage();

        const pageInfo = document.createElement('span');
        pageInfo.className = 'columnizer-page-info';
        pageInfo.style.margin = '0 15px';

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '次のページ';
        nextBtn.onclick = () => this.nextPage();

        nav.appendChild(prevBtn);
        nav.appendChild(pageInfo);
        nav.appendChild(nextBtn);

        document.body.appendChild(nav);

        this.pageInfoElement = pageInfo;
    }

    updatePaginationUI() {
        if (this.pageInfoElement) {
            this.pageInfoElement.textContent = `${this.currentPage + 1} / ${this.totalPages}`;
        }
    }

    setupUIControls() {
        // シンプル化したUIコントロール（親要素拡大ボタンのみ）
        const controls = document.createElement('div');
        controls.className = 'columnizer-controls';
        controls.style.position = 'fixed';
        controls.style.top = '20px';
        controls.style.right = '20px';

        // 親ノード選択コントロール（拡大/縮小）
        const expandBtn = document.createElement('button');
        expandBtn.textContent = '親要素に拡大';
        expandBtn.onclick = () => {
            // メッセージを送信してbackground.jsに親要素を要求
            chrome.runtime.sendMessage({ action: 'expandContent' });
        };

        controls.appendChild(expandBtn);
        document.body.appendChild(controls);
    }

    // メッセージハンドリングの追加
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // 各種メッセージに対応するハンドラー
            switch (request.action) {
                case 'displayHtmlContent':
                    this.handleDisplayHtmlContent(request, sendResponse);
                    break;
                case 'changeColumnWidth':
                    this.handleChangeColumnWidth(request, sendResponse);
                    break;
                // 他のメッセージタイプを追加可能
            }
            // 非同期レスポンスをサポートするため true を返す
            return true;
        });
    }

    handleDisplayHtmlContent(request, sendResponse) {
        try {
            const htmlContent = request.html;
            // 新しいコンテンツをパース
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            this.originalContent = doc.body.firstChild;

            // 新しいコンテンツで再レンダリング
            this.renderContent();

            sendResponse({ success: true });
        } catch (error) {
            console.error('HTML表示エラー:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    handleChangeColumnWidth(request, sendResponse) {
        try {
            // カラム幅を変更
            this.columnWidth = request.width || '25em';

            // レイアウトを再適用
            this.renderContent();

            sendResponse({ success: true });
        } catch (error) {
            console.error('カラム幅変更エラー:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
}

// multicol.html 読み込み時の処理
document.addEventListener('DOMContentLoaded', () => {
    // background.jsからコンテンツデータを取得
    chrome.runtime.sendMessage({ action: 'getContentData' }, response => {
        if (response && response.content) {
            // コンテンツスプリッターを初期化
            const splitter = new ContentSplitter('content-container', response.content);

            // メッセージハンドラーを設定
            splitter.setupMessageHandlers();

            // グローバルに保存（デバッグ用）
            window.splitter = splitter;
        } else {
            console.error('コンテンツデータを取得できませんでした');
            document.getElementById('content-container').innerHTML =
                '<div class="error">コンテンツを読み込めませんでした。ページを開き直してお試しください。</div>';
        }
    });
});

// 既存のリスナーは削除して統合
// chrome.runtime.onMessage.addListener();は削除