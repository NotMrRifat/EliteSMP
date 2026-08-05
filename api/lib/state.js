/**
 * Central State Management for EliteSMP Bedrock Bridge
 * Persists transient state across warm serverless invocations
 */

const onlinePlayers = new Set();
let serverState = "UNKNOWN";
let lastSeenTimestamp = 0;
let lastVersion = "N/A";
let lastMotd = "N/A";

// Queued admin commands for PocketMine outbound polling
const pendingCommands = [];
const commandResults = new Map();

// Deduplication sliding window cache
const recentEvents = new Map();
const DUP_WINDOW_MS = 5000;

function cleanupCache() {
  const now = Date.now();
  for (const [key, timestamp] of recentEvents.entries()) {
    if (now - timestamp > DUP_WINDOW_MS) {
      recentEvents.delete(key);
    }
  }
}

function isDuplicateEvent(type, player) {
  cleanupCache();
  const dedupKey = `${type}:${player || "server"}`;
  const now = Date.now();
  const lastSeen = recentEvents.get(dedupKey);

  if (lastSeen && now - lastSeen < DUP_WINDOW_MS) {
    return true;
  }
  recentEvents.set(dedupKey, now);
  return false;
}

function addOnlinePlayer(player) {
  if (player && typeof player === "string") {
    onlinePlayers.add(player.trim());
  }
}

function removeOnlinePlayer(player) {
  if (player && typeof player === "string") {
    onlinePlayers.delete(player.trim());
  }
}

function getOnlinePlayers() {
  return Array.from(onlinePlayers);
}

function clearOnlinePlayers() {
  onlinePlayers.clear();
}

function setServerState(state, extra = {}) {
  serverState = state;
  lastSeenTimestamp = Date.now();
  if (extra.version) lastVersion = extra.version;
  if (extra.motd) lastMotd = extra.motd;
}

function getServerState() {
  return {
    state: serverState,
    lastSeen: lastSeenTimestamp,
    version: lastVersion,
    motd: lastMotd
  };
}

// Queue an admin command (/cmd or /announce) for PocketMine polling
function queueCommand(commandId, actionType, payload) {
  const item = {
    id: commandId,
    type: actionType,
    payload,
    timestamp: Date.now()
  };
  pendingCommands.push(item);
  return item;
}

function popPendingCommands() {
  const list = [...pendingCommands];
  pendingCommands.length = 0;
  return list;
}

function saveCommandResult(commandId, result) {
  commandResults.set(commandId, {
    ...result,
    timestamp: Date.now()
  });
}

function getCommandResult(commandId) {
  return commandResults.get(commandId);
}

module.exports = {
  isDuplicateEvent,
  addOnlinePlayer,
  removeOnlinePlayer,
  getOnlinePlayers,
  clearOnlinePlayers,
  setServerState,
  getServerState,
  queueCommand,
  popPendingCommands,
  saveCommandResult,
  getCommandResult
};
