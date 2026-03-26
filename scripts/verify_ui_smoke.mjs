import { chromium, request } from "playwright";

const baseURL = process.env.XINGCE_BASE_URL || "http://127.0.0.1:8000";

async function main() {
  const username = `smoke_${Date.now()}`;
  const password = "codexpass123";

  const api = await request.newContext({ baseURL });
  const registerResp = await api.post("/api/auth/register", {
    data: { username, password }
  });
  if (!registerResp.ok()) {
    throw new Error(`register failed: ${registerResp.status()} ${await registerResp.text()}`);
  }

  const storageState = await api.storageState();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".top-bar");

  await page.click("#viewModeErrors");
  await page.evaluate(() => {
    if (typeof window.openQuickAddModal !== "function") throw new Error("openQuickAddModal missing");
    window.openQuickAddModal();
  });
  await page.waitForFunction(() => document.getElementById("addModal")?.classList.contains("open"));

  await page.selectOption("#editType", { label: "判断推理" }).catch(async () => {
    const firstValue = await page.$eval("#editType", el => {
      const options = Array.from(el.querySelectorAll("option")).map(item => item.value).filter(Boolean);
      return options[0] || "";
    });
    if (!firstValue) throw new Error("editType has no usable option");
    await page.selectOption("#editType", firstValue);
  });

  await page.fill("#editSubtype", "图形推理");
  await page.fill("#editSubSubtype", "位置规律");
  await page.fill("#editQuestion", "UI smoke 题目：如果图形按顺时针旋转，下一项是什么？");
  await page.fill("#editOptions", "A. 顺时针90度|B. 逆时针90度|C. 上下翻转|D. 左右翻转");
  await page.fill("#editAnswer", "A");
  await page.fill("#editMyAnswer", "B");
  await page.click("#saveErrorQuickBtn");

  await page.waitForFunction(() => !document.getElementById("addModal")?.classList.contains("open"));
  await page.waitForSelector("text=UI smoke 题目");

  await page.click("#aiWorkbenchBtn");
  await page.waitForSelector("#aiToolsModal.open");
  await page.waitForSelector("text=模式发现");
  await page.click("#aiToolsModal .modal-close");

  await page.click("#viewModeNotes");
  await page.waitForSelector("#tabContentNotes.active");
  await page.waitForTimeout(600);
  const notesText = await page.locator("#notesContent").textContent();
  if (!notesText || !notesText.trim()) {
    throw new Error("notes content is empty");
  }

  await page.click("#quizBtn");
  await page.waitForSelector("#quizModal.open");
  let reviewReached = false;
  for (let i = 0; i < 20; i += 1) {
    if (await page.locator("text=本次练习完成").count()) {
      reviewReached = true;
      break;
    }
    if (await page.locator(".quiz-opt-btn").count() < 1) {
      throw new Error("quiz options not rendered");
    }
    await page.locator(".quiz-opt-btn").first().click();
    await page.waitForSelector("#quizNextBtn");
    await page.click("#quizNextBtn");
    await page.waitForTimeout(250);
  }
  if (!reviewReached) {
    await page.waitForSelector("text=本次练习完成");
  }
  await page.click("text=保存记录");
  await page.waitForFunction(() => !document.getElementById("quizModal")?.classList.contains("open"));

  const cloudBadge = await page.locator("#cloudSyncBadge").textContent();
  console.log(JSON.stringify({
    ok: true,
    baseURL,
    username,
    cloudBadge: (cloudBadge || "").trim()
  }, null, 2));

  await context.close();
  await browser.close();
  await api.dispose();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
