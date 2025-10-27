const axios = require("axios");

/**
 * Searches for subdomains using crt.sh.
 * @param {string} domain - The domain to search.
 * @param {object} log - Logger object.
 * @returns {Promise<Array<string>>} - A list of unique subdomains.
 */
async function searchSubdomains(domain, log) {
  const url = `https://crt.sh/?q=${domain}&output=json`;
  try {
    log.info(`[SubdomainFind] Searching for subdomains of: ${domain}`);
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = response.data;
    if (!Array.isArray(data)) {
        log.warn(`[SubdomainFind] Unexpected response format from crt.sh for ${domain}:`, data);
        throw new Error("Gagal memproses respons dari API (format tidak dikenal).");
    }

    const subdomains = data.map((entry) => entry.name_value);
    // Bersihkan duplikat dan urutkan
    const uniqueSubdomains = [...new Set(subdomains)];
    uniqueSubdomains.sort();
    
    log.info(`[SubdomainFind] Found ${uniqueSubdomains.length} unique subdomains for: ${domain}`);
    return uniqueSubdomains;
    
  } catch (error) {
    log.error("[SubdomainFind] Error fetching subdomains:", error.message);
     if (axios.isAxiosError(error)) {
         throw new Error(`Gagal menghubungi crt.sh: ${error.message}`);
    }
    throw new Error("Gagal mengambil data subdomain");
  }
}

module.exports = function(app, log) {
  log.info('[SubdomainFind] Routes Initialized');

  // --- GET Route ---
  app.get("/api/tools/subdomains", async (req, res) => {
    const { apikey, domain } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[SubdomainFind GET] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!domain) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' diperlukan" });
    }
    if (typeof domain !== "string" || domain.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' harus berupa string yang tidak kosong" });
    }

    try {
      const result = await searchSubdomains(domain.trim(), log);
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
  app.post("/api/tools/subdomains", async (req, res) => {
    const { apikey, domain } = req.body;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[SubdomainFind POST] Invalid API Key from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }

    if (!domain) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' diperlukan" });
    }
    if (typeof domain !== "string" || domain.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'domain' harus berupa string yang tidak kosong" });
    }

    try {
      const result = await searchSubdomains(domain.trim(), log);
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
