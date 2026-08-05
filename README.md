# 🏰 EliteSMP — Production-Ready Bedrock Edition Telegram Control System

A high-performance, secure, VPS-free Telegram control bot and live web control center built specifically for **Free Aternos Bedrock Edition** (PocketMine-MP 5.44.1 / Minecraft 1.26.30 / Geyser).

Built for **Vercel Serverless Functions (Node.js 22)** on the **Vercel Hobby Plan**, utilizing Telegram Webhooks and RakNet Bedrock UDP status pinging.

> [!NOTE]
> **Free Aternos Bedrock Support**
> Free Aternos servers do **not** support custom PHP plugin uploads or direct FTP access. This project queries live Bedrock server status, online player counts, MOTD, software version, and uptime directly via **Bedrock RakNet UDP Ping** (with HTTP query fallback), requiring **zero plugin setup** on Aternos!

---

## 🎯 Free Aternos Bedrock Architecture Diagram

```text
 Telegram User 
       │
       ▼ (Telegram Webhook)
Vercel Serverless Platform (100% Vercel Hobby Plan Compatible)
  ├── /api/bot (Main Telegram Bot & Interactive Inline Dashboard)
  ├── /api/bridge (Web Dashboard REST API Proxy)
  ├── /api/events (Free Aternos Mode Info Receiver)
  └── /api/cron (Once-daily Hobby maintenance check: "0 0 * * *")
       │
       ▼ (Bedrock RakNet UDP Ping / HTTP Query Fallback)
Aternos Bedrock Server (Free Aternos PocketMine-MP 5.44.1 / MC 1.26.30)
  └── Responds with live Status, Player Count, MOTD, and Software Version
```

---

## ✨ Features

- 🚀 **100% Vercel Hobby & VPS-Free**: Zero VPS or paid workers required.
- 🧱 **Native Free Aternos Bedrock Support**: Direct RakNet UDP pinging for Bedrock servers (`elitesmp.aternos.me:19132`) with zero custom plugin upload requirements.
- 📊 **Real Live Server Status**: Genuine Bedrock metrics (Status, Player count, Max players, Version, MOTD) retrieved on-demand (`/status`).
- 👥 **Online Player Count**: Live lookup (`/players`) returning total online player count.
- 🛡️ **Zero Hardcoded Secrets**: Protected via environment variables (`TELEGRAM_TOKEN`, `ADMIN_ID`, `ALLOWED_USERS`, `MC_BRIDGE_URL`).
- 🌐 **Modern Web Control Panel**: Glassmorphism web dashboard (`/public`) with live status metrics and audit activity log.
- ⏰ **Hobby-Compliant Maintenance Cron**: Once-daily Vercel Cron (`0 0 * * *`) for non-critical system health checks.

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
   players - 👥 View online player count
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
| `MC_BRIDGE_URL` | Aternos Bedrock IP:Port | `elitesmp.aternos.me:19132` |
| `WEB_ADMIN_KEY` | Secret passkey for Web Control Panel | `my_web_admin_passkey` |
| `DEVELOPER_USERNAME` | Developer contact handle | `@NotMrRifat` |

5. Click **Deploy**. Note your deployment domain (e.g., `https://elitesmp.vercel.app`).

### 3. Set Telegram Webhook
Open the following URL in your browser (replace `<TELEGRAM_TOKEN>` and `<VERCEL_URL>`):

```text
https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/bot
```

---

## 🛡️ Security & Public Repository Guidelines

This repository is designed to be hosted **PUBLICLY** on GitHub.

- **NEVER Commit Secrets**: The `.gitignore` file strictly blocks `.env`, `.env.local`, and build artifacts.
- **Privacy Sanitization**: Audit logs automatically redact tokens and sensitive credentials before output.

---

## 👨‍💻 Developer & Credits

- **Developer**: Rifat Hassan ([@NotMrRifat](https://t.me/NotMrRifat))
- **Repository**: [GitHub Repository](https://github.com/NotMrRifat/EliteSMP/)
- **Live System**: [EliteSMP Web Dashboard](https://elitesmp.vercel.app/)
- **License**: MIT License