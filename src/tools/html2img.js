const puppeteer = require("puppeteer");
const { Buffer } = require("buffer");

/**
 * Converts HTML code to a PNG image using Puppeteer.
 * @param {string} htmlCode - The HTML code to convert.
 * @param {object} log - Logger object.
 * @returns {Promise<Buffer>} - A buffer containing the PNG image.
 */
async function convertHtmlToImage(htmlCode, log) {
  let browser = null;
  try {
    log.info("[HTML2Img] Launching Puppeteer...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    log.info("[HTML2Img] Browser launched, creating new page...");
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    await page.setViewport({ width: 1920, height: 1080 }); // Set viewport
    log.info("[HTML2Img] Setting content...");
    await page.setContent(htmlCode, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Beri waktu sedikit untuk rendering elemen (jika ada script)
    await new Promise(r => setTimeout(r, 1000)); 
    log.info("[HTML2Img] Taking screenshot...");

    const screenshotBuffer = await page.screenshot({
      fullPage: true, // Ambil screenshot seluruh halaman
      type: "png",
    });

    log.info("[HTML2Img] Screenshot taken, closing browser.");
    await browser.close();
    browser = null; // Pastikan browser di-null-kan setelah ditutup

    return screenshotBuffer;
    
  } catch (error) {
     log.error("[HTML2Img] Error:", error.message);
     if (browser) {
         await browser.close(); // Pastikan browser ditutup jika terjadi error
     }
     throw new Error(`Gagal membuat gambar dari HTML: ${error.message}`);
  }
}

module.exports = function(app, log) {
  log.info('[HTML2Img] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/code2img", async (req, res) => {
    const { apikey, htmlCode } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[HTML2Img GET] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!htmlCode) {
      return res.status(400).json({ status: false, error: "Parameter 'htmlCode' diperlukan" });
    }
    if (typeof htmlCode !== "string" || htmlCode.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'htmlCode' harus berupa string yang tidak kosong" });
    }
    if (htmlCode.length > 10000) {
      return res.status(413).json({ status: false, error: "Kode HTML terlalu panjang (maks 10000 karakter)" });
    }

    try {
      const screenshotBuffer = await convertHtmlToImage(htmlCode, log); // Jangan di-trim, biarkan spasi
      
      // Kirim gambar sebagai respons
      res.set("Content-Type", "image/png");
      res.set("Content-Disposition", 'inline; filename="html-to-image.png"');
      res.send(screenshotBuffer);

    } catch (error) {
      log.error("[HTML2Img GET] Handler error:", error);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal saat membuat gambar",
      });
    }
  });

  // --- POST Route ---
  app.post("/api/tools/code2img", async (req, res) => {
    const { apikey, htmlCode } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[HTML2Img POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!htmlCode) {
      return res.status(400).json({ status: false, error: "Parameter 'htmlCode' diperlukan" });
    }
    if (typeof htmlCode !== "string" || htmlCode.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'htmlCode' harus berupa string yang tidak kosong" });
    }
     if (htmlCode.length > 10000) {
      return res.status(413).json({ status: false, error: "Kode HTML terlalu panjang (maks 10000 karakter)" });
    }

    try {
      const screenshotBuffer = await convertHtmlToImage(htmlCode, log); // Jangan di-trim
      
      res.set("Content-Type", "image/png");
      res.set("Content-Disposition", 'inline; filename="html-to-image.png"');
      res.send(screenshotBuffer);

    } catch (error) {
      log.error("[HTML2Img POST] Handler error:", error);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal saat membuat gambar",
      });
    }
  });
};
