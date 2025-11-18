
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.get("/proxy", async (req, res) => {
  try {
    const api = await fetch("https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        pageSize: 10,
        pageNo: 1,
        typeId: 1,
        language: 0,
        random: "3a60c072dff3482c92764cf4b1749104",
        signature: "BC21C61AE44B0E7684AA007F646BA558",
        timestamp: Math.floor(Date.now() / 1000)
      })
    });

    const json = await api.json();
    res.json(json);
  } catch (err) {
    res.json({ error: "blocked" });
  }
});

app.listen(3000, () => console.log("Proxy running on port 3000"));
