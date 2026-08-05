const dgram = require("dgram");

const BRIDGE_URL = (process.env.MC_BRIDGE_URL || "").replace(/\/+$/, "");
const BRIDGE_KEY = process.env.MC_BRIDGE_KEY || "";
const TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Key": BRIDGE_KEY,
        ...(options.headers || {})
      }
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Bedrock Edition RakNet Unconnected Ping (UDP) for live server status
 */
function pingBedrockServer(host, port = 19132, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      try { client.close(); } catch (_) {}
      reject(new Error("Bedrock server ping timeout"));
    }, timeoutMs);

    const magic = Buffer.from([
      0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe,
      0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78
    ]);
    const ping = Buffer.alloc(33);
    ping.writeUInt8(0x01, 0);
    ping.writeBigInt64BE(BigInt(Date.now()), 1);
    magic.copy(ping, 9);
    ping.writeBigInt64BE(BigInt(0), 25);

    client.on("message", (msg) => {
      clearTimeout(timer);
      try { client.close(); } catch (_) {}
      try {
        if (msg[0] === 0x1c && msg.length >= 35) {
          const strLength = msg.readUInt16BE(33);
          const dataStr = msg.toString("utf8", 35, 35 + strLength);
          const parts = dataStr.split(";");
          resolve({
            success: true,
            serverName: parts[1] || process.env.SERVER_NAME || "EliteSMP Bedrock",
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
      serverName: process.env.SERVER_NAME || "EliteSMP Bedrock",
      address: "Not Configured",
      players: { online: 0, max: 0, names: [] },
      uptime: "N/A",
      tps: "N/A",
      error: "MC_BRIDGE_URL is not set in environment variables."
    };
  }

  // First attempt HTTP REST bridge (PocketMine / REST Adapter)
  if (BRIDGE_URL.startsWith("http://") || BRIDGE_URL.startsWith("https://")) {
    try {
      const res = await fetchWithTimeout(`${BRIDGE_URL}/status`);
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          configured: true,
          state: data.state || "🟢 ONLINE",
          rawState: data.rawState || "ONLINE",
          serverName: data.serverName || process.env.SERVER_NAME || "EliteSMP Bedrock",
          address: data.address || BRIDGE_URL.replace(/^https?:\/\//, ""),
          players: {
            online: data.players?.online ?? 0,
            max: data.players?.max ?? 20,
            names: Array.isArray(data.players?.names) ? data.players.names : []
          },
          uptime: data.uptime || "Online",
          tps: data.tps ?? "N/A",
          version: data.version || "Bedrock Edition"
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          configured: true,
          state: "⚪ UNKNOWN",
          rawState: "AUTH_FAILED",
          serverName: process.env.SERVER_NAME || "EliteSMP Bedrock",
          players: { online: 0, max: 0, names: [] },
          error: "Minecraft bridge authentication failed (Invalid X-Bridge-Key)."
        };
      }
    } catch (_) {
      // Fallback to Bedrock UDP query if HTTP REST unavailable
    }
  }

  // Extract host and port for Bedrock RakNet UDP Ping fallback
  try {
    const cleanAddr = BRIDGE_URL.replace(/^https?:\/\//, "");
    const parts = cleanAddr.split(":");
    const host = parts[0];
    const port = parts[1] ? parseInt(parts[1], 10) : 19132;

    const bedrockData = await pingBedrockServer(host, port);
    return {
      success: true,
      configured: true,
      state: bedrockData.state,
      rawState: bedrockData.rawState,
      serverName: bedrockData.serverName,
      address: `${host}:${port}`,
      players: {
        online: bedrockData.online,
        max: bedrockData.max,
        names: [] // Names are N/A in standard RakNet ping payload
      },
      uptime: "N/A",
      tps: "N/A",
      version: bedrockData.version
    };
  } catch (pingErr) {
    return {
      success: false,
      configured: true,
      state: "🔴 OFFLINE",
      rawState: "OFFLINE",
      serverName: process.env.SERVER_NAME || "EliteSMP Bedrock",
      address: BRIDGE_URL.replace(/^https?:\/\//, ""),
      players: { online: 0, max: 0, names: [] },
      uptime: "Offline",
      tps: "N/A",
      error: `Bedrock server unavailable: ${pingErr.message}`
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
  if (!BRIDGE_URL) {
    throw new Error("MC_BRIDGE_URL is not configured.");
  }
  if (!BRIDGE_KEY) {
    throw new Error("MC_BRIDGE_KEY is missing in server environment variables.");
  }
  if (!command || !command.trim()) {
    throw new Error("Command cannot be empty.");
  }

  const cleanCmd = command.trim().replace(/^\//, "");

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/command`, {
      method: "POST",
      body: JSON.stringify({ command: cleanCmd })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("Bridge authentication failed (Unauthorized X-Bridge-Key).");
      }
      throw new Error(`Bedrock bridge returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (data.ok === false) {
      throw new Error(data.error || "Command execution failed on Bedrock server.");
    }

    return {
      success: true,
      command: cleanCmd,
      output: data.output || data.message || "Command executed successfully."
    };
  } catch (err) {
    throw new Error(`Command dispatch failed: ${err.message}`);
  }
}

async function sendAnnouncement(message) {
  if (!BRIDGE_URL) {
    throw new Error("Minecraft bridge URL (MC_BRIDGE_URL) is not configured.");
  }
  if (!message || !message.trim()) {
    throw new Error("Announcement message cannot be empty.");
  }

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/say`, {
      method: "POST",
      body: JSON.stringify({ message: message.trim() })
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("Bridge authentication failed (Unauthorized X-Bridge-Key).");
      }
      throw new Error(`Bedrock bridge returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      message: message.trim(),
      response: data.message || "Announcement delivered."
    };
  } catch (err) {
    throw new Error(`Bedrock bridge unavailable. ${err.message}`);
  }
}

module.exports = {
  getStatus,
  getPlayers,
  executeCommand,
  sendAnnouncement
};
