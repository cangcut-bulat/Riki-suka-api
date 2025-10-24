const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function(app) {
    async function scrape() {
        // Ambil halaman acak antara 1 dan 20
        const page = Math.floor(20 * Math.random()) + 1;
        const url = `https://rimbakita.com/daftar-nama-hewan-lengkap/${page}/`;
        console.log(`[TebakHewan] Mencoba scrape dari: ${url}`);

        try {
            // Menambahkan lebih banyak header untuk meniru browser
            const response = await axios.get(url, {
                timeout: 30000, // Waktu tunggu 30 detik
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': 'https://www.google.com/' // Pura-pura datang dari Google
                },
            });

            const html = response.data;
            const $ = cheerio.load(html);

            const json = $("div.entry-content.entry-content-single img[class*=wp-image-][data-src]")
              .map((_, el) => {
                const src = $(el).attr("data-src");
                if (!src) return null;

                const titleMatch = src.split("/").pop();
                const title = titleMatch ? titleMatch.replace(/-/g, " ").replace(/\.\w+$/, "") : "Hewan Tidak Dikenal";
                
                return {
                  title: title.charAt(0).toUpperCase() + title.slice(1),
                  url: src,
                };
              })
              .get()
              .filter((item) => item !== null);

            if (json.length === 0) {
                // Jika tidak menemukan apa-apa, coba scrape lagi (rekursif dengan batasan)
                console.warn("[TebakHewan] Tidak ada data ditemukan, mencoba lagi...");
                // Ini bisa menjadi loop tak terbatas jika situs selalu kosong, jadi kita batasi
                // Untuk sekarang, kita lempar error saja agar tidak terjadi loop
                throw new Error("Tidak ada data hewan ditemukan di halaman yang di-scrape");
            }
            
            return json[Math.floor(Math.random() * json.length)];

        } catch (error) {
            // Memberikan pesan error yang lebih spesifik
            if (error.code === 'EHOSTUNREACH') {
                 console.error("[TebakHewan] API Error: Tidak bisa menjangkau host rimbakita.com. Kemungkinan diblokir oleh firewall hosting.");
                 throw new Error("Tidak bisa terhubung ke sumber data. Kemungkinan diblokir oleh firewall.");
            }
            console.error("[TebakHewan] API Error (scrape):", error.message);
            throw error;
        }
    }

    const handleRequest = async (req, res) => {
        try {
            const apikey = req.query.apikey; // Hanya perlu dari query untuk GET
            if (!global.apikey.includes(apikey)) {
                return res.status(403).json({ status: false, error: 'Apikey invalid' });
            }
            const result = await scrape();
            res.status(200).json({ status: true, result: result });
        } catch (error) {
            console.error(`[tebakhewan] Final Error:`, error.message);
            // Mengirim respons JSON yang konsisten saat error
            res.status(500).json({ 
                status: false, 
                message: "Gagal mengambil data tebak hewan.",
                error: error.message 
            });
        }
    };

    // Hanya menggunakan GET karena kita tidak mengirim body
    app.get('/games/tebakhewan', handleRequest);
};

