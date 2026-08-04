const ADMIN_ID = String(process.env.ADMIN_ID || "");
const ALLOWED_USERS = (process.env.ALLOWED_USERS || "")
  .split(",").map(x => x.trim()).filter(Boolean);

function isAdmin(id) {
  return String(id) === ADMIN_ID;
}

function isAllowed(id) {
  const s = String(id);
  return isAdmin(s) || ALLOWED_USERS.includes(s);
}

module.exports = { isAdmin, isAllowed };
