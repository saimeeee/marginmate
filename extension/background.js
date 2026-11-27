import { passageLimit } from "./core.mjs";

const menuId = "marginmate-selection";
const latestCapture = new Map();

chrome.runtime.onInstalled.addListener(() => {
  const chinese = chrome.i18n.getUILanguage().toLowerCase().startsWith("zh");
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: menuId,
      title: chinese ? "在 MarginMate 中处理选中文字" : "Bring selection to MarginMate",
      contexts: ["selection"],
      documentUrlPatterns: ["http://*/*", "https://*/*"]
    });
  });
});

function begin(tab) {
  const ticket = {};
  latestCapture.set(tab.windowId, ticket);
  // open() must start in the original gesture, before storage or scripting awaits.
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() =>
    chrome.tabs.create({ windowId: tab.windowId, url: chrome.runtime.getURL("panel.html") })
  );
  return ticket;
}

function save(tab, ticket, text, issue = "") {
  if (ticket !== latestCapture.get(tab.windowId)) return;
  const key = `capture-${tab.windowId}`;
  const problem = text.length > passageLimit ? "long" : issue;
  return chrome.storage.session.set({
    [key]: { text: problem ? "" : text, issue: problem, id: crypto.randomUUID() }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === menuId && tab?.id != null) {
    const ticket = begin(tab);
    void save(tab, ticket, info.selectionText || "");
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  const ticket = begin(tab);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const field = document.activeElement;
        if (field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && ["text", "search", "url", "email", "tel"].includes(field.type))) {
          if (typeof field.selectionStart === "number") return field.value.slice(field.selectionStart, field.selectionEnd);
        }
        return window.getSelection()?.toString() || "";
      }
    });
    const text = results[0]?.result || "";
    await save(tab, ticket, text, text.trim() ? "" : "empty");
  } catch {
    await save(tab, ticket, "", "restricted");
  }
});

chrome.windows.onRemoved.addListener((id) => {
  latestCapture.delete(id);
  void chrome.storage.session.remove(`capture-${id}`);
});
