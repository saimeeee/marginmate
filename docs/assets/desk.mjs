import { compose, languages, modelEndpoint, modelRequest, passageLimit, readReply } from "./core.mjs";

const extension = location.protocol === "chrome-extension:";
const $ = (id) => document.getElementById(id);
const copy = {
  panelTitle: ["Reading desk", "阅读工作台"], navDesk: ["Prompt desk", "提示词工作台"], navInstall: ["Install extension", "安装扩展"],
  heroFirst: ["From passage", "从一段原文"], heroLast: ["to prompt.", "写出好提问。"],
  intro: ["Bring a line you're reading. Shape a question for your AI assistant.", "把读到的文字放在这里，为你的 AI 助手准备一个具体的问题。"],
  extensionLabel: ["Browser extension", "浏览器扩展"], installTitle: ["Take the desk with you.", "在网页旁打开工作台。"],
  installIntro: ["Select text on a webpage to open it in the side panel. The extension can also send a prompt to your own local model.", "选中网页上的文字，在侧栏中处理。扩展还可以把提示词发给你自己的本地模型。"],
  download: ["Download extension ZIP", "下载扩展 ZIP"], getFiles: ["Unzip the download", "解压下载的文件"], getDetails: ["Keep the folder that contains manifest.json.", "找到并保留包含 manifest.json 的文件夹。"],
  load: ["Load the extension", "加载扩展"], loadDetail: ["Open chrome://extensions or edge://extensions, enable Developer mode, choose Load unpacked and select that folder.", "打开 chrome://extensions 或 edge://extensions，开启开发者模式，点击“加载已解压的扩展程序”，选择该文件夹。"],
  selectText: ["Select a passage", "选取原文"], selectDetail: ["On a regular webpage, right-click your selection and choose “Bring selection to MarginMate”.", "在普通网页选中一段文字，右键选择“在 MarginMate 中处理选中文字”。"],
  source: ["Source code ↗", "源代码 ↗"], passage: ["Your passage", "你的原文"], sample: ["Try a sample", "载入示例"], clear: ["Clear", "清空"], placeholder: ["Paste or type a passage…", "粘贴或输入一段文字…"],
  action: ["What would you like to do?", "你想如何处理这段文字？"], explain: ["Explain", "解释"], translate: ["Translate", "翻译"], rewrite: ["Rewrite", "改写"], custom: ["Custom", "自定义"],
  instructions: ["Your instruction", "你的指令"], example: ["Find three assumptions in this passage…", "找出这段文字的三个假设…"], language: ["Answer language", "回答语言"],
  preview: ["Prompt preview", "提示词预览"], copyPrompt: ["Copy prompt", "复制提示词"], copied: ["Copied", "已复制"], emptyPreview: ["Add a passage to see your prompt.", "输入原文后即可预览提示词。"], emptyCustom: ["Add your custom instruction to finish the prompt.", "输入自定义指令即可完成提示词。"],
  offline: ["Composed on this device", "在本机生成提示词"], open: ["Paste it into", "手动粘贴到"], copyFail: ["Select the prompt or answer and copy it manually.", "请选择提示词或回答，并手动复制。"],
  runner: ["Use a local model", "调用本地模型"], runnerHelp: ["Send the preview to a model server running on your computer.", "将预览中的提示词发送给此电脑上运行的模型服务。"],
  api: ["API format", "API 格式"], address: ["Server origin", "服务地址"], model: ["Model name", "模型名称"], key: ["Access token (optional, this panel only)", "访问令牌（可选，仅在当前侧栏使用）"],
  destination: ["Destination", "发送目标"], send: ["Send to local model", "发送给本地模型"], stop: ["Cancel", "取消"], running: ["Waiting for the local model…", "正在等待本地模型…"],
  response: ["Model answer", "模型回答"], copyAnswer: ["Copy answer", "复制回答"], denied: ["Host access was declined. Grant access when you send to this local server.", "未获准访问本地服务；再次发送时可以授权。"],
  invalid: ["Enter an HTTP origin on localhost or 127.0.0.1, with an optional port.", "请输入 localhost 或 127.0.0.1 的 HTTP 地址，可包含端口。"],
  missingModel: ["Enter a model installed on your server.", "请输入本地服务中已安装的模型名称。"],
  failed: ["Could not reach the model. Check the server address and allow this extension's origin in your server settings.", "无法连接模型。请检查服务地址，并在服务器中允许此扩展的来源。"],
  timeout: ["The model timed out. Try a shorter passage or a smaller model.", "模型响应超时，请缩短原文或改用较小的模型。"],
  badReply: ["The server returned an empty or unsupported answer. Check the API format and model name.", "服务返回空回答或不支持的格式。请检查 API 格式和模型名称。"],
  cancelled: ["Request cancelled.", "请求已取消。"], httpError: ["The server returned HTTP", "服务返回 HTTP"], long: ["Selection exceeds 24,000 characters. Paste a shorter excerpt.", "所选文字超过 24,000 字符，请粘贴较短的片段。"],
  restricted: ["This page restricts extension access. Copy the passage and paste it here.", "此页面限制扩展访问，请复制原文并粘贴到这里。"],
  empty: ["Select some text first, use the selection's context menu, or paste it here.", "请先选中文字，再使用右键菜单，或直接粘贴到这里。"],
  capture: ["Selection received.", "已接收选中文字。"], copyReady: ["Prompt copied. Paste it into the assistant you choose.", "提示词已复制。请粘贴到你选择的助手中。"],
  replyReady: ["Answer copied.", "回答已复制。"], blocked: ["A model request is already running.", "模型正在生成回答。"],
  count: ["characters", "字符"], setupHelp: ["Local server setup ↗", "本地服务设置 ↗"]
};
const examples = {
  en: "A city’s tree canopy works like a second roof. Its shade cools the pavement, while water released through leaves cools the air.",
  zh: "城市的树冠像第二层屋顶。树荫为路面降温，叶片释放的水分也降低了空气温度。"
};
let locale = (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
try { const saved = localStorage.getItem("marginmate-language"); if (["zh","en"].includes(saved)) locale = saved; } catch {}
let action = "explain";
let activeRequest;
let captureKey;
let captureChanges = 0;
let output = "";
let lastStatus = "";
const t = (key) => copy[key]?.[locale === "zh" ? 1 : 0] || "";

const modelMarkup = `<details class="runner"><summary data-t="runner"></summary><p data-t="runnerHelp"></p>
<div class="settings"><label><span data-t="api"></span><select id="protocol"><option value="ollama">Ollama</option><option value="openai">OpenAI-compatible</option></select></label>
<label><span data-t="address"></span><input id="address" type="url" value="http://127.0.0.1:11434" spellcheck="false"></label>
<label><span data-t="model"></span><input id="model" type="text" placeholder="e.g. llama3.2" spellcheck="false" maxlength="180"></label>
<label id="keyLabel" hidden><span data-t="key"></span><input id="token" type="password" autocomplete="off" spellcheck="false"></label></div>
<p class="destination"><span data-t="destination"></span> <code id="destination"></code></p>
<div class="buttons"><button class="primary" id="send" data-t="send"></button><button type="button" id="stop" class="secondary" data-t="stop" hidden></button></div>
<p class="status" id="modelStatus" role="status"></p><div id="answerBox" hidden><h3 data-t="response"></h3><pre id="answer" tabindex="0"></pre><button type="button" id="copyAnswer" class="secondary" data-t="copyAnswer"></button></div>
<a class="doclink" href="https://github.com/saimeeee/marginmate#local-model-setup" target="_blank" rel="noopener noreferrer" data-t="setupHelp"></a></details>`;

$("desk").innerHTML = `<div class="workbench"><section class="editor"><div class="section-title"><h2><label for="passage" data-t="passage"></label></h2><div class="quiet-actions"><button type="button" id="sample" class="link-button" data-t="sample"></button><button type="button" id="clear" class="link-button" data-t="clear"></button></div></div>
<div class="passage-box"><textarea id="passage" maxlength="${passageLimit}" data-ph="placeholder" spellcheck="false"></textarea><span id="count" class="count"></span></div>
<fieldset class="actions"><legend data-t="action"></legend><div class="choices">${["explain","translate","rewrite","custom"].map((id) => `<button class="choice" type="button" data-action="${id}" aria-pressed="${id==="explain"}"><i class="tool-icon ${id}" aria-hidden="true"></i><span data-t="${id}"></span></button>`).join("")}</div></fieldset>
<label class="custom-field" id="customField" hidden><span data-t="instructions"></span><textarea id="custom" maxlength="2000" rows="2" data-ph="example"></textarea></label>
<label class="lang-row" for="language"><span data-t="language"></span><select id="language"></select></label></section>
<section class="preview"><div class="section-title"><h2 data-t="preview"></h2><i class="preview-glyph" aria-hidden="true">❞</i></div>
<pre class="prompt" id="prompt" tabindex="0"></pre>
<div class="copy-line"><button type="button" id="copyPrompt" class="primary"><i class="copy-icon" aria-hidden="true"></i><span data-t="copyPrompt"></span></button>
<span class="privacy"><i aria-hidden="true"></i><span data-t="offline"></span></span></div>
<div class="assistants"><span data-t="open"></span><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT ↗</a><a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Claude ↗</a></div>
</section></div><p class="status" id="status" role="status"></p>${extension ? modelMarkup : ""}`;

function localize() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-t]").forEach((node) => node.textContent = t(node.dataset.t));
  document.querySelectorAll("[data-ph]").forEach((node) => node.placeholder = t(node.dataset.ph));
  $("switchLocale").textContent = locale === "en" ? "中文" : "English";
  const selected = $("language").value || locale;
  $("language").replaceChildren(...Object.entries(languages).map(([id, labels]) => new Option(labels[locale === "zh" ? 1 : 0], id)));
  $("language").value = selected;
  $("status").textContent = t(lastStatus);
}
function getPrompt() {
  return compose({ passage: $("passage").value, action, language: $("language").value, custom: $("custom").value, locale });
}
function redraw() {
  const prompt = getPrompt();
  $("prompt").textContent = prompt || t(action === "custom" && $("passage").value.trim() ? "emptyCustom" : "emptyPreview");
  $("prompt").classList.toggle("is-empty", !prompt);
  $("customField").hidden = action !== "custom";
  $("copyPrompt").disabled = !prompt;
  $("clear").disabled = !$("passage").value;
  $("count").textContent = `${$("passage").value.length.toLocaleString(locale)} ${t("count")}`;
  document.querySelectorAll("[data-action]").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.action === action)));
  if (extension) {
    let endpoint;
    try { endpoint = modelEndpoint($("protocol").value, $("address").value); } catch {}
    $("destination").textContent = endpoint ? endpoint.href : t("invalid");
    $("send").disabled = !!activeRequest || !prompt || !endpoint || !$("model").value.trim();
    $("stop").hidden = !activeRequest;
    $("keyLabel").hidden = $("protocol").value !== "openai";
  }
}
function status(key) { lastStatus = key; $("status").textContent = t(key); }
function changed() {
  status("");
  if (extension) {
    activeRequest?.abort();
    activeRequest = undefined;
    output = "";
    $("answer").textContent = "";
    $("answerBox").hidden = true;
    $("modelStatus").textContent = "";
  }
  redraw();
}
async function copyText(value, button, msg) {
  try {
    await navigator.clipboard.writeText(value);
    status(msg);
  } catch {
    const range = document.createRange();
    range.selectNodeContents($(button === "copyAnswer" ? "answer" : "prompt"));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    try { status(document.execCommand("copy") ? msg : "copyFail"); } catch { status("copyFail"); }
  }
}

["passage", "custom","language"].forEach((id) => $(id).addEventListener("input", changed));
document.querySelectorAll("[data-action]").forEach((btn) => btn.addEventListener("click", () => {
  action = btn.dataset.action;
  changed();
  if (action === "custom") $("custom").focus();
}));
$("clear").onclick = () => {
  $("passage").value = "";
  if (captureKey) void chrome.storage.session.remove(captureKey);
  changed(); $("passage").focus();
};
$("sample").onclick = () => { $("passage").value = examples[locale]; changed(); };
$("copyPrompt").onclick = () => copyText(getPrompt(), "copyPrompt", "copyReady");
$("switchLocale").onclick = () => {
  const previous = locale;
  locale = locale === "en" ? "zh" : "en";
  if ($("passage").value === examples[previous]) $("passage").value = examples[locale];
  try { localStorage.setItem("marginmate-language", locale); } catch {}
  localize(); changed();
};

async function setupExtension() {
  const current = await chrome.windows.getCurrent();
  captureKey = `capture-${current.id}`;
  function accept(record) {
    $("passage").value = record?.text || "";
    changed();
    status(record ? record.issue || "capture" : "");
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "session" && changes[captureKey]) { captureChanges++; accept(changes[captureKey].newValue); }
  });
  const stored = await chrome.storage.session.get(captureKey);
  if (!captureChanges && stored[captureKey]) accept(stored[captureKey]);
  const saved = (await chrome.storage.local.get("modelSettings")).modelSettings;
  if (saved && ["ollama","openai"].includes(saved.protocol)) {
    $("protocol").value = saved.protocol; $("address").value = saved.address; $("model").value = saved.model;
  }
  $("protocol").onchange = () => {
    $("address").value = $("protocol").value === "ollama" ? "http://127.0.0.1:11434" : "http://127.0.0.1:1234";
    $("token").value = ""; changed();
  };
  ["model", "address", "token"].forEach((id) => $(id).addEventListener("input", changed));
  $("stop").onclick = () => { activeRequest?.abort(); activeRequest = undefined; $("modelStatus").textContent = t("cancelled"); redraw(); };
  $("send").onclick = send;
  $("copyAnswer").onclick = () => copyText(output, "copyAnswer", "replyReady");
  redraw();
}

async function send() {
  if (activeRequest) return;
  const protocol = $("protocol").value;
  const model = $("model").value.trim();
  const prompt = getPrompt();
  let endpoint;
  try { endpoint = modelEndpoint(protocol, $("address").value); } catch { $("modelStatus").textContent = t("invalid"); return; }
  if (!model || !prompt) { $("modelStatus").textContent = t("missingModel"); return; }
  const token = protocol === "openai" ? $("token").value : "";
  const controller = new AbortController();
  activeRequest = controller;
  output = ""; $("answer").textContent = ""; $("answerBox").hidden = true;
  redraw();
  let timeout;
  try {
    const permission = await chrome.permissions.request({ origins: [`http://${endpoint.hostname}/*`] });
    if (controller.signal.aborted) return;
    if (!permission) throw new Error("denied");
    await chrome.storage.local.set({ modelSettings: { protocol, address: endpoint.origin, model } });
    if (controller.signal.aborted) return;
    $("modelStatus").textContent = t("running");
    timeout = setTimeout(() => controller.abort("timeout"), 90000);
    const response = await fetch(endpoint.href, modelRequest(model, prompt, token, controller.signal));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = readReply(protocol, await response.json().catch(() => { throw new Error("reply"); }));
    if (controller.signal.aborted) return;
    output = result; $("answer").textContent = result; $("answerBox").hidden = false; $("modelStatus").textContent = "";
  } catch (err) {
    if (activeRequest !== controller) return;
    const message = err?.message || "";
    $("modelStatus").textContent = controller.signal.reason === "timeout" ? t("timeout") :
      message.startsWith("HTTP ") ? `${t("httpError")} ${message.slice(5)}.` :
      t(message === "denied" ? "denied" : message === "reply" ? "badReply" : "failed");
  } finally {
    clearTimeout(timeout);
    if (activeRequest === controller) { activeRequest = undefined; redraw(); }
  }
}

if (!extension) $("passage").value = examples[locale];
localize(); redraw();
if (extension) setupExtension().catch(() => { status("restricted"); });
