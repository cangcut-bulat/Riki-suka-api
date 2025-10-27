// Import dependencies
const axios = require("axios");
const { URLSearchParams } = require('url'); // Tidak terpakai di sini, tapi jaga-jaga
const crypto = require("crypto"); // Tidak terpakai di sini, tapi jaga-jaga

// Helper function to call the external Brat API
async function generateBrat(text, isAnimated, delayMs, log) {
  try {
    const words = text.trim().split(/\s+/).slice(0, 10); // Limit to 10 words server-side just in case
    const limitedText = words.join(" ");

    // Ensure length doesn't exceed reasonable limits (redundant check, already done in route)
    if (limitedText.length > 800) {
      log.warn("[BRAT] Text exceeded limit even after client-side check:", limitedText.substring(0, 50) + "...");
      throw new Error("Text maksimal 800 karakter.");
    }

    // Encode text for URL
    const encodedText = encodeURIComponent(limitedText);

    // Choose endpoint based on isAnimated
    const apiUrl = isAnimated
      ? `https://brat.siputzx.my.id/gif?text=${encodedText}&delay=${delayMs}`
      : `https://brat.siputzx.my.id/image?text=${encodedText}`;

    log.info(`[BRAT] Calling external API: ${apiUrl}`);

    // Request to external API using axios
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer', // Get response as raw data
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Rikishopreal-API/1.0 axios/1.x', // Custom User-Agent
        'Accept': isAnimated ? 'image/gif' : 'image/png' // Indicate desired type
      }
    });

    // Check if response status is OK
    if (response.status !== 200) {
        throw new Error(`External API returned status ${response.status}`);
    }

    // Check content type if possible (might not always be accurate from external API)
    const contentTypeHeader = response.headers['content-type'];
    log.info(`[BRAT] External API response content-type: ${contentTypeHeader}`);

    const buffer = Buffer.from(response.data);

    if (isAnimated) {
      // Expecting GIF, but verify if possible
      const expectedContentType = "image/gif";
      if (contentTypeHeader && !contentTypeHeader.startsWith(expectedContentType)){
          log.warn(`[BRAT] Expected GIF but received content-type: ${contentTypeHeader}`);
      }
      return { buffer, contentType: expectedContentType }; // Return object for GIF
    } else {
       // Expecting PNG for static
       const expectedContentType = "image/png";
       if (contentTypeHeader && !contentTypeHeader.startsWith(expectedContentType)){
          log.warn(`[BRAT] Expected PNG but received content-type: ${contentTypeHeader}`);
       }
      return { buffer, contentType: expectedContentType }; // Return object for PNG too for consistency
    }

  } catch (error) {
    log.error("[BRAT] Error calling external Brat API:", error.message);

    // Handle different error types more specifically
    if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new Error("Request timeout - API pembuat gambar tidak merespon.");
        } else if (error.response) {
            // Log raw response body if possible for debugging
            let responseData = error.response.data;
             try {
                // If it's a buffer, try decoding as text
                 if (Buffer.isBuffer(responseData)) {
                    responseData = responseData.toString('utf-8');
                 }
             } catch (decodeError) { /* ignore */ }
            log.error(`[BRAT] External API error details: Status=${error.response.status}, Data=${responseData}`);
            throw new Error(`API pembuat gambar error: ${error.response.status} - ${error.response.statusText || 'Unknown error'}`);
        } else if (error.request) {
            throw new Error("Tidak dapat terhubung ke API pembuat gambar.");
        }
    }
    // Rethrow general errors
    throw new Error(`Gagal membuat gambar: ${error.message}`);
  }
}

// Export the route function
module.exports = function(app, log) {

  // --- GET Route ---
  app.get('/imagecreator/brat', async (req, res) => {
    const { apikey, text, isAnimated: isAnimatedParam = "false", delay = "500" } = req.query;

    // API Key Check (optional, adjust based on your settings.json logic if needed)
    // if (!global.apikey.includes(apikey)) {
    //   log.warn(`[BRAT GET] Invalid API Key: ${apikey} from IP: ${req.ip}`);
    //   return res.status(403).json({ status: false, error: 'Apikey invalid' });
    // }

    // Parameter Validation
    if (!text) {
      return res.status(400).json({ status: false, error: "Parameter 'text' diperlukan." });
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'text' harus berupa string yang tidak kosong." });
    }
    if (text.length > 800) {
      return res.status(400).json({ status: false, error: "Parameter 'text' maksimal 800 karakter." });
    }

    const isAnimated = String(isAnimatedParam).toLowerCase() === "true";
    // Validate and sanitize delay
    const delayMs = Math.max(100, Math.min(1500, parseInt(String(delay)) || 500));
    if (isNaN(delayMs)) {
         return res.status(400).json({ status: false, error: "Parameter 'delay' harus berupa angka." });
    }


    log.info(`[BRAT GET] Request received. Text: "${text.substring(0, 30)}...", Animated: ${isAnimated}, Delay: ${delayMs}, IP: ${req.ip}`);

    try {
      const result = await generateBrat(text.trim(), isAnimated, delayMs, log);

      // Send the image buffer as response
      res.set('Content-Type', result.contentType);
      res.send(result.buffer);

    } catch (error) {
      log.error("[BRAT GET] Handler error:", error);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal saat membuat gambar."
      });
    }
  });

  // --- POST Route --- (Optional, jika kamu membutuhkannya)
  app.post('/imagecreator/brat', async (req, res) => {
    // Ambil apikey dari query atau body (pilih salah satu atau prioritaskan)
    const apikey = req.query.apikey || req.body.apikey;
    const { text, isAnimated: isAnimatedParam = false, delay = 500 } = req.body;

    // API Key Check (optional)
    // if (!global.apikey.includes(apikey)) {
    //   log.warn(`[BRAT POST] Invalid API Key: ${apikey} from IP: ${req.ip}`);
    //   return res.status(403).json({ status: false, error: 'Apikey invalid' });
    // }

     // Parameter Validation
    if (!text) {
      return res.status(400).json({ status: false, error: "Parameter 'text' diperlukan dalam body request." });
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ status: false, error: "Parameter 'text' harus berupa string yang tidak kosong." });
    }
    if (text.length > 800) {
      return res.status(400).json({ status: false, error: "Parameter 'text' maksimal 800 karakter." });
    }

    // Gunakan nilai boolean langsung jika ada, atau konversi string
    const isAnimated = typeof isAnimatedParam === 'boolean' ? isAnimatedParam : String(isAnimatedParam).toLowerCase() === "true";

    // Validate and sanitize delay
    const delayParsed = parseInt(String(delay));
    const delayMs = Math.max(100, Math.min(1500, isNaN(delayParsed) ? 500 : delayParsed));
     if (typeof delay !== 'number' && typeof delay !== 'string' && delay !== undefined) { // Check type if provided
         return res.status(400).json({ status: false, error: "Parameter 'delay' harus berupa angka." });
     }


    log.info(`[BRAT POST] Request received. Text: "${text.substring(0, 30)}...", Animated: ${isAnimated}, Delay: ${delayMs}, IP: ${req.ip}`);

    try {
      const result = await generateBrat(text.trim(), isAnimated, delayMs, log);

      // Send the image buffer as response
      res.set('Content-Type', result.contentType);
      res.send(result.buffer);

    } catch (error) {
      log.error("[BRAT POST] Handler error:", error);
      res.status(500).json({
        status: false,
        error: error.message || "Terjadi kesalahan internal saat membuat gambar."
      });
    }
  });

}; // End module.exports
