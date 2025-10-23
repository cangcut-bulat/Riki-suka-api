const axios = require('axios');
const FormData = require('form-data');
const { fileTypeFromBuffer } = require('file-type');
const { Buffer } = require('buffer');

module.exports = function(app) {
    // --- Helper Functions ---
    const ALLOWED_IMAGE_TYPES = [ "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff", "image/svg+xml" ];

    async function validateImageBuffer(buffer) {
        try {
            const fileType = await fileTypeFromBuffer(buffer);
            if (!fileType) { throw new Error("Tidak bisa deteksi tipe file"); }
            if (!ALLOWED_IMAGE_TYPES.includes(fileType.mime)) { throw new Error(`Tipe file tidak didukung: ${fileType.mime}`); }
            return { isValid: true, mime: fileType.mime, ext: fileType.ext };
        } catch (error) { return { isValid: false, error: error.message }; }
    }

    async function processImageIdentification(imageBuffer) {
        const form = new FormData();
        form.append("image", imageBuffer, { filename: "anime.jpg", contentType: "image/jpeg" });
        try {
            const response = await axios.post( "https://www.animefinder.xyz/api/identify", form,
                {
                    headers: { ...form.getHeaders(), "Origin": "https://www.animefinder.xyz", "Referer": "https://www.animefinder.xyz/", "User-Agent": "Mozilla/5.0" },
                    maxBodyLength: Infinity, timeout: 30000,
                }
            );
            const result = response.data;
            if (!result || !result.animeTitle) { throw new Error("Format respons API animefind tidak valid"); }
            return {
                anime: result.animeTitle, character: result.character, genres: result.genres,
                premiere: result.premiereDate, production: result.productionHouse,
                description: result.description, synopsis: result.synopsis, references: result.references || [],
            };
        } catch (error) {
            console.error("API Error (animefind):", error.message);
            throw new Error(error.response?.data?.error || "Gagal mengidentifikasi anime");
        }
    }
    // --- End Helper Functions ---

    // Rute GET (via URL)
    app.get('/tools/identify-anime', async (req, res) => {
        try {
            const { apikey, imageUrl } = req.query;

            // 1. Validasi API Key
            if (!global.apikey.includes(apikey)) { return res.json({ status: false, error: 'Apikey invalid' }); }

            // 2. Validasi Parameter 'imageUrl'
            if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim().length === 0) { return res.status(400).json({ status: false, error: "Parameter 'imageUrl' wajib diisi" }); }
            try { new URL(imageUrl.trim()); } catch (e) { return res.status(400).json({ status: false, error: "Format imageUrl tidak valid" }); }

            // 3. Ambil gambar dari URL
            const imageBufferResponse = await axios.get(imageUrl.trim(), { responseType: "arraybuffer", timeout: 30000 });
            const imageBuffer = Buffer.from(imageBufferResponse.data);
            
            // 4. Validasi buffer gambar
            const validation = await validateImageBuffer(imageBuffer);
            if (!validation.isValid) { return res.status(400).json({ status: false, error: validation.error || "File bukan gambar valid." }); }

            // 5. Panggil helper
            const result = await processImageIdentification(imageBuffer);

            // 6. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                result: {
                    ...result,
                    image_source: imageUrl.trim(), // Tambahkan URL asli
                }
            });

        } catch (error) {
            // 7. Tangani Error
            console.error(`[animefind GET] Error:`, error.message);
            res.json({ status: false, error: error.message });
        }
    });

    // Rute POST (Upload File) - Tidak Diimplementasikan
    app.post('/tools/identify-anime', async (req, res) => {
         const apikey = req.body.apikey || req.query.apikey;
         if (!global.apikey.includes(apikey)) { return res.json({ status: false, error: 'Apikey invalid' }); }
         console.error("[animefind POST] Error: File upload (guf) helper not implemented.");
         res.status(501).json({ status: false, error: 'Metode POST (upload file) tidak diimplementasikan di server ini. Gunakan GET dengan imageUrl.' });
    });
};
