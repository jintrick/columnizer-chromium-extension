console.log("multicol.js: Minimal test start.");
import { crm } from "./Crm.js";
console.log("multicol.js: Minimal test imports complete, signaling ready.");

crm.signalReady()
    .then(() => {
        console.log("multicol.js: Ready signal sent successfully.");
        // ここで処理を止めたり、簡単な表示だけしてみる
        document.body.textContent = 'Ready signal sent.';
    })
    .catch(e => {
        console.error("multicol.js: Error sending ready signal:", e);
        document.body.textContent = 'Error sending ready signal: ' + e.message;
    });

console.log("multicol.js: Minimal test end.");