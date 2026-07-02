export function calculateInterest(balance, interestRate, bankLimit, termDays, taxRate) {
    // 1. Faiz İşleyen Anapara
    const principal = Math.max(0, balance - bankLimit);
    
    // 2. Günlük Brüt Faiz
    const dailyGrossInterest = (principal * (interestRate / 100)) / 365;
    
    // 3. Günlük Vergi (Kullanıcının girdiği Stopaj)
    const dailyTax = dailyGrossInterest * (taxRate / 100);
    
    // 4. Günlük Net Kazanç
    const dailyNetIncome = dailyGrossInterest - dailyTax;
    
    // 5. Toplam Net Faiz Geliri
    const totalNetProfit = dailyNetIncome * termDays;
    
    // 6. Dönem Sonu Toplam Bakiye (Anapara + Net Faiz)
    const finalBalance = balance + totalNetProfit;

    // Sayısal değerleri doğrudan dönüyoruz, formatlama UI (app.js) tarafında yapılacak
    return {
        principal,
        dailyGrossInterest,
        dailyTax,
        dailyNetIncome,
        totalNetProfit,
        finalBalance
    };
}
