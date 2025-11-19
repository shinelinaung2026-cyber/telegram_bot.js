
// shine_sync.js
import fetch from "node-fetch";

// === Telegram Config ===
const BOT_TOKEN = "7513291825:AAGHKWei5eUTVjCsddg5X3_mf8VvNzLq8J4";
const CHAT_ID = "@lionmyid0909";

// === LOCAL PROXY CONFIG ===
const PROXY_URL = "http://localhost/proxy.php";

// localhost হলে → "http://localhost/proxy.php"

// Last processed period
let lastPeriod = null;

// Fetch data from proxy.php
async function getData() {
  try {
    const res = await fetch(PROXY_URL);
    const json = await res.json();
    return json.data.list || [];
  } catch (e) {
    console.log("Proxy Fetch Error:", e);
    return [];
  }
}

// AI Prediction Logic
function AIpredict(list) {
  if (list.length < 4) return { predNum: "-", bs: "-", col: "-", conf: 0 };

  const nums = list.map(a => Number(a.number));
  const trend = nums[0] - nums[3];
  let predNum = trend > 0 ? nums[0] + 1 : trend < 0 ? nums[0] - 1 : nums[0];
  predNum = Math.max(0, Math.min(9, predNum));

  const bs = predNum >= 5 ? "Big" : "Small";

  const colCount = { red: 0, green: 0, violet: 0 };
  list.forEach(i => {
    const c = i.colour.toLowerCase();
    if (c.includes("red")) colCount.red++;
    if (c.includes("green")) colCount.green++;
    if (c.includes("violet")) colCount.violet++;
  });
  const col = Object.keys(colCount).reduce((a, b) =>
    colCount[a] > colCount[b] ? a : b
  );
  const conf = Math.round((colCount[col] / list.length) * 100);

  return { predNum, bs, col, conf };
}

// Send Telegram Message
function sendToTelegram(text) {
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  }).catch(e => console.log("Telegram Error:", e));
}

// Main Prediction Flow
async function handlePrediction() {
  const list = await getData();
  if (!list.length) return;

  const latest = list[0];
  const currentPeriod = latest.issueNumber;

  // Already processed → skip
  if (currentPeriod === lastPeriod) return;

  // Save last period
  lastPeriod = currentPeriod;

  // Calculate next period
  const nextPeriod = (BigInt(currentPeriod) + 1n).toString();

  // Generate AI Prediction
  const ai = AIpredict(list);

  // Send prediction
  const predictionMessage =
    ` CK LOTTERY WINGO 1-MIN\n`+
    `🎯 Prediction for ${nextPeriod}\n` +
    `Number: ${ai.predNum}\n` +
    `Big/Small: ${ai.bs}\n` +
    `Colour: ${ai.col}\n` +
    `Confidence: ${ai.conf}%`;

  setTimeout(() => sendToTelegram(predictionMessage), 3000);

  // Wait for actual result
  const interval = setInterval(async () => {
    const newList = await getData();
    const newLatest = newList[0];

    if (!newLatest || newLatest.issueNumber === currentPeriod) return;

    clearInterval(interval);

    const actualBS = newLatest.number >= 5 ? "Big" : "Small";

    const resultMessage =
      `📊 Result for ${nextPeriod}\n` +
      `Predicted: ${ai.bs}\n` +
      `Actual: ${actualBS}\n` +
      `Result: ${ai.bs === actualBS ? "WIN ✅" : "LOSE ❌"}`;

    sendToTelegram(resultMessage);

  }, 4000);
}

// Run Every Second
handlePrediction();
setInterval(handlePrediction, 1000);
