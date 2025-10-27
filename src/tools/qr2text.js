const axios = require("axios");
const jsQR = require("jsqr");
const { createCanvas, loadImage } = require("canvas");
const { Buffer } = require("buffer");

/**
 * Reads text from a QR code image URL.
 * @param {string} url - The URL of the image containing the QR code.
 * @param {object} log - Logger object.
 * @returns {Promise<string>} - The decoded text from the QR code.
 */
async function readQrCodeFromUrl(url, log) {
  try {
    log.info(`[QR2Text] Fetching image from: ${url}`);
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    log.info("[QR2Text] Image fetched, loading into canvas...");
    const image = await loadImage(Buffer.from(response.data));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    log.info("[QR2Text] Canvas drawn, getting image data...");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    log.info("[QR2Text] Scanning for QR code...");
    const code = jsQR(
      imageData.data,
      imageData.width,
      imageData.height,
    );

    if (!code) {
      log.warn("[QR2Text] No QR code found in the image.");
      throw new Error("Tidak ada kode QR yang ditemukan di gambar");
    }
    
    log.info("[QR2Text] QR code found and decoded.");
    return code.data;
    
  } catch (error) {
    log.error("[QR2Text] QR Code API Error:", error.message);
    if (axios.isAxiosError(error)) {
        throw new Error(`Gagal mengambil gambar dari URL: ${error.message}`);
    }
    throw new Error(`Gagal membaca kode QR: ${error.message}`);
  }
}

module.exports = function(app, log) {
  log.info('[QR2Text] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/qr2text", async (req, res) => {
    const { apikey, url } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[QR2Text GET] Invalid API Key: ${apikey} from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!url) {
      return res.status(400).json({ status: false, error: "Parameter 'url' diperlukan" });
    }
    if (typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'url' harus berupa string yang tidak kosong" });
    }
    
    try {
        new URL(url.trim());
    } catch {
        return res.status(400).json({ status: false, error: "Format URL tidak valid" });
    }

    try {
      const text = await readQrCodeFromUrl(url.trim(), log);
      res.json({
        status: true,
        data: {
          text: text,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Gagal membaca kode QR",
      });
    }
  });

  // --- POST Route ---
  app.post("/api/tools/qr2text", async (req, res) => {
    const { apikey, url } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[QR2Text POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!url) {
      return res.status(400).json({ status: false, error: "Parameter 'url' diperlukan" });
    }
    if (typeof url !== "string" || url.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'url' harus berupa string yang tidak kosong" });
    }
    
    try {
        new URL(url.trim());
    } catch {
        return res.status(400).json({ status: false, error: "Format URL tidak valid" });
    }

    try {
      const text = await readQrCodeFromUrl(url.trim(), log);
      res.json({
        status: true,
        data: {
          text: text,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Gagal membaca kode QR",
      });
    }
  });
};
