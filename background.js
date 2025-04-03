chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'getClickedElement',
        title: 'Multicol',
        contexts: ['all'],
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'getClickedElement') {
        chrome.tabs.sendMessage(tab.id, { action: 'getClickedElement' }, (response) => {
            if (response && response.element) {
                console.log('クリックされた要素:', response.element);
                // ここで取得した要素の情報を処理
            } else {
                console.log('要素を取得できませんでした。');
            }
        });
    }
});