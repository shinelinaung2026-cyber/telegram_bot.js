import puppeteer from "puppeteer";
import dotenv from "dotenv";
dotenv.config();

export async function login() {
  console.log("🚀 Starting browser...");

  // Anti‑ban settings
  const browser = await puppeteer.launch({
    headless: false, // true = hidden (ban risk)
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ]
  });

  const page = await browser.newPage();

  // Fake human behavior
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  );

  // Go to login page
  console.log("🌐 Opening login page...");
  await page.goto("https://YOUR-WEBSITE.COM/login", {
    waitUntil: "networkidle2",
    timeout: 0
  });

  // ===== SELECTORS =====
  const phoneSelector = "#phone";         // Change if different
  const passSelector = "#password";       // Change if different
  const loginBtn     = "#login-btn";      // Change if different

  await page.waitForSelector(phoneSelector);
  await page.waitForSelector(passSelector);

  // Type phone
  console.log("⌨ Entering phone...");
  await page.click(phoneSelector);
  await page.type(phoneSelector, process.env.PHONE_NUMBER, { delay: randomDelay() });

  // Type password
  console.log("🔐 Entering password...");
  await page.click(passSelector);
  await page.type(passSelector, process.env.PASSWORD, { delay: randomDelay() });

  // Click login button
  console.log("👉 Clicking login...");
  await page.click(loginBtn);

  // Wait redirect after login
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 0 });

  console.log("✅ Login Successful!");

  return { browser, page }; // Return for auto-bet script
}


// Random delay (Human-like)
function randomDelay() {
  return Math.floor(Math.random() * 90) + 50; // 50–140ms
}
