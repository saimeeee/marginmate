import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { compose, languages, modelEndpoint, modelRequest, passageLimit, readReply } from "../extension/core.mjs";

const base = { passage: "  Rain gardens absorb water.\n\n雨水。  ", action: "explain", language: "en" };
test("all four actions create copyable prompts and preserve internal paragraph breaks", () => {
  for (const action of ["explain","translate","rewrite","custom"]) {
    for (const language of Object.keys(languages)) {
      const prompt = compose({...base, action, language, custom:"Check the argument."});
      assert.ok(prompt.endsWith(base.passage.trim()));
      assert.ok(prompt.includes(languages[language][0]));
      if (action === "custom") assert.ok(prompt.startsWith("Check the argument."));
    }
  }
});
test("Chinese instructions and answer language are independent", () => {
  const prompt = compose({...base, action:"translate", language:"ja", locale:"zh"});
  assert.ok(prompt.includes("日语")); assert.ok(prompt.includes("原文")); assert.ok(prompt.endsWith(base.passage.trim()));
});
test("incomplete, unsupported or oversized inputs do not yield actionable prompts", () => {
  for (const change of [{passage:" "},{action:"custom", custom:" "},{action:"toString"},{language:"constructor"},{passage:"a".repeat(passageLimit+1)}]) {
    assert.equal(compose({...base,...change}), "");
  }
  assert.ok(compose({...base, passage:"a".repeat(passageLimit)}));
});
test("model API destination is an explicit HTTP loopback origin and a fixed chat route", () => {
  assert.equal(modelEndpoint("ollama","http://localhost:11434").href, "http://localhost:11434/api/chat");
  assert.equal(modelEndpoint("openai","http://127.0.0.1:1234/").href, "http://127.0.0.1:1234/v1/chat/completions");
  for (const origin of ["http://example.org","http://localhost.example.org","https://localhost","http://127.0.0.1/?secret=1","http://localhost/chat","http://u:p@localhost","http://127.0.0.1/#x"]) {
    assert.throws(() => modelEndpoint("ollama",origin));
  }
  assert.throws(() => modelEndpoint("bogus","http://localhost"));
});
test("both chat API adapters accept their actual response schemas", () => {
  const options = modelRequest(" local-model ", "hello", "", new AbortController().signal);
  assert.deepEqual(JSON.parse(options.body), {model:"local-model",messages:[{role:"user",content:"hello"}],stream:false});
  assert.equal(options.redirect,"error"); assert.equal(options.credentials,"omit"); assert.equal(options.headers.Authorization,undefined);
  assert.equal(modelRequest("m","p"," test ",undefined).headers.Authorization, "Bearer test");
  assert.equal(readReply("ollama",{message:{content:"你好"}}),"你好");
  assert.equal(readReply("openai",{choices:[{message:{content:"hello"}}]}),"hello");
  for (const invalid of [{},{choices:[]},{choices:[{message:{content:" "}}]}]) assert.throws(() => readReply("openai",invalid));
});
test("Pages and extension use identical desk assets and no install-time host grants", async () => {
  for (const name of ["core.mjs","desk.mjs","desk.css"]) {
    assert.deepEqual(await readFile(new URL("../docs/assets/"+name,import.meta.url)), await readFile(new URL("../extension/"+name,import.meta.url)));
  }
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json",import.meta.url)));
  assert.equal(manifest.host_permissions,undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.optional_host_permissions, ["http://localhost/*","http://127.0.0.1/*"]);
});
