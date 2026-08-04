const token = process.env.TELEGRAM_TOKEN;
const base = `https://api.telegram.org/bot${token}`;

async function call(method, payload = {}) {
  if (!token) {
    console.warn(`[Telegram Call Skipped] TELEGRAM_TOKEN missing. Method: ${method}`);
    return { ok: false, description: "TELEGRAM_TOKEN is missing" };
  }

  try {
    const r = await fetch(`${base}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!data.ok) {
      console.error(`Telegram API Error (${method}):`, data.description);
    }
    return data;
  } catch (err) {
    console.error(`Telegram Fetch Error (${method}):`, err.message);
    return { ok: false, description: err.message };
  }
}

const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

async function send(chatId, text, keyboard) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {})
  });
}

async function edit(chatId, messageId, text, keyboard) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {})
  });
}

async function answerCallback(callbackQueryId, text = "", showAlert = false) {
  return call("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text, show_alert: showAlert } : {})
  });
}

async function notifyAdmins(text, keyboard) {
  const adminId = process.env.ADMIN_ID;
  if (adminId) {
    await send(adminId, text, keyboard);
  }
}

async function broadcast(chatIds, text, keyboard) {
  const results = [];
  for (const id of chatIds) {
    if (id) {
      const res = await send(id, text, keyboard);
      results.push({ id, res });
    }
  }
  return results;
}

module.exports = {
  call,
  send,
  edit,
  answerCallback,
  notifyAdmins,
  broadcast,
  esc
};
