# Rest-API-V1.1.1 BY RIKI SHOP

# Tentu! Ini adalah panduan lengkap untuk menjalankan proyek web Node.js (Express) Anda di VPS dan mengarahkannya ke domain Cloudflare (CF). Proyek Anda adalah aplikasi Express (berdasarkan index.js dan package.json) yang membutuhkan Node.js, bukan platform serverless seperti Vercel (file vercel.json tidak akan kita gunakan di sini).

# Berikut adalah langkah-langkahnya dari awal sampai akhir:
# Ringkasan Rencana
#  Persiapan VPS: Instal software yang diperlukan (Node.js, Git, PM2, Nginx).
#  Upload Kode: Ambil kode Anda dari GitHub ke VPS.
#  Setup Proyek: Buat file .env dan instal dependensi (npm install).
#  Jalankan Server: Gunakan pm2 agar server Anda terus berjalan.
#  Konfigurasi Cloudflare: Arahkan domain Anda ke IP VPS.
#  Konfigurasi Nginx: Siapkan reverse proxy agar domain Anda bisa mengakses aplikasi Node.js. *
 
/*_____________________________________________________________*/
 Langkah 1: Persiapan VPS (Server)
Asumsi Anda menggunakan VPS dengan Ubuntu 22.04. Silakan login ke VPS Anda melalui SSH.

 * Update Server: 
```
  sudo apt update && sudo apt upgrade -y
```

 * Install Node.js (v18.x direkomendasikan):
```
  curl -sL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
```

 * Cek versi nodejs jika 22 berarti berhasil 
```
node -v
```

 * Install Git (untuk mengambil kode):
```
  sudo apt install -y git
```

 * Install PM2 (Process Manager):
   Ini sangat penting agar aplikasi Node.js Anda tetap berjalan selamanya, bahkan setelah Anda menutup SSH atau server reboot.
```
   sudo npm install -g pm2
```

 * Install Nginx (Web Server / Reverse Proxy):
   Ini akan bertindak sebagai "penghubung" antara domain Anda (port 80/443) dan aplikasi Node.js Anda (yang berjalan di port 8000)
```.
   sudo apt install -y nginx
```

/*_____________________________________________________________*/
Langkah 2: Ambil & Konfigurasi Kode Proyek
 * Clone Proyek Anda:
   Saya sarankan Anda mengunggah semua file Anda ke repositori GitHub privat.
   # Ganti [URL_GITHUB_ANDA] dengan URL repo Anda
```
git clone https://github.com/username/repo.git api-web
cd api-web
```

   (File vercel.json tidak diperlukan di VPS, jadi Anda bisa menghapusnya atau mengabaikannya.)
 * Buat File .env:
   Aplikasi Anda (index.js) menggunakan require('dotenv').config(). Anda HARUS membuat file .env untuk menyimpan semua rahasia Anda.
```
nano .env
```

   Salin dan tempelkan konten berikut ke dalamnya, lalu isi nilainya:
```
# === KUNCI ADMIN ===
ADMIN_KEY=admin
ADMIN_PAGE_PASSWORD=hai

# === NOTIFIKASI TELEGRAM ===
# Ganti dengan Bot Token dari @BotFather
TELEGRAM_BOT_TOKEN=7115204744:AAFpEKhB5BI2QOr2BTG5JpTaIHxEqcEUAiY
# Ganti dengan Chat ID Anda atau Grup Anda
TELEGRAM_CHAT_ID=6240781143
SERVER_PORT=3000

# === LIMIT REQUEST ===
# Atur limit harian default untuk IP baru
DAILY_LIMIT=100
```
Tekan Ctrl+X, lalu Y, lalu Enter untuk menyimpan.
   
/*_____________________________________________________________*/
Langkah 3: Instalasi Dependensi Proyek
 * Install Modul Node.js:
```
   npm install
```

 * PENTING: Install Dependensi Puppeteer:
   package.json Anda menyertakan puppeteer. Puppeteer membutuhkan banyak pustaka sistem tambahan di Linux agar bisa berjalan. Jalankan perintah besar ini untuk menginstalnya:
   sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

/*_____________________________________________________________*/
Langkah 4: Jalankan Server dengan PM2
Sekarang aplikasi Anda siap dijalankan secara permanen.
 * Jalankan Aplikasi:
   Perintah ini akan menggunakan skrip start dari package.json Anda (node --no-deprecation index.js) dan memberinya nama "api-web".
```
   pm2 start npm --name "api-web" -- start
```

 * Atur PM2 agar Mulai Otomatis saat Reboot:
```
   pm2 startup
```
(Salin dan jalankan perintah yang diberikan oleh PM2)
  
 * Simpan Konfigurasi PM2:
```
   pm2 save
```

 * Cek Status:
```
   pm2 list
```

/*_____________________________________________________________*/
Anda seharusnya melihat api-web dengan status online. Aplikasi Anda sekarang berjalan di http://[IP_VPS_ANDA]:8000.
Langkah 5: Konfigurasi Cloudflare (DNS)
Sekarang, arahkan domain Anda ke VPS.
 * Masuk ke Dashboard Cloudflare Anda.
 * Pilih domain Anda, lalu pergi ke menu DNS -> Records.
 * Klik Add record.
   * Type: A
   * Name: @ (jika Anda ingin menggunakan domain utama, misal domainanda.com) ATAU api (jika Anda ingin subdomain api.domainanda.com).
   * IPv4 address: Masukkan IP VPS Anda.
   * Proxy status: Pastikan awan oranye Proxied aktif.
 * Klik Save.
 
/*_____________________________________________________________*/
Langkah 6: Konfigurasi Nginx (Reverse Proxy)
Ini adalah langkah terakhir untuk menghubungkan domain (port 80) ke aplikasi Node.js Anda (port 8000).
 * Buat file konfigurasi Nginx baru:
```
   sudo nano /etc/nginx/sites-available/api-web
```

 * Salin dan tempel konfigurasi ini:
   Ganti domainanda.com dengan nama domain yang Anda atur di Cloudflare.
```
   server {
    listen 80;
    server_name domainanda.com; # <-- GANTI INI

    location / {
        # Arahkan ke port yang Anda atur di .env
        proxy_pass http://localhost:8000; 

        # Pengaturan standar untuk meneruskan header
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Pengaturan untuk WebSocket (jika Anda menggunakannya nanti)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```
Tekan Ctrl+X, Y, Enter untuk menyimpan.

 * Aktifkan Konfigurasi Anda:
```
   sudo ln -s /etc/nginx/sites-available/api-web /etc/nginx/sites-enabled/
```

 * (Opsional) Hapus konfigurasi default:
```
   sudo rm /etc/nginx/sites-enabled/default
```

 * Tes dan Restart Nginx:
```
   sudo nginx -t 
```

  *  (Jika muncul syntax is ok dan test is successful, lanjutkan)
```
   sudo systemctl restart nginx
```

/*_____________________________________________________________*/
Langkah 7: Atur SSL (HTTPS) di Cloudflare
Karena Anda sudah mengaktifkan proxy Cloudflare (awan oranye), Anda bisa mendapatkan HTTPS dengan mudah.
 * Di Dashboard Cloudflare, pergi ke menu SSL/TLS.
 * Set SSL/TLS encryption mode ke Flexible.
Ini berarti Cloudflare akan mengenkripsi koneksi dari pengunjung ke server Cloudflare (HTTPS), dan Cloudflare akan terhubung ke server Nginx Anda melalui HTTP (karena kita listen 80). Ini adalah cara termudah dan tercepat.
Selesai! 🚀
Sekarang Anda seharusnya sudah bisa membuka https://domainanda.com di browser Anda dan melihat aplikasi web Anda berjalan.
