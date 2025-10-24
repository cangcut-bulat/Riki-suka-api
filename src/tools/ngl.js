const axios = require('axios');

module.exports = function(app) {
    async function submitAnswer(question, urlString) {
      try {
        const parsedUrl = new URL(urlString);
        const username = parsedUrl.pathname.split("/").filter(Boolean).pop();
        if (!username) { throw new Error("URL NGL tidak valid: tidak bisa ekstrak username."); }

        const postData = new URLSearchParams({ username, question, deviceId: "", gameSlug: "", referrer: "" });
        const axiosConfig = {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded", "Accept": "*/*",
            "X-Requested-With": "XMLHttpRequest", "User-Agent": "Mozilla/5.0", "Referer": urlString,
          },
          timeout: 30000,
        };
        // Hapus proxy()
        const { data } = await axios.post("https://ngl.link/api/submit", postData.toString(), axiosConfig);
        return data;
      } catch (error) {
        console.error("API Error (ngl scrape):", error.message);
        throw error.response?.data?.message || error;
      }
    }

    const handleRequest = async (req, res) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const { apikey, link, text } = params;

            // 1. Validasi API Key (Pola deepseek.js)
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }

            // 2. Validasi Parameter
            if (!link || typeof link !== "string" || link.trim().length === 0) {
                return res.status(400).json({ status: false, error: "Parameter 'link' wajib diisi" });
            }
            if (!text || typeof text !== "string" || text.trim().length === 0) {
                return res.status(400).json({ status: false, error: "Parameter 'text' wajib diisi" });
            }
            try { new URL(link.trim()); } catch (e) {
                 return res.status(400).json({ status: false, error: "Format link NGL tidak valid" });
            }

            // 3. Panggil helper
            const result = await submitAnswer(text.trim(), link.trim());

            // 4. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                result: result
            });

        } catch (error) {
            // 5. Tangani Error
            console.error(`[ngl ${req.method}] Error:`, error.message);
            res.json({ status: false, error: error.message });
        }
    };

    app.get('/tools/ngl', handleRequest);
    app.post('/tools/ngl', handleRequest);
};
