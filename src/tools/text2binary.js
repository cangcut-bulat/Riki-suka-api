/**
 * Converts a text string to its binary representation.
 * @param {string} text - The input text.
 * @returns {string} - The binary string.
 */
function text2binary(text) {
  return text
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join(" ");
}

module.exports = function(app, log) {
  log.info('[Text2Binary] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/text2binary", async (req, res) => {
    const { apikey, content } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[Text2Binary GET] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!content) {
      return res.status(400).json({ status: false, error: "Parameter 'content' diperlukan." });
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'content' harus berupa string yang tidak kosong." });
    }
    if (content.length > 1000) {
      return res.status(413).json({ status: false, error: "Konten terlalu panjang (maks 1000 karakter)" });
    }

    try {
      const binaryResult = text2binary(content); // Tidak perlu trim, biarkan spasi
      res.json({
        status: true,
        data: binaryResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("[Text2Binary GET] Error:", error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal server.",
      });
    }
  });

  // --- POST Route ---
  app.post("/api/tools/text2binary", async (req, res) => {
    const { apikey, content } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[Text2Binary POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!content) {
      return res.status(400).json({ status: false, error: "Parameter 'content' diperlukan." });
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'content' harus berupa string yang tidak kosong." });
    }
    if (content.length > 1000) {
      return res.status(413).json({ status: false, error: "Konten terlalu panjang (maks 1000 karakter)" });
    }

    try {
      const binaryResult = text2binary(content);
      res.json({
        status: true,
        data: binaryResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error("[Text2Binary POST] Error:", error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal server.",
      });
    }
  });
};
