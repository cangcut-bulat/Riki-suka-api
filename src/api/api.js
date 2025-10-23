// Import modul 'os' untuk mendapatkan info sistem
const os = require('os');

// [MODIFIKASI] Terima 'log' sebagai parameter kedua
module.exports = function (app, log) {

    // Fungsi untuk menghitung jumlah endpoint API yang sebenarnya (mengabaikan middleware dll.)
    function countApiRoutes() {
        let count = 0;
        if (app._router && app._router.stack) {
            app._router.stack.forEach(layer => {
                if (layer.route && layer.route.path &&
                    !layer.route.path.startsWith('/api/admin/') &&
                    !layer.route.path.startsWith('/api/public/') &&
                    layer.route.path !== '/api/status' && layer.route.path !== '/api/my-stats' &&
                    layer.route.path !== '/api/endpoint-status' && layer.route.path !== '/api/get-endpoints' &&
                    layer.route.path !== '/' && layer.route.path !== '/admin' && layer.route.path !== '/admin-panel' &&
                    // [BARU] Jangan hitung checkapikey
                    layer.route.path !== '/api/checkapikey'
                    ) {
                     count++;
                }
            });
        }
        // Tidak perlu bagi dua jika GET & POST dianggap fitur beda atau tidak selalu ada keduanya
        return Math.max(1, count); // Pastikan minimal 1
    }

    // Fungsi format byte ke MB/GB
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024; const dm = decimals < 0 ? 0 : decimals; const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    app.get('/api/status', async (req, res) => {
        const startTime = Date.now(); // Catat waktu mulai request
        try {
            const memoryUsage = process.memoryUsage();
            const cpuInfo = os.cpus(); // Dapat info CPU
            const totalMem = os.totalmem(); // Total RAM server
            const freeMem = os.freemem(); // RAM bebas

            // Hitung ping (waktu respons)
            const responseTime = Date.now() - startTime;

            // Pastikan global.runtime ada sebelum dipanggil
            const serverUptime = typeof runtime === 'function' ? runtime() : 'N/A';
            if (serverUptime === 'N/A') log.warn("[/api/status] Fungsi global 'runtime' tidak ditemukan!");


            res.status(200).json({
                status: true,
                message: "Server Status Rikishopreal API",
                result: {
                    status: "🟢 Online",
                    server_time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
                    response_time: `${responseTime} ms`, // Kecepatan respon
                    // [MODIFIKASI] Tampilkan uptime dari fungsi runtime
                    server_uptime: serverUptime, // Uptime server (sudah termasuk hari)
                    total_request_today: global.totalreq.toString(), // Request hari ini
                    total_features: `${countApiRoutes()}`, // Jumlah fitur API
                    memory_usage: {
                        rss: formatBytes(memoryUsage.rss), // Resident Set Size
                        heapTotal: formatBytes(memoryUsage.heapTotal), // Total Heap Size
                        heapUsed: formatBytes(memoryUsage.heapUsed), // Heap Used
                        external: formatBytes(memoryUsage.external), // External Memory
                        server_total_ram: formatBytes(totalMem),
                        server_free_ram: formatBytes(freeMem)
                    },
                    platform: os.platform(), // OS Server (e.g., 'linux', 'win32')
                    cpu_model: cpuInfo[0]?.model || "N/A", // Model CPU
                    cpu_cores: cpuInfo.length, // Jumlah core CPU
                    hostname: os.hostname(), // Nama host server
                    domain_request: req.hostname // Domain yang diakses user
                }
            });
        } catch (error) {
            // [MODIFIKASI] Gunakan 'log' yang sudah dioper
            log.error("[/api/status] Error:", error.message);
            const responseTimeOnError = Date.now() - startTime;
            res.status(500).json({
                 status: false,
                 error: `Terjadi kesalahan internal. Silakan coba lagi nanti.`,
                 response_time: `${responseTimeOnError} ms`
            });
        }
    });
}
