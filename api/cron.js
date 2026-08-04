const aternos = require("./lib/aternos");

module.exports = async (_req, res) => {
  try {
    const result = await aternos.status();
    return res.status(200).json({ok:true, result});
  } catch (error) {
    return res.status(200).json({
      ok:false,
      code:error.code || "MONITOR_ERROR",
      message:error.message
    });
  }
};

