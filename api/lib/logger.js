const logsBuffer = [];
const MAX_LOGS = 100;

function sanitize(text) {
  if (typeof text !== "string") {
    try {
      text = JSON.stringify(text);
    } catch {
      text = String(text);
    }
  }

  const secrets = [
    process.env.TELEGRAM_TOKEN,
    process.env.MC_BRIDGE_KEY,
    process.env.ATERNOS_PASS,
    process.env.WEB_ADMIN_KEY
  ].filter(Boolean);

  let sanitized = text;
  for (const secret of secrets) {
    if (secret.length > 3) {
      sanitized = sanitized.replaceAll(secret, "[REDACTED]");
    }
  }
  return sanitized;
}

function logAction({ userId, username, action, result = "SUCCESS", details = "", level = "INFO" }) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  const entry = {
    timestamp,
    userId: String(userId || "system"),
    username: username ? `@${username.replace(/^@/, "")}` : "Unknown",
    action: sanitize(action),
    result: sanitize(result),
    details: sanitize(details),
    level
  };

  logsBuffer.unshift(entry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.pop();
  }

  console.log(`[${entry.timestamp}] [${entry.level}] User: ${entry.username} (${entry.userId}) | Action: ${entry.action} | Result: ${entry.result}`);
  return entry;
}

function getLogs(limit = 20) {
  return logsBuffer.slice(0, limit);
}

module.exports = {
  logAction,
  getLogs,
  sanitize
};
