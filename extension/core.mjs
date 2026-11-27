export const passageLimit = 24000;

export const languages = {
  en: ["English", "英语"], zh: ["Simplified Chinese", "简体中文"],
  es: ["Spanish", "西班牙语"], fr: ["French", "法语"], de: ["German", "德语"],
  ja: ["Japanese", "日语"], ko: ["Korean", "韩语"], pt: ["Portuguese", "葡萄牙语"]
};

const directions = {
  explain: [
    "Explain the central idea of the passage in plain language. Define any essential term and give one concrete example.",
    "请用通俗的语言解释这段文字的核心意思，解释必要的术语，并举一个具体例子。"
  ],
  translate: [
    "Translate the passage faithfully. Keep its meaning, tone, names, and paragraph breaks. Return only the translation.",
    "请忠实翻译这段文字，保留原意、语气、专有名词和分段，只输出译文。"
  ],
  rewrite: [
    "Rewrite the passage for clarity and concision. Preserve the author's meaning and factual details. Return only the revised passage.",
    "请把这段文字改写得清晰、简洁，保留作者的原意和事实细节，只输出改写后的文字。"
  ]
};

export function compose({ passage, action, language, custom = "", locale = "en" }) {
  const body = passage.trim();
  if (!body || body.length > passageLimit || !Object.hasOwn(languages, language)) return "";
  const cn = locale === "zh";
  const instruction = action === "custom" ? custom.trim() : Object.hasOwn(directions, action) ? directions[action][cn ? 1 : 0] : "";
  if (!instruction) return "";
  const target = languages[language][cn ? 1 : 0];
  const response = cn ? `请使用${target}作答。` : `Write the answer in ${target}.`;
  return `${instruction}\n${response}\n\n${cn ? "原文" : "Passage"}\n${body}`;
}

export function modelEndpoint(protocol, address) {
  if (!["ollama", "openai"].includes(protocol)) throw new Error("protocol");
  let base;
  try { base = new URL(address.trim()); } catch { throw new Error("address"); }
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname) ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash) throw new Error("address");
  return new URL(protocol === "ollama" ? "/api/chat" : "/v1/chat/completions", base);
}

export function modelRequest(model, prompt, token, signal) {
  const headers = { "Content-Type": "application/json" };
  if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
  return {
    method: "POST", headers, signal, redirect: "error", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
    body: JSON.stringify({ model: model.trim(), messages: [{ role: "user", content: prompt }], stream: false })
  };
}

export function readReply(protocol, data) {
  const content = protocol === "ollama" ? data?.message?.content : data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("reply");
  return content;
}
