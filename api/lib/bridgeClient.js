const BRIDGE_URL = (process.env.MC_BRIDGE_URL || "").replace(/\/+$/, "");
const BRIDGE_KEY = process.env.MC_BRIDGE_KEY || "";
const TIMEOUT_MS = 5000;

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

async function getStatus() {
  if (!BRIDGE_URL) {
    return {
      success: false,
      configured: false,
      state: "⚪ UNKNOWN",
      rawState: "UNKNOWN",
      serverName: process.env.SERVER_NAME || "EliteSMP",
      address: "Not Configured",
      players: { online: 0, max: 0, names: [] },
      uptime: "N/A",
      tps: "N/A",
      error: "MC_BRIDGE_URL is not set in environment variables."
    };
  }

  try {
    const res = await fetchWithTimeout(`${BRIDGE_URL}/status`);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          configured: true,
          state: "⚪ UNKNOWN",
          rawState: "AUTH_FAILED",
          serverName: process.env.SERVER_NAME || "EliteSMP",
          players: { online: 0, max: 0, names: [] },
          error: "Minecraft bridge authentication failed (Invalid X-Bridge-Key)."
        };
      }
      throw new Error(`HTTP Error ${res.status}`);
    }
    const data = await res.json();
    return {
      success: true,
      configured: true,
      state: data.state || "🟢 ONLINE",
      rawState: data.rawState || "ONLINE",
      serverName: data.serverName || process.env.SERVER_NAME || "EliteSMP",
      address: data.address || BRIDGE_URL.replace(/^https?:\/\//, ""),
      players: {
        online: data.players?.online ?? 0,
        max: data.players?.max ?? 20,
        names: Array.isArray(data.players?.names) ? data.players.names : []
      },
      uptime: data.uptime || "Online",
      tps: data.tps ?? 20.0,
      version: data.version || "Paper Minecraft"
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      state: "🔴 OFFLINE",
      rawState: "OFFLINE",
      serverName: process.env.SERVER_NAME || "EliteSMP",
      address: BRIDGE_URL.replace(/^https?:\/\//, ""),
      players: { online: 0, max: 0, names: [] },
      uptime: "Offline",
      tps: 0,
      error: `Bridge unavailable: ${err.message}`
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
      throw new Error(`Minecraft bridge returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (data.ok === false) {
      throw new Error(data.error || "Command execution failed on Minecraft server.");
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
      throw new Error(`Minecraft bridge returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      message: message.trim(),
      response: data.message || "Announcement delivered."
    };
  } catch (err) {
    throw new Error(`Minecraft bridge unavailable. ${err.message}`);
  }
}

module.exports = {
  getStatus,
  getPlayers,
  executeCommand,
  sendAnnouncement
};
