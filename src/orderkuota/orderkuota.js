// Import dependencies
const { URLSearchParams } = require('url');
const crypto = require("crypto");
const QRCode = require('qrcode');
const { ImageUploadService } = require('node-upload-images');
// Pastikan node-fetch@2 diinstal: npm install node-fetch@2
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// --- Class OrderKuota ---
// (Class ini sama persis seperti yang kamu berikan)
class OrderKuota {
  static API_URL = 'https://app.orderkuota.com:443/api/v2';
  static API_URL_ORDER = 'https://app.orderkuota.com:443/api/v2/order';
  static HOST = 'app.orderkuota.com';
  static USER_AGENT = 'okhttp/4.10.0';
  static APP_VERSION_NAME = '25.03.14';
  static APP_VERSION_CODE = '250314';
  static APP_REG_ID = 'di309HvATsaiCppl5eDpoc:APA91bFUcTOH8h2XHdPRz2qQ5Bezn-3_TaycFcJ5pNLGWpmaxheQP9Ri0E56wLHz0_b1vcss55jbRQXZgc9loSfBdNa5nZJZVMlk7GS1JDMGyFUVvpcwXbMDg8tjKGZAurCGR4kDMDRJ';

  constructor(username = null, authToken = null) {
    this.username = username;
    this.authToken = authToken;
  }

  async loginRequest(username, password) {
    const payload = new URLSearchParams({
      username,
      password,
      app_reg_id: OrderKuota.APP_REG_ID,
      app_version_code: OrderKuota.APP_VERSION_CODE,
      app_version_name: OrderKuota.APP_VERSION_NAME,
    });
    return await this.request('POST', `${OrderKuota.API_URL}/login`, payload);
  }

  async getAuthToken(username, otp) {
    const payload = new URLSearchParams({
      username,
      password: otp, // OTP digunakan sebagai password di sini
      app_reg_id: OrderKuota.APP_REG_ID,
      app_version_code: OrderKuota.APP_VERSION_CODE,
      app_version_name: OrderKuota.APP_VERSION_NAME,
    });
    // Menggunakan endpoint login yang sama
    return await this.request('POST', `${OrderKuota.API_URL}/login`, payload);
  }

  async getTransactionQris(type = '') {
    const payload = new URLSearchParams({
      auth_token: this.authToken,
      auth_username: this.username,
      'requests[qris_history][jumlah]': '',
      'requests[qris_history][jenis]': type,
      'requests[qris_history][page]': '1',
      'requests[qris_history][dari_tanggal]': '',
      'requests[qris_history][ke_tanggal]': '',
      'requests[qris_history][keterangan]': '',
      'requests[0]': 'qris_history', // Koreksi: Seharusnya 'qris_history' agar sesuai request
      app_version_name: OrderKuota.APP_VERSION_NAME,
      app_version_code: OrderKuota.APP_VERSION_CODE,
      app_reg_id: OrderKuota.APP_REG_ID,
    });
    return await this.request('POST', `${OrderKuota.API_URL}/get`, payload);
  }

  buildHeaders() {
    return {
      'Host': OrderKuota.HOST,
      'User-Agent': OrderKuota.USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  async request(method, url, body = null) {
    try {
      const res = await fetch(url, {
        method,
        headers: this.buildHeaders(),
        body: body ? body.toString() : null,
        timeout: 15000 // Tambahkan timeout
      });

      // Cek status code sebelum parsing
      if (!res.ok) {
        // Coba baca error text jika ada
        let errorText = await res.text().catch(() => `HTTP error ${res.status}`);
        try {
            // Jika error text adalah JSON, parse dan ambil message
            const errorJson = JSON.parse(errorText);
            if (errorJson && errorJson.message) {
                errorText = errorJson.message;
            }
        } catch(e) { /* Abaikan jika bukan JSON */ }
        throw new Error(errorText || `HTTP error ${res.status}`);
      }


      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      } else {
        // Jika bukan JSON, kembalikan sebagai teks (mungkin error HTML atau teks biasa)
        const textResponse = await res.text();
        console.warn("Orderkuota response was not JSON:", textResponse.substring(0, 200)); // Log peringatan
        // Coba parse jika mungkin JSON tapi content-type salah
         try {
             return JSON.parse(textResponse);
         } catch (e) {
             return { status: false, message: "Received non-JSON response from Orderkuota", raw_response: textResponse.substring(0, 500) };
         }
      }
    } catch (err) {
      console.error("Orderkuota request error:", err); // Log error lebih detail
      return { status: false, error: err.message || "Request failed" }; // Kembalikan struktur error standar
    }
  }
}

// --- Helper Functions ---
// (Helper functions sama persis seperti yang kamu berikan)
function convertCRC16(str) {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ("000" + (crc & 0xFFFF).toString(16).toUpperCase()).slice(-4);
}

function generateTransactionId() {
  // Membuat ID yang lebih unik dan standar
  const timestamp = Date.now().toString(36); // Bagian waktu
  const randomPart = crypto.randomBytes(4).toString('hex'); // Bagian acak
  return `RK-${timestamp}-${randomPart}`.toUpperCase();
}

function generateExpirationTime(minutes = 30) {
  // Format ISO string lebih standar
  const expirationTime = new Date();
  expirationTime.setMinutes(expirationTime.getMinutes() + minutes);
  return expirationTime.toISOString(); // Contoh: "2025-10-26T10:30:00.000Z"
}

async function elxyzFile(buffer) {
    try {
        // Menggunakan pixhost.to dari node-upload-images
        const service = new ImageUploadService('pixhost.to');
        // Memberi nama file sementara saat upload
        const { directLink } = await service.uploadFromBinary(buffer, `qris-${Date.now()}.png`);
        if (!directLink) {
            throw new Error('Upload to pixhost.to failed, no direct link returned.');
        }
        return directLink;
    } catch (error) {
        console.error("Image upload error:", error);
        throw new Error("Gagal mengunggah gambar QRIS."); // Beri pesan error yang lebih jelas
    }
}


async function createQRIS(amount, codeqr) {
  // Validasi dasar input
  if (!amount || isNaN(parseInt(amount)) || parseInt(amount) <= 0) {
      throw new Error("Jumlah (amount) tidak valid.");
  }
   if (!codeqr || typeof codeqr !== 'string' || codeqr.length < 10) { // Panjang minimal asal
       throw new Error("Kode QR dasar tidak valid.");
   }

  let qrisData = codeqr.slice(0, -4); // Hapus CRC lama
  // Pastikan format dasar QRIS ada
  if (!qrisData.includes("5802ID") || !qrisData.includes("5303360")) { // Cek IDR dan Indonesia
      console.warn("Format kode QR dasar mungkin tidak standar:", codeqr);
      // throw new Error("Format kode QR dasar tidak standar."); // Bisa lebih ketat jika perlu
  }

  const step1 = qrisData.replace("010211", "010212"); // Set QRIS dinamis
  const step2 = step1.split("5802ID"); // Split berdasarkan kode negara
  if (step2.length !== 2) {
      throw new Error("Gagal memproses kode QR dasar (split error).");
  }

  amount = parseInt(amount).toString(); // Pastikan amount adalah string angka bersih
  let amountField = "54" + ("0" + amount.length).slice(-2) + amount; // Format amount TLV
  let countryCodeField = "5802ID"; // Kode Negara

  // Gabungkan kembali dengan amount di tengah
  const finalPayload = step2[0] + amountField + countryCodeField + step2[1];

  // Hitung CRC16 baru
  const newCRC = convertCRC16(finalPayload);
  const result = finalPayload + newCRC;

  try {
      const buffer = await QRCode.toBuffer(result);
      const uploadedFileUrl = await elxyzFile(buffer); // Upload buffer QR code

      return {
          idtransaksi: generateTransactionId(),
          jumlah: parseInt(amount), // Kembalikan sebagai angka
          expired: generateExpirationTime(), // Gunakan format ISO
          imageqris: {
              url: uploadedFileUrl
          }
      };
  } catch (error) {
      console.error("Error creating or uploading QRIS:", error);
      throw new Error("Gagal membuat atau mengunggah gambar QRIS: " + error.message);
  }
}


// --- Export Fungsi Route ---
module.exports = function (app, log) { // Terima app dan log
  log.info('[ORDERKUOTA] Routes Initialized'); // Tambahkan log

  // === Route untuk mendapatkan OTP ===
  app.get("/orderkuota/getotp", async (req, res) => {
    const { apikey, username, password } = req.query;

    // Cek API Key (lapisan kedua setelah middleware)
    if (!global.apikey.includes(apikey)) {
      log.warn(`[ORDERKUOTA] Invalid API Key attempt on /getotp: ${apikey} from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }
    // Cek parameter
    if (!username) return res.status(400).json({ status: false, error: 'Parameter username diperlukan' });
    if (!password) return res.status(400).json({ status: false, error: 'Parameter password diperlukan' });

    log.info(`[ORDERKUOTA] /getotp request from user: ${username}, IP: ${req.ip}`);
    try {
      const ok = new OrderKuota();
      const loginResult = await ok.loginRequest(username, password);

      // Cek hasil dari OrderKuota
      if (loginResult && loginResult.status === false) {
           log.error(`[ORDERKUOTA] Login request failed for ${username}: ${loginResult.error || loginResult.message}`);
           // Sesuaikan status code berdasarkan error jika memungkinkan
           let statusCode = 500;
           if (typeof loginResult.error === 'string' && (loginResult.error.includes('Username atau Password Salah') || loginResult.error.includes('credentials'))) {
               statusCode = 401; // Unauthorized
           }
           return res.status(statusCode).json({ status: false, error: loginResult.error || loginResult.message || "Gagal menghubungi Orderkuota." });
      }

      // Jika berhasil, kirim hasilnya
      log.info(`[ORDERKUOTA] Login request successful for ${username}, OTP might be needed.`);
      res.json({ status: true, result: loginResult.results || loginResult }); // Kirim results jika ada

    } catch (err) {
      log.error(`[ORDERKUOTA] Error on /getotp for ${username}:`, err);
      res.status(500).json({ status: false, error: err.message || "Terjadi kesalahan internal server." });
    }
  });

  // === Route untuk mendapatkan Auth Token setelah OTP ===
  app.get("/orderkuota/gettoken", async (req, res) => {
    const { apikey, username, otp } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[ORDERKUOTA] Invalid API Key attempt on /gettoken: ${apikey} from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }
    if (!username) return res.status(400).json({ status: false, error: 'Parameter username diperlukan' });
    if (!otp) return res.status(400).json({ status: false, error: 'Parameter otp diperlukan' });

    log.info(`[ORDERKUOTA] /gettoken request from user: ${username}, IP: ${req.ip}`);
    try {
      const ok = new OrderKuota();
      const tokenResult = await ok.getAuthToken(username, otp);

      if (tokenResult && tokenResult.status === false) {
           log.error(`[ORDERKUOTA] Get token failed for ${username}: ${tokenResult.error || tokenResult.message}`);
           let statusCode = 500;
           if (typeof tokenResult.error === 'string' && (tokenResult.error.includes('OTP Salah') || tokenResult.error.includes('credentials'))) {
               statusCode = 401; // Unauthorized
           }
           return res.status(statusCode).json({ status: false, error: tokenResult.error || tokenResult.message || "Gagal mendapatkan token." });
      }

      log.info(`[ORDERKUOTA] Get token successful for ${username}.`);
      res.json({ status: true, result: tokenResult.results || tokenResult }); // Kirim results jika ada

    } catch (err) {
      log.error(`[ORDERKUOTA] Error on /gettoken for ${username}:`, err);
      res.status(500).json({ status: false, error: err.message || "Terjadi kesalahan internal server." });
    }
  });

  // === Route untuk cek mutasi QRIS ===
  app.get("/orderkuota/mutasiqr", async (req, res) => {
    const { apikey, username, token } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[ORDERKUOTA] Invalid API Key attempt on /mutasiqr: ${apikey} from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }
    if (!username) return res.status(400).json({ status: false, error: 'Parameter username diperlukan' });
    if (!token) return res.status(400).json({ status: false, error: 'Parameter token diperlukan' });

    log.info(`[ORDERKUOTA] /mutasiqr request from user: ${username}, IP: ${req.ip}`);
    try {
      const ok = new OrderKuota(username, token); // Gunakan username & token
      const data = await ok.getTransactionQris(); // Ambil transaksi QRIS

      if (data && data.status === false) {
          log.error(`[ORDERKUOTA] Get QRIS mutation failed for ${username}: ${data.error || data.message}`);
          let statusCode = 500;
           if (typeof data.error === 'string' && (data.error.includes('Token tidak valid') || data.error.includes('Unauthorized'))) {
               statusCode = 401; // Unauthorized
           }
          return res.status(statusCode).json({ status: false, error: data.error || data.message || "Gagal mengambil mutasi QRIS." });
      }

      // Filter hanya transaksi yang masuk (status "IN")
      let history = [];
      if (data && data.qris_history && data.qris_history.results && Array.isArray(data.qris_history.results)) {
         history = data.qris_history.results.filter(e => e.status === "IN");
         log.info(`[ORDERKUOTA] Found ${history.length} incoming QRIS transactions for ${username}.`);
      } else {
         log.warn(`[ORDERKUOTA] Unexpected QRIS history structure received for ${username}:`, data);
      }

      res.json({ status: true, result: history });

    } catch (err) {
      log.error(`[ORDERKUOTA] Error on /mutasiqr for ${username}:`, err);
      res.status(500).json({ status: false, error: err.message || "Terjadi kesalahan internal server." });
    }
  });

  // === Route untuk membuat QRIS Payment ===
  app.get("/orderkuota/createpayment", async (req, res) => {
    const { apikey, amount, codeqr } = req.query;

    if (!global.apikey.includes(apikey)) {
      log.warn(`[ORDERKUOTA] Invalid API Key attempt on /createpayment: ${apikey} from IP: ${req.ip}`);
      return res.status(403).json({ status: false, error: 'Apikey invalid' });
    }
    if (!amount) return res.status(400).json({ status: false, error: 'Parameter amount diperlukan' });
    if (!codeqr) return res.status(400).json({ status: false, error: 'Parameter codeqr diperlukan' });

    log.info(`[ORDERKUOTA] /createpayment request for amount: ${amount}, IP: ${req.ip}`);
    try {
      const qrData = await createQRIS(amount, codeqr);
      log.info(`[ORDERKUOTA] QRIS created successfully for amount: ${amount}, ID: ${qrData.idtransaksi}`);
      res.status(200).json({ status: true, result: qrData });
    } catch (error) {
      log.error(`[ORDERKUOTA] Error on /createpayment for amount ${amount}:`, error);
      res.status(500).json({ status: false, error: error.message || "Gagal membuat QRIS payment." });
    }
  });

  // [MODIFIKASI] Tambahkan route cek status dari settings.json
  // Endpoint ini belum ada implementasinya di kode class OrderKuota yang kamu berikan
  // Jadi, kita buat placeholder atau response error sementara
  app.get("/orderkuota/cekstatus", async (req, res) => {
       const { apikey, merchant, keyorkut } = req.query; // Sesuai path di settings.json

       if (!global.apikey.includes(apikey)) {
           log.warn(`[ORDERKUOTA] Invalid API Key attempt on /cekstatus: ${apikey} from IP: ${req.ip}`);
           return res.status(403).json({ status: false, error: 'Apikey invalid' });
       }
       if (!merchant || !keyorkut) {
           return res.status(400).json({ status: false, error: 'Parameter merchant dan keyorkut diperlukan' });
       }

       log.warn(`[ORDERKUOTA] /cekstatus called for merchant ${merchant}, key ${keyorkut}. Endpoint not implemented yet.`);

       // Karena belum ada fungsinya di class OrderKuota, kita beri response error sementara
       res.status(501).json({ status: false, error: "Fungsi cek status payment belum diimplementasikan." });

       // Nanti jika sudah ada fungsi di class OrderKuota, contohnya:
       /*
       try {
           const ok = new OrderKuota(YOUR_USERNAME, YOUR_TOKEN); // Butuh cara handle auth di sini
           const statusResult = await ok.checkPaymentStatus(merchant, keyorkut);
           if (statusResult && statusResult.status === false) {
               return res.status(500).json({ status: false, error: statusResult.error || "Gagal cek status." });
           }
           res.json({ status: true, result: statusResult });
       } catch (error) {
           log.error(`[ORDERKUOTA] Error on /cekstatus:`, error);
           res.status(500).json({ status: false, error: error.message || "Internal server error." });
       }
       */
  });

}; // Akhir dari module.exports