const tg = require("./lib/telegram");
const { ADMIN_ID, ALLOWED_USERS } = require("./lib/auth");
const logger = require("./lib/logger");
const state = require("./lib/state");

const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP Bedrock";
const BRIDGE_KEY = process.env.MC_BRIDGE_KEY;

function checkAuth(req) {
  if (!BRIDGE_KEY) return true; // If key not set in environment, allow with warning
  const keyHeader = req.headers["x-bridge-key"] || req.query?.key;
  return keyHeader === BRIDGE_KEY;
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Security Authentication Check
  if (!checkAuth(req)) {
    logger.logAction({
      userId: "MinecraftServer",
      username: "Webhook",
      action: "EVENT_WEBHOOK",
      result: "UNAUTHORIZED",
      details: "Invalid X-Bridge-Key header",
      level: "WARN"
    });
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid X-Bridge-Key" });
  }

  // GET /api/events?action=poll — Outbound command polling from PocketMine-MP plugin
  if (req.method === "GET" && req.query.action === "poll") {
    const pending = state.popPendingCommands();
    return res.status(200).json({ ok: true, commands: pending });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};

    // Command Result Post from PocketMine-MP plugin
    if (body.action === "command_result") {
      const { id, success, output } = body;
      if (id) {
        state.saveCommandResult(id, { success: success !== false, output: output || "Execution completed." });
      }
      return res.status(200).json({ ok: true });
    }

    // Command Poll via POST
    if (body.action === "poll") {
      const pending = state.popPendingCommands();
      return res.status(200).json({ ok: true, commands: pending });
    }

    const { type, player, online, max, server } = body;

    if (!type) {
      return res.status(400).json({ ok: false, error: "Missing event type parameter." });
    }

    // Deduplication check
    if (state.isDuplicateEvent(type, player)) {
      logger.logAction({
        userId: "MinecraftServer",
        username: "Webhook",
        action: `EVENT_${type}_SKIPPED`,
        result: "DEDUPLICATED",
        details: `Duplicate event suppressed for ${type}:${player || "server"}`
      });
      return res.status(200).json({ ok: true, note: "Duplicate event suppressed." });
    }

    // State Tracking
    if (type === "SERVER_ONLINE") {
      state.setServerState("ONLINE");
    } else if (type === "SERVER_OFFLINE") {
      state.setServerState("OFFLINE");
      state.clearOnlinePlayers();
    } else if (type === "PLAYER_JOIN" && player) {
      state.addOnlinePlayer(player);
      state.setServerState("ONLINE");
    } else if (type === "PLAYER_QUIT" && player) {
      state.removeOnlinePlayer(player);
      state.setServerState("ONLINE");
    }

    const recipients = Array.from(new Set([ADMIN_ID, ...ALLOWED_USERS])).filter(Boolean);

    if (recipients.length === 0) {
      return res.status(200).json({ ok: true, note: "Event processed, but no Telegram recipients configured." });
    }

    const displayServer = server || SERVER_NAME;
    let text = "";

    if (type === "PLAYER_JOIN") {
      text =
        `🟢 <b>BEDROCK PLAYER JOINED</b>\n` +
        `👤 <b>${tg.esc(player || "Player")}</b>\n` +
        `🎮 <b>${tg.esc(displayServer)}</b>\n` +
        `👥 <b>Online:</b> ${online ?? 1}/${max ?? 20}`;
    } else if (type === "PLAYER_QUIT") {
      text =
        `🔴 <b>BEDROCK PLAYER LEFT</b>\n` +
        `👤 <b>${tg.esc(player || "Player")}</b>\n` +
        `👥 <b>Online:</b> ${online ?? 0}/${max ?? 20}`;
    } else if (type === "SERVER_ONLINE") {
      text =
        `🟢 <b>${tg.esc(displayServer.toUpperCase())} IS ONLINE</b>\n` +
        `👥 <b>Players:</b> ${online ?? 0}/${max ?? 20}`;
    } else if (type === "SERVER_OFFLINE") {
      text =
        `🔴 <b>${tg.esc(displayServer.toUpperCase())} IS OFFLINE</b>`;
    } else if (type === "SERVER_STARTING") {
      text =
        `🟡 <b>${tg.esc(displayServer.toUpperCase())} IS STARTING...</b>`;
    } else {
      text = `ℹ️ <b>BEDROCK EVENT:</b> ${tg.esc(type || "UNKNOWN")}`;
    }

    await tg.broadcast(recipients, text);
    logger.logAction({
      userId: "MinecraftServer",
      username: "Webhook",
      action: `EVENT_${type}`,
      result: "SUCCESS",
      details: `Dispatched to ${recipients.length} user(s)`
    });

    return res.status(200).json({ ok: true, delivered: recipients.length });
  } catch (error) {
    console.error("Error processing Bedrock event webhook:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
