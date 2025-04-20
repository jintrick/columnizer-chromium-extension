import { crm } from "./Crm.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("multicol.js: DOM fully loaded, signaling ready.");
    try {
        await crm.signalReady();
        console.log("multicol.js: Ready signal sent successfully.");
        document.body.textContent = "Ready signal sent.";
    } catch (e) {
        console.error("multicol.js: Error sending ready signal:", e);
        document.body.textContent = "Error sending ready signal: " + e.message;
    }
});