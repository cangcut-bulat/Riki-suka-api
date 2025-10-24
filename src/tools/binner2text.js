const { Buffer } = require('buffer');

module.exports = function(app) {
    async function scrapeBinary(content) {
        try {
            const text = content.split(" ")
                .map((bin) => {
                    // Validasi simpel: cek jika bukan 0 atau 1, atau terlalu panjang
                    if (!/^[01]+$/.test(bin) || bin.length > 16) { 
                        throw new Error(`Format binary tidak valid: '${bin}'`);
                    }
                    return String.fromCharCode(parseInt(bin, 2));
                })
                .join("");
             // Cek jika hasil decode aneh
             if (text.includes(String.fromCharCode(65533)) || text.length === 0) {
                 throw new Error("Input binary tidak valid atau tidak bisa di-decode");
             }
            return { text: text };
        } catch (error) {
             console.error("Binary decode error:", error.message);
             throw new Error(error.message || "Input binary tidak valid");
        }
    }

    const handleRequest = async (req, res) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const { apikey, content } = params;

            // 1. Validasi API Key
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }

            // 2. Validasi Parameter 'content'
            if (!content || typeof content !== "string" || content.trim().length === 0) {
                return res.status(400).json({ status: false, error: "Parameter 'content' wajib diisi" });
            }
            if (content.length > 5000) {
                 return res.status(400).json({ status: false, error: "Input terlalu panjang (maks 5000 char)" });
            }

            // 3. Panggil helper
            const result = await scrapeBinary(content.trim());

            // 4. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                result: result
            });

        } catch (error) {
            // 5. Tangani Error
            console.error(`[binary2text ${req.method}] Error:`, error.message);
            res.json({ status: false, error: error.message });
        }
    };

    app.get('/tools/binary2text', handleRequest);
    app.post('/tools/binary2text', handleRequest);
};
