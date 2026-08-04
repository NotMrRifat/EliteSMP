/*
 * Aternos adapter boundary.
 *
 * IMPORTANT:
 * Aternos does not expose a stable public server-control API for this bot.
 * Do not put guessed/private AJAX endpoints here and call them "live".
 *
 * This module intentionally fails closed until a verified integration is
 * selected and tested in the target runtime.
 */

function unavailable(action) {
  const error = new Error(
    `Aternos adapter is not configured for ${action}. ` +
    `No fake success is returned.`
  );
  error.code = "ATERNOS_ADAPTER_NOT_CONFIGURED";
  throw error;
}

async function status() { return unavailable("status"); }
async function start() { return unavailable("start"); }
async function stop() { return unavailable("stop"); }
async function restart() { return unavailable("restart"); }

module.exports = { status, start, stop, restart };
