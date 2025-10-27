const axios = require("axios");

/**
 * Scrapes DNS records from nslookup.io API.
 * @param {string} domain - The domain to lookup.
 * @param {string} dnsServer - The DNS server to use (e.g., "cloudflare").
 * @param {object} log - Logger object.
 * @returns {Promise<object>} - The DNS records result.
 */
async function scrape(domain, dnsServer, log) {
  try {
    log.info(`[DNS] Scraping DNS for ${domain} using ${dnsServer}`);
    const response = await axios.post(
      "https://www.nslookup.io/api/v1/records",
      {
        domain: domain,
        dnsServer: dnsServer,
      },
      {
        headers: {
          "accept": "application/json, text/plain, */*",
          "content-type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        timeout: 30000,
      },
    );
    return response.data.result || response.data;
  } catch (error) {
    log.error("[DNS] API Error:", error.message);
    if (axios.isAxiosError(error) && error.response) {
         log.error("[DNS] External API Response:", error.response.data);
         throw new Error(`Gagal mendapatkan respons dari API: ${error.response.statusText || error.message}`);
    }
    throw new Error("Gagal mendapatkan respons dari API DNS");
  }
}

module.exports = function(app, log) {
  log.info('[DNS] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/dns", async (req, res) => {
    const { apikey, domain, dnsServer } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[DNS GET] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!domain) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' diperlukan" });
    }
    if (typeof domain !== "string" || domain.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' harus berupa string yang tidak kosong" });
    }
    if (dnsServer && typeof dnsServer !== "string") {
      return res.status(400).json({ status: false, error: "Parameter 'dnsServer' harus berupa string" });
    }

    try {
      const result = await scrape(domain.trim(), (dnsServer || "cloudflare").trim(), log);
      if (!result || (result.records && Object.keys(result.records).length === 0)) {
        return res.status(404).json({ status: false, error: "Tidak ada data DNS yang ditemukan untuk domain tersebut" });
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
  app.post("/api/tools/dns", async (req, res) => {
    const { apikey, domain, dnsServer } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[DNS POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }
    
    if (!domain) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' diperlukan" });
    }
    if (typeof domain !== "string" || domain.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' harus berupa string yang tidak kosong" });
    }
    if (dnsServer && typeof dnsServer !== "string") {
      return res.status(400).json({ status: false, error: "Parameter 'dnsServer' harus berupa string" });
    }

    try {
      const result = await scrape(domain.trim(), (dnsServer || "cloudflare").trim(), log);
      if (!result || (result.records && Object.keys(result.records).length === 0)) {
        return res.status(404).json({ status: false, error: "Tidak ada data DNS yang ditemukan untuk domain tersebut" });
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
