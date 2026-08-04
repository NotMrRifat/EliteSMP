const token = process.env.TELEGRAM_TOKEN;
const base = `https://api.telegram.org/bot${token}`;

async function call(method, payload = {}) {
  if (!token) throw new Error("TELEGRAM_TOKEN is missing");
  const r = await fetch(`${base}/${method}`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed`);
  return data;
}

const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

async function send(chatId, text, keyboard) {
  return call("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? {reply_markup: keyboard} : {})
  });
}

async function edit(chatId, messageId, text, keyboard) {
  return call("editMessageText", {
    chat_id: chatId, message_id: messageId,
    text, parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? {reply_markup: keyboard} : {})
  });
}

module.exports = { call, send, edit, esc };
