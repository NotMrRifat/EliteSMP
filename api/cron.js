const bridgeClient = require("./lib/bridgeClient");
const tg = require("./lib/telegram");
const { ADMIN_ID, ALLOWED_USERS } = require("./lib/auth");
const logger = require("./lib/logger");

let lastState = null;

module.exports = async (_req, res) => {
  try {
    const status = await bridgeClient.getStatus();
    const currentState = status.rawState || (status.success ? "ONLINE" : "OFFLINE");
    const serverName = process.env.SERVER_NAME || "EliteSMP";

    let stateChanged = false;

    if (lastState !== null && lastState !== currentState) {
      stateChanged = true;

      const recipients = Array.from(new Set([ADMIN_ID, ...ALLOWED_USERS])).filter(Boolean);
      if (recipients.length > 0) {
        let text = "";
        if (currentState === "ONLINE") {
          text = `🟢 <b>${tg.esc(serverName.toUpperCase())} IS NOW ONLINE!</b>\n👥 <b>Players:</b> ${status.players.online}/${status.players.max}`;
        } else if (currentState === "OFFLINE") {
          text = `🔴 <b>${tg.esc(serverName.toUpperCase())} IS NOW OFFLINE!</b>`;
        } else {
          text = `📡 <b>${tg.esc(serverName)} STATUS CHANGE:</b> ${status.state}`;
        }

        await tg.broadcast(recipients, text);
        logger.logAction({
          userId: "CronMonitor",
          username: "VercelCron",
          action: "STATE_CHANGE_ALERT",
          result: "SUCCESS",
          details: `${lastState} ➔ ${currentState}`
        });
      }
    }

    lastState = currentState;

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      serverState: currentState,
      stateChanged,
      playersOnline: status.players.online
    });
  } catch (error) {
    console.error("Cron monitor error:", error);
    return res.status(200).json({
      ok: false,
      code: "CRON_ERROR",
      message: error.message
    });
  }
};
