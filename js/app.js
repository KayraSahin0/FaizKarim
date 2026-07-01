import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from './firebase-config.js';
import { fetchInflationRate } from './api.js';

// DOM Element Referansları
const form = document.getElementById('calculator-form');
const inflationInput = document.getElementById('inflation-rate');
const apiStatus = document.getElementById('api-status');
const startDateInput = document.getElementById('start-date');

// Format Helper
const formatCurrency = (val) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercent = (val) => `%${val.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;

// Global Chart Instance
let yieldChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tarih Ayarlama
    const today = new Date();
    if(startDateInput) {
        startDateInput.value = today.toLocaleDateString('tr-TR');
    }

    // 2. Enflasyon Verisi (EVDS)
    try {
        if(apiStatus) {
            apiStatus.textContent = "(Çekiliyor...)";
            apiStatus.style.color = "var(--text-muted)";
        }
        const rate = await fetchInflationRate();
        if(inflationInput) inflationInput.value = rate.toFixed(2);
        if(apiStatus) {
            apiStatus.textContent = "✅";
            apiStatus.style.color = "var(--neon-green)";
        }
    } catch (error) {
        if(apiStatus) {
            apiStatus.textContent = "❌ Manuel Girin";
            apiStatus.style.color = "var(--soft-red)";
        }
    }

    // 3. Firebase Geçmiş Dinleyici & Dashboard Güncelleme
    if (db) {
        const q = query(collection(db, "calculations"), orderBy("timestamp", "desc"), limit(1)); // Son veriyi al
        onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                updateDashboardWithData(data);
                updateAnalysisWithData(data);
            }
        });
    }
});

// Hesaplama Formu Gönderimi
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const balance = parseFloat(document.getElementById('balance').value);
        const interestRate = parseFloat(document.getElementById('interest-rate').value);
        const termDays = parseInt(document.getElementById('term-days').value, 10);
        const inflationRate = parseFloat(inflationInput.value || 0);
        const taxRate = parseFloat(document.getElementById('tax-rate').value || 15);
        
        // Vadeye Göre Net Faiz Oranı
        const netInterestRate = interestRate * (1 - (taxRate/100));
        document.getElementById('net-rate-display').textContent = formatPercent(netInterestRate);

        // Hesaplama Motoru (Kendi içimizde yeniden yazıldı ki yeni parametrelere tam uyumlu olsun)
        const principal = balance;
        const dailyGross = (principal * (interestRate / 100)) / 365;
        const dailyTax = dailyGross * (taxRate / 100);
        const dailyNet = dailyGross - dailyTax;
        const totalNetProfit = dailyNet * termDays;
        const finalBalance = balance + totalNetProfit;
        
        // Reel Getiri
        const inflationLoss = balance * (inflationRate / 100) / 30 * termDays;
        const realReturn = totalNetProfit - inflationLoss;
        const realReturnRate = (realReturn / balance) * 100;
        
        const calcData = {
            balance, interestRate, termDays, inflationRate, taxRate,
            principal, dailyNetIncome: dailyNet, totalNetProfit, finalBalance, 
            realReturn, realReturnRate,
            timestamp: serverTimestamp()
        };

        // Başarı Mesajı
        const msg = document.getElementById('calc-success-msg');
        msg.style.opacity = 1;
        setTimeout(() => { msg.style.opacity = 0; }, 4000);

        // Firebase Kaydı
        if (db) {
            try {
                await addDoc(collection(db, "calculations"), calcData);
            } catch (err) {
                console.error(err);
                // Çevrimdışı / Hata durumunda UI'ı lokal verilerle besle
                updateDashboardWithData(calcData);
                updateAnalysisWithData(calcData);
            }
        }
    });
}

function updateDashboardWithData(data) {
    document.getElementById('dash-total-balance').textContent = `${formatCurrency(data.balance)} ₺`;
    document.getElementById('dash-daily-profit').textContent = `+${formatCurrency(data.dailyNetIncome)} ₺`;
    document.getElementById('dash-total-profit').textContent = `+${formatCurrency(data.totalNetProfit)} ₺`;
    
    // Reel Getiri
    const realBadge = document.getElementById('dash-real-badge');
    const realRateText = document.getElementById('dash-real-rate');
    
    if (data.realReturn > 0) {
        realBadge.textContent = "Kârdasınız";
        realBadge.className = "status-badge success-bg";
        realRateText.textContent = `+${formatPercent(data.realReturnRate)}`;
        realRateText.style.color = "var(--neon-green)";
        realRateText.style.textShadow = "0 0 20px rgba(0, 230, 118, 0.3)";
    } else {
        realBadge.textContent = "Zarardasınız";
        realBadge.className = "status-badge loss-bg";
        realRateText.textContent = `${formatPercent(data.realReturnRate)}`;
        realRateText.style.color = "var(--soft-red)";
        realRateText.style.textShadow = "0 0 20px rgba(239, 68, 68, 0.3)";
    }

    document.getElementById('dash-inflation-rate').textContent = formatPercent(data.inflationRate);
    
    const termRate = (data.totalNetProfit / data.balance) * 100;
    document.getElementById('dash-interest-rate').textContent = formatPercent(termRate);
    
    document.getElementById('dash-daily-profit-large').textContent = `+${formatCurrency(data.dailyNetIncome)} ₺`;
    document.getElementById('dash-hourly-profit').textContent = `${formatCurrency(data.dailyNetIncome / 24)} ₺`;
    document.getElementById('dash-minute-profit').textContent = `${formatCurrency(data.dailyNetIncome / 1440)} ₺`;
}

function updateAnalysisWithData(data) {
    const termRate = (data.totalNetProfit / data.balance) * 100;
    const termInflation = (data.inflationRate / 30) * data.termDays;

    document.getElementById('analysis-interest-val').textContent = formatPercent(termRate);
    document.getElementById('analysis-interest-bar').style.width = `${Math.min(termRate * 10, 100)}%`;
    
    document.getElementById('analysis-inflation-val').textContent = formatPercent(termInflation);
    document.getElementById('analysis-inflation-bar').style.width = `${Math.min(termInflation * 10, 100)}%`;
    
    const realValEl = document.getElementById('analysis-real-val');
    const realDescEl = document.getElementById('analysis-real-desc');
    const realCard = document.getElementById('analysis-real-card');
    const realIconBg = document.getElementById('analysis-icon-bg');
    const realIcon = document.getElementById('analysis-icon');

    if (data.realReturn > 0) {
        realValEl.textContent = `+${formatCurrency(data.realReturn)} ₺`;
        realValEl.style.color = "var(--text-main)";
        realDescEl.textContent = "Pozitif Getiri (Alım gücünüz arttı)";
        realCard.className = "glass-card success-tint-bg mb-3";
        realIconBg.className = "icon-circle success-bg";
        realIcon.className = "fa-solid fa-arrow-trend-up";
    } else {
        realValEl.textContent = `${formatCurrency(data.realReturn)} ₺`;
        realValEl.style.color = "var(--text-main)";
        realDescEl.textContent = "Negatif Getiri (Alım gücünüz eridi)";
        realCard.className = "glass-card loss-tint-bg mb-3";
        realIconBg.className = "icon-circle loss-bg";
        realIcon.className = "fa-solid fa-arrow-trend-down text-white";
    }

    drawChart(termRate, termInflation);

    // Tablo
    const tbody = document.getElementById('analysis-table-body');
    tbody.innerHTML = '';
    const months = ['1. Ay', '2. Ay', '3. Ay'];
    let currentBalance = data.balance;
    
    months.forEach((m) => {
        const monthlyInterest = (currentBalance * (data.interestRate / 100)) / 12 * (1 - data.taxRate/100);
        const monthlyInflationLoss = currentBalance * (data.inflationRate/100);
        const monthlyReal = monthlyInterest - monthlyInflationLoss;
        currentBalance += monthlyInterest;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m}</td>
            <td>${formatPercent((monthlyInterest/data.balance)*100)}</td>
            <td>${formatPercent(data.inflationRate)}</td>
            <td style="color: ${monthlyReal > 0 ? 'var(--neon-green)' : 'var(--soft-red)'}">${monthlyReal > 0 ? '+' : ''}${formatCurrency(monthlyReal)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function drawChart(interest, inflation) {
    const ctx = document.getElementById('yieldChart');
    if(!ctx) return;
    
    if (yieldChartInstance) {
        yieldChartInstance.destroy();
    }
    
    const labels = ['1. Ay', '2. Ay', '3. Ay', '4. Ay', '5. Ay', '6. Ay'];
    const interestData = [];
    const inflationData = [];
    
    for(let i=1; i<=6; i++) {
        interestData.push(interest * i); // Projeksiyon (Kümülatif)
        inflationData.push(inflation * i);
    }
    
    Chart.defaults.color = '#8A96A8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    yieldChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Faiz Getirisi (%)',
                    data: interestData,
                    borderColor: '#00E676',
                    backgroundColor: 'rgba(0, 230, 118, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Enflasyon Kaybı (%)',
                    data: inflationData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}
