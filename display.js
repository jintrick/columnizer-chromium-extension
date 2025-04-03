chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'displayData') {
      // データを受信し、DOMに表示
      const displayArea = document.querySelector('#display-area');
      displayArea.innerHTML = request.data;
    }
  });