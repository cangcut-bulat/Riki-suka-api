const { Buffer } = require("buffer");

module.exports = function(app, log) {
  log.info('[Text2Base64] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/text2base64", async (req, res) => {
    const { apikey, text } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[Text2Base64 GET] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!text) {
      return res.status(400).json({ status: false, error: "Parameter 'text' diperlukan" });
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'text' harus berupa string yang tidak kosong" });
    }
    if (text.length > 10000) { // Limit length
      return res.status(413).json({ status: false, error: "Teks terlalu panjang (maks 10000 karakter)" });
    }

    try {
      const base64 = Buffer.from(text).toString("base64"); // Tidak perlu trim di sini, biarkan user putuskan
      res.json({
        status: true,
        data: {
          base64: base64,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("[Text2Base64 GET] Error:", error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal server",
      });
    }
  });

  // --- POST Route ---
  app.post("/api/tools/text2base64", async (req, res) => {
    const { apikey, text } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[Text2Base64 POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!text) {
      return res.status(400).json({ status: false, error: "Parameter 'text' diperlukan" });
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'text' harus berupa string yang tidak kosong" });
    }
     if (text.length > 10000) {
      return res.status(413).json({ status: false, error: "Teks terlalu panjang (maks 10000 karakter)" });
    }

    try {
      const base64 = Buffer.from(text).toString("base64");
      res.json({
        status: true,
        data: {
          base64: base64,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("[Text2Base64 POST] Error:", error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal server",
      });
    }
  });
};
