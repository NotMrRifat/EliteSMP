# 🏰 EliteSMP — Production-Ready Telegram ↔ Minecraft Control System

A high-performance, secure, VPS-free Telegram control bot, real-time event dispatcher, and live web control center for **EliteSMP Minecraft Server**.

Built for **Vercel Serverless Functions (Node.js 22)** and **Paper/Spigot Minecraft servers**, utilizing Telegram Webhooks and an embedded HTTP REST Bridge plugin.

---

## 🎯 Architecture Diagram

```text
 Telegram User 
       │
       ▼ (Telegram Webhook)
Vercel Serverless Platform
  ├── /api/bot (Main Telegram Bot & Interactive Inline Dashboard)
  ├── /api/bridge (Web Dashboard REST API Proxy)
  ├── /api/events (Ingests real-time player join/leave & server status)
  └── /api/cron (Vercel Cron monitoring & state-change alerts)
       │
       ▼ (HTTP REST with X-Bridge-Key Authentication)
EliteSMP Minecraft Server (EliteTelegramBridge Paper Plugin)
  ├── GET  /status   ➔ Real server status, player names, TPS & uptime
  ├── GET  /players  ➔ Real-time list of online players
  ├── POST /command  ➔ Safely execute Minecraft console commands
  ├── POST /say      ➔ Deliver in-game Telegram announcements
  └── Webhook Dispatcher ➔ Sends real-time Player Join/Quit events to Vercel
```

---

## ✨ Features

- 🚀 **Zero VPS Required**: Runs entirely on Vercel's free serverless infrastructure and Telegram Webhooks.
- 📊 **Real Live Server Status**: Displays genuine Minecraft server metrics (Status, Player count, Player names list, Server address, Uptime, TPS). No fake data.
- 👥 **Real Player Lookup**: Instant `/players` lookup displaying active player usernames and heads.
- ⚡ **Secure Admin Command Runner**: Executing `/cmd <minecraft command>` safely on the server console (Admin only).
- 📢 **In-Game Telegram Announcements**: Broadcast messages in-game via `/announce <message>`.
- 🔔 **Real-Time Event Alerts**: Immediate notifications sent to Telegram when players join or leave, or when server status changes.
- 🛡️ **Strict Access Control**: Protects commands using `ADMIN_ID` and `ALLOWED_USERS` whitelist. Rejects unauthorized users automatically.
- 🌐 **Modern Web Control Panel**: Glassmorphism web dashboard (`/public`) with live metrics, player list, announcement trigger, console runner, and audit activity log.
- ⏰ **Smart State-Change Alerts**: Vercel Cron monitors status changes (e.g. ONLINE ➔ OFFLINE) and alerts users without spamming repeated offline messages.

---

## 🛠️ Project Structure

```text
EliteSMP/
├── api/
│   ├── bot.js            # Main Telegram webhook handler & inline dashboard
│   ├── bridge.js         # Web control panel REST API endpoint
│   ├── cron.js           # Vercel Cron monitoring & state-change notifier
│   ├── events.js         # Webhook receiver for Minecraft events (Join/Leave)
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
│           │   └── EventListener.java       # Player Join/Quit listener
│           └── resources/
│               ├── config.yml # Plugin port, bridge key, & webhook config
│               └── plugin.yml # Paper plugin metadata
├── public/               # Web Control Panel Frontend
│   ├── index.html        # Glassmorphism HTML dashboard
│   ├── style.css         # Modern dark theme styles
│   └── app.js            # Frontend JavaScript logic
├── .env.example          # Environment variables template
├── package.json          # Project metadata & scripts
├── vercel.json           # Vercel Serverless Functions & Cron configuration
└── README.md             # Full setup & architectural documentation
```

---

## 🚀 Deployment Guide

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

### 2. Deploy to Vercel
1. Fork or push this repository to your **GitHub** account.
2. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your `EliteSMP` repository.
4. Add the following **Environment Variables** in Vercel Project Settings:

| Environment Variable | Description | Example Value |
|---|---|---|
| `TELEGRAM_TOKEN` | Bot Token from BotFather | `123456789:ABCdefGHI...` |
| `ADMIN_ID` | Telegram User ID (Primary Admin) | `12345678` |
| `ALLOWED_USERS` | Comma-separated allowed Telegram User IDs | `12345678,87654321` |
| `SERVER_NAME` | Name of your Minecraft server | `EliteSMP` |
| `MC_BRIDGE_URL` | Full URL of your Minecraft Bridge HTTP server | `https://play.elitesmp.com:8080` |
| `MC_BRIDGE_KEY` | Secret secret key matching `config.yml` | `my_secure_secret_key_123` |
| `WEB_ADMIN_KEY` | Secret passkey for Web Control Panel | `my_web_admin_passkey` |
| `DEVELOPER_USERNAME` | Developer contact handle | `@NotMrRifat` |

5. Click **Deploy**. Note your deployment domain (e.g., `https://elitesmp.vercel.app`).

### 3. Set Telegram Webhook
Set your Telegram Bot Webhook by opening the following URL in your browser (replace `<TELEGRAM_TOKEN>` and `<VERCEL_URL>`):

```text
https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/bot
```

Successful response:
```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

---

## 🔌 Minecraft Plugin Setup (`EliteTelegramBridge`)

1. **Build the Plugin Jar**:
   ```bash
   cd minecraft-plugin
   ./gradlew build   # (or gradlew.bat build on Windows)
   ```
   The compiled JAR will be saved in `minecraft-plugin/build/libs/EliteTelegramBridge-1.0.0.jar`.

2. **Install on Server**:
   - Copy `EliteTelegramBridge-1.0.0.jar` into your Minecraft server's `plugins/` directory.
   - Start or restart the Minecraft server.

3. **Configure `plugins/EliteTelegramBridge/config.yml`**:
   ```yaml
   port: 8080
   bridge-key: "my_secure_secret_key_123"  # MUST MATCH MC_BRIDGE_KEY in Vercel!
   vercel-events-url: "https://<VERCEL_URL>/api/events"
   enable-event-webhooks: true
   ```
4. Restart or reload the plugin to apply configurations (`/reload` or server restart).

---

## 🛡️ Security & Public Repository Guidelines

This repository is designed to be hosted **PUBLICLY** on GitHub.

- **NEVER Commit Secrets**: The `.gitignore` file strictly blocks `.env`, `.env.local`, and build artifacts.
- **Header Authentication**: All Vercel ↔ Minecraft communications require a matching `X-Bridge-Key` header.
- **Privacy Sanitization**: Audit logs automatically redact tokens, bridge keys, and sensitive credentials before output.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Telegram webhook not responding** | Invalid `TELEGRAM_TOKEN` or webhook URL not set | Re-run the `setWebhook` URL in your browser and check Vercel function logs for `/api/bot`. |
| **Bridge unavailable / 🔴 OFFLINE** | Port closed, wrong IP, or server stopped | Ensure your server's bridge port (e.g., `8080`) is port-forwarded and accessible from Vercel. |
| **Bridge authentication failed** | `MC_BRIDGE_KEY` mismatch | Ensure `MC_BRIDGE_KEY` in Vercel matches `bridge-key` in `plugins/EliteTelegramBridge/config.yml`. |
| **Plugin not loading** | Incompatible Java version | Ensure your Minecraft server runs Java 17 or higher. |
| **Access Restricted message in Telegram** | User ID not listed in whitelist | Get your Telegram ID from `@userinfobot` and add it to `ALLOWED_USERS` or `ADMIN_ID` in Vercel. |

---

## 👨‍💻 Developer & Credits

- **Developer**: Rifat Hassan ([@NotMrRifat](https://t.me/NotMrRifat))
- **Repository**: [GitHub Repository](https://github.com/NotMrRifat/EliteSMP/)
- **Live System**: [EliteSMP Web Dashboard](https://elitesmp.vercel.app/)
- **License**: MIT License