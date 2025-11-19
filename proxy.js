// proxy.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_URL = "https://ckygjf6r.com/api/webapi/GetNoaverageEmerdList";

app.get("/proxy", async (req, res) => {
  try {
    const body = {
      pageSize: 10,
      pageNo: 1,
      typeId: 1,
      language: 0,
      random: "6bd0534ee4324f8bb3282b93e69df558",
      signature: "C2DCB5613548D4C912D9CC530B659264",
      timestamp: Math.floor(Date.now() / 1000)
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const json = await response.json();
    res.json(json);

  } catch (e) {
    res.json({ error: e.toString() });
  }
});

app.listen(10000, () => console.log("Proxy running on port 10000"));
