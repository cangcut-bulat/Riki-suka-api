const axios = require('axios');

module.exports = function(app) {
    // --- Fungsi Helper (dari .ts) ---
    function calculateSimilarity(str1, str2) {
      str1 = str1.toLowerCase().replace(/\s+/g, "");
      str2 = str2.toLowerCase().replace(/\s+/g, "");
      if (str1 === str2) return 1;
      const len1 = str1.length; const len2 = str2.length; const maxLen = Math.max(len1, len2);
      if (str2.includes(str1) || str1.includes(str2)) return 0.9;
      let matches = 0;
      for (let i = 0; i < Math.min(len1, len2); i++) { if (str1[i] === str2[i]) matches++; }
      const prefixMatch = str1.startsWith(str2.slice(0, 3)) || str2.startsWith(str1.slice(0, 3)) ? 0.2 : 0;
      return matches / maxLen + prefixMatch;
    }

    async function scrapeCountryInfo(name) {
      try {
        const [coordsResponse, countriesResponse] = await Promise.all([
          axios.get("https://raw.githubusercontent.com/CoderPopCat/Country-Searcher/refs/heads/master/src/constants/country-coords.json", { timeout: 30000 }),
          axios.get("https://raw.githubusercontent.com/CoderPopCat/Country-Searcher/refs/heads/master/src/constants/countries.json", { timeout: 30000 }),
        ]);

        const countriesCoords = coordsResponse.data;
        const countriesInfo = countriesResponse.data;
        const searchName = name.toLowerCase().trim();

        const similarityResults = countriesInfo.map((country) => ({
          country, similarity: calculateSimilarity(searchName, country.country),
        })).sort((a, b) => b.similarity - a.similarity);

        const bestMatch = similarityResults[0];

        if (bestMatch.similarity < 0.4) {
          const suggestions = similarityResults.slice(0, 5).map((r) => r.country.country);
          // Throw error agar ditangkap sebagai JSON
          throw { status: 404, error: "Negara tidak ditemukan", suggestions: suggestions };
        }

        const countryInfo = bestMatch.country;
        const countryCoord = countriesCoords.find((c) => c.name.toLowerCase() === countryInfo.country.toLowerCase());
        const continents = { as: { name: "Asia", emoji: "🌏" }, eu: { name: "Europe", emoji: "🌍" }, af: { name: "Africa", emoji: "🌍" }, na: { name: "North America", emoji: "🌎" }, sa: { name: "South America", emoji: "🌎" }, oc: { name: "Oceania", emoji: "🌏" }, an: { name: "Antarctica", emoji: "🌎" } };
        const neighbors = countryInfo.neighbors.map((neighborCode) => {
          const neighborCountry = countriesCoords.find((c) => c.country.toLowerCase() === neighborCode.toLowerCase());
          return neighborCountry ? { name: neighborCountry.name, flag: neighborCountry.icon, coordinates: { latitude: neighborCountry.latitude, longitude: neighborCountry.longitude } } : null;
        }).filter((n) => n !== null);

        // Format data hasil
        const resultData = {
          name: countryInfo.country, capital: countryInfo.capital, flag: countryInfo.flag,
          phoneCode: countryInfo.phone_code,
          googleMapsLink: `https://www.google.com/maps/place/$$$${countryInfo.country}/@${countryCoord?.latitude || 0},${countryCoord?.longitude || 0},6z`,
          continent: { code: countryInfo.continent, name: continents[countryInfo.continent]?.name || "Unknown", emoji: continents[countryInfo.continent]?.emoji || "🌐" },
          coordinates: { latitude: countryCoord?.latitude || null, longitude: countryCoord?.longitude || null },
          area: { squareKilometers: countryInfo.area.km2, squareMiles: countryInfo.area.mi2 },
          landlocked: countryInfo.is_landlocked,
          languages: { native: countryInfo.native_language, codes: countryInfo.language_codes },
          famousFor: countryInfo.famous_for, constitutionalForm: countryInfo.constitutional_form,
          neighbors: neighbors, currency: countryInfo.currency, drivingSide: countryInfo.drive_direction,
          alcoholProhibition: countryInfo.alcohol_prohibition, internetTLD: countryInfo.tld,
          isoCode: { numeric: countryInfo.iso.numeric, alpha2: countryInfo.iso.alpha_2, alpha3: countryInfo.iso.alpha_3 }
        };
        
        return { status: true, data: resultData, searchMetadata: { originalQuery: name, matchedCountry: countryInfo.country, similarity: bestMatch.similarity } };
      } catch (error) {
        console.error("API Error (countryinfo scrape):", error.message || error);
        if (axios.isAxiosError(error)) { throw { status: error.response?.status || 500, error: error.message }; }
        throw error;
      }
    }
    // --- Akhir Fungsi Helper ---

    const handleRequest = async (req, res) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const { apikey, name } = params;

            // 1. Validasi API Key
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }

            // 2. Validasi Parameter 'name'
            if (!name || typeof name !== "string" || name.trim().length === 0) {
                return res.status(400).json({ status: false, error: "Parameter 'name' wajib diisi" });
            }

            // 3. Panggil helper
            const result = await scrapeCountryInfo(name.trim());

            // 4. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                result: result.data, // Kirim 'data' sebagai 'result'
                searchMetadata: result.searchMetadata
            });

        } catch (error) {
            // 5. Tangani Error
            console.error(`[countryinfo ${req.method}] Error:`, error.error || error.message);
            // Cek jika error kustom (404)
            if (error.status === 404) {
                 return res.status(404).json({ status: false, error: error.error, suggestions: error.suggestions });
            }
            res.json({ status: false, error: error.message || "Internal Server Error" });
        }
    };

    app.get('/tools/countryInfo', handleRequest);
    app.post('/tools/countryInfo', handleRequest);
};
