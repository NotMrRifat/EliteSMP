const bridgeClient = require("./lib/bridgeClient");
const logger = require("./lib/logger");

module.exports = async (_req, res) => {
  try {
    const status = await bridgeClient.getStatus();
    const serverName = process.env.SERVER_NAME || "EliteSMP";

    logger.logAction({
      userId: "CronMonitor",
      username: "VercelDailyCron",
      action: "DAILY_MAINTENANCE_CHECK",
      result: status.success ? "SUCCESS" : "CHECK_FAILED",
      details: status.configured ? `State: ${status.state}` : "Bridge not configured"
    });

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      serverName,
      schedule: "0 0 * * * (Once Daily - Vercel Hobby)",
      bridgeConfigured: status.configured,
      bridgeState: status.state,
      playersOnline: status.players?.online ?? 0
    });
  } catch (error) {
    console.error("Daily cron maintenance error:", error);
    return res.status(200).json({
      ok: false,
      code: "CRON_ERROR",
      message: error.message
    });
  }
};
