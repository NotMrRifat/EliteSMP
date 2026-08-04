# 🏰 EliteSMP — Production-Ready Telegram ↔ Minecraft Control System

A high-performance, secure, VPS-free Telegram control bot, real-time event dispatcher, and live web control center for **EliteSMP Minecraft Server**.

Built for **Vercel Serverless Functions (Node.js 22)** on the **Vercel Hobby Plan** and **Paper/Spigot Minecraft servers**, utilizing Telegram Webhooks and an event-driven Paper plugin.

---

## 🎯 Architecture Diagram

```text
 Telegram User 
       │
       ▼ (Telegram Webhook)
Vercel Serverless Platform (100% Vercel Hobby Plan Compatible)
  ├── /api/bot (Main Telegram Bot & Interactive Inline Dashboard)
  ├── /api/bridge (Web Dashboard REST API Proxy)
  ├── /api/events (Authenticated event-driven receiver with deduplication)
  └── /api/cron (Once-daily Hobby maintenance check: "0 0 * * *")
       │                                     ▲
       │ (On-Demand Live REST Calls)        │ (Real-Time Webhook Push)
       ▼                                     │
EliteSMP Minecraft Server (EliteTelegramBridge Paper Plugin)
  ├── GET  /status   ➔ Real server status, player names, TPS & uptime
  ├── GET  /players  ➔ Real-time list of online players
  ├── POST /command  ➔ Safely execute Minecraft console commands
  ├── POST /say      ➔ Deliver in-game Telegram announcements
  └── Event Listeners (PlayerJoinEvent, PlayerQuitEvent, Lifecycle)
        └── Sends authenticated POST with X-Bridge-Key to /api/events
```

---

## ✨ Features

- 🚀 **100% Vercel Hobby Compatible**: Zero VPS required. Replaces frequent Vercel Cron polling with event-driven webhooks.
- 📊 **Real Live Server Status**: Displays genuine Minecraft server metrics (Status, Player count, Player names list, Server address, Uptime, TPS). On-demand live lookup (`/status`).
- 👥 **Real Player Lookup**: Instant `/players` lookup displaying active player usernames.
- ⚡ **Secure Admin Command Runner**: Executing `/cmd <minecraft command>` safely on the server console (Admin only).
- 📢 **In-Game Telegram Announcements**: Broadcast messages in-game via `/announce <message>`.
- 🔔 **Event-Driven Real-Time Alerts**: Paper plugin event listeners (`PlayerJoinEvent`, `PlayerQuitEvent`, server enable/disable) push real-time notifications to `/api/events`.
- 🛡️ **Deduplication & State Protection**: Sliding-window deduplication and state tracking in `/api/events` and plugin to prevent duplicate Telegram alerts.
- 🔑 **Strict Authentication**: `/api/events` and REST API require matching `MC_BRIDGE_KEY` (`X-Bridge-Key`). Bot access protected via `ADMIN_ID` and `ALLOWED_USERS`.
- 🌐 **Modern Web Control Panel**: Glassmorphism web dashboard (`/public`) with live metrics, player list, announcement trigger, console runner, and audit activity log.
- ⏰ **Hobby-Compliant Maintenance Cron**: Once-daily Vercel Cron (`0 0 * * *`) for non-critical daily system health logging.

---

## 🛠️ Project Structure

```text
EliteSMP/
├── api/
│   ├── bot.js            # Main Telegram webhook handler & inline dashboard
│   ├── bridge.js         # Web control panel REST API endpoint
│   ├── cron.js           # Once-daily Hobby maintenance & health check endpoint
│   ├── events.js         # Webhook receiver with X-Bridge-Key auth & deduplication
│   └── lib/
│       ├── aternos.js    # Aternos server adapter boundary
│       ├── auth.js       # Telegram admin & allowed user authentication
│       ├── bridgeClient.js # Secure HTTP client for Minecraft bridge
│       ├── logger.js     # Privacy-filtered audit logger
│       └── telegram.js   # Resilient Telegram API wrapper
├── minecraft-plugin/
│   ├── build.gradle      # Paper plugin Gradle build script (Java 17)
│   ├── settings.gradle   # Gradle project settings
│   └── src/
│       └── main/
│           ├── java/eu/elitesmp/telegrambridge/
│           │   ├── EliteTelegramBridge.java # Main plugin class
│           │   ├── HttpBridgeServer.java    # Embedded HTTP REST server
│           │   └── EventListener.java       # Player Join/Quit event listener
│           └── resources/
│               ├── config.yml # Plugin port, bridge key, & webhook config
│               └── plugin.yml # Paper plugin metadata
├── public/               # Web Control Panel Frontend
│   ├── index.html        # Glassmorphism HTML dashboard
│   ├── style.css         # Modern dark theme styles
│   └── app.js            # Frontend JavaScript logic
├── .env.example          # Environment variables template
├── package.json          # Project metadata & scripts
├── vercel.json           # Vercel Serverless Functions & Daily Cron (0 0 * * *)
└── README.md             # Full setup & architectural documentation
```

---

## 🚀 Deployment & Redeployment Guide

### 1. Configure Telegram Bot Father
1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Create a new bot using `/newbot` and copy your **Bot Token**.
3. Register quick commands with `/setcommands`:
   ```text
   start - 🚀 Open main dashboard
   menu - 📱 Show main control menu
   status - 📊 Check real server status
   players - 👥 View online player list
   server - 🌐 View server IP & specs
   help - 📖 Show help & commands
   admin - ⚙️ Open admin panel (Admin only)
   ```

### 2. Deploy to Vercel (Hobby Compatible)
1. Push these updated changes to your **GitHub** repository.
2. If already deployed, Vercel will automatically trigger a new build.
3. Verify your **Environment Variables** in Vercel Project Settings:

| Environment Variable | Description | Example Value |
|---|---|---|
| `TELEGRAM_TOKEN` | Bot Token from BotFather | `123456789:ABCdefGHI...` |
| `ADMIN_ID` | Telegram User ID (Primary Admin) | `12345678` |
| `ALLOWED_USERS` | Comma-separated allowed Telegram User IDs | `12345678,87654321` |
| `SERVER_NAME` | Name of your Minecraft server | `EliteSMP` |
| `MC_BRIDGE_URL` | Full URL of your Minecraft Bridge HTTP server | `https://play.elitesmp.com:8080` |
| `MC_BRIDGE_KEY` | Secret passkey matching `config.yml` (`bridge-key`) | `my_secure_secret_key_123` |
| `WEB_ADMIN_KEY` | Secret passkey for Web Control Panel | `my_web_admin_passkey` |
| `DEVELOPER_USERNAME` | Developer contact handle | `@NotMrRifat` |

### 3. Build & Update Minecraft Plugin (`EliteTelegramBridge`)

1. **Build the Updated Plugin**:
   ```bash
   cd minecraft-plugin
   ./gradlew build   # (or gradlew.bat build on Windows)
   ```
   The compiled JAR will be saved in `minecraft-plugin/build/libs/EliteTelegramBridge-1.0.0.jar`.

2. **Deploy to Minecraft Server**:
   - Upload `EliteTelegramBridge-1.0.0.jar` into your Minecraft server's `plugins/` directory.
   - Configure `plugins/EliteTelegramBridge/config.yml`:
     ```yaml
     port: 8080
     bridge-key: "my_secure_secret_key_123"  # MUST MATCH MC_BRIDGE_KEY in Vercel!
     vercel-events-url: "https://<YOUR_VERCEL_APP>.vercel.app/api/events"
     enable-event-webhooks: true
     ```
   - Restart the Minecraft server or reload the plugin.

---

## 🛡️ Security & Public Repository Guidelines

This repository is designed to be hosted **PUBLICLY** on GitHub.

- **NEVER Commit Secrets**: The `.gitignore` file strictly blocks `.env`, `.env.local`, and build artifacts.
- **Header Authentication**: All Vercel ↔ Minecraft communications require a matching `X-Bridge-Key` header (`MC_BRIDGE_KEY`).
- **Deduplication Safeguards**: Sliding window cache prevents event flooding or duplicate Telegram alerts.
- **Privacy Sanitization**: Audit logs automatically redact tokens, bridge keys, and sensitive credentials before output.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Vercel Deployment Error (Cron limit exceeded)** | Cron schedule set to sub-daily frequency | Ensure `vercel.json` uses `"0 0 * * *"` (once daily) for Vercel Hobby compatibility. |
| **Telegram webhook not responding** | Invalid `TELEGRAM_TOKEN` or webhook URL not set | Re-run the `setWebhook` URL in your browser and check Vercel function logs for `/api/bot`. |
| **Bridge unavailable / 🔴 OFFLINE** | Port closed, wrong IP, or server stopped | Ensure your server's bridge port (e.g., `8080`) is port-forwarded and accessible from Vercel. |
| **Events rejected with HTTP 401** | `MC_BRIDGE_KEY` mismatch | Ensure `MC_BRIDGE_KEY` in Vercel matches `bridge-key` in `plugins/EliteTelegramBridge/config.yml`. |
| **Duplicate Telegram notifications** | Duplicate event firing | System features sliding-window deduplication (5s window). Ensure plugin `config.yml` is correctly loaded. |

---

## 👨‍💻 Developer & Credits

- **Developer**: Rifat Hassan ([@NotMrRifat](https://t.me/NotMrRifat))
- **Repository**: [GitHub Repository](https://github.com/NotMrRifat/EliteSMP/)
- **Live System**: [EliteSMP Web Dashboard](https://elitesmp.vercel.app/)
- **License**: MIT License