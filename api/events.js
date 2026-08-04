const tg = require("./lib/telegram");
const { ADMIN_ID, ALLOWED_USERS } = require("./lib/auth");
const logger = require("./lib/logger");

const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP";
const BRIDGE_KEY = process.env.MC_BRIDGE_KEY;

// Deduplication cache and state tracking (persists across warm serverless instances)
const recentEvents = new Map();
let lastServerState = null;
const onlinePlayersSet = new Set();
const DUP_WINDOW_MS = 5000; // 5-second sliding deduplication window

function cleanupCache() {
  const now = Date.now();
  for (const [key, timestamp] of recentEvents.entries()) {
    if (now - timestamp > DUP_WINDOW_MS) {
      recentEvents.delete(key);
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // Security Verification
  const keyHeader = req.headers["x-bridge-key"];
  if (BRIDGE_KEY && keyHeader !== BRIDGE_KEY) {
    logger.logAction({
      userId: "MinecraftServer",
      username: "Webhook",
      action: "EVENT_WEBHOOK",
      result: "UNAUTHORIZED",
      details: "X-Bridge-Key mismatch",
      level: "WARN"
    });
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid X-Bridge-Key" });
  }

  try {
    const event = req.body || {};
    const { type, player, online, max } = event;

    if (!type) {
      return res.status(400).json({ ok: false, error: "Missing event type" });
    }

    cleanupCache();

    // Deduplication key construction
    const dedupKey = `${type}:${player || "server"}`;
    const now = Date.now();
    const lastSeen = recentEvents.get(dedupKey);

    if (lastSeen && now - lastSeen < DUP_WINDOW_MS) {
      logger.logAction({
        userId: "MinecraftServer",
        username: "Webhook",
        action: `EVENT_${type}_SKIPPED`,
        result: "DEDUPLICATED",
        details: `Skipped duplicate event for ${dedupKey}`
      });
      return res.status(200).json({ ok: true, note: "Duplicate event suppressed." });
    }

    // State-change / logical deduplication
    if (type === "SERVER_ONLINE" && lastServerState === "ONLINE") {
      return res.status(200).json({ ok: true, note: "Server already recorded as online." });
    }
    if (type === "SERVER_OFFLINE" && lastServerState === "OFFLINE") {
      return res.status(200).json({ ok: true, note: "Server already recorded as offline." });
    }
    if (type === "PLAYER_JOIN" && player && onlinePlayersSet.has(player)) {
      return res.status(200).json({ ok: true, note: `Player ${player} already recorded as online.` });
    }
    if (type === "PLAYER_QUIT" && player && !onlinePlayersSet.has(player)) {
      // Even if player state missing, still notify if not recently sent, but update state
    }

    // Record event timestamp for sliding-window deduplication
    recentEvents.set(dedupKey, now);

    // Update tracked state
    if (type === "SERVER_ONLINE") {
      lastServerState = "ONLINE";
    } else if (type === "SERVER_OFFLINE") {
      lastServerState = "OFFLINE";
      onlinePlayersSet.clear();
    } else if (type === "PLAYER_JOIN" && player) {
      onlinePlayersSet.add(player);
    } else if (type === "PLAYER_QUIT" && player) {
      onlinePlayersSet.delete(player);
    }

    const recipients = Array.from(new Set([ADMIN_ID, ...ALLOWED_USERS])).filter(Boolean);

    if (recipients.length === 0) {
      return res.status(200).json({ ok: true, note: "Event received but no Telegram recipients configured." });
    }

    let text = "";

    if (type === "PLAYER_JOIN") {
      text =
        `🟢 <b>PLAYER JOINED</b>\n` +
        `👤 <b>${tg.esc(player || "Player")}</b>\n` +
        `🎮 <b>${tg.esc(SERVER_NAME)}</b>\n` +
        `👥 <b>Online:</b> ${online ?? 1}/${max ?? 20}`;
    } else if (type === "PLAYER_QUIT") {
      text =
        `🔴 <b>PLAYER LEFT</b>\n` +
        `👤 <b>${tg.esc(player || "Player")}</b>\n` +
        `👥 <b>Online:</b> ${online ?? 0}/${max ?? 20}`;
    } else if (type === "SERVER_ONLINE") {
      text =
        `🟢 <b>${tg.esc(SERVER_NAME.toUpperCase())} IS ONLINE</b>\n` +
        `👥 <b>Players:</b> ${online ?? 0}/${max ?? 20}`;
    } else if (type === "SERVER_OFFLINE") {
      text =
        `🔴 <b>${tg.esc(SERVER_NAME.toUpperCase())} IS OFFLINE</b>`;
    } else if (type === "SERVER_STARTING") {
      text =
        `🟡 <b>${tg.esc(SERVER_NAME.toUpperCase())} IS STARTING...</b>`;
    } else {
      text = `ℹ️ <b>EVENT:</b> ${tg.esc(type || "UNKNOWN")}`;
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
    console.error("Error processing event webhook:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
