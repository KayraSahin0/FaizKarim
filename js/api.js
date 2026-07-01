// Kendi EVDS API anahtarınızı buraya girin
const EVDS_API_KEY = "sAMzl5qgMd";

export async function fetchInflationRate() {
    // TP.TUFE1AY.T1 -> TÜFE Aylık Değişim Oranı (%)
    // Not: EVDS API doğrudan client-side'dan yapıldığında CORS hatası verebilir.
    // Yakalanan hatalar try/catch ile yakalanarak UI üzerinde manuel veri girişine izin verilecektir.

    const today = new Date();
    // Bitiş tarihi: Bugün
    const endDate = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    // Başlangıç tarihi: En az son 3 ayı kapsayalım ki açıklanan son veriyi kaçırmayalım
    today.setMonth(today.getMonth() - 3);
    const startDate = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`;

    const url = `https://evds2.tcmb.gov.tr/service/evds/series=TP.TUFE1AY.T1&startDate=${startDate}&endDate=${endDate}&type=json&key=${EVDS_API_KEY}`;

    try {
        if (!EVDS_API_KEY || EVDS_API_KEY === "sAMzl5qgM") {
            throw new Error("API Key eksik veya varsayılan değerde.");
        }

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const items = data.items || [];
        let latestInflation = null;

        // Son geçerli (null olmayan) veriyi sondan başa doğru arıyoruz
        for (let i = items.length - 1; i >= 0; i--) {
            // Aylık değişim serisi: TP_TUFE1AY_T1
            if (items[i]["TP_TUFE1AY_T1"] !== null && items[i]["TP_TUFE1AY_T1"] !== undefined) {
                latestInflation = parseFloat(items[i]["TP_TUFE1AY_T1"]);
                break;
            }
        }

        if (latestInflation === null) {
            throw new Error("Geçerli enflasyon verisi bulunamadı");
        }

        return latestInflation;

    } catch (error) {
        console.error("TCMB EVDS API Hatası:", error.message);
        // Hata fırlatarak app.js içerisinde catch bloğuna düşmesini sağlıyoruz
        throw error;
    }
}
