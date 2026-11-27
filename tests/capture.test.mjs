import assert from "node:assert/strict";
import { test } from "node:test";

function event() {
  return { addListener(fn) { this.fire = fn; } };
}

test("context-menu capture opens during the gesture and stays isolated per window", async () => {
  const calls = [];
  const store = {};
  const menu = event();
  const action = event();
  const close = event();
  globalThis.chrome = {
    runtime: {onInstalled:event(), getURL:(path)=>"chrome-extension://test/"+path},
    contextMenus: {onClicked:menu}, action: {onClicked:action}, windows:{onRemoved:close},
    sidePanel: {open(args) { calls.push(["open",args]); return Promise.resolve(); }},
    tabs:{create(args) {calls.push(["fallback",args]);}},
    storage: {session:{
      async set(items) { calls.push(["store"]); Object.assign(store,items); },
      async remove(key) { delete store[key]; }
    }},
    scripting:{executeScript: async () => [{result:""}]}
  };
  try {
    await import("../extension/background.js");
    menu.fire({menuItemId:"marginmate-selection",selectionText:"one"},{id:11,windowId:2});
    menu.fire({menuItemId:"marginmate-selection",selectionText:"two"},{id:12,windowId:3});
    assert.deepEqual(calls[0],["open",{windowId:2}]);
    assert.equal(store["capture-2"].text,"one");
    assert.equal(store["capture-3"].text,"two");
    await action.fire({id:11,windowId:2});
    assert.equal(store["capture-2"].text,"");
    assert.equal(store["capture-2"].issue,"empty");
    chrome.scripting.executeScript = async () => {throw new Error("restricted");};
    await action.fire({id:11,windowId:2});
    assert.equal(store["capture-2"].issue,"restricted");
    chrome.sidePanel.open = () => Promise.reject(new Error("sidebar disabled"));
    menu.fire({menuItemId:"marginmate-selection",selectionText:"x".repeat(24001)},{id:11,windowId:2});
    await Promise.resolve();
    assert.equal(store["capture-2"].issue,"long");
    assert.deepEqual(calls.at(-1),["fallback",{windowId:2,url:"chrome-extension://test/panel.html"}]);
    close.fire(2);
    assert.equal(store["capture-2"],undefined);
    assert.equal(store["capture-3"].text,"two");
  } finally { delete globalThis.chrome; }
});
