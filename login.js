import dotenv from "dotenv";
import puppeteer from "puppeteer";
dotenv.config();

export async function login(page) {
  await page.goto("https://ck-site.com/login", { waitUntil: "networkidle2" });

  // Phone input
  await page.type("#phone", process.env.PHONE_NUMBER, { delay: 80 });

  // Password input
  await page.type("#password", process.env.PASSWORD, { delay: 80 });

  // Login button click
  await page.click("#login-btn");

  // Wait redirect
  await page.waitForNavigation({ waitUntil: "networkidle2" });

  console.log("Logged in ✔️");
}
