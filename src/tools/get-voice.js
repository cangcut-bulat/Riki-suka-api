const axios = require('axios');

module.exports = function(app) {
    async function scrapeVoices() {
      try {
        const response = await axios.get(
          "https://iniapi-tts.hf.space/voices",
          {
            headers: {
              "accept": "*/*", "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
              "sec-ch-ua": '"Not-A.Brand";v="99", "Chromium";v="124"', "sec-ch-ua-mobile": "?1",
              "sec-ch-ua-platform": '"Android"', "sec-fetch-dest": "empty", "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin", "user-agent": "Mozilla/5.0",
            },
            timeout: 30000,
          }
        );
        if (response.data && response.data.data) {
            return response.data.data;
        } else {
             throw new Error("Format respons API voices tidak valid");
        }
      } catch (error) {
        console.error("API Error (get-voice scrape):", error.message);
        throw error.response?.data || error;
      }
    }

    const handleRequest = async (req, res) => {
        try {
            const apikey = req.method === 'GET' ? req.query.apikey : req.body.apikey;
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }
            const result = await scrapeVoices();
            res.status(200).json({ status: true, result: result });
        } catch (error) {
            console.error(`[get-voice ${req.method}] Error:`, error.message);
            res.json({ status: false, error: error.message });
        }
    };

    app.get('/tools/voices', handleRequest);
    app.post('/tools/voices', handleRequest);
};
