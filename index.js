require('dotenv').config(); // <-- Pastikan ini paling atas

const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const moment = require('moment-timezone');
const axios = require('axios');
const crypto = require('crypto'); // Dibutuhkan untuk generate key

// --- Log Warna Kustom ---
const log = { info: (...args) => console.log(chalk.blueBright(...args)), warn: (...args) => console.warn(chalk.yellow(...args)), error: (...args) => console.error(chalk.red(...args)), req: (...args) => console.log(chalk.cyan(...args)), limit: (...args) => console.log(chalk.magenta(...args)), admin: (...args) => console.log(chalk.blue(...args)), ipLog: (...args) => console.log(chalk.green(...args)), customKey: (...args) => console.log(chalk.hex('#FFA500')(...args)), ddos: (...args) => console.error(chalk.bgRed.white(...args)) };
log.info("LOG: Script index.js dimulai.");

// --- Baca Konfigurasi dari Environment ---
const ADMIN_API_KEY = process.env.ADMIN_KEY; const ADMIN_PAGE_PASSWORD = process.env.ADMIN_PAGE_PASSWORD; const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; const INITIAL_DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT, 10) || 100;
const FLOOD_WINDOW_SECONDS = parseInt(process.env.FLOOD_WINDOW_SECONDS, 10) || 10; const FLOOD_LIMIT_PER_WINDOW = parseInt(process.env.FLOOD_LIMIT_PER_WINDOW, 10) || 50; const FLOOD_DETECTION_ENABLED = (process.env.FLOOD_DETECTION_ENABLED || 'true') === 'true';
if (!ADMIN_API_KEY) log.warn("PERINGATAN: 'ADMIN_KEY' tidak diatur."); if (!ADMIN_PAGE_PASSWORD) log.warn("PERINGATAN: 'ADMIN_PAGE_PASSWORD' (untuk login) tidak diatur."); if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) log.warn("PERINGATAN: Telegram tidak dikonfigurasi.");

// --- Fungsi utilitas ---
function calculateNextResetTime() { return moment().tz('Asia/Jakarta').endOf('day').add(1, 'millisecond').valueOf(); }
async function sendTelegramNotification(message) { if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`; try { await axios.post(url, { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }, { timeout: 5000 }); } catch (error) { log.error("Gagal kirim notif Telegram:", error.response?.data?.description || error.message); } }
async function sendDdosNotification(ip) { if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return; const message = `🚨 <b>!!! PERINGATAN DDOS/FLOOD !!!</b> 🚨\n——————————————\n🛡️ <b>Tindakan:</b> IP Telah Diblokir Otomatis.\n🎯 <b>IP Target:</b> <code>${ip}</code>\n📈 <b>Request Rate:</b> > ${FLOOD_LIMIT_PER_WINDOW} req / ${FLOOD_WINDOW_SECONDS} dtk.`; const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`; try { await axios.post(url, { chat_id: TELEGRAM_CHAT_ID, text: message.replace(/^\s+/gm, ''), parse_mode: 'HTML' }, { timeout: 5000 }); } catch (error) { log.error("Gagal kirim notif DDoS Telegram:", error.response?.data?.description || error.message); } }
// Fungsi runtime
if (typeof runtime !== 'function') { global.startTime = Date.now(); global.runtime = function() { const uptimeMilliseconds = Date.now() - global.startTime; const seconds = Math.floor((uptimeMilliseconds / 1000) % 60); const minutes = Math.floor((uptimeMilliseconds / (1000 * 60)) % 60); const hours = Math.floor((uptimeMilliseconds / (1000 * 60 * 60)) % 24); const days = Math.floor(uptimeMilliseconds / (1000 * 60 * 60 * 24)); let result = ''; if (days > 0) result += days + 'd '; if (hours > 0) result += hours + 'h '; if (minutes > 0) result += minutes + 'm '; result += seconds + 's'; return result.trim(); }; log.info("LOG: Fungsi 'runtime' ditambahkan secara internal."); }
else { log.info("LOG: Fungsi 'runtime' sudah ada."); }
try { require("./function.js"); log.info("LOG: function.js dimuat (jika ada)."); } catch (e) { if (e.code === 'MODULE_NOT_FOUND') { log.warn("PERINGATAN: function.js tidak ditemukan."); } else { log.error("FATAL ERROR load function.js:", e.message); process.exit(1); } }

const app = express();
const PORT = process.env.SERVER_PORT || process.env.PORT || 8000;
log.info(`LOG: Port: ${PORT}`); log.info(`LOG: Anti-Flood: ${FLOOD_DETECTION_ENABLED ? `ON (${FLOOD_LIMIT_PER_WINDOW} req / ${FLOOD_WINDOW_SECONDS}s)` : 'OFF'}`);
app.enable("trust proxy"); app.set("json spaces", 2); app.use(express.json()); app.use(express.urlencoded({ extended: false })); app.use(cors()); log.info("LOG: Middleware dasar dimuat.");

// --- Lokasi File ---
const API_PAGE_DIR = path.join(__dirname, 'api-page'); const ROOT_DIR = __dirname; const error404Path = path.join(API_PAGE_DIR, '404.html'); const error500Path = path.join(API_PAGE_DIR, '500.html'); const blacklistFilePath = path.join(ROOT_DIR, 'blacklist.json'); const rateLimitsFilePath = path.join(ROOT_DIR, 'rate_limits.json'); const uniqueIpsFilePath = path.join(ROOT_DIR, 'unique_ips.json'); const customKeysFilePath = path.join(ROOT_DIR, 'api_keys.json'); const apiKeyOverridesFilePath = path.join(ROOT_DIR, 'apikey_requirements.json');

// Static file serving
app.use(express.static(API_PAGE_DIR)); app.use(express.static(ROOT_DIR)); app.use('/images', express.static(path.join(ROOT_DIR, 'images'))); app.use('/audio', express.static(path.join(ROOT_DIR, 'audio'))); log.info("LOG: Penyajian file statis dikonfigurasi.");

// --- Data & Fungsi Persistence ---
let rateLimitData = {}; let ipRequestLog = {}; global.ipBlacklist = new Set(); let uniqueIps = new Set();
global.customApiKeys = {}; // [MODIFIKASI] Jadikan global
global.apiKeyOverrides = {}; global.currentDailyLimit = INITIAL_DAILY_LIMIT; global.isRateLimitingEnabled = true; global.totalreq = 0;

// Fungsi helper baca/tulis JSON (dengan perbaikan)
function readJsonFile(filePath, defaultValue) { try { if (fs.existsSync(filePath)) { const fileContent = fs.readFileSync(filePath, 'utf-8'); if (!fileContent) return defaultValue; const jsonData = JSON.parse(fileContent); if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) { return (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) ? jsonData : defaultValue; } if (Array.isArray(defaultValue)) { return Array.isArray(jsonData) ? jsonData : defaultValue; } return jsonData || defaultValue; } } catch (err) { log.error(`ERROR load ${path.basename(filePath)}:`, err); if (err instanceof SyntaxError) { const backupPath = filePath + '.bak'; try { fs.copyFileSync(filePath, backupPath); log.warn(`WARNING: File ${path.basename(filePath)} rusak, backup dibuat di ${backupPath}`); fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8'); log.warn(`WARNING: File ${path.basename(filePath)} direset ke default.`); return defaultValue; } catch (backupErr) { log.error(`ERROR saat mencoba backup/reset ${path.basename(filePath)}:`, backupErr); } } } return defaultValue; }
function writeJsonFile(filePath, data) { try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8'); } catch (err) { log.error(`ERROR save ${path.basename(filePath)}:`, err); } }

// Load/Save Blacklist
function loadBlacklist() { const ips = readJsonFile(blacklistFilePath, []); if (Array.isArray(ips)) global.ipBlacklist = new Set(ips); log.admin(`LOG: Blacklist dimuat (${global.ipBlacklist.size} IP).`); }
function saveBlacklist() { writeJsonFile(blacklistFilePath, Array.from(global.ipBlacklist).sort()); }
// Load/Save Rate Limit
function loadRateLimits() { rateLimitData = readJsonFile(rateLimitsFilePath, {}); log.info(`LOG: Rate limit dimuat (${Object.keys(rateLimitData).length} IP).`); if(typeof rateLimitData !== 'object' || rateLimitData === null) rateLimitData = {}; }
function saveRateLimits() { writeJsonFile(rateLimitsFilePath, rateLimitData); }
// Load/Save Unique IPs
function loadUniqueIps() { const ips = readJsonFile(uniqueIpsFilePath, []); if (Array.isArray(ips)) uniqueIps = new Set(ips); log.info(`LOG: IP unik dimuat (${uniqueIps.size} IP).`); }
function saveUniqueIps() { writeJsonFile(uniqueIpsFilePath, Array.from(uniqueIps).sort()); }
// Load/Save Custom API Keys
function loadCustomApiKeys() { global.customApiKeys = readJsonFile(customKeysFilePath, {}); log.info(`LOG: Kunci API Kustom dimuat (${Object.keys(global.customApiKeys).length} kunci).`); if(typeof global.customApiKeys !== 'object' || global.customApiKeys === null) global.customApiKeys = {}; } // [MODIFIKASI] Gunakan global
function saveCustomApiKeys() { writeJsonFile(customKeysFilePath, global.customApiKeys); } // [MODIFIKASI] Gunakan global
// Load/Save API Key Overrides
function loadApiKeyOverrides() { global.apiKeyOverrides = readJsonFile(apiKeyOverridesFilePath, {}); log.admin(`LOG: Override API Key dimuat (${Object.keys(global.apiKeyOverrides).length} aturan).`); if(typeof global.apiKeyOverrides !== 'object' || global.apiKeyOverrides === null) global.apiKeyOverrides = {}; }
function saveApiKeyOverrides() { writeJsonFile(apiKeyOverridesFilePath, global.apiKeyOverrides); }

// Muat semua data saat start
loadBlacklist(); loadRateLimits(); loadUniqueIps(); loadCustomApiKeys(); loadApiKeyOverrides();
log.info(`LOG: Rate limit IP default: ${global.currentDailyLimit}, Status: ${global.isRateLimitingEnabled ? 'ON' : 'OFF'}.`);

// --- Middleware 1: Flood/DDoS & Blacklist ---
app.use((req, res, next) => { const ip = req.ip; const now = Date.now(); if (FLOOD_DETECTION_ENABLED) { if (!ipRequestLog[ip]) ipRequestLog[ip] = []; ipRequestLog[ip].push(now); const windowStart = now - (FLOOD_WINDOW_SECONDS * 1000); ipRequestLog[ip] = ipRequestLog[ip].filter(ts => ts >= windowStart); if (ipRequestLog[ip].length > FLOOD_LIMIT_PER_WINDOW) { if (!global.ipBlacklist.has(ip)) { log.ddos(`🚨 DDOS DETECTED: IP ${ip} diblokir! (${ipRequestLog[ip].length} reqs / ${FLOOD_WINDOW_SECONDS}s)`); global.ipBlacklist.add(ip); saveBlacklist(); sendDdosNotification(ip); } else { log.warn(`BLACKLIST: Tolak IP (flood): ${ip}`); } return res.status(429).json({ status: false, error: "Terlalu banyak request. IP Anda diblokir sementara." }); } } if (global.ipBlacklist.has(ip)) { log.warn(`BLACKLIST: Tolak IP: ${ip}`); return res.status(403).json({ status: false, error: "Akses ditolak (IP diblokir)." }); } next(); });
log.info("LOG: Middleware 1 (DDoS, Blacklist) dimuat.");

// --- Load settings.json ---
const settingsPath = path.join(__dirname, './settings.json');
global.settings = {}; // [MODIFIKASI] Jadikan global
global.endpointStatus = {}; global.dynamicLabels = {}; global.initialRequiredKeyPaths = new Set();
try {
    global.settings = readJsonFile(settingsPath, {}); // [MODIFIKASI] Gunakan global
    for (const category in global.settings.endpoints) {
        if (Array.isArray(global.settings.endpoints[category])) {
            global.settings.endpoints[category].forEach(e => {
                if (e.path) { const basePath = e.path.split('?')[0]; global.endpointStatus[basePath] = e.status || 'Active'; if (e.path.includes('apikey=')) { global.initialRequiredKeyPaths.add(basePath); } }
            });
        }
    }
    log.info("LOG: settings.json dibaca, var global siap.");
    log.admin(`LOG: Path Awal Wajib API Key (dari settings.json): ${global.initialRequiredKeyPaths.size} endpoint.`);
} catch (err) { log.error(`FATAL ERROR: Gagal memuat settings.json: ${err.message}`); process.exit(1); }

// --- Logika global.apikey (untuk file endpoint lama) ---
global.apikey = global.settings.apikey || []; // [MODIFIKASI] Gunakan global.settings
log.info(`LOG: Kunci default dimuat: ${global.apikey.length}`);
const customKeys = Object.keys(global.customApiKeys); // [MODIFIKASI] Gunakan global
if (customKeys.length > 0) { global.apikey = global.apikey.concat(customKeys); log.info(`LOG: Menggabungkan ${customKeys.length} Kunci Kustom ke global.apikey.`); }
global.apikey.push(undefined);
log.admin(`LOG: Total global.apikey (termasuk custom & undefined): ${global.apikey.length}`);

// --- Middleware 2: Logika Utama (Limit IP & Validasi API Key) ---
app.use((req, res, next) => {
    const ip = req.ip; const reqPath = req.path;
    const excludedPaths = ['/', '/api/stats', '/api/my-stats', '/api/endpoint-status', '/api/get-endpoints', '/api/public/blacklist', '/api/checkapikey']; const excludedPrefixes = ['/images/', '/audio/', '/api/admin/']; const excludedSuffixes = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.map', '.woff', '.woff2', '.ttf', '.svg']; let isExcluded = excludedPaths.includes(reqPath) || excludedPrefixes.some(p => reqPath.startsWith(p)) || excludedSuffixes.some(s => reqPath.endsWith(s)); if (reqPath === '/admin') isExcluded = true; if (reqPath === '/' && req.method === 'GET' && req.accepts('html')) isExcluded = true;
    if (isExcluded) return next();

    log.req(`LOG: Request dari IP: ${ip} ke ${reqPath}`); global.totalreq += 1;
    const providedKey = req.query.apikey; const now = Date.now();
    let useIpLimit = true; let limitInfo = ''; let keyName = 'IP Limit';
    const pathOverride = global.apiKeyOverrides[reqPath]; let needsKey; if (pathOverride !== undefined) { needsKey = pathOverride; log.info(`API KEY OVERRIDE: ${reqPath} -> ${needsKey ? 'WAJIB' : 'PUBLIK'}`); } else { needsKey = global.initialRequiredKeyPaths.has(reqPath); log.info(`API KEY INITIAL: ${reqPath} -> ${needsKey ? 'WAJIB' : 'PUBLIK'}`); }

    if (needsKey) { // Endpoint WAJIB API Key
        if (!providedKey) { log.warn(`API KEY: Apikey hilang untuk ${reqPath}, diteruskan ke file endpoint...`); }
        else {
            const customKeyData = global.customApiKeys[providedKey]; // [MODIFIKASI] Gunakan global
            if (customKeyData) { keyName = customKeyData.name || providedKey; if (customKeyData.expires && now >= customKeyData.expires) { log.warn(`CUSTOM KEY: Kunci '${keyName}' KEDALUWARSA.`); return res.status(403).json({ status: false, error: "Kunci API Kustom Anda telah kedaluwarsa." }); } if (customKeyData.limit > 0 && (customKeyData.count || 0) >= customKeyData.limit) { log.warn(`CUSTOM KEY: Kunci '${keyName}' LIMIT HABIS.`); return res.status(403).json({ status: false, error: "Limit Kunci API Kustom Anda telah habis." }); } log.customKey(`CUSTOM KEY: Kunci '${keyName}' VALID.`); useIpLimit = false; customKeyData.count = (customKeyData.count || 0) + 1; saveCustomApiKeys(); limitInfo = `🔑 <b>Key (${keyName}):</b> ${customKeyData.count} / ${customKeyData.limit || '∞'}`; }
            else if (global.apikey.includes(providedKey)) { log.info(`DEFAULT KEY: Kunci default VALID.`); keyName = 'Default Key'; }
            else { log.warn(`API KEY: Kunci ${providedKey} TIDAK VALID (bukan custom atau default).`); }
        }
    } else { // Endpoint PUBLIK
        log.info(`API KEY: Endpoint ${reqPath} tidak perlu Apikey (publik).`);
        if (providedKey && global.customApiKeys[providedKey]) { const customKeyData = global.customApiKeys[providedKey]; keyName = customKeyData.name || providedKey; if (!(customKeyData.expires && now >= customKeyData.expires) && !(customKeyData.limit > 0 && (customKeyData.count || 0) >= customKeyData.limit)) { log.customKey(`CUSTOM KEY: Kunci '${keyName}' VALID (opsional).`); useIpLimit = false; customKeyData.count = (customKeyData.count || 0) + 1; saveCustomApiKeys(); limitInfo = `🔑 <b>Key (${keyName}):</b> ${customKeyData.count} / ${customKeyData.limit || '∞'}`; } else { log.warn(`CUSTOM KEY: Kunci '${keyName}' expired/limit habis (dialihkan ke IP Limit).`); } } // [MODIFIKASI] Gunakan global
        else if (providedKey) { log.info(`API KEY: Kunci opsional ${providedKey} (default/invalid) diabaikan, pakai IP Limit.`); }
    }

    if (useIpLimit) { // Pemeriksaan Limit IP
         if (global.isRateLimitingEnabled) { let ipData = rateLimitData[ip]; let needsSaveLimit = false; let effectiveLimit = ipData?.limit === 0 ? 0 : (ipData?.limit ?? global.currentDailyLimit); if (!ipData || now >= ipData.resetTime) { const currentSpecificLimit = ipData?.limit; rateLimitData[ip] = { count: 1, resetTime: calculateNextResetTime(), limit: currentSpecificLimit ?? null }; ipData = rateLimitData[ip]; needsSaveLimit = true; effectiveLimit = ipData.limit ?? global.currentDailyLimit; log.limit(`IP LIMIT: IP ${ip} count: 1/${effectiveLimit === 0 ? '∞' : effectiveLimit} (Reset)`); } else { if (effectiveLimit !== 0) { if (ipData.count >= effectiveLimit) { log.warn(`IP LIMIT: IP ${ip} limit (${ipData.count}/${effectiveLimit}).`); return res.status(429).json({ status: false, error: `Limit request harian (${effectiveLimit}) tercapai.` }); } ipData.count++; needsSaveLimit = true; log.limit(`IP LIMIT: IP ${ip} count: ${ipData.count}/${effectiveLimit}`); } else { ipData.count++; needsSaveLimit = true; log.limit(`IP LIMIT: IP ${ip} count: ${ipData.count}/∞ (Unlimited)`); } } if (needsSaveLimit) saveRateLimits(); limitInfo = `📊 <b>Limit IP:</b> ${ipData.count} / ${effectiveLimit === 0 ? '∞' : effectiveLimit}`; }
         else { log.limit(`IP LIMIT: OFF - Akses diizinkan untuk IP: ${ip}`); limitInfo = `⚡ <b>Limit IP:</b> Unlimited (OFF)`; }
    }

    if (!uniqueIps.has(ip)) { uniqueIps.add(ip); saveUniqueIps(); log.ipLog(`IP LOG: IP unik baru terdeteksi dan disimpan: ${ip}`); sendTelegramNotification(`🆕 IP Unik Baru:\nIP: <code>${ip}</code>\nPath: ${reqPath}`); }
    sendTelegramNotification(`🚀 <b>Request API</b> 🚀\n——————————————\n👤 <b>IP:</b> <code>${ip}</code>\n📍 <b>Path:</b> ${reqPath}\n${limitInfo}`);
    next();
});
log.info("LOG: Middleware 2 (Logika Utama: Limit & API Key) dimuat.");

// Middleware format JSON
app.use((req, res, next) => { const oJson = res.json; res.json = function(d) { if (d && typeof d === 'object' && d.status !== undefined) { const rD = { creator: global.settings.creator || "Rikishopreal", ...d }; return oJson.call(this, rD); } return oJson.call(this, d); }; next(); });
log.info("LOG: Middleware response JSON dimuat.");

// --- Load dynamic routes ---
let totalRoutes = 0; const apiFolder = path.join(__dirname, './src');
try {
    fs.readdirSync(apiFolder).forEach((subfolder) => { const subfolderPath = path.join(apiFolder, subfolder); if (fs.statSync(subfolderPath).isDirectory()) { fs.readdirSync(subfolderPath).forEach((file) => { if (path.extname(file) === '.js') { try { require(path.join(subfolderPath, file))(app, log); totalRoutes++; } catch (loadError) { log.error(`-> GAGAL load rute: ${subfolder}/${file}. Err: ${loadError.message}`); if (loadError.stack) { console.error(loadError.stack); } } } }); } });
    log.info(`LOG: Selesai load rute dinamis. Total endpoint files: ${totalRoutes}`);
} catch (readDirError) { log.error(`FATAL ERROR: Gagal baca folder src: ${readDirError.message}`); process.exit(1); }

// --- Public Endpoints ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/api/endpoint-status', (req, res) => res.json({ status: true, creator: global.settings.creator, data: global.endpointStatus }));
app.get('/api/public/blacklist', (req, res) => res.json({ status: true, creator: global.settings.creator, blacklist: Array.from(global.ipBlacklist).sort() }));
app.get('/api/stats', (req, res) => res.json({ totalRequests: global.totalreq, uptime: runtime(), limit: global.currentDailyLimit }));
app.get('/api/my-stats', (req, res) => { const ip = req.ip; const ipData = rateLimitData[ip]; const effectiveLimit = ipData?.limit === 0 ? 0 : (ipData?.limit ?? global.currentDailyLimit); const resetTime = ipData?.resetTime || calculateNextResetTime(); const count = ipData?.count || 0; res.json({ status: true, isLimitEnabled: global.isRateLimitingEnabled, limit: effectiveLimit === 0 ? 'Infinity' : effectiveLimit, remaining: effectiveLimit === 0 ? 'Infinity' : Math.max(0, effectiveLimit - count), resetTime: resetTime }); });

// Endpoint /api/get-endpoints
app.get('/api/get-endpoints', (req, res) => { let sCopy = JSON.parse(JSON.stringify(global.settings)); const now = Date.now(); for (const cat in sCopy.endpoints) { if (Array.isArray(sCopy.endpoints[cat])) { sCopy.endpoints[cat].forEach(e => { if (!e.path) return; const p = e.path.split('?')[0]; let newStatic = e.dateAdded && (now - new Date(e.dateAdded).getTime()) / 36e5 <= 24; const dyn = global.dynamicLabels[p]; if (dyn && now < dyn.expires) e.dynamicLabel = dyn.label; else { if (dyn) delete global.dynamicLabels[p]; if (newStatic) e.dynamicLabel = "NEW"; } const pathOverride = global.apiKeyOverrides[p]; let finalRequiresKey; if (pathOverride !== undefined) { finalRequiresKey = pathOverride; } else { finalRequiresKey = global.initialRequiredKeyPaths.has(p); } e.requiresKey = finalRequiresKey; const originalPath = e.path; const originalQuery = originalPath.split('?')[1] || ''; let newParams = []; if (originalQuery) { const params = new URLSearchParams(originalQuery); for (const [key, value] of params.entries()) { if (key !== 'apikey' && key !== 'apikey_custom') { newParams.push(`${key}=${value}`); } } } if (e.requiresKey) { newParams.push('apikey='); } e.path = p; if (newParams.length > 0) { e.path += '?' + newParams.join('&'); } }); } } res.json(sCopy); });
log.info("LOG: Rute publik dikonfigurasi.");

// --- Admin Endpoints ---
app.get('/admin', (req, res) => { fs.existsSync(path.join(ROOT_DIR, 'login.html')) ? res.sendFile(path.join(ROOT_DIR, 'login.html')) : res.status(404).send("File login.html tidak ditemukan."); });
app.post('/api/admin/login', (req, res) => { const { password } = req.body; if (!ADMIN_PAGE_PASSWORD) { log.error("ADMIN LOGIN GAGAL: ADMIN_PAGE_PASSWORD tidak diatur."); return res.status(500).json({ status: false, error: "Server login tidak dikonfigurasi." }); } if (!ADMIN_API_KEY) { log.error("ADMIN LOGIN GAGAL: ADMIN_KEY (API) tidak diatur."); return res.status(500).json({ status: false, error: "Server admin tidak dikonfigurasi." }); } if (password === ADMIN_PAGE_PASSWORD) { log.admin(`ADMIN LOGIN SUKSES dari IP: ${req.ip}`); res.json({ status: true, message: "Login success", token: ADMIN_API_KEY }); } else { log.warn(`ADMIN LOGIN GAGAL dari IP: ${req.ip}`); res.status(401).json({ status: false, error: "Password salah." }); } });
app.get('/admin-panel', (req, res) => { fs.existsSync(path.join(ROOT_DIR, 'admin-panel.html')) ? res.sendFile(path.join(ROOT_DIR, 'admin-panel.html')) : res.status(404).send("File admin-panel.html tidak ditemukan."); });
const adminAuthMiddleware = (req, res, next) => { const key = req.method === 'GET' ? req.query.apikey : req.body.apikey; if (!ADMIN_API_KEY) return res.status(503).json({ status: false, error: "Admin disabled." }); if (key !== ADMIN_API_KEY) { log.warn(`ADMIN AUTH FAIL: IP ${req.ip}`); return res.status(403).json({ status: false, error: "Admin API Key invalid." }); } next(); };
app.get('/api/admin/endpoints/list', adminAuthMiddleware, (req, res) => { try { const allPaths = new Set(); for (const category in global.settings.endpoints) { if (Array.isArray(global.settings.endpoints[category])) { global.settings.endpoints[category].forEach(e => { if (e.path) { allPaths.add(e.path.split('?')[0]); } }); } } const sortedPaths = Array.from(allPaths).sort(); res.json({ status: true, paths: sortedPaths }); } catch (err) { log.error("Error /api/admin/endpoints/list:", err); res.status(500).json({ status: false, error: "Internal server error" }); } });
app.get('/api/admin/customkeys/list', adminAuthMiddleware, (req, res) => { const now = Date.now(); const keyList = Object.entries(global.customApiKeys).map(([key, data]) => ({ key: key, name: data.name, limit: data.limit, count: data.count || 0, expires: data.expires, isExpired: data.expires ? now >= data.expires : false, isOutOfLimit: data.limit > 0 ? (data.count || 0) >= data.limit : false, createdAt: data.createdAt })); keyList.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); res.json({ status: true, keys: keyList }); }); // [MODIFIKASI] Gunakan global
app.post('/api/admin/customkeys/add', adminAuthMiddleware, (req, res) => { const { name, limit, days, key } = req.body; if (!name || typeof name !== 'string' || name.trim() === '') { return res.status(400).json({ status: false, error: "Nama kunci diperlukan." }); } if (!key || typeof key !== 'string' || key.trim() === '') { return res.status(400).json({ status: false, error: "API Key diperlukan." }); } const newKey = key.trim(); if (global.customApiKeys[newKey]) { return res.status(400).json({ status: false, error: `API Key '${newKey}' sudah ada.` }); } if (newKey.startsWith('RIKI-')) { return res.status(400).json({ status: false, error: "API Key tidak boleh diawali 'RIKI-'." }); } const parsedLimit = parseInt(limit, 10); if (isNaN(parsedLimit) || parsedLimit < 0) { return res.status(400).json({ status: false, error: "Limit harus angka 0 atau lebih (0 = unlimited)." }); } const parsedDays = parseInt(days, 10); if (isNaN(parsedDays) || parsedDays <= 0) { return res.status(400).json({ status: false, error: "Masa aktif (hari) harus angka positif." }); } const expiryTimestamp = moment().add(parsedDays, 'days').valueOf(); global.customApiKeys[newKey] = { name: name.trim(), limit: parsedLimit, count: 0, expires: expiryTimestamp, createdAt: Date.now() }; saveCustomApiKeys(); if (!global.apikey.includes(newKey)) { global.apikey.push(newKey); log.admin(`ADMIN: Kunci ${newKey} ditambahkan ke global.apikey (in-memory).`); } log.admin(`ADMIN: Kunci kustom baru ditambahkan: ${name.trim()} (${newKey}), Limit: ${parsedLimit}, Aktif: ${parsedDays} hari.`); sendTelegramNotification(`🔑 Kunci Kustom Baru:\nNama: ${name.trim()}\nKunci: <code>${newKey}</code>\nLimit: ${parsedLimit === 0 ? 'Unlimited' : parsedLimit}\nMasa Aktif: ${parsedDays} hari`); res.json({ status: true, message: `Kunci '${name.trim()}' (${newKey}) berhasil dibuat.`, newKey: newKey }); }); // [MODIFIKASI] Gunakan global
app.post('/api/admin/customkeys/delete', adminAuthMiddleware, (req, res) => { const { key } = req.body; if (!key || typeof key !== 'string' || !global.customApiKeys[key]) { return res.status(400).json({ status: false, error: "Kunci tidak valid atau tidak ditemukan." }); } const keyName = global.customApiKeys[key].name || key; delete global.customApiKeys[key]; saveCustomApiKeys(); const index = global.apikey.indexOf(key); if (index > -1) { global.apikey.splice(index, 1); log.admin(`ADMIN: Kunci ${key} dihapus dari global.apikey (in-memory).`); } log.admin(`ADMIN: Kunci kustom dihapus: ${keyName} (${key}).`); sendTelegramNotification(`🗑️ Kunci Kustom Dihapus:\nNama: ${keyName}\nKunci: <code>${key}</code>`); res.json({ status: true, message: `Kunci '${keyName}' berhasil dihapus.` }); }); // [MODIFIKASI] Gunakan global
app.post('/api/admin/set-label', adminAuthMiddleware, (req, res) => { const { endpoint, label } = req.body; const valid = ["NEW", "FIX", ""]; if (!endpoint || !valid.includes(label)) return res.status(400).json({ status: false, error: "Param invalid." }); let found = Object.values(global.settings.endpoints).flat().some(e => e.path?.startsWith(endpoint)); if (!found) return res.status(404).json({ status: false, error: "Endpoint not found." }); if (label === "") { delete global.dynamicLabels[endpoint]; log.admin(`ADMIN: Label ${endpoint} cleared.`); return res.json({ status: true, message: `Label ${endpoint} cleared.` }); } else { global.dynamicLabels[endpoint] = { label, expires: Date.now() + 864e5 }; log.admin(`ADMIN: Label '${label}' -> ${endpoint} (24h).`); return res.json({ status: true, message: `Label '${label}' -> ${endpoint} (24h).` }); } });
app.get('/api/admin/blacklist/list', adminAuthMiddleware, (req, res) => res.json({ status: true, blacklist: Array.from(global.ipBlacklist).sort() }));
app.post('/api/admin/blacklist/add', adminAuthMiddleware, (req, res) => { const { ip } = req.body; if (!ip?.trim()) return res.status(400).json({ status: false, error: "'ip' needed." }); const ipAdd = ip.trim(); if(global.ipBlacklist.has(ipAdd)) return res.json({ status: true, message: `IP ${ipAdd} sudah ada.` }); global.ipBlacklist.add(ipAdd); saveBlacklist(); log.admin(`ADMIN: IP ${ipAdd} BLACKLISTED.`); sendTelegramNotification(`🚫 IP Blacklisted:\nIP: <code>${ipAdd}</code>`); res.json({ status: true, message: `IP ${ipAdd} ditambahkan.` }); });
app.post('/api/admin/blacklist/remove', adminAuthMiddleware, (req, res) => { const { ip } = req.body; if (!ip?.trim()) return res.status(400).json({ status: false, error: "'ip' needed." }); const ipRem = ip.trim(); if(!global.ipBlacklist.has(ipRem)) return res.json({ status: true, message: `IP ${ipRem} tidak ditemukan.` }); global.ipBlacklist.delete(ipRem); saveBlacklist(); log.admin(`ADMIN: IP ${ipRem} UNBLACKLISTED.`); sendTelegramNotification(`✅ IP Unblacklisted:\nIP: <code>${ipRem}</code>`); res.json({ status: true, message: `IP ${ipRem} dihapus.` }); });
app.get('/api/admin/limit/status', adminAuthMiddleware, (req, res) => res.json({ status: true, enabled: global.isRateLimitingEnabled, globalLimit: global.currentDailyLimit }));
app.post('/api/admin/limit/toggle', adminAuthMiddleware, (req, res) => { const { enable } = req.body; if (typeof enable !== 'boolean') return res.status(400).json({ status: false, error: "'enable' boolean." }); global.isRateLimitingEnabled = enable; const status = enable ? 'ON' : 'OFF'; log.admin(`ADMIN: Rate Limit IP -> ${status}.`); sendTelegramNotification(`⚠️ Rate Limit Global (IP) -> ${status}`); res.json({ status: true, message: `Rate limit IP -> ${status}.`, enabled: enable }); });
app.post('/api/admin/limit/set-global', adminAuthMiddleware, (req, res) => { const limitNum = parseInt(req.body.newLimit, 10); if (isNaN(limitNum) || limitNum < 0) return res.status(400).json({ status: false, error: "'newLimit' >= 0." }); const old = global.currentDailyLimit; global.currentDailyLimit = limitNum; log.admin(`ADMIN: Global Limit IP -> ${limitNum}.`); sendTelegramNotification(`⚙️ Global Limit (IP):\nOld: ${old}\nNew: ${limitNum}`); res.json({ status: true, message: `Global Limit IP -> ${limitNum}.`, newLimit: limitNum }); });
app.post('/api/admin/limit/set-ip', adminAuthMiddleware, (req, res) => { const { ip, newLimit } = req.body; const limitNum = parseInt(newLimit, 10); if (!ip?.trim()) return res.status(400).json({ status: false, error: "'ip' needed." }); if (isNaN(limitNum) || limitNum < 0) return res.status(400).json({ status: false, error: "'newLimit' >= 0 (0=unlimited)." }); const targetIp = ip.trim(); if (!rateLimitData[targetIp]) rateLimitData[targetIp] = { count: 0, resetTime: calculateNextResetTime(), limit: limitNum }; else rateLimitData[targetIp].limit = limitNum; saveRateLimits(); const limitText = limitNum === 0 ? 'UNLIMITED' : limitNum; log.admin(`ADMIN: Limit IP ${targetIp} -> ${limitText}.`); sendTelegramNotification(`🔧 Limit IP:\nIP: <code>${targetIp}</code>\nNew: ${limitText}`); res.json({ status: true, message: `Limit ${targetIp} -> ${limitText}.` }); });
app.get('/api/admin/limit/all-ips', adminAuthMiddleware, (req, res) => { const now = Date.now(); try { if (typeof rateLimitData !== 'object' || rateLimitData === null) { log.error("Error /api/admin/limit/all-ips: rateLimitData bukan object valid."); rateLimitData = {}; } const allIpData = Object.entries(rateLimitData) .map(([ip, data]) => { try { if (typeof data !== 'object' || data === null) { log.warn(`Peringatan: Data untuk IP ${ip} di rate_limits.json tidak valid, dilewati.`); return null; } const limitValue = data.limit; const countValue = data.count || 0; const resetTimeValue = data.resetTime || calculateNextResetTime(); const effectiveLimit = limitValue === 0 ? 0 : (limitValue ?? global.currentDailyLimit); const isExpired = now >= resetTimeValue; const currentCount = isExpired ? 0 : countValue; let limitDisplay = (effectiveLimit === 0) ? `Used: ${currentCount}` : `${currentCount} / ${effectiveLimit}`; let specificLimitDisplay = 'Global'; if (limitValue === 0) specificLimitDisplay = 'Unlimited (IP)'; else if (limitValue !== null && limitValue !== undefined) specificLimitDisplay = `${limitValue} (IP)`; return { ip: ip, usageDisplay: limitDisplay, specificLimitDisplay: specificLimitDisplay, resetTime: resetTimeValue, resetsInMs: Math.max(0, resetTimeValue - now), isExpired: isExpired }; } catch (innerErr) { log.error(`Error saat memproses IP ${ip} di /api/admin/limit/all-ips:`, innerErr); return null; } }) .filter(item => item !== null); allIpData.sort((a, b) => a.isExpired - b.isExpired || b.resetsInMs - a.resetsInMs); res.json({ status: true, ipData: allIpData }); } catch (err) { log.error("Error /api/admin/limit/all-ips:", err); res.status(500).json({ status: false, error: "Internal server error saat mengambil data IP." }); } });
app.get('/api/admin/apikey-requirements/list', adminAuthMiddleware, (req, res) => { try { const statusList = []; const allPaths = new Set(); for (const category in global.settings.endpoints) { if (Array.isArray(global.settings.endpoints[category])) { global.settings.endpoints[category].forEach(e => { if (e.path) { allPaths.add(e.path.split('?')[0]); } }); } } const sortedPaths = Array.from(allPaths).sort(); sortedPaths.forEach(path => { const initial = global.initialRequiredKeyPaths.has(path); const override = global.apiKeyOverrides[path]; let current = initial; if (override !== undefined) { current = override; } statusList.push({ path: path, initial: initial, current: current }); }); res.json({ status: true, requirements: statusList }); } catch (err) { log.error("Error /api/admin/apikey-requirements/list:", err); res.status(500).json({ status: false, error: "Internal server error" }); } });
app.post('/api/admin/apikey-requirements/set', adminAuthMiddleware, (req, res) => { const { path, require } = req.body; if (!path || typeof require !== 'boolean') { return res.status(400).json({ status: false, error: "Parameter 'path' (string) dan 'require' (boolean) diperlukan." }); } let found = false; for (const category in global.settings.endpoints) { if (Array.isArray(global.settings.endpoints[category])) { if (global.settings.endpoints[category].some(e => e.path?.startsWith(path))) { found = true; break; } } } if (!found) { return res.status(404).json({ status: false, error: `Endpoint path '${path}' tidak ditemukan.` }); } const initialRequirement = global.initialRequiredKeyPaths.has(path); if (require === initialRequirement) { if (global.apiKeyOverrides[path] !== undefined) { delete global.apiKeyOverrides[path]; saveApiKeyOverrides(); log.admin(`ADMIN: Override API Key untuk ${path} dihapus (kembali ke default: ${initialRequirement ? 'WAJIB' : 'PUBLIK'}).`); sendTelegramNotification(`🔑 Aturan API Key:\nPath: ${path}\nStatus: Kembali ke Default (${initialRequirement ? 'WAJIB' : 'PUBLIK'})`); res.json({ status: true, message: `Aturan API Key untuk ${path} dikembalikan ke default.` }); } else { res.json({ status: true, message: `Aturan API Key untuk ${path} sudah sesuai default.` }); } } else { global.apiKeyOverrides[path] = require; saveApiKeyOverrides(); const statusText = require ? 'WAJIB' : 'PUBLIK'; log.admin(`ADMIN: Override API Key untuk ${path} diatur menjadi ${statusText}.`); sendTelegramNotification(`🔑 Aturan API Key:\nPath: ${path}\nStatus: Diubah menjadi ${statusText}`); res.json({ status: true, message: `Aturan API Key untuk ${path} diatur menjadi ${statusText}.` }); } });

log.info("LOG: Rute admin dikonfigurasi.");

// --- Error Handlers & Server Start ---
app.use((req, res, next) => { fs.access(error404Path, fs.constants.F_OK, (err) => { if (!err) res.status(404).sendFile(error404Path); else res.status(404).send('404 Not Found'); }); });
app.use((err, req, res, next) => { log.error("ERROR HANDLER 500:", err.stack); if (req.path && global.endpointStatus[req.path]) global.endpointStatus[req.path] = 'Error'; fs.access(error500Path, fs.constants.F_OK, (errAccess) => { if (!errAccess) res.status(500).sendFile(error500Path); else res.status(500).send('500 Internal Server Error'); }); });
const server = app.listen(PORT, '0.0.0.0', () => { const host = global.settings.publicAddress || 'localhost'; console.log(chalk.blue(` Server BERHASIL berjalan di http://${host}:${PORT} `)); console.log(chalk.yellow(` Halaman Login Admin: http://${host}:${PORT}/admin `)); });
server.on('error', (error) => { log.error('FATAL ERROR server! 💥', error); process.exit(1); });
process.on('uncaughtException', (err) => { log.error('UNCAUGHT EXCEPTION! 💥', err); if(err.stack) console.error(err.stack); });
process.on('unhandledRejection', (reason, promise) => { log.error('UNHANDLED REJECTION! 💥', reason); if(reason && reason.stack) console.error(reason.stack); });

