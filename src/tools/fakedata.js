const { faker } = require('@faker-js/faker'); // Pastikan sudah npm install @faker-js/faker

module.exports = function(app) {
    const availableTypes = ["person", "company", "product", "address", "internet", "finance", "vehicle", "lorem", "date"];

    async function generateFakeData(type, count) {
      try {
          let data;
          switch (type) {
            case "person": data = Array.from({ length: Number(count) }, () => ({ name: faker.person.fullName(), email: faker.internet.email(), avatar: faker.image.avatar(), phone: faker.phone.number(), birthDate: faker.date.past(), gender: faker.person.gender() })); break;
            case "company": data = Array.from({ length: Number(count) }, () => ({ name: faker.company.name(), catchPhrase: faker.company.catchPhrase(), address: faker.location.streetAddress(), website: faker.internet.url() })); break;
            case "product": data = Array.from({ length: Number(count) }, () => ({ name: faker.commerce.productName(), price: faker.commerce.price(), category: faker.commerce.department(), description: faker.commerce.productDescription() })); break;
            case "address": data = Array.from({ length: Number(count) }, () => ({ street: faker.location.streetAddress(), city: faker.location.city(), country: faker.location.country(), zipCode: faker.location.zipCode() })); break;
            case "internet": data = Array.from({ length: Number(count) }, () => ({ email: faker.internet.email(), username: faker.internet.userName(), password: faker.internet.password(), url: faker.internet.url() })); break;
            case "finance": data = Array.from({ length: Number(count) }, () => ({ accountNumber: faker.finance.accountNumber(), amount: faker.finance.amount(), currency: faker.finance.currencyName() })); break;
            case "vehicle": data = Array.from({ length: Number(count) }, () => ({ manufacturer: faker.vehicle.manufacturer(), model: faker.vehicle.model(), type: faker.vehicle.type() })); break;
            case "lorem": data = Array.from({ length: Number(count) }, () => ({ word: faker.lorem.word(), sentence: faker.lorem.sentence(), paragraph: faker.lorem.paragraph() })); break;
            case "date": data = Array.from({ length: Number(count) }, () => ({ past: faker.date.past(), future: faker.date.future(), recent: faker.date.recent() })); break;
            default: throw new Error("Tipe data palsu tidak valid."); // Seharusnya tidak terjadi
          }
          return data;
      } catch (error) {
          console.error("Faker error:", error.message);
          throw error;
      }
    }

    const handleRequest = async (req, res) => {
        try {
            const params = req.method === 'GET' ? req.query : req.body;
            const { apikey, type, count = 1 } = params;

            // 1. Validasi API Key
            if (!global.apikey.includes(apikey)) {
                return res.json({ status: false, error: 'Apikey invalid' });
            }

            // 2. Validasi Parameter 'type'
            if (!type) { return res.status(400).json({ status: false, error: "Parameter 'type' wajib diisi", availableTypes: availableTypes }); }
            if (typeof type !== "string" || !availableTypes.includes(type.trim())) { return res.status(400).json({ status: false, error: "Tipe tidak valid", availableTypes: availableTypes }); }

            // 3. Validasi Parameter 'count'
            const parsedCount = Number(count);
            if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 100) { return res.status(400).json({ status: false, error: "Parameter 'count' harus angka antara 1 dan 100" }); }

            // 4. Generate Data
            const result = await generateFakeData(type.trim(), parsedCount);

            // 5. Kirim Respons Sukses
            res.status(200).json({
                status: true,
                count: result.length,
                result: result
            });

        } catch (error) {
            // 6. Tangani Error
            console.error(`[fakedata ${req.method}] Error:`, error.message);
            res.json({ status: false, error: error.message });
        }
    };

    app.get('/tools/fake-data', handleRequest);
    app.post('/tools/fake-data', handleRequest);
};
