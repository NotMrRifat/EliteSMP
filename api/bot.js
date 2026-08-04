const Client = require('aternos-api');
const fetch = require('node-fetch');

// Environment Variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ATERNOS_USER = process.env.ATERNOS_USER;
const ATERNOS_PASS = process.env.ATERNOS_PASS;

const ADMIN_ID = String(process.env.ADMIN_ID);
const ALLOWED_USERS = process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',').map(id => id.trim()) : [];
const SERVER_NAME = process.env.SERVER_NAME || "Minecraft SMP"; // Env variable for dynamic server/world name

// Fixed Developer Information
const DEVELOPER_INFO = {
  name: "Rifat Hassan",
  role: "Full Stack Developer, AI Automation Engineer & Bot Specialist",
  username: "@NotMrRifat",
  website: "https://omarfaruk.eu.cc/",
  socialHandle: "@NotMrRifat" // Standard handle for FB, Insta, Telegram
};

// In-Memory Store for message tracking
const userStates = {}; 

// Telegram API Helper Function
async function callTelegram(method, payload) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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

// Broadcast Message Function
async function broadcastToAll(text, excludeChatId = null) {
  const recipients = Array.from(new Set([ADMIN_ID, ...ALLOWED_USERS]));
  for (const id of recipients) {
    if (id && id !== String(excludeChatId)) {
      await sendMsg(id, text);
    }
  }
}

// Main Menu (English Buttons)
function getMainMenu(isAdmin) {
  const keyboard = [
    [
      { text: "🚀 Start Server", callback_data: "cmd_startserver" },
      { text: "📊 Server Status", callback_data: "cmd_status" }
    ],
    [
      { text: "📢 Send Message to Everyone", callback_data: "cmd_user_broadcast" }
    ],
    [
      { text: "👨‍💻 Developer Info", callback_data: "cmd_dev_info" }
    ]
  ];

  if (isAdmin) {
    keyboard.push([{ text: "⚙️ Admin Panel", callback_data: "cmd_admin_panel" }]);
  }

  return { inline_keyboard: keyboard };
}

function getAdminMenu() {
  return {
    inline_keyboard: [
      [
        { text: "🛑 Stop Server", callback_data: "cmd_stopserver" },
        { text: "📣 Admin Broadcast", callback_data: "cmd_admin_broadcast" }
      ],
      [
        { text: "🔙 Main Menu", callback_data: "cmd_main_menu" }
      ]
    ]
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('Bot Running!');

  const body = req.body;
  
  let chatId, senderName, text, isCallback = false, callbackId = null, messageId = null;

  if (body.callback_query) {
    isCallback = true;
    callbackId = body.callback_query.id;
    chatId = String(body.callback_query.message.chat.id);
    messageId = body.callback_query.message.message_id;
    senderName = body.callback_query.from.first_name || "User";
    text = body.callback_query.data;
    await callTelegram('answerCallbackQuery', { callback_query_id: callbackId });
  } else if (body.message) {
    chatId = String(body.message.chat.id);
    senderName = body.message.from.first_name || "User";
    text = body.message.text ? body.message.text.trim() : "";
  } else {
    return res.status(200).send('OK');
  }

  const isAdmin = chatId === ADMIN_ID;
  const isAllowed = ALLOWED_USERS.includes(chatId) || isAdmin;

  // 1. Access Control Check
  if (!isAllowed) {
    const denyMsg = `⚠️ <b>Access Denied!</b>\n\nআপনি এই বটটি ব্যবহার করার অনুমতি পাননি। আপনি যদি <b>${SERVER_NAME}</b> সার্ভারে খেলতে চান তবে ডেভলপারের সাথে যোগাযোগ করুন:\n👉 Telegram: ${DEVELOPER_INFO.username}\n🌐 Website: ${DEVELOPER_INFO.website}`;
    await sendMsg(chatId, denyMsg);
    return res.status(200).send('OK');
  }

  // 2. User Input State Check
  if (userStates[chatId]) {
    const state = userStates[chatId];
    delete userStates[chatId];

    if (state === 'WAITING_USER_BROADCAST' || state === 'WAITING_ADMIN_BROADCAST') {
      const prefix = state === 'WAITING_ADMIN_BROADCAST' ? `📢 <b>[Admin Announcement - ${SERVER_NAME}]</b>` : `✉️ <b>[Player Message - ${SERVER_NAME}]</b>`;
      const broadcastContent = `${prefix}\n<b>Sender:</b> ${senderName}\n\n💬 "${text}"`;
      
      await broadcastToAll(broadcastContent, chatId);
      await sendMsg(chatId, `✅ <b>সফলভাবে মেসেজটি সকলের কাছে পাঠানো হয়েছে!</b>`, getMainMenu(isAdmin));
      return res.status(200).send('OK');
    }
  }

  // 3. Command and Callback Handling
  if (text === '/start' || text === '/menu' || text === 'cmd_main_menu') {
    const msg = `👋 <b>হ্যালো ${senderName}!</b>\n<b>${SERVER_NAME}</b> কন্ট্রোল প্যানেলে স্বাগতম।\n\n👨‍💻 <b>Developer:</b> ${DEVELOPER_INFO.username}\n🌐 <b>Website:</b> ${DEVELOPER_INFO.website}\n\nনিচের বাটন বা কুইক কমান্ড ব্যবহার করে সার্ভার ম্যানেজ করুন:`;
    if (isCallback) {
      await editMsg(chatId, messageId, msg, getMainMenu(isAdmin));
    } else {
      await sendMsg(chatId, msg, getMainMenu(isAdmin));
    }
  }

  // --- Developer Info (/devoloper_info or Button) ---
  else if (text === '/devoloper_info' || text === 'cmd_dev_info') {
    const devText = `👨‍💻 <b>Developer Details</b>\n\n` +
      `<b>Name:</b> ${DEVELOPER_INFO.name}\n` +
      `<b>Title:</b> ${DEVELOPER_INFO.role}\n\n` +
      `🔗 <b>Social Links:</b>\n` +
      `• <b>Telegram:</b> ${DEVELOPER_INFO.username}\n` +
      `• <b>Instagram:</b> ${DEVELOPER_INFO.socialHandle}\n` +
      `• <b>Facebook:</b> ${DEVELOPER_INFO.socialHandle}\n` +
      `🌐 <b>Website:</b> ${DEVELOPER_INFO.website}`;

    if (isCallback) {
      await editMsg(chatId, messageId, devText, getMainMenu(isAdmin));
    } else {
      await sendMsg(chatId, devText, getMainMenu(isAdmin));
    }
  }

  // --- Admin Panel ---
  else if (text === '/admin' || text === 'cmd_admin_panel') {
    if (!isAdmin) {
      await sendMsg(chatId, "❌ <b>Permission Denied!</b> শুধুমাত্র এডমিন এই প্যানেল ব্যবহার করতে পারবে।");
      return res.status(200).send('OK');
    }
    const adminMsg = `⚙️ <b>Admin Control Panel (${SERVER_NAME})</b>\n\nএখানে কেবল এডমিনদের জন্য বিশেষ অপশন রয়েছে:`;
    if (isCallback) {
      await editMsg(chatId, messageId, adminMsg, getAdminMenu());
    } else {
      await sendMsg(chatId, adminMsg, getAdminMenu());
    }
  }

  // --- Start Server ---
  else if (text === '/startserver' || text === 'cmd_startserver') {
    let activeMsgId = messageId;
    if (!isCallback) {
      const initRes = await sendMsg(chatId, `🔄 <b>প্রক্রিয়াধীন...</b>\n<b>${SERVER_NAME}</b> এর জন্য Aternos এ কানেক্ট করা হচ্ছে।`);
      activeMsgId = initRes?.result?.message_id;
    } else {
      await editMsg(chatId, activeMsgId, `🔄 <b>প্রক্রিয়াধীন...</b>\n<b>${SERVER_NAME}</b> এর জন্য Aternos এ কানেক্ট করা হচ্ছে।`);
    }

    try {
      const aternos = new Client();
      await aternos.login(ATERNOS_USER, ATERNOS_PASS);
      const servers = await aternos.getServers();
      const server = servers[0];

      await editMsg(chatId, activeMsgId, `⏳ <b>সার্ভার স্টার্ট হচ্ছে...</b>\n<b>${SERVER_NAME}</b> চালু হতে কিছুক্ষণ সময় লাগতে পারে, অনুগ্রহ করে অপেক্ষা করুন।`);
      await server.start();

      const successMenu = {
        inline_keyboard: [
          [{ text: "✉️ Send Message to All", callback_data: "cmd_user_broadcast" }],
          [{ text: "📊 Check Status", callback_data: "cmd_status" }]
        ]
      };

      await editMsg(chatId, activeMsgId, `✅ <b>${SERVER_NAME} সার্ভার সফলভাবে চালু করার কমান্ড দেওয়া হয়েছে!</b>\n\nসবাইকে গেমের কথা জানাতে নিচের <b>Send Message</b> বাটনে ক্লিক করতে পারেন।`, successMenu);

      await broadcastToAll(`🚀 <b>${SERVER_NAME} Update</b>\n\n<b>${senderName}</b> সার্ভার চালু করার প্রসেস শুরু করেছে! কিছুক্ষণের মধ্যে সার্ভার অনলাইন হবে।`, chatId);

    } catch (err) {
      await editMsg(chatId, activeMsgId, `❌ <b>ব্যর্থ হয়েছে!</b>\nত্রুটি: ${err.message || 'কানেক্ট করা সম্ভব হয়নি'}`);
    }
  }

  // --- Stop Server (Admin Only) ---
  else if (text === '/stopserver' || text === 'cmd_stopserver') {
    if (!isAdmin) {
      await sendMsg(chatId, "❌ <b>Permission Denied!</b> কেবল এডমিন সার্ভার স্টপ করতে পারবে।");
      return res.status(200).send('OK');
    }

    let activeMsgId = messageId;
    if (!isCallback) {
      const initRes = await sendMsg(chatId, `🔄 <b>প্রক্রিয়াধীন...</b>\n<b>${SERVER_NAME}</b> সার্ভার বন্ধ করার চেষ্টা করা হচ্ছে।`);
      activeMsgId = initRes?.result?.message_id;
    } else {
      await editMsg(chatId, activeMsgId, `🔄 <b>প্রক্রিয়াধীন...</b>\n<b>${SERVER_NAME}</b> সার্ভার বন্ধ করার চেষ্টা করা হচ্ছে।`);
    }

    try {
      const aternos = new Client();
      await aternos.login(ATERNOS_USER, ATERNOS_PASS);
      const servers = await aternos.getServers();
      await servers[0].stop();

      await editMsg(chatId, activeMsgId, `🛑 <b>${SERVER_NAME} সার্ভারটি সফলভাবে বন্ধ করা হয়েছে!</b>`);
      await broadcastToAll(`🛑 <b>${SERVER_NAME} Update</b>\n\nএডমিন কর্তৃক <b>${SERVER_NAME}</b> সার্ভারটি বন্ধ করা হয়েছে।`, chatId);

    } catch (err) {
      await editMsg(chatId, activeMsgId, `❌ <b>স্টপ করতে সমস্যা হয়েছে:</b> ${err.message}`);
    }
  }

  // --- Check Status ---
  else if (text === '/status' || text === 'cmd_status') {
    let activeMsgId = messageId;
    if (!isCallback) {
      const initRes = await sendMsg(chatId, `🔍 <b>${SERVER_NAME} এর স্ট্যাটাস চেক করা হচ্ছে...</b>`);
      activeMsgId = initRes?.result?.message_id;
    } else {
      await editMsg(chatId, activeMsgId, `🔍 <b>${SERVER_NAME} এর স্ট্যাটাস চেক করা হচ্ছে...</b>`);
    }

    try {
      const aternos = new Client();
      await aternos.login(ATERNOS_USER, ATERNOS_PASS);
      const servers = await aternos.getServers();
      const status = await servers[0].getStatus();

      const statusMsg = `📊 <b>${SERVER_NAME} বর্তমান স্ট্যাটাস:</b> <code>${status.toUpperCase()}</code>`;
      await editMsg(chatId, activeMsgId, statusMsg, getMainMenu(isAdmin));

    } catch (err) {
      await editMsg(chatId, activeMsgId, `❌ স্ট্যাটাস চেক করা যায়নি: ${err.message}`);
    }
  }

  // --- Broadcast Prompt ---
  else if (text === 'cmd_user_broadcast') {
    userStates[chatId] = 'WAITING_USER_BROADCAST';
    await sendMsg(chatId, `✍️ <b>আপনি ${SERVER_NAME} এর সবাইকে কী মেসেজ পাঠাতে চান তা লিখে পাঠান:</b>\n<i>(উদাহরণ: 'আমি গেমের মধ্যে ঢুকছি, তোরা তাড়াতাড়ি আয়!')</i>`);
  }

  else if (text === 'cmd_admin_broadcast') {
    if (!isAdmin) return res.status(200).send('OK');
    userStates[chatId] = 'WAITING_ADMIN_BROADCAST';
    await sendMsg(chatId, `📣 <b>${SERVER_NAME} এডমিন অ্যানাউন্সমেন্ট মেসেজটি টাইপ করে পাঠান:</b>`);
  }

  return res.status(200).send('OK');
};