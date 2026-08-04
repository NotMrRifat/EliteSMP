const ADMIN_ID = String(process.env.ADMIN_ID || "").trim();
const ALLOWED_USERS = (process.env.ALLOWED_USERS || "")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

function isAdmin(id) {
  if (!id || !ADMIN_ID) return false;
  return String(id).trim() === ADMIN_ID;
}

function isAllowed(id) {
  if (!id) return false;
  const s = String(id).trim();
  if (isAdmin(s)) return true;
  if (ALLOWED_USERS.length === 0) return false;
  return ALLOWED_USERS.includes(s);
}

module.exports = {
  isAdmin,
  isAllowed,
  ADMIN_ID,
  ALLOWED_USERS
};
