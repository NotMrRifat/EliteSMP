document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");

  const metricPlayers = document.getElementById("metric-players");
  const metricAddress = document.getElementById("metric-address");
  const metricUptime = document.getElementById("metric-uptime");
  const metricTps = document.getElementById("metric-tps");

  const playerCountBadge = document.getElementById("player-count-badge");
  const playerList = document.getElementById("player-list");

  const btnRefresh = document.getElementById("btn-refresh");
  const btnAdminAuth = document.getElementById("btn-admin-auth");

  const authModal = document.getElementById("auth-modal");
  const formAuth = document.getElementById("form-auth");
  const authKeyInput = document.getElementById("auth-key-input");
  const btnCloseModal = document.getElementById("btn-close-modal");

  const adminPanel = document.getElementById("admin-panel");
  const formAnnounce = document.getElementById("form-announce");
  const announceInput = document.getElementById("announce-input");
  const announceOutput = document.getElementById("announce-output");

  const formCmd = document.getElementById("form-cmd");
  const cmdInput = document.getElementById("cmd-input");
  const cmdOutput = document.getElementById("cmd-output");

  const logsContainer = document.getElementById("logs-container");

  let adminKey = localStorage.getItem("elitesmp_admin_key") || "";

  async function fetchStatus() {
    try {
      const headers = adminKey ? { "X-Web-Admin-Key": adminKey } : {};
      const res = await fetch("/api/bridge", { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      if (result.ok && result.data) {
        updateUI(result.data, result.isAdmin);
      }
    } catch (err) {
      console.error("Failed to fetch live server status:", err);
      showErrorState(err.message);
    }
  }

  function updateUI(data, isAdmin) {
    const isOnline = data.state && data.state.includes("ONLINE");
    const isOffline = data.state && data.state.includes("OFFLINE");

    statusBadge.className = "badge " + (isOnline ? "badge-online" : isOffline ? "badge-offline" : "badge-unknown");
    statusBadge.querySelector(".dot").className = "dot";
    statusText.textContent = data.state ? data.state.replace(/^[^\w]+/, "").trim() : "UNKNOWN";

    const online = data.players?.online ?? 0;
    const max = data.players?.max ?? 20;
    metricPlayers.textContent = `${online}/${max}`;
    metricAddress.textContent = data.address || "play.elitesmp.com";
    metricUptime.textContent = data.uptime || "Offline";
    metricTps.textContent = data.tps ?? "20.0";

    playerCountBadge.textContent = `${online} Online`;

    const names = data.players?.names || [];
    if (names.length === 0) {
      playerList.innerHTML = `<div class="empty-state"><p>${online > 0 ? `${online} active player(s)` : 'No players currently online.'}</p></div>`;
    } else {
      playerList.innerHTML = names.map(name => `
        <div class="player-item">
          <img class="player-avatar" src="https://mc-heads.net/avatar/${encodeURIComponent(name)}/32" alt="${name}" onerror="this.src='https://mc-heads.net/avatar/steve/32'" />
          <span class="player-name">${escapeHtml(name)}</span>
        </div>
      `).join("");
    }

    if (isAdmin) {
      adminPanel.classList.remove("hidden");
      btnAdminAuth.innerHTML = `<span class="btn-icon">🔓</span> Admin Active`;
      fetchLogs();
    } else {
      adminPanel.classList.add("hidden");
    }
  }

  function showErrorState(msg) {
    statusBadge.className = "badge badge-offline";
    statusText.textContent = "OFFLINE";
    metricPlayers.textContent = "0/20";
    metricUptime.textContent = "Offline";
    playerList.innerHTML = `<div class="empty-state"><p>Bridge unavailable: ${escapeHtml(msg)}</p></div>`;
  }

  async function fetchLogs() {
    if (!adminKey) return;
    try {
      const res = await fetch("/api/bridge?action=logs", {
        headers: { "X-Web-Admin-Key": adminKey }
      });
      const data = await res.json();
      if (data.ok && data.logs) {
        if (data.logs.length === 0) {
          logsContainer.innerHTML = `<p class="empty-state">No logs recorded yet.</p>`;
        } else {
          logsContainer.innerHTML = data.logs.map(log => `
            <div class="log-entry">
              <span style="color:var(--text-muted)">[${log.timestamp.substring(11)}]</span>
              <strong>${escapeHtml(log.username)}</strong> (${log.action}) &rarr; <em>${escapeHtml(log.result)}</em>
            </div>
          `).join("");
        }
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }

  // Admin Auth Handlers
  btnAdminAuth.addEventListener("click", () => {
    if (adminKey && !adminPanel.classList.contains("hidden")) {
      if (confirm("Log out from Admin Mode?")) {
        adminKey = "";
        localStorage.removeItem("elitesmp_admin_key");
        btnAdminAuth.innerHTML = `<span class="btn-icon">🔐</span> Admin Mode`;
        adminPanel.classList.add("hidden");
      }
    } else {
      authModal.classList.remove("hidden");
      authKeyInput.focus();
    }
  });

  btnCloseModal.addEventListener("click", () => {
    authModal.classList.add("hidden");
  });

  formAuth.addEventListener("submit", (e) => {
    e.preventDefault();
    adminKey = authKeyInput.value.trim();
    if (adminKey) {
      localStorage.setItem("elitesmp_admin_key", adminKey);
      authModal.classList.add("hidden");
      authKeyInput.value = "";
      fetchStatus();
    }
  });

  // Action Form Submissions
  formAnnounce.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = announceInput.value.trim();
    if (!message || !adminKey) return;

    announceOutput.style.display = "block";
    announceOutput.className = "output-msg";
    announceOutput.textContent = "Broadcasting announcement...";

    try {
      const res = await fetch("/api/bridge?action=announce", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Web-Admin-Key": adminKey
        },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (data.ok) {
        announceOutput.className = "output-msg badge-online";
        announceOutput.textContent = "✅ " + (data.result?.response || "Announcement broadcasted!");
        announceInput.value = "";
        fetchLogs();
      } else {
        throw new Error(data.error || "Announcement failed.");
      }
    } catch (err) {
      announceOutput.className = "output-msg badge-offline";
      announceOutput.textContent = "❌ " + err.message;
    }
  });

  formCmd.addEventListener("submit", async (e) => {
    e.preventDefault();
    const command = cmdInput.value.trim();
    if (!command || !adminKey) return;

    cmdOutput.style.display = "block";
    cmdOutput.textContent = "> Executing command...";

    try {
      const res = await fetch("/api/bridge?action=command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Web-Admin-Key": adminKey
        },
        body: JSON.stringify({ command })
      });
      const data = await res.json();
      if (data.ok) {
        cmdOutput.textContent = `> ${command}\n${data.result.output || "Success"}`;
        cmdInput.value = "";
        fetchLogs();
      } else {
        throw new Error(data.error || "Command execution failed.");
      }
    } catch (err) {
      cmdOutput.textContent = `> Error: ${err.message}`;
    }
  });

  btnRefresh.addEventListener("click", () => {
    btnRefresh.style.transform = "rotate(360deg)";
    btnRefresh.style.transition = "transform 0.5s ease";
    fetchStatus();
    setTimeout(() => { btnRefresh.style.transform = "none"; }, 500);
  });

  function escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Initial fetch and auto-refresh every 30 seconds
  fetchStatus();
  setInterval(fetchStatus, 30000);
});
