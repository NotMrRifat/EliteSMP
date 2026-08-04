const bridgeClient = require("./lib/bridgeClient");
const logger = require("./lib/logger");

module.exports = async (req, res) => {
  // Enable CORS for frontend web control panel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Web-Admin-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { action } = req.query;
  const webAdminKey = req.headers["x-web-admin-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  const EXPECTED_KEY = process.env.WEB_ADMIN_KEY || process.env.MC_BRIDGE_KEY;

  const isAdmin = Boolean(EXPECTED_KEY && webAdminKey === EXPECTED_KEY);

  try {
    if (req.method === "GET") {
      if (action === "players") {
        const data = await bridgeClient.getPlayers();
        return res.status(200).json({ ok: true, data });
      }

      if (action === "logs") {
        if (!isAdmin) {
          return res.status(401).json({ ok: false, error: "Unauthorized access to logs." });
        }
        const logs = logger.getLogs(50);
        return res.status(200).json({ ok: true, logs });
      }

      // Default GET: return full live status
      const data = await bridgeClient.getStatus();
      return res.status(200).json({ ok: true, data, isAdmin });
    }

    if (req.method === "POST") {
      if (!isAdmin) {
        return res.status(401).json({ ok: false, error: "Unauthorized. Valid X-Web-Admin-Key required." });
      }

      const body = req.body || {};

      if (action === "announce") {
        if (!body.message) {
          return res.status(400).json({ ok: false, error: "Message field is required." });
        }
        const result = await bridgeClient.sendAnnouncement(body.message);
        logger.logAction({ userId: "WebDashboard", username: "WebAdmin", action: "ANNOUNCE", result: "SUCCESS", details: body.message });
        return res.status(200).json({ ok: true, result });
      }

      if (action === "command") {
        if (!body.command) {
          return res.status(400).json({ ok: false, error: "Command field is required." });
        }
        const result = await bridgeClient.executeCommand(body.command);
        logger.logAction({ userId: "WebDashboard", username: "WebAdmin", action: `CMD: ${body.command}`, result: "SUCCESS", details: result.output });
        return res.status(200).json({ ok: true, result });
      }

      return res.status(400).json({ ok: false, error: `Invalid POST action: ${action}` });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (error) {
    console.error("Bridge API error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
