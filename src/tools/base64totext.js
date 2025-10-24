const { Buffer } = require('buffer');

module.exports = function(app) {
    async function scrape(base64) {
      try {
        const text = Buffer.from(base64, "base64").toString("utf-8");
        // Cek jika hasil decode tidak valid (mengandung karakter aneh)
        if (text.includes(String.fromCharCode(65533))) {
             throw new Error("Karakter tidak valid terdeteksi, mungkin bukan Base64 UTF-8");
        }
        return { text: text };
      } catch (error) {
        console.error("Base64 decode error:", error.message);
        throw new Error("String Base64 tidak valid.");
      }
    }

    const handleRequest = async (req, res) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const { apikey, base64 } = params; // Ganti nama parameter

            // 1. Validasi API Key
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }

            // 2. Validasi Parameter 'base64'
            if (!base64 || typeof base64 !== "string" || base64.trim().length === 0) {
                return res.status(400).json({ status: false, error: "Parameter 'base64' wajib diisi" });
            }
             if (base64.length > 5000) {
                 return res.status(400).json({ status: false, error: "Input terlalu panjang (maks 5000 char)" });
            }

            // 3. Panggil helper
            const result = await scrape(base64.trim());

            // 4. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                result: result
            });

        } catch (error) {
            // 5. Tangani Error
            console.error(`[base642text ${req.method}] Error:`, error.message);
            res.json({ status: false, error: error.message });
        }
    };

    app.get('/tools/base642text', handleRequest);
    app.post('/tools/base642text', handleRequest);
};
