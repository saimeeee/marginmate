// Run with playwright-core and a current Chrome for Testing binary. All fixture data stays on localhost.
const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright-core");

const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");
const selected = "The shade of urban trees cools the pavement.";
const other = "Another paragraph outside the selection.";
const requests = [];
const server = http.createServer(async (req, res) => {
  if (req.url === "/selection") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    return res.end('<!doctype html><title>Reading fixture</title><p id="selected">' + selected + "</p><p>" + other + "</p>");
  }
  if (req.url === "/api/chat" && req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    res.writeHead(200, {"Content-Type":"application/json"});
    return res.end(JSON.stringify({message:{role:"assistant",content:"Local fixture reply."}}));
  }
  const pathname = new URL(req.url, "http://localhost").pathname;
  const target = path.resolve(docs, "." + (pathname === "/" ? "/index.html" : pathname));
  if (!target.startsWith(docs + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) return res.writeHead(404).end();
  const type = {".mjs":"text/javascript",".css":"text/css",".html":"text/html",".png":"image/png"}[path.extname(target)];
  res.writeHead(200, {"Content-Type":(type || "application/octet-stream") + "; charset=utf-8"});
  fs.createReadStream(target).pipe(res);
});
async function until(read, description) {
  for (let i=0; i<100; i++) {
    const value = await read();
    if (value) return value;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error(description);
}

async function main() {
  assert.ok(process.env.BROWSER_EXECUTABLE, "Set BROWSER_EXECUTABLE to a Chrome for Testing executable.");
  const extension = path.join(root, "extension");
  server.listen(0, "127.0.0.1");
  await once(server,"listening");
  const origin = "http://127.0.0.1:" + server.address().port;
  const context = await chromium.launchPersistentContext("", {
    executablePath: process.env.BROWSER_EXECUTABLE, headless: true, locale: "en-US",
    viewport:{width:1400,height:880}, ignoreDefaultArgs:["--disable-extensions"],
    args:["--enable-unsafe-extension-debugging", "--disable-extensions-except="+extension, "--load-extension="+extension,
      "--disable-background-networking"]
  });
  try {
    const browserSession = await context.browser().newBrowserCDPSession();
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).hostname;
    const page = context.pages()[0];
    await page.goto(origin + "/selection");
    await page.locator("#selected").evaluate(el => getSelection().selectAllChildren(el));
    assert.equal(await page.evaluate(() => getSelection().toString()), selected);

    const cdp = await context.newCDPSession(page);
    const pageTarget = (await cdp.send("Target.getTargetInfo")).targetInfo;
    // CDP revisions differ on whether triggerAction accepts the page or its tab target.
    try {
      await browserSession.send("Extensions.triggerAction", {id, targetId:pageTarget.targetId});
    } catch (error) {
      if (!String(error).includes("tab target")) throw error;
      const {targetInfos} = await browserSession.send("Target.getTargets", {filter:[{type:"tab"}]});
      const tab = targetInfos.find(target=>target.url === page.url());
      assert.ok(tab, "Could not find the selected tab");
      await browserSession.send("Extensions.triggerAction", {id, targetId:tab.targetId});
    }
    const panelURL = "chrome-extension://" + id + "/panel.html";
    await until(async () => (await browserSession.send("Target.getTargets")).targetInfos.some(target=>target.url===panelURL), "Toolbar did not open the reading desk");
    // The native docked surface is managed by the browser. Open the same extension UI in its window for DOM/clipboard checks.
    const panel = await context.newPage();
    await panel.goto(panelURL);
    await panel.waitForFunction(expected=>document.querySelector("#passage")?.value === expected, selected);
    await panel.locator("[data-action=translate]").click();
    await panel.locator("#language").selectOption("ja");
    const prompt = await panel.locator("#prompt").innerText();
    assert.ok(prompt.includes(selected) && prompt.includes("Japanese") && !prompt.includes(other));
    await panel.locator("#copyPrompt").click();
    await panel.waitForFunction(()=>document.querySelector("#status").textContent.includes("copied"));
    await panel.locator(".runner summary").click();
    await panel.locator("#address").fill(origin);
    await panel.locator("#model").fill("fixture-model");
    assert.equal(await panel.locator("#destination").innerText(), origin + "/api/chat");
    const granted = await panel.evaluate(()=>chrome.permissions.getAll());
    assert.ok(!granted.origins.includes("http://127.0.0.1/*"));
    assert.equal(requests.length,0);
    // Native permission dialogs are outside the page automation surface. Exercise the adapter over real HTTP independently.
    const { modelRequest, readReply } = await import("../extension/core.mjs");
    const result = await fetch(origin + "/api/chat", modelRequest("fixture-model", prompt, "", undefined));
    assert.equal(readReply("ollama",await result.json()),"Local fixture reply.");
    assert.deepEqual(requests,[{model:"fixture-model",messages:[{role:"user",content:prompt}],stream:false}]);

    const publicPage = await context.newPage();
    await publicPage.goto(origin + "/");
    await publicPage.waitForFunction(()=>document.querySelector("#prompt")?.innerText.includes("tree canopy"));
    if (process.env.MARGINMATE_SCREENSHOT) await publicPage.screenshot({path:process.env.MARGINMATE_SCREENSHOT});
    await publicPage.locator("#passage").fill("A short note.");
    await publicPage.locator("[data-action=custom]").click();
    await publicPage.locator("#custom").fill("Suggest a title.");
    assert.ok((await publicPage.locator("#prompt").innerText()).includes("Suggest a title."));
    await publicPage.locator("#switchLocale").click();
    assert.equal(await publicPage.locator("html").getAttribute("lang"), "zh-CN");
    await publicPage.setViewportSize({width:375,height:760});
    assert.ok(await publicPage.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await publicPage.locator(".runner").count(),0);
    console.log("Verified native extension action, selected passage, copy, local model POST, public composer and mobile layout.");
  } finally { await context.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
