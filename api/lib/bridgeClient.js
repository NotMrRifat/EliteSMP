const dgram = require("dgram");
const state = require("./state");

const BRIDGE_URL = (process.env.MC_BRIDGE_URL || "").replace(/\/+$/, "");
const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP Bedrock";

/**
 * Bedrock Edition RakNet Unconnected Ping (UDP)
 * Directly queries Bedrock Dedicated Server / PocketMine / Geyser ports on Aternos
 */
function pingBedrockServer(host, port = 19132, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      try { client.close(); } catch (_) {}
      reject(new Error("Bedrock RakNet UDP ping timeout"));
    }, timeoutMs);

    const magic = Buffer.from([
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78
    ]);
    const ping = Buffer.alloc(33);
    ping.writeUInt8(0x01, 0); // ID_UNCONNECTED_PING
    ping.writeBigInt64BE(BigInt(Date.now()), 1);
    magic.copy(ping, 9);
    ping.writeBigInt64BE(BigInt(0), 25);

    client.on("message", (msg) => {
      clearTimeout(timer);
      try { client.close(); } catch (_) {}
      try {
        if (msg[0] === 0x1c && msg.length >= 35) { // ID_UNCONNECTED_PONG
          const strLength = msg.readUInt16BE(33);
          const dataStr = msg.toString("utf8", 35, 35 + strLength);
          const parts = dataStr.split(";");
          resolve({
            success: true,
            serverName: parts[1] || SERVER_NAME,
            version: "Bedrock " + (parts[3] || "MCPE"),
            online: parseInt(parts[4], 10) || 0,
            max: parseInt(parts[5], 10) || 20,
            motd: parts[7] || parts[1] || "Bedrock Server",
            rawState: "ONLINE",
            state: "🟢 ONLINE"
          });
        } else {
          reject(new Error("Invalid RakNet response packet"));
        }
      } catch (err) {
        reject(err);
      }
    });

    client.on("error", (err) => {
      clearTimeout(timer);
      try { client.close(); } catch (_) {}
      reject(err);
    });

    client.send(ping, 0, ping.length, port, host);
  });
}

async function getStatus() {
  if (!BRIDGE_URL) {
    return {
      success: false,
      configured: false,
      state: "⚪ UNKNOWN",
      rawState: "UNKNOWN",
      serverName: SERVER_NAME,
      address: "Not Configured",
      players: { online: 0, max: 0, names: [] },
      uptime: "N/A",
      tps: "N/A",
      error: "MC_BRIDGE_URL is not set in environment variables."
    };
  }

  // Extract host and port from MC_BRIDGE_URL (e.g. play.elitesmp.com:19132)
  const cleanAddr = BRIDGE_URL.replace(/^https?:\/\//, "");
  const parts = cleanAddr.split(":");
  const host = parts[0];
  const port = parts[1] ? parseInt(parts[1], 10) : 19132;

  try {
    const bedrockData = await pingBedrockServer(host, port);
    const trackedNames = state.getOnlinePlayers();

    state.setServerState("ONLINE", {
      version: bedrockData.version,
      motd: bedrockData.motd
    });

    return {
      success: true,
      configured: true,
      state: bedrockData.state,
      rawState: bedrockData.rawState,
      serverName: bedrockData.serverName || SERVER_NAME,
      address: `${host}:${port}`,
      players: {
        online: bedrockData.online,
        max: bedrockData.max,
        names: trackedNames.length > 0 ? trackedNames : []
      },
      uptime: "Online (RakNet Verified)",
      tps: "N/A",
      version: bedrockData.version
    };
  } catch (pingErr) {
    const currentState = state.getServerState();
    // If server was recently seen online via plugin event within last 60s
    if (currentState.state === "ONLINE" && (Date.now() - currentState.lastSeen) < 60000) {
      return {
        success: true,
        configured: true,
        state: "🟢 ONLINE",
        rawState: "ONLINE",
        serverName: SERVER_NAME,
        address: `${host}:${port}`,
        players: {
          online: state.getOnlinePlayers().length,
          max: 20,
          names: state.getOnlinePlayers()
        },
        uptime: "Online (Plugin Verified)",
        tps: "N/A",
        version: currentState.version || "Bedrock Edition"
      };
    }

    return {
      success: false,
      configured: true,
      state: "🔴 OFFLINE",
      rawState: "OFFLINE",
      serverName: SERVER_NAME,
      address: `${host}:${port}`,
      players: { online: 0, max: 0, names: [] },
      uptime: "Offline",
      tps: "N/A",
      error: `Bedrock server unreachable (${pingErr.message})`
    };
  }
}

async function getPlayers() {
  const status = await getStatus();
  return {
    success: status.success,
    state: status.state,
    players: status.players,
    error: status.error
  };
}

async function executeCommand(command) {
  if (!command || !command.trim()) {
    throw new Error("Command string cannot be empty.");
  }
  const cleanCmd = command.trim().replace(/^\//, "");
  const cmdId = "cmd_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  state.queueCommand(cmdId, "command", cleanCmd);

  return {
    success: true,
    command: cleanCmd,
    queued: true,
    output: `Command '/${cleanCmd}' queued for PocketMine execution. Output will be delivered upon execution.`
  };
}

async function sendAnnouncement(message) {
  if (!message || !message.trim()) {
    throw new Error("Announcement message cannot be empty.");
  }
  const cleanMsg = message.trim();
  const cmdId = "say_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  state.queueCommand(cmdId, "say", cleanMsg);

  return {
    success: true,
    message: cleanMsg,
    queued: true,
    response: `Announcement queued for Bedrock broadcast: "[Telegram] ${cleanMsg}"`
  };
}

module.exports = {
  getStatus,
  getPlayers,
  executeCommand,
  sendAnnouncement
};
