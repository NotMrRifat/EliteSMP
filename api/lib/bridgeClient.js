const dgram = require("dgram");
const http = require("https");
const state = require("./state");
const logger = require("./logger");

const BRIDGE_URL = (process.env.MC_BRIDGE_URL || "").replace(/\/+$/, "");
const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP Bedrock";

/**
 * Bedrock Edition RakNet Unconnected Ping (UDP)
 */
function pingBedrockServer(host, port = 19132, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      try { client.close(); } catch (_) {}
      reject(new Error("RakNet UDP ping timeout"));
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
            version: parts[3] ? ("Bedrock " + parts[3]) : "Bedrock Edition",
            rawVersion: parts[3] || "",
            online: parseInt(parts[4], 10) || 0,
            max: parseInt(parts[5], 10) || 0,
            motd: parts[7] || parts[1] || "Bedrock Server"
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

/**
 * Public Bedrock status query API (mcsrvstat.us)
 */
function fetchBedrockStatusHttp(host, port = 19132, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const url = `https://api.mcsrvstat.us/bedrock/2/${encodeURIComponent(host)}:${port}`;
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({
            success: true,
            online: Boolean(json.online),
            serverName: json.hostname || SERVER_NAME,
            version: json.version ? ("Bedrock " + json.version) : "Bedrock Edition",
            rawVersion: json.version || "",
            onlineCount: json.players?.online || 0,
            maxCount: json.players?.max || 0,
            motd: Array.isArray(json.motd?.clean) ? json.motd.clean.join(" ") : (json.hostname || "Bedrock Server")
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => { req.destroy(); reject(new Error("HTTP status query timeout")); });
  });
}

/**
 * Multi-source strict status detection logic for Free Aternos Bedrock
 */
async function queryBedrockStatus(host, port) {
  let rakNetRes = null;
  let rakNetErr = null;
  let httpRes = null;
  let httpErr = null;

  const [rakResult, httpResult] = await Promise.allSettled([
    pingBedrockServer(host, port, 3000),
    fetchBedrockStatusHttp(host, port, 4000)
  ]);

  if (rakResult.status === "fulfilled") rakNetRes = rakResult.value;
  else rakNetErr = rakResult.reason;

  if (httpResult.status === "fulfilled") httpRes = httpResult.value;
  else httpErr = httpResult.reason;

  const isOfflineText = (str) => {
    if (!str) return false;
    return /offline|server is offline|server offline|aternos\s*\|\s*offline/i.test(String(str));
  };

  // Evaluate RakNet findings
  let rakNetValidOnline = false;
  if (rakNetRes && rakNetRes.success) {
    const rawMotd = (rakNetRes.motd || "") + " " + (rakNetRes.serverName || "");
    const rawVer = rakNetRes.rawVersion || rakNetRes.version || "";
    
    const hasOfflineKeyword = isOfflineText(rawMotd) || isOfflineText(rawVer);
    // On Free Aternos, offline proxy pongs typically report max <= 1 with 0 players and Aternos branding
    const isProxyPlaceholder = (rakNetRes.max <= 1 && rakNetRes.online === 0 && (hasOfflineKeyword || /aternos/i.test(rawMotd)));

    if (!hasOfflineKeyword && !isProxyPlaceholder && rakNetRes.max > 1) {
      rakNetValidOnline = true;
    }
  }

  // Evaluate HTTP findings
  let httpValidOnline = false;
  if (httpRes && httpRes.online) {
    const rawMotd = httpRes.motd || "";
    const rawVer = httpRes.rawVersion || httpRes.version || "";
    if (!isOfflineText(rawMotd) && !isOfflineText(rawVer) && httpRes.maxCount > 1) {
      httpValidOnline = true;
    }
  }

  // Final Decision Logic (Prefers OFFLINE on ambiguity)
  let isOnline = false;
  let decisionSource = "None";
  let decisionReason = "";

  if (httpRes && httpRes.online === false) {
    isOnline = false;
    decisionSource = "HTTP Query (Explicit Offline)";
    decisionReason = "Public status API confirmed server is offline.";
  } else if (rakNetRes && !rakNetValidOnline && rakNetRes.success) {
    isOnline = false;
    decisionSource = "RakNet (Proxy Offline Packet Detected)";
    decisionReason = `RakNet packet contained offline markers (MOTD: "${rakNetRes.motd}", Ver: "${rakNetRes.version}", Players: ${rakNetRes.online}/${rakNetRes.max}).`;
  } else if (httpValidOnline && rakNetValidOnline) {
    isOnline = true;
    decisionSource = "RakNet + HTTP Verified";
    decisionReason = "Both RakNet UDP socket and HTTP status query verified active game server.";
  } else if (rakNetValidOnline && (!httpRes || httpErr)) {
    isOnline = true;
    decisionSource = "RakNet UDP Verified";
    decisionReason = "RakNet UDP socket verified active game server (HTTP query unavailable).";
  } else if (httpValidOnline && (!rakNetRes || rakNetErr)) {
    isOnline = true;
    decisionSource = "HTTP Query Verified";
    decisionReason = "HTTP status query verified active game server (RakNet UDP socket blocked).";
  } else {
    isOnline = false;
    decisionSource = "Ambiguous / Validation Fallback";
    decisionReason = `RakNet: ${rakNetErr ? rakNetErr.message : (rakNetRes ? 'Proxy/Offline' : 'None')} | HTTP: ${httpErr ? httpErr.message : (httpRes ? 'Offline' : 'None')}`;
  }

  logger.logAction({
    userId: "BridgeClient",
    username: "StatusCheck",
    action: "STATUS_DETECTION",
    result: isOnline ? "ONLINE" : "OFFLINE",
    details: `Address: ${host}:${port} | Source: ${decisionSource} | Reason: ${decisionReason}`
  });

  if (!isOnline) {
    state.setServerState("OFFLINE");
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
      version: "N/A",
      error: `Server is offline (${decisionReason})`
    };
  }

  const activeData = rakNetValidOnline ? rakNetRes : httpRes;
  const finalMotd = activeData.motd || SERVER_NAME;
  const finalVersion = activeData.version || "Bedrock Edition";
  const finalOnlineCount = activeData.onlineCount ?? activeData.online ?? 0;
  const finalMaxCount = activeData.maxCount ?? activeData.max ?? 20;

  state.setServerState("ONLINE", { version: finalVersion, motd: finalMotd });

  return {
    success: true,
    configured: true,
    state: "🟢 ONLINE",
    rawState: "ONLINE",
    serverName: (activeData.serverName && !isOfflineText(activeData.serverName)) ? activeData.serverName : SERVER_NAME,
    address: `${host}:${port}`,
    players: {
      online: finalOnlineCount,
      max: finalMaxCount,
      names: []
    },
    uptime: "Unknown", // Return "Unknown" as required when no true uptime source exists
    tps: "N/A",
    version: finalVersion,
    motd: finalMotd
  };
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

  const cleanAddr = BRIDGE_URL.replace(/^https?:\/\//, "");
  const parts = cleanAddr.split(":");
  const host = parts[0];
  const port = parts[1] ? parseInt(parts[1], 10) : 19132;

  return queryBedrockStatus(host, port);
}

async function getPlayers() {
  const status = await getStatus();
  return {
    success: status.success,
    state: status.state,
    rawState: status.rawState,
    players: status.players,
    error: status.error
  };
}

async function executeCommand(command) {
  if (!command || !command.trim()) {
    throw new Error("Command string cannot be empty.");
  }
  const err = new Error(
    "⚠️ Remote in-game console commands are unavailable on Free Aternos.\n" +
    "Aternos Free restricts RCON ports and custom PHP plugin execution."
  );
  err.code = "ATERNOS_FREE_LIMITATION";
  throw err;
}

async function sendAnnouncement(message) {
  if (!message || !message.trim()) {
    throw new Error("Announcement message cannot be empty.");
  }
  const err = new Error(
    "⚠️ Remote in-game announcements are unavailable on Free Aternos.\n" +
    "Aternos Free restricts RCON ports and custom PHP plugin execution."
  );
  err.code = "ATERNOS_FREE_LIMITATION";
  throw err;
}

module.exports = {
  getStatus,
  getPlayers,
  executeCommand,
  sendAnnouncement
};


