/*
 * Aternos / Minecraft Server Adapter Layer
 *
 * Provides a clean interface for querying server status, online players,
 * executing admin commands, and sending announcements.
 *
 * Note: Aternos does not offer an official serverless-compatible API for automatic start/stop.
 * As per policy, fake success messages are never returned.
 */

const bridgeClient = require("./bridgeClient");

async function status() {
  return bridgeClient.getStatus();
}

async function players() {
  return bridgeClient.getPlayers();
}

async function start() {
  const err = new Error(
    "⚠️ Aternos Start/Stop is unavailable through the current serverless architecture. " +
    "Please start the server directly via Aternos Web UI or configured auto-start plugin."
  );
  err.code = "ATERNOS_CONTROL_UNAVAILABLE";
  throw err;
}

async function stop() {
  // If bridge is connected, an admin can issue stop command via bridge safely
  try {
    return await bridgeClient.executeCommand("stop");
  } catch {
    const err = new Error(
      "⚠️ Remote server stop command failed or bridge is unavailable. " +
      "Please stop the server via Aternos Web UI."
    );
    err.code = "SERVER_STOP_UNAVAILABLE";
    throw err;
  }
}

async function restart() {
  try {
    return await bridgeClient.executeCommand("restart");
  } catch {
    const err = new Error(
      "⚠️ Remote server restart command failed or bridge is unavailable."
    );
    err.code = "SERVER_RESTART_UNAVAILABLE";
    throw err;
  }
}

module.exports = {
  status,
  players,
  start,
  stop,
  restart
};
