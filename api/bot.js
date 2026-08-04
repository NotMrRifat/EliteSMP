const fetch = require('node-fetch');

// Environment Variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ATERNOS_USER = process.env.ATERNOS_USER;
const ATERNOS_PASS = process.env.ATERNOS_PASS;

const ADMIN_ID = String(process.env.ADMIN_ID || "");
const ALLOWED_USERS = process.env.ALLOWED_USERS 
  ? process.env.ALLOWED_USERS.split(',').map(id => id.trim()) 
  : [];
const SERVER_NAME = process.env.SERVER_NAME || "EliteSMP Minecraft";

// Developer Details
const DEVELOPER_INFO = {
  name: "Rifat Hassan",
  role: "Full Stack Developer • AI Automation Engineer",
  username: "@NotMrRifat",
  website: "https://omarfaruk.eu.cc/",
  socialHandle: "@NotMrRifat"
};

// State Storage for Broadcast Handling
const userStates = {}; 

// Custom Telegram API Caller with Link Preview Disabled
async function callTelegram(method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        disable_web_page_preview: true // 🚫 Link Preview Disabled Globally
      })
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API Error (${method}):`, err);
    return null;
  }
}

async function sendMsg(chatId, text, replyMarkup = null) {
  return await callTelegram('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
}

async function editMsg(chatId, messageId, text, replyMarkup = null) {
  return await callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
}

// Broadcast Message Helper
async function broadcastToAll(text, excludeChatId = null) {
  const recipients = Array.from(new Set([ADMIN_ID, ...ALLOWED_USERS]));
  for (const id of recipients) {
    if (id && id !== String(excludeChatId)) {
      await sendMsg(id, text);
    }
  }
}

// 🌐 Real Aternos Live Status & Action Engine
async function handleAternosAction(action) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': `ATERNOS_USER=${encodeURIComponent(ATERNOS_USER)}; ATERNOS_PASS=${encodeURIComponent(ATERNOS_PASS)}`,
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (action === 'status') {
      const response = await fetch(`https://aternos.org/panel/ajax/status.php`, { headers });
      if (!response.ok) return { success: false, status: 'UNKNOWN' };
      const data = await response.json();
      
      let rawStatus = (data.status || 'OFFLINE').toUpperCase();
      let statusFormatted = '🔴 OFFLINE';
      
      if (rawStatus.includes('ONLINE')) statusFormatted = '🟢 ONLINE';
      else if (rawStatus.includes('STARTING') || rawStatus.includes('PREPARING')) statusFormatted = '🟡 STARTING...';
      else if (rawStatus.includes('SHUTDOWN') || rawStatus.includes('STOPPING')) statusFormatted = '🟠 STOPPING...';

      return { 
        success: true, 
        status: statusFormatted,
        players: data.players || '0/20',
        ip: data.ip || `${ATERNOS_USER}.aternos.me`
      };
    } else {
      const response = await fetch(`https://aternos.org/panel/action.php?SEC=${encodeURIComponent(ATERNOS_USER)}&action=${action}`, { headers });
      return { success: response.ok };
    }
  } catch (err) {
    console.error("Aternos Engine Error:", err);
    return { success: false, status: 'ERROR' };
  }
}

// Modern Keyboards
function getMainMenu(isAdmin) {
  const keyboard = [
    [
      { text: "⚡ Start Server", callback_data: "cmd_startserver" },
      { text: "📡 Live Status", callback_data: "cmd_status" }
    ],
    [
      { text: "📢 Alert Players", callback_data: "cmd_user_broadcast" }
    ],
    [
      { text: "👨‍💻 Developer Specs", callback_data: "cmd_dev_info" }
    ]
  ];

  if (isAdmin) {
    keyboard.push([{ text: "⚙️ Admin Control Panel", callback_data: "cmd_admin_panel" }]);
  }

  return { inline_keyboard: keyboard };
}

function getAdminMenu() {
  return {
    inline_keyboard: [
      [
        { text: "🛑 Shutdown Server", callback_data: "cmd_stopserver" },
        { text: "📣 Official Broadcast", callback_data: "cmd_admin_broadcast" }
      ],
      [
        { text: "🔙 Return to Dashboard", callback_data: "cmd_main_menu" }
      ]
    ]
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('⚡ EliteSMP Control Node Active');
  }

  const body = req.body || {};
  let chatId, senderName, text, isCallback = false, callbackId = null, messageId = null;

  if (body.callback_query) {
    isCallback = true;
    callbackId = body.callback_query.id;
    chatId = String(body.callback_query.message.chat.id);
    messageId = body.callback_query.message.message_id;
    
    const user = body.callback_query.from;
    senderName = user.username ? `@${user.username}` : (user.first_name || "Player");
    text = body.callback_query.data;
    await callTelegram('answerCallbackQuery', { callback_query_id: callbackId });
  } else if (body.message) {
    chatId = String(body.message.chat.id);
    
    const user = body.message.from;
    senderName = user.username ? `@${user.username}` : (user.first_name || "Player");
    text = body.message.text ? body.message.text.trim() : "";
  } else {
    return res.status(200).send('OK');
  }

  const isAdmin = (chatId === ADMIN_ID);
  const isAllowed = ALLOWED_USERS.includes(chatId) || isAdmin;

  // 1. Strict Security Guard
  if (!isAllowed) {
    const denyMsg = `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️ <b>ACCESS CONTROL SYSTEM</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚠️ <b>Access Restricted!</b>\n` +
      `আপনি <b>${SERVER_NAME}</b> নেটওয়ার্কটি ব্যবহারের অনুমতি পাননি। অ্যাক্সেস পেতে ডেভলপারের সাথে যোগাযোগ করুন:\n\n` +
      `👤 <b>Developer:</b> ${DEVELOPER_INFO.username}\n` +
      `🌐 <b>Portfolio:</b> ${DEVELOPER_INFO.website}`;
      
    await sendMsg(chatId, denyMsg);
    return res.status(200).send('OK');
  }

  // 2. Broadcast State Collector
  if (userStates[chatId] && !isCallback) {
    const state = userStates[chatId];
    delete userStates[chatId];

    if (state === 'WAITING_USER_BROADCAST' || state === 'WAITING_ADMIN_BROADCAST') {
      const header = (state === 'WAITING_ADMIN_BROADCAST')
        ? `📢 <b>[SYSTEM ANNOUNCEMENT — ${SERVER_NAME.toUpperCase()}]</b>`
        : `✉️ <b>[PLAYER BROADCAST — ${SERVER_NAME.toUpperCase()}]</b>`;
      
      const broadcastContent = `${header}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Sender:</b> ${senderName}\n\n` +
        `💬 <i>"${text}"</i>\n` +
        `━━━━━━━━━━━━━━━━━━━━`;
      
      await broadcastToAll(broadcastContent, chatId);
      await sendMsg(chatId, `✅ <b>মেসেজটি ব্রডকাস্টের মাধ্যমে সকলের কাছে পাঠানো হয়েছে!</b>`, getMainMenu(isAdmin));
      return res.status(200).send('OK');
    }
  }

  // 3. UI Commands & Flow Handler

  // --- /start or /menu ---
  if (text === '/start' || text === '/menu' || text === 'cmd_main_menu') {
    const msg = `🏰 <b>${SERVER_NAME.toUpperCase()} DASHBOARD</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👋 <b>Welcome back,</b> ${senderName}!\n\n` +
      `⚡ <b>System Status:</b> <code>ACTIVE</code>\n` +
      `👨‍💻 <b>Lead Architect:</b> ${DEVELOPER_INFO.username}\n` +
      `🌐 <b>Official Portal:</b> ${DEVELOPER_INFO.website}\n\n` +
      `নিচের কন্ট্রোল প্যানেল থেকে সার্ভার অপারেট করুন:`;
      
    if (isCallback) {
      await editMsg(chatId, messageId, msg, getMainMenu(isAdmin));
    } else {
      await sendMsg(chatId, msg, getMainMenu(isAdmin));
    }
  }

  // --- Developer Info ---
  else if (text === '/devoloper_info' || text === 'cmd_dev_info') {
    const devText = `👨‍💻 <b>DEVELOPER SPECIFICATIONS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Name:</b> ${DEVELOPER_INFO.name}\n` +
      `💼 <b>Specialization:</b> ${DEVELOPER_INFO.role}\n\n` +
      `🌐 <b>Portfolio:</b> ${DEVELOPER_INFO.website}\n` +
      `📱 <b>Telegram:</b> ${DEVELOPER_INFO.username}\n` +
      `📸 <b>Instagram:</b> ${DEVELOPER_INFO.socialHandle}\n` +
      `📘 <b>Facebook:</b> ${DEVELOPER_INFO.socialHandle}\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    if (isCallback) {
      await editMsg(chatId, messageId, devText, getMainMenu(isAdmin));
    } else {
      await sendMsg(chatId, devText, getMainMenu(isAdmin));
    }
  }

  // --- Admin Panel ---
  else if (text === '/admin' || text === 'cmd_admin_panel') {
    if (!isAdmin) {
      await sendMsg(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED!</b>");
      return res.status(200).send('OK');
    }
    const adminMsg = `⚙️ <b>ADMINISTRATION DASHBOARD</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Server Node:</b> ${SERVER_NAME}\n` +
      `<b>Access Scope:</b> Super Admin Panel\n\n` +
      `জরুরি প্রশাসনিক কাজ সম্পাদন করার জন্য কমান্ড নির্বাচন করুন:`;
      
    if (isCallback) {
      await editMsg(chatId, messageId, adminMsg, getAdminMenu());
    } else {
      await sendMsg(chatId, adminMsg, getAdminMenu());
    }
  }

  // --- Start Server ---
  else if (text === '/startserver' || text === 'cmd_startserver') {
    let activeMsgId = messageId;
    const processText = `🔄 <b>INITIATING SERVER START...</b>\n━━━━━━━━━━━━━━━━━━━━\n📡 Connecting to Aternos Cloud Node for <b>${SERVER_NAME}</b>...`;

    if (!isCallback) {
      const initRes = await sendMsg(chatId, processText);
      activeMsgId = initRes?.result?.message_id;
    } else {
      await editMsg(chatId, activeMsgId, processText);
    }

    const actionResult = await handleAternosAction('start');

    if (actionResult.success) {
      const successMenu = {
        inline_keyboard: [
          [{ text: "📢 Broadcast Notification", callback_data: "cmd_user_broadcast" }],
          [{ text: "📊 Check Live Status", callback_data: "cmd_status" }]
        ]
      };

      const bootedMsg = `🚀 <b>START COMMAND EXECUTED!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>World:</b> ${SERVER_NAME}\n` +
        `<b>Status:</b> 🟡 <code>STARTING UP</code>\n\n` +
        `সার্ভারটি অন হচ্ছে, ১-২ মিনিট অপেক্ষা করে <b>Check Live Status</b> বাটনে ট্যাপ করুন।`;

      if (activeMsgId) await editMsg(chatId, activeMsgId, bootedMsg, successMenu);
      else await sendMsg(chatId, bootedMsg, successMenu);

      await broadcastToAll(`🚀 <b>${SERVER_NAME} SYSTEM ALERT</b>\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>${senderName}</b> সার্ভারটি চালুর কমান্ড দিয়েছে! গেমের জন্য রেডি হন।`, chatId);
    } else {
      const failMsg = `❌ <b>STARTUP FAILED!</b>\n━━━━━━━━━━━━━━━━━━━━\nAternos Session এক্সপায়ার্ড বা Cloudflare সিকিউরিটির কারণে স্টার্ট করা যায়নি। ওয়েবসাইট থেকে ম্যানুয়ালি একবার লগইন করে নিন।`;
      if (activeMsgId) await editMsg(chatId, activeMsgId, failMsg);
      else await sendMsg(chatId, failMsg);
    }
  }

  // --- Stop Server ---
  else if (text === '/stopserver' || text === 'cmd_stopserver') {
    if (!isAdmin) {
      await sendMsg(chatId, "⛔ <b>ADMIN PERMISSION REQUIRED!</b>");
      return res.status(200).send('OK');
    }

    let activeMsgId = messageId;
    const processText = `🔄 <b>INITIATING SHUTDOWN...</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>${SERVER_NAME}</b> এর সার্ভার শাটডাউন প্রক্রিয়া শুরু হচ্ছে...`;

    if (!isCallback) {
      const initRes = await sendMsg(chatId, processText);
      activeMsgId = initRes?.result?.message_id;
    } else {
      await editMsg(chatId, activeMsgId, processText);
    }

    const actionResult = await handleAternosAction('stop');

    if (actionResult.success) {
      const stoppedMsg = `🛑 <b>SERVER SHUTDOWN SUCCESSFUL!</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>Server Name:</b> ${SERVER_NAME}\n<b>State:</b> 🔴 <code>OFFLINE</code>`;
      if (activeMsgId) await editMsg(chatId, activeMsgId, stoppedMsg);
      else await sendMsg(chatId, stoppedMsg);

      await broadcastToAll(`🛑 <b>${SERVER_NAME} SYSTEM ALERT</b>\n━━━━━━━━━━━━━━━━━━━━\nএডমিন কর্তৃক <b>${SERVER_NAME}</b> সার্ভারটি বন্ধ করে দেওয়া হয়েছে।`, chatId);
    } else {
      const failMsg = `❌ <b>SHUTDOWN FAILED!</b>\nস্টপ রিকোয়েস্ট প্রক্রিয়া করতে সমস্যা হয়েছে।`;
      if (activeMsgId) await editMsg(chatId, activeMsgId, failMsg);
      else await sendMsg(chatId, failMsg);
    }
  }

  // --- Real Live Status ---
  else if (text === '/status' || text === 'cmd_status') {
    let activeMsgId = messageId;
    const processText = `🔍 <b>FETCHING REAL-TIME METRICS...</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>${SERVER_NAME}</b> এর লাইভ ডেটা আনা হচ্ছে...`;

    if (!isCallback) {
      const initRes = await sendMsg(chatId, processText);
      activeMsgId = initRes?.result?.message_id;
    } else {
      await editMsg(chatId, activeMsgId, processText);
    }

    const liveData = await handleAternosAction('status');

    const statusReport = `📊 <b>LIVE SERVER METRICS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎮 <b>World:</b> ${SERVER_NAME}\n` +
      `📡 <b>State:</b> ${liveData.status}\n` +
      `👥 <b>Active Players:</b> <code>${liveData.players || '0/20'}</code>\n` +
      `🌐 <b>Server IP:</b> <code>${liveData.ip || `${ATERNOS_USER}.aternos.me`}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    if (activeMsgId) {
      await editMsg(chatId, activeMsgId, statusReport, getMainMenu(isAdmin));
    } else {
      await sendMsg(chatId, statusReport, getMainMenu(isAdmin));
    }
  }

  // --- Broadcast Triggers ---
  else if (text === 'cmd_user_broadcast') {
    userStates[chatId] = 'WAITING_USER_BROADCAST';
    await sendMsg(chatId, `✍️ <b>${SERVER_NAME} এর বন্ধুদের মেসেজ পাঠান:</b>\n<i>(মেসেজটি টাইপ করে পাঠালে বট তা সবার কাছে রিলে করবে)</i>`);
  }

  else if (text === 'cmd_admin_broadcast') {
    if (!isAdmin) return res.status(200).send('OK');
    userStates[chatId] = 'WAITING_ADMIN_BROADCAST';
    await sendMsg(chatId, `📣 <b>${SERVER_NAME} এর সকল প্লেয়ারদের জন্য অফিসিয়াল অ্যানাউন্সমেন্ট টাইপ করুন:</b>`);
  }

  return res.status(200).send('OK');
};