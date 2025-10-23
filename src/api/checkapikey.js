const moment = require('moment-timezone'); // Untuk format tanggal

// Terima 'log' sebagai parameter kedua
module.exports = function (app, log) {

    app.get('/api/checkapikey', async (req, res) => {
        const providedKey = req.query.key;

        // --- 1. Validasi Input ---
        if (!providedKey) {
            return res.status(400).json({ // 400 Bad Request
                status: false,
                error: "Parameter 'key' diperlukan.",
                message: "Silakan masukkan API key yang ingin diperiksa pada parameter 'key'."
            });
        }

        try {
            // --- 2. Cek Apakah Kunci Valid Sama Sekali ---
            // Kita cek di global.apikey karena ini berisi SEMUA kunci yang valid (default, custom, undefined)
            if (!global.apikey.includes(providedKey) && providedKey !== undefined ) {
                return res.status(404).json({ // 404 Not Found
                    status: false,
                    error: "API Key tidak valid.",
                    message: `API Key '${providedKey}' tidak ditemukan atau tidak terdaftar.`
                });
            }

            // --- 3. Cek Kunci Kustom ---
            // [MODIFIKASI] Gunakan global.customApiKeys
            const customKeyData = global.customApiKeys[providedKey];
            if (customKeyData) {
                const now = Date.now();
                const isExpired = customKeyData.expires && now >= customKeyData.expires;
                const isOutOfLimit = customKeyData.limit > 0 && (customKeyData.count || 0) >= customKeyData.limit;
                const remainingLimit = customKeyData.limit === 0 ? '∞ (Unlimited)' : Math.max(0, customKeyData.limit - (customKeyData.count || 0));

                let statusKey = "🟢 Aktif";
                if (isExpired) statusKey = "🔴 Kedaluwarsa";
                else if (isOutOfLimit) statusKey = "🟠 Limit Habis";

                return res.json({
                    status: true,
                    message: "Detail API Key Kustom ditemukan.",
                    result: {
                        key: providedKey,
                        type: "Kustom ✨",
                        owner_name: customKeyData.name || "N/A",
                        status: statusKey,
                        limit_request: customKeyData.limit === 0 ? '∞ (Unlimited)' : customKeyData.limit.toString(),
                        usage_today: (customKeyData.count || 0).toString(),
                        remaining_limit: remainingLimit.toString(),
                        created_at: customKeyData.createdAt ? moment(customKeyData.createdAt).tz('Asia/Jakarta').format('DD MMM YYYY, HH:mm:ss') : "N/A",
                        expires_at: customKeyData.expires ? moment(customKeyData.expires).tz('Asia/Jakarta').format('DD MMM YYYY, HH:mm:ss') : "Selamanya",
                        note: "Kunci ini memiliki limit dan masa aktif sendiri, mengabaikan limit IP global."
                    }
                });
            }

            // --- 4. Cek Kunci Default ---
            // [MODIFIKASI] Gunakan global.settings
            if (global.settings.apikey && global.settings.apikey.includes(providedKey)) {
                return res.json({
                    status: true,
                    message: "API Key Default terdeteksi.",
                    result: {
                        key: providedKey,
                        type: "Default 🛡️",
                        owner_name: "Server Default",
                        status: "🟢 Aktif",
                        limit_request: `Mengikuti IP (${global.currentDailyLimit === 0 ? '∞' : global.currentDailyLimit}/IP)`,
                        usage_today: "Lihat /api/my-stats",
                        remaining_limit: "Lihat /api/my-stats",
                        created_at: "N/A",
                        expires_at: "Selamanya",
                        note: "Kunci ini menggunakan sistem limit harian berbasis IP Address."
                    }
                });
            }

             // --- 5. Handle Kasus 'undefined' ---
            if (providedKey === undefined || providedKey === 'undefined') { return res.status(400).json({ status: false, error: "Tidak ada API Key.", message: "Anda tidak memasukkan API Key. Akses untuk endpoint publik akan menggunakan limit IP." }); }

            // --- 6. Fallback ---
            // Log ini mungkin membantu jika ada kasus aneh
            log.warn(`[/api/checkapikey] Key '${providedKey}' lolos cek global tapi bukan custom/default/undefined.`);
            return res.status(500).json({ status: false, error: "Kesalahan Internal.", message: "Tidak dapat menentukan tipe API Key." });

        } catch (error) {
            // Gunakan 'log' yang sudah dioper
            log.error("[/api/checkapikey] Error:", error.message);
            // [BARU] Tambahkan stack trace ke log server jika ada error tak terduga
            if (error.stack) {
                console.error(error.stack);
            }
            res.status(500).json({ status: false, error: `Terjadi kesalahan internal saat memeriksa API Key.` });
        }
    });
}
