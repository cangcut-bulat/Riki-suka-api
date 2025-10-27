const axios = require("axios");

/**
 * Flux Image Generator (Adapted for Express Route)
 * Utility function to generate images from nihalgazi-flux-unlimited.hf.space.
 *
 * @param {string} prompt - The text prompt describing the desired image.
 * @param {number} width - Image width.
 * @param {number} height - Image height.
 * @param {string} server - Server name for generation.
 * @param {object} log - Logger object.
 * @returns {Promise<string>} - Returns the generated image URL.
 * @throws {Error} - Throws an error if generation fails.
 *
 * LIST SERVERS:
 * NSFW-Core: Uncensored Server
 * NSFW-Core: Uncensored Server 2
 * NSFW-Core: Uncensored Server 3
 * NSFW-Core: Uncensored Server 4
 * Azure Lite Supercomputer Server
 * Artemis GPU Super cluster
 * NebulaDrive Tensor Server
 * PixelNet NPU Server
 * Google US Server
 */
async function generateFluxImage(prompt, width, height, server, log) {
    try {
        log.info(`[FLUX] Initiating image generation. Prompt: "${prompt.substring(0, 50)}...", Size: ${width}x${height}, Server: ${server}`);

        // 1. Initiate Generation
        const initResponse = await axios.post(
            "https://nihalgazi-flux-unlimited.hf.space/gradio_api/call/generate_image",
            { data: [prompt, width, height, 3, true, server] }, // Parameter sesuai API eksternal
            {
                headers: {
                    "Content-Type": "application/json",
                    Origin: "https://chrunos.com", // Header penting mungkin
                    Referer: "https://chrunos.com/",
                    "User-Agent": "Rikishopreal-API/1.0 axios/1.x", // Custom User-Agent
                },
                timeout: 20000, // Timeout 20 detik untuk inisiasi
            }
        );

        const eventId = initResponse.data?.event_id;
        if (!eventId) {
            log.error("[FLUX] Failed to obtain event_id from initial response:", initResponse.data);
            throw new Error("Gagal memulai proses generasi gambar (tidak ada event_id).");
        }
        log.info(`[FLUX] Generation initiated. Event ID: ${eventId}`);

        // 2. Poll for Result URL
        const streamUrl = `https://nihalgazi-flux-unlimited.hf.space/gradio_api/call/generate_image/${eventId}`;
        let imageUrl = null;
        const maxAttempts = 15; // Jumlah percobaan polling
        const pollInterval = 2500; // Jeda antar polling (ms)

        for (let i = 0; i < maxAttempts; i++) {
            log.info(`[FLUX] Polling attempt ${i + 1}/${maxAttempts} for Event ID: ${eventId}`);
            try {
                const streamResponse = await axios.get(streamUrl, {
                    headers: {
                        Accept: "text/event-stream", // Header sesuai contoh
                        "User-Agent": "Rikishopreal-API/1.0 axios/1.x",
                    },
                    timeout: 10000, // Timeout 10 detik untuk polling
                });

                // Cari URL dalam data respons (bisa jadi beberapa event, cari yang terakhir)
                const responseText = streamResponse.data;
                const urlMatches = responseText.match(/"url":\s*"([^"]+)"/g); // Cari semua kemunculan URL

                if (urlMatches && urlMatches.length > 0) {
                    // Ambil URL terakhir
                    const lastMatch = urlMatches[urlMatches.length - 1];
                    const urlExtract = lastMatch.match(/"url":\s*"([^"]+)"/);
                    if (urlExtract && urlExtract[1]) {
                        imageUrl = urlExtract[1];
                        log.info(`[FLUX] Image URL found: ${imageUrl}`);
                        break; // Hentikan loop jika URL ditemukan
                    }
                }

                // Jika belum ada URL, tunggu sebelum polling lagi
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            } catch (pollError) {
                // Tangani error polling (misal timeout), tapi lanjutkan loop
                log.warn(`[FLUX] Polling attempt ${i + 1} failed: ${pollError.message}. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, pollInterval)); // Tunggu sebelum coba lagi
            }
        }

        if (!imageUrl) {
            log.error(`[FLUX] Failed to retrieve image URL after ${maxAttempts} attempts for Event ID: ${eventId}`);
            throw new Error("Gagal mendapatkan URL gambar setelah beberapa percobaan. Coba lagi nanti.");
        }

        return imageUrl; // Kembalikan URL jika berhasil

    } catch (error) {
        log.error("[FLUX] General error in generateFluxImage:", error.message);
        // Throw error yang lebih spesifik jika memungkinkan (dari error axios)
        if (axios.isAxiosError(error)) {
             if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                throw new Error("Request timeout - API eksternal Flux tidak merespon.");
            } else if (error.response) {
                log.error(`[FLUX] External API error details: Status=${error.response.status}, Data=${JSON.stringify(error.response.data)}`);
                throw new Error(`API eksternal Flux error: ${error.response.status} - ${error.response.statusText || 'Unknown error'}`);
            } else if (error.request) {
                throw new Error("Tidak dapat terhubung ke API eksternal Flux.");
            }
        }
        // Rethrow error umum atau error asli jika bukan dari axios
        throw new Error(error.message || "Terjadi kesalahan saat memproses gambar Flux.");
    }
}


// Export the route function
module.exports = function(app, log) {
    log.info('[FLUX] Route Initialized');

    app.get('/imagecreator/flux', async (req, res) => {
        const {
            apikey,
            prompt,
            width: widthParam, // Ambil parameter width
            height: heightParam, // Ambil parameter height
            server: serverParam // Ambil parameter server
        } = req.query;

        // API Key Check (Sesuaikan jika perlu)
        // if (!global.apikey.includes(apikey)) {
        //   log.warn(`[FLUX GET] Invalid API Key: ${apikey} from IP: ${req.ip}`);
        //   return res.status(403).json({ status: false, error: 'Apikey invalid' });
        // }

        // --- Parameter Validation ---
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ status: false, error: "Parameter 'prompt' diperlukan dan tidak boleh kosong." });
        }

        // Validasi dan set default untuk width
        let width = 1024; // Default
        if (widthParam) {
            const parsedWidth = parseInt(String(widthParam));
            if (!isNaN(parsedWidth) && parsedWidth > 0) {
                width = Math.min(parsedWidth, 2048); // Batasi maks width (misalnya 2048)
            } else {
                return res.status(400).json({ status: false, error: "Parameter 'width' harus berupa angka positif." });
            }
        }

        // Validasi dan set default untuk height
        let height = 1024; // Default
        if (heightParam) {
            const parsedHeight = parseInt(String(heightParam));
            if (!isNaN(parsedHeight) && parsedHeight > 0) {
                height = Math.min(parsedHeight, 2048); // Batasi maks height
            } else {
                return res.status(400).json({ status: false, error: "Parameter 'height' harus berupa angka positif." });
            }
        }

        // Validasi server (opsional tapi bagus)
        const validServers = [
             "NSFW-Core: Uncensored Server",
             "NSFW-Core: Uncensored Server 2",
             "NSFW-Core: Uncensored Server 3",
             "NSFW-Core: Uncensored Server 4",
             "Azure Lite Supercomputer Server",
             "Artemis GPU Super cluster",
             "NebulaDrive Tensor Server",
             "PixelNet NPU Server",
             "Google US Server"
        ];
        // Gunakan default jika tidak ada atau tidak valid
        const server = serverParam && validServers.includes(String(serverParam)) ? String(serverParam) : "Google US Server"; // Default ke Google US Server


        log.info(`[FLUX GET] Request received. Prompt: "${prompt.substring(0, 30)}...", Size: ${width}x${height}, Server: ${server}, IP: ${req.ip}`);

        try {
            const imageUrl = await generateFluxImage(prompt.trim(), width, height, server, log);

            // Jika berhasil, kirim response JSON dengan URL gambar
            res.json({
                status: true,
                result: {
                    image_url: imageUrl
                }
            });

        } catch (error) {
            log.error("[FLUX GET] Handler error:", error);
            // Kirim response error JSON
            res.status(500).json({
                status: false,
                error: error.message || "Terjadi kesalahan internal saat membuat gambar."
            });
        }
    });

}; // End module.exports
