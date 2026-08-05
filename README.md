# 🏰 EliteSMP — Production-Ready Bedrock Edition Telegram Control System

A high-performance, secure, VPS-free Telegram control bot, real-time event dispatcher, and live web control center built specifically for **Minecraft Bedrock Edition** (Aternos PocketMine-MP / Bedrock Dedicated Server / Geyser).

Built for **Vercel Serverless Functions (Node.js 22)** on the **Vercel Hobby Plan**, utilizing Telegram Webhooks, RakNet Bedrock UDP status pinging, and an event-driven PocketMine-MP plugin.

> [!IMPORTANT]
> **Bedrock Edition Notice**
> Paper/Spigot Java `.jar` plugins **cannot** run on Bedrock Edition servers. This repository provides an official **PocketMine-MP PHP plugin** (`minecraft-plugin/pocketmine/`) for Bedrock servers on Aternos, plus RakNet UDP pinging for on-demand Bedrock status queries (`/status`).

---

## 🎯 Bedrock Architecture Diagram

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
       │ (RakNet UDP Ping or HTTP REST)      │ (Real-Time Webhook Push)
       ▼                                     │
Aternos Bedrock Server (PocketMine-MP PHP Plugin: EliteTelegramBridge)
  ├── GET  /status   ➔ Real Bedrock status, player names, TPS & uptime
  ├── GET  /players  ➔ Real-time list of online players
  ├── POST /command  ➔ Safely execute console commands
  ├── POST /say      ➔ Deliver in-game Telegram announcements
  └── Event Listeners (PlayerJoinEvent, PlayerQuitEvent, Lifecycle)
        └── Sends authenticated POST with X-Bridge-Key to /api/events
```

---

## ✨ Features

- 🚀 **100% Vercel Hobby & VPS-Free**: Zero VPS required. Replaces frequent Vercel Cron polling with event-driven webhooks.
- 🧱 **Native Bedrock Edition Support**: Native PocketMine-MP PHP plugin (`minecraft-plugin/pocketmine/`) plus RakNet UDP status pinging for Bedrock servers (`play.elitesmp.com:19132`).
- 📊 **Real Live Server Status**: Genuine Bedrock metrics (Status, Player count, Max players, Version, MOTD). On-demand live query (`/status`).
- 👥 **Real Player Lookup**: Instant `/players` lookup displaying active Bedrock player usernames.
- ⚡ **Secure Admin Command Runner**: Executing `/cmd <command>` safely on the Bedrock console (Admin only).
- 📢 **In-Game Telegram Announcements**: Broadcast messages in-game via `/announce <message>`.
- 🔔 **Event-Driven Real-Time Alerts**: PocketMine-MP event listeners (`PlayerJoinEvent`, `PlayerQuitEvent`, server enable/disable) push real-time notifications to `/api/events`.
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
│       ├── bridgeClient.js # RakNet UDP Ping & HTTP client for Bedrock bridge
│       ├── logger.js     # Privacy-filtered audit logger
│       └── telegram.js   # Resilient Telegram API wrapper
├── minecraft-plugin/
│   ├── pocketmine/       # PRIMARY: Official PocketMine-MP PHP Plugin (Bedrock)
│   │   ├── plugin.yml    # PocketMine-MP plugin metadata
│   │   ├── resources/
│   │   │   └── config.yml # Bridge port, secret key, & Vercel webhook URL
│   │   └── src/EliteTelegramBridge/
│   │       └── Main.php  # Main Bedrock event listener & REST API server
│   └── java-paper/       # OPTIONAL: Paper/Spigot Java Edition plugin
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

### 2. Deploy to Vercel (Hobby Compatible)
1. Push this repository to your **GitHub** account.
2. Log into [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import your `EliteSMP` repository.
4. Add the following **Environment Variables** in Vercel Project Settings:

| Environment Variable | Description | Example Value |
|---|---|---|
| `TELEGRAM_TOKEN` | Bot Token from BotFather | `123456789:ABCdefGHI...` |
| `ADMIN_ID` | Telegram User ID (Primary Admin) | `12345678` |
| `ALLOWED_USERS` | Comma-separated allowed Telegram User IDs | `12345678,87654321` |
| `SERVER_NAME` | Name of your Bedrock server | `EliteSMP Bedrock` |
| `MC_BRIDGE_URL` | PocketMine REST URL (or Bedrock IP:Port) | `https://play.elitesmp.com:8080` |
| `MC_BRIDGE_KEY` | Secret passkey matching `config.yml` (`bridge-key`) | `my_secure_secret_key_123` |
| `WEB_ADMIN_KEY` | Secret passkey for Web Control Panel | `my_web_admin_passkey` |
| `DEVELOPER_USERNAME` | Developer contact handle | `@NotMrRifat` |

5. Click **Deploy**. Note your deployment domain (e.g., `https://elitesmp.vercel.app`).

### 3. Set Telegram Webhook
Open the following URL in your browser (replace `<TELEGRAM_TOKEN>` and `<VERCEL_URL>`):

```text
https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/bot
```

---

## 🔌 Installing Bedrock Plugin on Aternos (PocketMine-MP)

1. Open your Aternos server files directory (`plugins/`).
2. Copy the `minecraft-plugin/pocketmine` directory into `plugins/EliteTelegramBridge`.
3. Configure `plugins/EliteTelegramBridge/resources/config.yml`:
   ```yaml
   bridge-key: "my_secure_secret_key_123"  # MUST MATCH MC_BRIDGE_KEY in Vercel!
   vercel-events-url: "https://<YOUR_VERCEL_APP>.vercel.app/api/events"
   enable-event-webhooks: true
   ```
4. Restart your Aternos PocketMine-MP server.

---

## 🛡️ Security & Public Repository Guidelines

This repository is designed to be hosted **PUBLICLY** on GitHub.

- **NEVER Commit Secrets**: The `.gitignore` file strictly blocks `.env`, `.env.local`, and build artifacts.
- **Header Authentication**: All Vercel ↔ Bedrock communications require a matching `X-Bridge-Key` header (`MC_BRIDGE_KEY`).
- **Deduplication Safeguards**: Sliding window cache prevents event flooding or duplicate Telegram alerts.
- **Privacy Sanitization**: Audit logs automatically redact tokens, bridge keys, and sensitive credentials before output.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Java Plugin Upload Error on Bedrock** | Uploaded `.jar` to Bedrock server | Do NOT upload `.jar` files to Bedrock. Install the PocketMine-MP PHP plugin in `minecraft-plugin/pocketmine/`. |
| **Vercel Deployment Error (Cron limit exceeded)** | Cron schedule set to sub-daily frequency | Ensure `vercel.json` uses `"0 0 * * *"` (once daily) for Vercel Hobby compatibility. |
| **Telegram webhook not responding** | Invalid `TELEGRAM_TOKEN` or webhook URL not set | Re-run the `setWebhook` URL in your browser and check Vercel function logs for `/api/bot`. |
| **Events rejected with HTTP 401** | `MC_BRIDGE_KEY` mismatch | Ensure `MC_BRIDGE_KEY` in Vercel matches `bridge-key` in `plugins/EliteTelegramBridge/resources/config.yml`. |

---

## 👨‍💻 Developer & Credits

- **Developer**: Rifat Hassan ([@NotMrRifat](https://t.me/NotMrRifat))
- **Repository**: [GitHub Repository](https://github.com/NotMrRifat/EliteSMP/)
- **Live System**: [EliteSMP Web Dashboard](https://elitesmp.vercel.app/)
- **License**: MIT License