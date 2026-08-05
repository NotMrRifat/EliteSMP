/*
 * Aternos / Minecraft Server Adapter Layer
 *
 * Provides a clean interface for querying live Bedrock server status and player count.
 *
 * Note: Free Aternos does not offer an official API for remote server start/stop/restart,
 * and restricts RCON ports and custom PHP plugins.
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
    "⚠️ Remote server start is unavailable on Free Aternos.\n" +
    "Please start your server directly via the official Aternos Web UI (https://aternos.org/server/)."
  );
  err.code = "ATERNOS_FREE_LIMITATION";
  throw err;
}

async function stop() {
  const err = new Error(
    "⚠️ Remote server stop is unavailable on Free Aternos.\n" +
    "Aternos Free restricts RCON ports and custom PHP plugin execution. Stop the server via Aternos Web UI."
  );
  err.code = "ATERNOS_FREE_LIMITATION";
  throw err;
}

async function restart() {
  const err = new Error(
    "⚠️ Remote server restart is unavailable on Free Aternos.\n" +
    "Aternos Free restricts RCON ports and custom PHP plugin execution. Restart the server via Aternos Web UI."
  );
  err.code = "ATERNOS_FREE_LIMITATION";
  throw err;
}

module.exports = {
  status,
  players,
  start,
  stop,
  restart
};

