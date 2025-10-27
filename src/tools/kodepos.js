const axios = require("axios");
const cheerio = require("cheerio");
const { URLSearchParams } = require('url');

/**
 * Scrapes postal code information from Pos Indonesia.
 * @param {string} form - The location name to search for.
 * @param {object} log - Logger object.
 * @returns {Promise<Array<object>>} - An array of postal code results.
 */
async function scrapeKodepos(form, log) {
  try {
    log.info(`[Kodepos] Scraping for: ${form}`);
    const response = await axios.post(
      "https://kodepos.posindonesia.co.id/CariKodepos",
      new URLSearchParams({ kodepos: form }).toString(), // Pastikan format body benar
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Cache-Control": "max-age=0",
          "Origin": "https://kodepos.posindonesia.co.id",
          "Referer": "https://kodepos.posindonesia.co.id/",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
          // Cookie bisa jadi expired, mungkin lebih baik dihapus atau diambil dinamis
          "Cookie": "ci_session=aqlrvi6tdfajmfelsla8n974p1btd9pb", 
        },
        timeout: 30000,
      }
    );

    const html = response.data;
    const $ = cheerio.load(html);
    
    // Cek jika tabelnya ada
    if ($("tbody > tr").length === 0) {
        log.warn(`[Kodepos] No results found in HTML for: ${form}`);
        // Cek jika ada pesan error di halaman
        const errorMsg = $(".alert-danger").text().trim();
        if(errorMsg) {
             throw new Error(`Pos Indonesia API Error: ${errorMsg}`);
        }
        return []; // Kembalikan array kosong jika tidak ada hasil
    }

    const result = $("tbody > tr")
      .map((_, el) => {
        const $td = $(el).find("td");
        // Lakukan pengecekan jumlah kolom untuk menghindari error
        if ($td.length >= 6) {
            const kodepos = $td.eq(1).text().trim();
            const desa = $td.eq(2).text().trim();
            const kecamatan = $td.eq(3).text().trim();
            const kota = $td.eq(4).text().trim();
            const provinsi = $td.eq(5).text().trim();
            return {
              kodepos,
              desa,
              kecamatan,
              kota,
              provinsi,
            };
        }
        return null; // Abaikan baris yang tidak valid
      })
      .get()
      .filter(Boolean); // Hapus entri null

    log.info(`[Kodepos] Found ${result.length} results for: ${form}`);
    return result;
    
  } catch (error) {
    log.error("[Kodepos] API Error:", error.message);
     if (axios.isAxiosError(error)) {
         throw new Error(`Gagal menghubungi server Pos Indonesia: ${error.message}`);
    }
    throw new Error("Gagal mengambil data kodepos");
  }
}

module.exports = function(app, log) {
  log.info('[Kodepos] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/kodepos", async (req, res) => {
    const { apikey, form } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[Kodepos GET] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!form) {
      return res.status(400).json({ status: false, error: "Parameter 'form' (lokasi) diperlukan" });
    }
    if (typeof form !== "string" || form.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'form' harus berupa string yang tidak kosong" });
    }

    try {
      const result = await scrapeKodepos(form.trim(), log);
      if (!result || result.length === 0) {
        return res.status(404).json({ status: false, error: "Tidak ada informasi kodepos ditemukan untuk lokasi tersebut" });
      }
      res.json({
        status: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal server",
      });
    }
  });

  // --- POST Route ---
  app.post("/api/tools/kodepos", async (req, res) => {
    const { apikey, form } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[Kodepos POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!form) {
      return res.status(400).json({ status: false, error: "Parameter 'form' (lokasi) diperlukan" });
    }
    if (typeof form !== "string" || form.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'form' harus berupa string yang tidak kosong" });
    }

    try {
      const result = await scrapeKodepos(form.trim(), log);
      if (!result || result.length === 0) {
        return res.status(404).json({ status: false, error: "Tidak ada informasi kodepos ditemukan untuk lokasi tersebut" });
      }
      res.json({
        status: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal server",
      });
    }
  });
};
