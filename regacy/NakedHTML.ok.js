// NakedHTMLクラスのDevTools用テストスニペット
// DevToolsのSourcesタブ -> Snippetsに貼り付けて使用してください

function testNakedHTML() {
    console.clear();
    console.log('=== NakedHTML テストを開始 ===');

    // テスト用のターゲット要素を取得（ページのbody全体をコピー）
    const originalBody = document.body.cloneNode(true);
    const testElement = originalBody;

    // テスト実行前の状態を記録
    console.log('元の要素構造:', testElement);
    console.log('元のHTML:', testElement.outerHTML.length, '文字');

    // 現在のページのBodyに対してNakedHTMLを適用
    const nakedHtml = new NakedHTML(testElement);

    // 不要な要素を削除するテスト
    console.log('\n--- 不要な要素削除テスト ---');
    console.time('removeNodes');
    nakedHtml.removeNodes();
    console.timeEnd('removeNodes');
    console.log('不要な要素削除後:', testElement);

    // 属性の削除をテスト
    console.log('\n--- 属性削除テスト ---');
    console.time('removeAttributes');
    nakedHtml.removeAttributes();
    console.timeEnd('removeAttributes');
    console.log('属性削除後:', testElement);

    // ラッパー削除をテスト
    console.log('\n--- ラッパー削除テスト ---');
    console.time('removeWrappers');
    nakedHtml.removeWrappers();
    console.timeEnd('removeWrappers');
    console.log('ラッパー削除後:', testElement);

    // 結果の比較
    console.log('\n--- 結果比較 ---');
    console.log('処理後のHTML:', testElement.outerHTML.length, '文字');
    console.log('サイズ変化率:', Math.round((testElement.outerHTML.length / document.body.outerHTML.length) * 100) + '%');

    // 削除された特定の要素をチェック
    const scripts = Array.from(testElement.querySelectorAll('script'));
    const styles = Array.from(testElement.querySelectorAll('style'));
    const comments = Array.from(testElement.childNodes).filter(node => node.nodeType === 8); // Comment nodes

    console.log('\n--- 削除された要素チェック ---');
    console.log(`スクリプト要素残存数: ${scripts.length}件`);
    console.log(`スタイル要素残存数: ${styles.length}件`);
    console.log(`コメント要素残存数: ${comments.length}件`);

    // 特定の要素の変換をチェック
    const imgLinks = Array.from(testElement.querySelectorAll('a[data-role="img"]'));
    const iframeLinks = Array.from(testElement.querySelectorAll('a[data-role="iframe"]'));
    const videoLinks = Array.from(testElement.querySelectorAll('a[data-role="video"]'));

    console.log('\n--- 特定要素の変換結果 ---');
    console.log(`画像 → リンク変換: ${imgLinks.length}件`);
    if (imgLinks.length > 0) {
        console.log('画像リンクのサンプル:', imgLinks[0]);
    }

    console.log(`iframe → リンク変換: ${iframeLinks.length}件`);
    if (iframeLinks.length > 0) {
        console.log('iframeリンクのサンプル:', iframeLinks[0]);
    }

    console.log(`video → リンク変換: ${videoLinks.length}件`);
    if (videoLinks.length > 0) {
        console.log('videoリンクのサンプル:', videoLinks[0]);
    }

    // 保持されるべき要素のチェック
    const tables = Array.from(testElement.querySelectorAll('table'));
    const lists = Array.from(testElement.querySelectorAll('ul, ol'));
    const svgs = Array.from(testElement.querySelectorAll('svg'));

    console.log('\n--- 保持された要素 ---');
    console.log(`テーブル: ${tables.length}件`);
    console.log(`リスト(UL/OL): ${lists.length}件`);
    console.log(`SVG: ${svgs.length}件`);

    console.log('\n=== テスト完了 ===');

    // 結果をページに表示するための要素を作成
    appendTestResults(document.body.outerHTML, testElement.outerHTML);

    // 変換前後の比較データを返す
    return {
        original: document.body.outerHTML,
        processed: testElement.outerHTML,
        originalSize: document.body.outerHTML.length,
        processedSize: testElement.outerHTML.length,
        sizeReduction: Math.round((1 - testElement.outerHTML.length / document.body.outerHTML.length) * 100),
        removedElements: {
            scripts: document.querySelectorAll('script').length - scripts.length,
            styles: document.querySelectorAll('style').length - styles.length
        }
    };
}

// CSP制限を回避するためにDOM操作でテスト結果を表示する関数
function appendTestResults(originalHTML, processedHTML) {
    // テスト結果表示用の要素を作成
    const testResultsContainer = document.createElement('div');
    testResultsContainer.id = 'nakedhtml-test-results';
    testResultsContainer.style.position = 'fixed';
    testResultsContainer.style.top = '0';
    testResultsContainer.style.left = '0';
    testResultsContainer.style.width = '100%';
    testResultsContainer.style.height = '100%';
    testResultsContainer.style.backgroundColor = 'white';
    testResultsContainer.style.zIndex = '999999';
    testResultsContainer.style.padding = '20px';
    testResultsContainer.style.boxSizing = 'border-box';
    testResultsContainer.style.overflow = 'auto';
    testResultsContainer.style.fontFamily = 'sans-serif';

    // コンテンツを作成
    testResultsContainer.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <h1 style="margin-top: 0;">NakedHTML テスト結果</h1>
            <p>元のHTMLサイズ: ${originalHTML.length.toLocaleString()}文字 / 処理後: ${processedHTML.length.toLocaleString()}文字 (${Math.round((1 - processedHTML.length / originalHTML.length) * 100)}% 削減)</p>
            
            <div style="margin: 20px 0;">
                <button id="close-test-results" style="padding: 10px; margin-right: 10px; cursor: pointer; background: #f44336; color: white; border: none; border-radius: 4px;">閉じる</button>
                <button id="toggle-view" style="padding: 10px; margin-right: 10px; cursor: pointer; background: #2196F3; color: white; border: none; border-radius: 4px;">コード/プレビュー切替</button>
                <button id="show-original" style="padding: 10px; margin-right: 10px; cursor: pointer; background: #4CAF50; color: white; border: none; border-radius: 4px;">元のHTMLを表示</button>
                <button id="show-processed" style="padding: 10px; cursor: pointer; background: #FF9800; color: white; border: none; border-radius: 4px;">処理後のHTMLを表示</button>
            </div>
            
            <div id="code-view" style="display: flex; gap: 20px;">
                <div style="flex: 1; border: 1px solid #ccc; padding: 10px; height: 500px; overflow: auto;">
                    <h2 style="margin-top: 0;">元のHTML</h2>
                    <pre style="white-space: pre-wrap; word-break: break-all; font-size: 12px;">${escapeHTML(originalHTML)}</pre>
                </div>
                <div style="flex: 1; border: 1px solid #ccc; padding: 10px; height: 500px; overflow: auto;">
                    <h2 style="margin-top: 0;">処理後のHTML</h2>
                    <pre style="white-space: pre-wrap; word-break: break-all; font-size: 12px;">${escapeHTML(processedHTML)}</pre>
                </div>
            </div>
            
            <div id="preview-container" style="display: none; border: 1px solid #ccc; padding: 10px; margin-top: 20px;">
                <h2 style="margin-top: 0;">プレビュー</h2>
                <div id="preview-content" style="min-height: 300px;"></div>
            </div>
        </div>
    `;

    // ページに追加
    document.body.appendChild(testResultsContainer);

    // 閉じるボタンのイベントリスナーを追加
    document.getElementById('close-test-results').addEventListener('click', function () {
        testResultsContainer.remove();
    });

    // ビュー切替ボタンのイベントリスナーを追加
    document.getElementById('toggle-view').addEventListener('click', function () {
        const codeView = document.getElementById('code-view');
        const previewContainer = document.getElementById('preview-container');

        if (codeView.style.display !== 'none') {
            codeView.style.display = 'none';
            previewContainer.style.display = 'block';
        } else {
            codeView.style.display = 'flex';
            previewContainer.style.display = 'none';
        }
    });

    // 元のHTMLを表示ボタンのイベントリスナーを追加
    document.getElementById('show-original').addEventListener('click', function () {
        const previewContainer = document.getElementById('preview-container');
        const previewContent = document.getElementById('preview-content');
        const codeView = document.getElementById('code-view');

        // プレビューに切り替え
        codeView.style.display = 'none';
        previewContainer.style.display = 'block';

        // 安全に表示するために一度クリア
        previewContent.innerHTML = '';

        // サンドボックスiframeを作成して表示
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '500px';
        iframe.style.border = 'none';

        previewContent.appendChild(iframe);

        // iframeにコンテンツを設定
        setTimeout(() => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open();
                doc.write('<!DOCTYPE html><html><head><title>Original Preview</title></head><body style="margin: 0; padding: 10px;">');
                doc.write('<h3>元のHTML（プレビュー）</h3>');

                // スクリプトタグを無効化する簡易的な方法
                const sanitizedHTML = originalHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- script removed -->');

                doc.write(sanitizedHTML);
                doc.write('</body></html>');
                doc.close();
            } catch (e) {
                previewContent.innerHTML = '<div style="color: red; padding: 20px;">プレビューの表示に失敗しました。CSP制限により表示できない可能性があります。</div>';
                console.error('プレビュー表示エラー:', e);
            }
        }, 100);
    });

    // 処理後のHTMLを表示ボタンのイベントリスナーを追加
    document.getElementById('show-processed').addEventListener('click', function () {
        const previewContainer = document.getElementById('preview-container');
        const previewContent = document.getElementById('preview-content');
        const codeView = document.getElementById('code-view');

        // プレビューに切り替え
        codeView.style.display = 'none';
        previewContainer.style.display = 'block';

        // 安全に表示するために一度クリア
        previewContent.innerHTML = '';

        // サンドボックスiframeを作成して表示
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '500px';
        iframe.style.border = 'none';

        previewContent.appendChild(iframe);

        // iframeにコンテンツを設定
        setTimeout(() => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open();
                doc.write('<!DOCTYPE html><html><head><title>Processed Preview</title></head><body style="margin: 0; padding: 10px;">');
                doc.write('<h3>処理後のHTML（プレビュー）</h3>');

                // スクリプトタグを無効化する簡易的な方法
                const sanitizedHTML = processedHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '<!-- script removed -->');

                doc.write(sanitizedHTML);
                doc.write('</body></html>');
                doc.close();
            } catch (e) {
                previewContent.innerHTML = '<div style="color: red; padding: 20px;">プレビューの表示に失敗しました。CSP制限により表示できない可能性があります。</div>';
                console.error('プレビュー表示エラー:', e);
            }
        }, 100);
    });
}

// HTMLエスケープ関数
function escapeHTML(html) {
    return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// テスト実行
const testResult = testNakedHTML();
console.log('テスト結果:', testResult);