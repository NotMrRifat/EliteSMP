const tg = require("./lib/telegram");
const {isAdmin, isAllowed} = require("./lib/auth");
const aternos = require("./lib/aternos");

const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP Minecraft";
const DEV = process.env.DEVELOPER_USERNAME || "@NotMrRifat";

const menu = admin => ({
  inline_keyboard: [
    [{text:"⚡ Start Server",callback_data:"start"},
     {text:"📊 Live Status",callback_data:"status"}],
    [{text:"🔄 Refresh",callback_data:"status"},
     {text:"📢 Broadcast",callback_data:"broadcast"}],
    [{text:"👨‍💻 Developer",callback_data:"developer"}],
    ...(admin ? [[{text:"⚙️ Admin Panel",callback_data:"admin"}]] : [])
  ]
});

const adminMenu = {
  inline_keyboard: [
    [{text:"🛑 Stop Server",callback_data:"stop"},
     {text:"🔄 Restart",callback_data:"restart"}],
    [{text:"📊 Status",callback_data:"status"}],
    [{text:"🔙 Dashboard",callback_data:"home"}]
  ]
};

function dashboard(name) {
  return `🏰 <b>${tg.esc(SERVER_NAME.toUpperCase())} CONTROL CENTER</b>
━━━━━━━━━━━━━━━━━━━━
👋 Welcome, <b>${tg.esc(name)}</b>

🛰️ <b>Telegram Node:</b> <code>ONLINE</code>
🔐 <b>Access:</b> <code>AUTHORIZED</code>

Choose an action below.`;
}

function failure(action, error) {
  return `⚠️ <b>${action.toUpperCase()} NOT COMPLETED</b>
━━━━━━━━━━━━━━━━━━━━
🎮 <b>Server:</b> ${tg.esc(SERVER_NAME)}

❌ <b>Reason:</b>
<code>${tg.esc(error.message)}</code>

No success status was reported because the Aternos adapter has not been verified in this deployment.`;
}

async function runAction(action) {
  if (action === "status") return aternos.status();
  if (action === "start") return aternos.start();
  if (action === "stop") return aternos.stop();
  if (action === "restart") return aternos.restart();
  throw new Error("Unknown action");
}

module.exports = async (req, res) => {
  if (req.method !== "POST")
    return res.status(200).send("EliteSMP Telegram Control Bot is online.");

  try {
    const body = req.body || {};
    const cb = body.callback_query;
    const msg = body.message;
    if (!cb && !msg) return res.status(200).send("OK");

    const chat = cb ? cb.message.chat : msg.chat;
    const user = cb ? cb.from : msg.from;
    const chatId = String(chat.id);
    const name = user.username ? `@${user.username}` : (user.first_name || "Player");
    const action = cb ? cb.data : String(msg.text || "").trim().split(/\s+/)[0].toLowerCase();
    const admin = isAdmin(chatId);

    if (cb) await tg.call("answerCallbackQuery", {callback_query_id: cb.id});

    if (!isAllowed(chatId)) {
      await tg.send(chatId,
        `🛡️ <b>ACCESS RESTRICTED</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `You are not authorized to use <b>${tg.esc(SERVER_NAME)}</b> controls.\n\n` +
        `Developer: ${tg.esc(DEV)}`);
      return res.status(200).send("OK");
    }

    if (["/start","/menu","home"].includes(action)) {
      const text = dashboard(name);
      if (cb) await tg.edit(chatId, cb.message.message_id, text, menu(admin));
      else await tg.send(chatId, text, menu(admin));
      return res.status(200).send("OK");
    }

    if (["developer","/developer_info"].includes(action)) {
      const text = `👨‍💻 <b>DEVELOPER</b>\n━━━━━━━━━━━━━━━━━━━━\nTelegram: ${tg.esc(DEV)}\nProject: <b>${tg.esc(SERVER_NAME)}</b>\n\nThis public repository keeps credentials outside Git.`;
      if (cb) await tg.edit(chatId, cb.message.message_id, text, menu(admin));
      else await tg.send(chatId, text, menu(admin));
      return res.status(200).send("OK");
    }

    if (["admin","/admin"].includes(action)) {
      if (!admin) return res.status(200).send("OK");
      const text = `⚙️ <b>ADMIN CONTROL PANEL</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>${tg.esc(SERVER_NAME)}</b>\n\nSelect an action.`;
      if (cb) await tg.edit(chatId, cb.message.message_id, text, adminMenu);
      else await tg.send(chatId, text, adminMenu);
      return res.status(200).send("OK");
    }

    const normalized = {
      "/status":"status", status:"status",
      "/startserver":"start", start:"start",
      "/stopserver":"stop", stop:"stop",
      restart:"restart"
    }[action];

    if (normalized) {
      if (["stop","restart"].includes(normalized) && !admin) {
        await tg.send(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED</b>");
        return res.status(200).send("OK");
      }

      let messageId = cb?.message?.message_id;
      const loading = `🔄 <b>${normalized.toUpperCase()} REQUEST</b>\n━━━━━━━━━━━━━━━━━━━━\nConnecting to the Aternos adapter...`;

      if (cb) await tg.edit(chatId, messageId, loading);
      else {
        const sent = await tg.send(chatId, loading);
        messageId = sent.result.message_id;
      }

      try {
        const result = await runAction(normalized);
        const text = `✅ <b>${normalized.toUpperCase()} COMPLETED</b>\n━━━━━━━━━━━━━━━━━━━━\n<pre>${tg.esc(JSON.stringify(result, null, 2))}</pre>`;
        await tg.edit(chatId, messageId, text, admin ? adminMenu : menu(admin));
      } catch (error) {
        await tg.edit(chatId, messageId, failure(normalized, error), admin ? adminMenu : menu(admin));
      }
      return res.status(200).send("OK");
    }

    if (action === "broadcast") {
      await tg.send(chatId, "📢 <b>BROADCAST</b>\n\nPersistent broadcast state will be added after the data layer.");
      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    return res.status(200).send("OK");
  }
};
