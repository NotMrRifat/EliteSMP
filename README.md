# 🎮 Aternos Minecraft Telegram Control Bot

A lightweight, serverless, high-security Telegram Bot designed to manage your **Aternos Minecraft Server** dynamically via Webhooks. Built for **Vercel (Node.js)** with built-in Access Control, Live Status Updates, Broadcast Notifications, and interactive Inline Keyboards.

---

## ✨ Features

* 🚀 **One-Click Server Control:** Start your server instantly via quick commands or inline buttons.
* 🛡️ **Strict Access Control:** Only whitelisted Telegram IDs (`ALLOWED_USERS`) can access the bot. Unauthorized users get an Access Denied message with your developer contact link.
* ⚙️ **Dedicated Admin Panel:** Restricted `/admin` dashboard for administrative tasks like stopping the server and sending official announcements.
* 🔄 **Live Status Edits:** Real-time visual feedback on Telegram as the server transitions through states (Processing → Starting → Online).
* ✉️ **Player Broadcast System:** Allows players to send "Joining Now" notifications to everyone right after starting the server.
* 📢 **Automatic Notifications:** Broadcasts real-time server status updates to all registered users whenever someone starts or stops the server.
* 🌐 **Serverless Ready:** Configured specifically for deployment on Vercel Node.js Serverless Functions using Telegram Webhooks.

---

## 🛠️ Project Structure

```text
.
├── api/
│   └── bot.js          # Main Telegram Webhook execution script
├── .env.example        # Environment variables template
├── package.json        # Project metadata and dependencies
├── vercel.json         # Vercel configuration file
└── README.md           # Documentation 

📋 Prerequisites
Before deploying, make sure you have:

An active Aternos Account (Username & Password).

A Telegram Bot Token from @BotFather.

Your Telegram User ID (Get it via @userinfobot).

A free Vercel Account linked to your GitHub.

🚀 Quick Start & Deployment
1. Clone & Push to GitHub
Upload your project files (api/bot.js, package.json, vercel.json, and .env.example) to your GitHub repository.

2. Deploy to Vercel
Log into your Vercel Dashboard and click Add New Project.

Select and import your GitHub repository.

Under Environment Variables, add the following key-value pairs:

Variable,           Description,                     Example
TELEGRAM_TOKEN,     Bot API token from BotFather,    123456789:ABCdefGHI...
ADMIN_ID,           Telegram User ID(primary admin), 12345678
ALLOWED_USERS,      Comma-separated list of IDs,     "12345678,87654321"
ATERNOS_USER,       Your Aternos username,           my_aternos_account
ATERNOS_PASS,       Your Aternos password,           my_aternos_password
SERVER_NAME         Custom name for your SMP         EliteSMP

Click Deploy. Once completed, copy your Vercel deployment domain (e.g., https://your-bot-repo.vercel.app). 

3. Set Telegram Webhook
Open your web browser and navigate to the following URL (replace <TELEGRAM_TOKEN> and <VERCEL_URL> with your actual values): 

[https://api.telegram.org/bot](https://api.telegram.org/bot)<TELEGRAM_TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/bot

If successful, you will see { "ok": true, "result": true, "description": "Webhook was set" }.

.

🤖 Commands & Usage
You can register these quick commands with @BotFather using /setcommands:


start - 🚀 Open main dashboard
startserver - ⚡ Start the Minecraft server
status - 📊 Check server status
admin - ⚙️ Open admin panel (Admin only)
menu - 📱 View interactive menu
Command Permissions
All Allowed Users: /start, /menu, /startserver, /status, and sending player broadcasts.

Admin Only: /admin, /stopserver, and official announcements.

Unauthorized Users: Blocked automatically with developer referral.

⚠️ Important Notes
Aternos Security: If Aternos updates their Cloudflare protection or triggers a Captcha requirement, direct password authentication may require updating the aternos-api dependency or switching to session cookies.

Privacy: Keep your .env file private and never commit actual credentials to a public repository.

👨‍💻 Developer Information
Name: Rifat Hassan
Role: Full Stack Developer, AI Automation Engineer & Bot Specialist
Telegram / Socials: @NotMrRifat
Website: https://omarfaruk.eu.cc/


📄 License
This project is open-source and available under the MIT License.