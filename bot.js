import fetch from "node-fetch";

const BOT_TOKEN = "8253001112:AAE51vOORcdJCYMWz6L340goOu9ElpkhtuM";
const CHAT_ID = "@shine49034000";

const API_URL = "https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList";

const body = {
  pageSize: 10,
  pageNo: 1,
  typeId: 1,
  language: 0,
  random: "3a60c072dff3482c92764cf4b1749104",
  signature: "BC21C61AE44B0E7684AA007F646BA558",
  timestamp: Math.floor(Date.now() / 1000),
};

let lastPeriod = null;

// ============ FETCH API ============
async function getData() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json.data.list;
  } catch (e) {
    console.log("API error:", e);
    return [];
  }
}

// ============ AI Logic (Number + Big Small + Colour + Confidence) ============
function AIpredict(list) {
  if (list.length < 4)
    return { predNum: "-", bs: "-", col: "-", conf: 0 };

  let nums = list.map((a) => Number(a.number));
  let trend = nums[0] - nums[3];

  let predNum =
    trend > 0 ? nums[0] + 1 : trend < 0 ? nums[0] - 1 : nums[0];
  predNum = Math.max(0, Math.min(9, predNum));

  let bs = predNum >= 5 ? "Big" : "Small";

  // ---- Colour Prediction ----
  let colCount = { red: 0, green: 0, violet: 0 };
  list.forEach((i) => {
    const c = i.colour.toLowerCase();
    if (c.includes("red")) colCount.red++;
    if (c.includes("green")) colCount.green++;
    if (c.includes("violet")) colCount.violet++;
  });

  let col = Object.keys(colCount).reduce((a, b) =>
    colCount[a] > colCount[b] ? a : b
  );

  let conf = Math.round((colCount[col] / list.length) * 100);

  return { predNum, bs, col, conf };
}

// ============ TELEGRAM SEND ============
function sendToTelegram(text) {
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
    }),
  }).catch((e) => console.log("Telegram Error:", e));
}

// ============ MAIN LOOP ============
async function load() {
  const list = await getData();
  if (!list.length) return;

  const latest = list[0];

  // New period detect
  if (latest.issueNumber !== lastPeriod) {
    lastPeriod = latest.issueNumber;

    const targetPeriod = String(Number(latest.issueNumber) + 1);

    // AI Prediction from current list
    const ai = AIpredict(list);

    // ---- SEND PREDICTION ----
    sendToTelegram(
      `🎯 Prediction for ${targetPeriod}\n` +
      `Number: ${ai.predNum}\n` +
      `Big/Small: ${ai.bs}\n` +
      `Colour: ${ai.col}\n` +
      `Confidence: ${ai.conf}%`
    );

    // ---- WAIT 60 SEC → CHECK NEW PERIOD RESULT ----
    setTimeout(async () => {
      const newList = await getData();
      const newLatest = newList[0];

      // Must match targetPeriod
      if (newLatest.issueNumber === targetPeriod) {
        const actualBS = newLatest.number >= 5 ? "Big" : "Small";

        sendToTelegram(
          `📊 Result for ${targetPeriod}\n` +
          `Predicted: ${ai.bs}\n` +
          `Actual: ${actualBS}\n` +
          `Result: ${ai.bs === actualBS ? "WIN ✅" : "LOSE ❌"}`
        );
      }
    }, 60000);
  }
}

// Run every 10s
load();
setInterval(load, 10000);
