const tg = require("./lib/telegram");
const { isAdmin, isAllowed } = require("./lib/auth");
const bridgeClient = require("./lib/bridgeClient");
const aternos = require("./lib/aternos");
const logger = require("./lib/logger");

const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP";
const DEV = process.env.DEVELOPER_USERNAME || "@NotMrRifat";

function mainMenu(admin, serverState = "ONLINE", onlineCount = 0, maxPlayers = 20) {
  return {
    inline_keyboard: [
      [
        { text: "📊 Live Status", callback_data: "status" },
        { text: "👥 Players", callback_data: "players" }
      ],
      [
        { text: "📢 Announcement", callback_data: "prompt_announce" },
        { text: "🔄 Refresh", callback_data: "refresh" }
      ],
      [
        { text: "📜 Logs", callback_data: "logs" },
        { text: admin ? "⚙️ Admin Panel" : "🌐 Server Info", callback_data: admin ? "admin" : "server" }
      ],
      [
        { text: "👨‍💻 Developer", callback_data: "developer" }
      ]
    ]
  };
}

function adminMenu() {
  return {
    inline_keyboard: [
      [
        { text: "⚡ Start Server", callback_data: "start" },
        { text: "🛑 Stop Server", callback_data: "stop" }
      ],
      [
        { text: "🔄 Restart", callback_data: "restart" },
        { text: "📜 Activity Logs", callback_data: "logs" }
      ],
      [
        { text: "🔙 Dashboard", callback_data: "home" }
      ]
    ]
  };
}

async function renderDashboard(name, statusData) {
  const stateBadge = statusData.state || "⚪ UNKNOWN";
  const online = statusData.players?.online ?? 0;
  const max = statusData.players?.max ?? 20;
  const addr = statusData.address || "play.elitesmp.com";

  return (
    `🏰 <b>${tg.esc(SERVER_NAME.toUpperCase())} CONTROL CENTER</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 Welcome, <b>${tg.esc(name)}</b>\n\n` +
    `🎮 <b>Server:</b> <code>${tg.esc(SERVER_NAME)}</code>\n` +
    `📡 <b>Status:</b> ${stateBadge}\n` +
    `👥 <b>Players:</b> <code>${online}/${max}</code>\n` +
    `🌐 <b>Address:</b> <code>${tg.esc(addr)}</code>\n\n` +
    `Choose an action from the dashboard below.`
  );
}

async function renderStatus(statusData) {
  const isOnline = statusData.rawState === "ONLINE" || (statusData.state && statusData.state.includes("ONLINE"));
  const addr = statusData.address || "play.elitesmp.com";

  if (!isOnline) {
    let offlineText =
      `📊 <b>LIVE SERVER STATUS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎮 <b>Server:</b> ${tg.esc(SERVER_NAME)}\n` +
      `📡 <b>Status:</b> 🔴 OFFLINE\n` +
      `👥 <b>Players:</b> 0/0\n` +
      `🌐 <b>Address:</b> <code>${tg.esc(addr)}</code>\n` +
      `⏱ <b>Uptime:</b> Offline`;

    if (statusData.error) {
      offlineText += `\n\n⚠️ <b>Notice:</b> <code>${tg.esc(statusData.error)}</code>`;
    }
    return offlineText;
  }

  const online = statusData.players?.online ?? 0;
  const max = statusData.players?.max ?? 20;
  const names = statusData.players?.names || [];
  const uptime = statusData.uptime || "Unknown";
  const version = statusData.version || "Bedrock Edition";
  const motd = statusData.motd || SERVER_NAME;

  let playerListText = "";
  if (names.length > 0) {
    playerListText = names.map(n => `  • ${tg.esc(n)}`).join("\n");
  } else if (online > 0) {
    playerListText = `  • ${online} player(s) active in-game`;
  } else {
    playerListText = "  • No players online";
  }

  let text =
    `📊 <b>LIVE SERVER STATUS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 <b>Server:</b> ${tg.esc(SERVER_NAME)}\n` +
    `📡 <b>Status:</b> 🟢 ONLINE\n` +
    `👥 <b>Players:</b> ${online}/${max}\n` +
    `👤 <b>Online Players:</b>\n${playerListText}\n` +
    `🌐 <b>Address:</b> <code>${tg.esc(addr)}</code>\n` +
    `🧱 <b>Version:</b> ${tg.esc(version)}\n` +
    `📝 <b>MOTD:</b> ${tg.esc(motd)}\n` +
    `⏱ <b>Uptime:</b> ${tg.esc(uptime)}`;

  return text;
}

async function renderPlayers(playersData) {
  const isOnline = playersData.rawState === "ONLINE" || (playersData.state && playersData.state.includes("ONLINE"));
  const online = playersData.players?.online ?? 0;
  const names = playersData.players?.names || [];

  if (!isOnline) {
    return (
      `👥 <b>ONLINE PLAYERS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔴 Server is currently OFFLINE.`
    );
  }

  if (online === 0) {
    return (
      `👥 <b>ONLINE PLAYERS — 0</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🟢 Server is online, but no players are currently in-game.`
    );
  }

  if (names.length > 0) {
    const list = names.map((name, idx) => `${idx + 1}. <b>${tg.esc(name)}</b>`).join("\n");
    return (
      `👥 <b>ONLINE PLAYERS — ${online}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${list}`
    );
  }

  return (
    `👥 <b>ONLINE PLAYERS — ${online}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🟢 ${online} player(s) currently active on server.`
  );
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("EliteSMP Telegram Control System is online and webhook is ready.");
  }

  try {
    const body = req.body || {};
    const cb = body.callback_query;
    const msg = body.message;

    if (!cb && !msg) {
      return res.status(200).send("OK");
    }

    const chat = cb ? cb.message.chat : msg.chat;
    const user = cb ? cb.from : msg.from;
    const chatId = String(chat.id);
    const userId = String(user.id);
    const username = user.username || `${user.first_name || "Player"}`;
    const name = user.username ? `@${user.username}` : (user.first_name || "Player");

    const textInput = String(msg?.text || "").trim();
    const commandMatch = textInput.match(/^(\/[a-zA-Z0-9_]+)(?:\s+(.*))?$/);
    const cmdName = commandMatch ? commandMatch[1].toLowerCase() : "";
    const cmdArgs = commandMatch ? (commandMatch[2] || "").trim() : "";

    const action = cb ? cb.data : (cmdName || textInput);
    const admin = isAdmin(userId);

    // Answer callback query immediately to avoid loading spinner stuck in Telegram client
    if (cb) {
      await tg.answerCallback(cb.id);
    }

    // Access control verification
    if (!isAllowed(userId)) {
      logger.logAction({
        userId,
        username,
        action: action || "UNAUTHORIZED_ACCESS",
        result: "REJECTED",
        details: "User ID not in ALLOWED_USERS or ADMIN_ID",
        level: "WARN"
      });

      await tg.send(
        chatId,
        `🛡️ <b>ACCESS RESTRICTED</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
        `You are not authorized to access <b>${tg.esc(SERVER_NAME)}</b> controls.\n\n` +
        `Developer: ${tg.esc(DEV)}`
      );
      return res.status(200).send("OK");
    }

    // Navigation & Info Commands
    if (["/start", "/menu", "home"].includes(action)) {
      const statusData = await bridgeClient.getStatus();
      const text = await renderDashboard(name, statusData);
      if (cb) await tg.edit(chatId, cb.message.message_id, text, mainMenu(admin, statusData.rawState, statusData.players?.online, statusData.players?.max));
      else await tg.send(chatId, text, mainMenu(admin, statusData.rawState, statusData.players?.online, statusData.players?.max));

      logger.logAction({ userId, username, action: "/start", result: "SUCCESS" });
      return res.status(200).send("OK");
    }

    if (["/help"].includes(action)) {
      const helpText =
        `📖 <b>ELITESMP BOT COMMANDS</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>User Commands:</b>\n` +
        `• <code>/start</code> - Open main dashboard\n` +
        `• <code>/menu</code> - Show main control menu\n` +
        `• <code>/status</code> - View real-time Bedrock RakNet status\n` +
        `• <code>/players</code> - View online player count\n` +
        `• <code>/server</code> - View server IP & details\n` +
        `• <code>/help</code> - Show command overview\n\n` +
        `<b>Admin Commands (Free Aternos Info):</b>\n` +
        `• <code>/admin</code> - Open admin control panel\n` +
        `• <code>/logs</code> - View system activity log\n` +
        `• <code>/announce</code> - Platform notice for broadcasts\n` +
        `• <code>/cmd</code> - Platform notice for console commands`;

      if (cb) await tg.edit(chatId, cb.message.message_id, helpText, mainMenu(admin));
      else await tg.send(chatId, helpText, mainMenu(admin));
      return res.status(200).send("OK");
    }

    if (["developer", "/developer_info"].includes(action)) {
      const text =
        `👨‍💻 <b>DEVELOPER & PROJECT CREDITS</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Project: <b>${tg.esc(SERVER_NAME)} Control System</b>\n` +
        `Developer: ${tg.esc(DEV)}\n` +
        `GitHub: <a href="https://github.com/NotMrRifat/EliteSMP">NotMrRifat/EliteSMP</a>\n` +
        `Live Web: <a href="https://elitesmp.vercel.app/">elitesmp.vercel.app</a>\n\n` +
        `Public repository compliant with zero hardcoded credentials & Free Aternos compatible.`;

      if (cb) await tg.edit(chatId, cb.message.message_id, text, mainMenu(admin));
      else await tg.send(chatId, text, mainMenu(admin));
      return res.status(200).send("OK");
    }

    if (["/server", "server"].includes(action)) {
      const statusData = await bridgeClient.getStatus();
      const text =
        `🌐 <b>SERVER INFORMATION</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🎮 <b>Name:</b> ${tg.esc(SERVER_NAME)}\n` +
        `📡 <b>Status:</b> ${statusData.state || "⚪ UNKNOWN"}\n` +
        `👥 <b>Players:</b> ${statusData.players?.online || 0}/${statusData.players?.max || 20}\n` +
        `🌐 <b>Address:</b> <code>${tg.esc(statusData.address || "play.elitesmp.com")}</code>\n` +
        `⏱ <b>Uptime:</b> ${tg.esc(statusData.uptime || "N/A")}\n` +
        `⚡ <b>Platform:</b> Bedrock Edition (Free Aternos)`;

      if (cb) await tg.edit(chatId, cb.message.message_id, text, mainMenu(admin));
      else await tg.send(chatId, text, mainMenu(admin));
      return res.status(200).send("OK");
    }

    if (["admin", "/admin"].includes(action)) {
      if (!admin) {
        await tg.send(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED</b>");
        return res.status(200).send("OK");
      }
      const text =
        `⚙️ <b>ADMIN CONTROL PANEL</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Authorized Admin: <b>${tg.esc(name)}</b>\n\n` +
        `ℹ️ <b>Free Aternos Platform Notice:</b>\n` +
        `Aternos Free restricts remote plugin/RCON controls and requires starting/stopping via <a href="https://aternos.org/server/">aternos.org</a>.\n\n` +
        `• <code>/logs</code> - View system activity audit log`;

      if (cb) await tg.edit(chatId, cb.message.message_id, text, adminMenu());
      else await tg.send(chatId, text, adminMenu());
      return res.status(200).send("OK");
    }

    // Status Query
    if (["/status", "status", "refresh"].includes(action)) {
      let messageId = cb?.message?.message_id;
      const loadingText = `🔄 <b>FETCHING LIVE SERVER DATA...</b>\n━━━━━━━━━━━━━━━━━━━━\nContacting Minecraft server bridge...`;

      if (cb) await tg.edit(chatId, messageId, loadingText);
      else {
        const sent = await tg.send(chatId, loadingText);
        messageId = sent.result.message_id;
      }

      const statusData = await bridgeClient.getStatus();
      const statusText = await renderStatus(statusData);

      await tg.edit(chatId, messageId, statusText, mainMenu(admin, statusData.rawState, statusData.players?.online, statusData.players?.max));
      logger.logAction({ userId, username, action: "/status", result: "SUCCESS", details: `Players: ${statusData.players?.online}/${statusData.players?.max}` });
      return res.status(200).send("OK");
    }

    // Players Query
    if (["/players", "/online", "players"].includes(action)) {
      let messageId = cb?.message?.message_id;
      const loadingText = `🔄 <b>FETCHING ONLINE PLAYERS...</b>`;

      if (cb) await tg.edit(chatId, messageId, loadingText);
      else {
        const sent = await tg.send(chatId, loadingText);
        messageId = sent.result.message_id;
      }

      const playersData = await bridgeClient.getPlayers();
      const playersText = await renderPlayers(playersData);

      await tg.edit(chatId, messageId, playersText, mainMenu(admin));
      logger.logAction({ userId, username, action: "/players", result: "SUCCESS", details: `Online: ${playersData.players?.online}` });
      return res.status(200).send("OK");
    }

    // Announcement Handling
    if (cmdName === "/announce" || action === "prompt_announce") {
      if (!admin) {
        await tg.send(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED</b>");
        return res.status(200).send("OK");
      }

      if (!cmdArgs && action !== "prompt_announce") {
        await tg.send(chatId, "⚠️ <b>Usage:</b> <code>/announce &lt;message&gt;</code>\nExample: <code>/announce Server restart in 5 minutes!</code>");
        return res.status(200).send("OK");
      }

      if (action === "prompt_announce") {
        await tg.send(chatId, "📢 <b>HOW TO ANNOUNCE</b>\n━━━━━━━━━━━━━━━━━━━━\nSend command: <code>/announce &lt;your message&gt;</code>\nExample: <code>/announce Event starting now in spawn!</code>");
        return res.status(200).send("OK");
      }

      try {
        const resAnnounce = await bridgeClient.sendAnnouncement(cmdArgs);
        await tg.send(chatId, `✅ <b>Announcement delivered.</b>\n\n📢 Broadcast: <i>${tg.esc(cmdArgs)}</i>`);
        logger.logAction({ userId, username, action: "/announce", result: "SUCCESS", details: cmdArgs });
      } catch (err) {
        await tg.send(chatId, `❌ <b>Announcement failed. Reason:</b> ${tg.esc(err.message)}`);
        logger.logAction({ userId, username, action: "/announce", result: "FAILED", details: err.message, level: "ERROR" });
      }
      return res.status(200).send("OK");
    }

    // Minecraft Console Command Execution
    if (cmdName === "/cmd") {
      if (!admin) {
        await tg.send(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED</b>");
        logger.logAction({ userId, username, action: `/cmd ${cmdArgs}`, result: "UNAUTHORIZED", level: "WARN" });
        return res.status(200).send("OK");
      }

      if (!cmdArgs) {
        await tg.send(chatId, "⚠️ <b>Usage:</b> <code>/cmd &lt;minecraft command&gt;</code>\nExample: <code>/cmd time set day</code>");
        return res.status(200).send("OK");
      }

      try {
        const cmdRes = await bridgeClient.executeCommand(cmdArgs);
        await tg.send(
          `⚡ <b>COMMAND EXECUTED</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💻 <b>Command:</b> <code>${tg.esc(cmdArgs)}</code>\n` +
          `📜 <b>Output:</b>\n<pre>${tg.esc(cmdRes.output)}</pre>`
        );
        logger.logAction({ userId, username, action: `/cmd ${cmdArgs}`, result: "SUCCESS", details: cmdRes.output });
      } catch (err) {
        await tg.send(chatId, `❌ <b>Command execution failed. Reason:</b>\n<code>${tg.esc(err.message)}</code>`);
        logger.logAction({ userId, username, action: `/cmd ${cmdArgs}`, result: "FAILED", details: err.message, level: "ERROR" });
      }
      return res.status(200).send("OK");
    }

    // Admin Control Actions (Start / Stop / Restart)
    if (["start", "stop", "restart", "/restart"].includes(action)) {
      if (!admin) {
        await tg.send(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED</b>");
        return res.status(200).send("OK");
      }

      const targetAction = action.replace(/^\//, "");
      let messageId = cb?.message?.message_id;
      const loading = `🔄 <b>EXECUTING ${targetAction.toUpperCase()}...</b>\n━━━━━━━━━━━━━━━━━━━━\nSending request to Minecraft server adapter...`;

      if (cb) await tg.edit(chatId, messageId, loading);
      else {
        const sent = await tg.send(chatId, loading);
        messageId = sent.result.message_id;
      }

      try {
        let result;
        if (targetAction === "start") result = await aternos.start();
        else if (targetAction === "stop") result = await aternos.stop();
        else if (targetAction === "restart") result = await aternos.restart();

        const successText =
          `✅ <b>${targetAction.toUpperCase()} COMPLETED</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `<pre>${tg.esc(JSON.stringify(result, null, 2))}</pre>`;

        await tg.edit(chatId, messageId, successText, adminMenu());
        logger.logAction({ userId, username, action: targetAction, result: "SUCCESS" });
      } catch (err) {
        const failText =
          `⚠️ <b>${targetAction.toUpperCase()} NOT COMPLETED</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🎮 <b>Server:</b> ${tg.esc(SERVER_NAME)}\n\n` +
          `❌ <b>Reason:</b>\n` +
          `<code>${tg.esc(err.message)}</code>`;

        await tg.edit(chatId, messageId, failText, adminMenu());
        logger.logAction({ userId, username, action: targetAction, result: "FAILED", details: err.message, level: "ERROR" });
      }
      return res.status(200).send("OK");
    }

    // Logs Command
    if (["/logs", "logs"].includes(action)) {
      if (!admin) {
        await tg.send(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED</b>");
        return res.status(200).send("OK");
      }

      const logs = logger.getLogs(15);
      if (logs.length === 0) {
        await tg.send(chatId, "📜 <b>ACTIVITY LOGS</b>\n━━━━━━━━━━━━━━━━━━━━\nNo logs recorded yet.", adminMenu());
        return res.status(200).send("OK");
      }

      const logText = logs.map(l =>
        `• <code>[${l.timestamp.substring(11)}]</code> <b>${tg.esc(l.username)}</b>: ${tg.esc(l.action)} ➔ <i>${tg.esc(l.result)}</i>`
      ).join("\n");

      const responseText =
        `📜 <b>RECENT ACTIVITY LOGS</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${logText}`;

      if (cb) await tg.edit(chatId, cb.message.message_id, responseText, adminMenu());
      else await tg.send(chatId, responseText, adminMenu());

      logger.logAction({ userId, username, action: "/logs", result: "SUCCESS" });
      return res.status(200).send("OK");
    }

    // Fallback for unhandled inputs
    if (!cb && textInput) {
      await tg.send(chatId, "❓ Unknown command. Type <code>/help</code> or <code>/start</code> to open the main menu.", mainMenu(admin));
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Unhandled error in bot handler:", error);
    return res.status(200).send("OK");
  }
};
