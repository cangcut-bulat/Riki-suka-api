const axios = require('axios');

module.exports = function(app) {
    async function scrape(domain, dnsServer) {
      try {
        const response = await axios.post(
          "https://www.nslookup.io/api/v1/records",
          { domain: domain, dnsServer: dnsServer },
          {
            headers: { "accept": "application/json, text/plain, */*", "content-type": "application/json", "User-Agent": "Mozilla/5.0" },
            timeout: 30000,
          }
        );
        if (response.data && response.data.result) {
            return response.data.result;
        } else if (response.data) {
             return response.data;
        }
        throw new Error("Tidak ada data DNS ditemukan");
      } catch (error) {
        console.error("API Error (dns scrape):", error.message);
        throw error.response?.data || error;
      }
    }

    const handleRequest = async (req, res) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const { apikey, domain, dnsServer = "cloudflare" } = params;

            // 1. Validasi API Key
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }

            // 2. Validasi Parameter 'domain'
            if (!domain || typeof domain !== "string" || domain.trim().length === 0) {
                return res.status(400).json({ status: false, error: "Parameter 'domain' wajib diisi" });
            }

            // 3. Panggil helper
            const result = await scrape(domain.trim(), dnsServer.trim());

            // 4. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                result: result
            });

        } catch (error) {
            // 5. Tangani Error
            console.error(`[dns ${req.method}] Error:`, error.message);
            res.json({ status: false, error: error.message || "Gagal mengambil data DNS" });
        }
    };

    app.get('/tools/dns', handleRequest);
    app.post('/tools/dns', handleRequest);
};
