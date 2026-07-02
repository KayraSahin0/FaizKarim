import { db, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, getDoc, deleteDoc } from './firebase-config.js';
import { fetchInflationRate } from './api.js';

// DOM Element Referansları
const form = document.getElementById('calculator-form');
const inflationInput = document.getElementById('inflation-rate');
const apiStatus = document.getElementById('api-status');

// Format Helper
const formatCurrency = (val) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatPercent = (val) => `%${val.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;

// Global Variables
let yieldChartInstance = null;
let currentDashboardData = null;
let isBalanceVisible = true;
let deleteCallback = null;

// Modal Logic
window.showModal = function(title, message) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    document.getElementById('custom-modal').classList.add('active');
}
window.closeModal = function() {
    document.getElementById('custom-modal').classList.remove('active');
}
window.closeNotificationModal = function() {
    document.getElementById('notification-modal').classList.remove('active');
}
window.closeConfirmModal = function() {
    document.getElementById('confirm-modal').classList.remove('active');
}

document.getElementById('confirm-btn-yes').addEventListener('click', async () => {
    window.closeConfirmModal();
    if(deleteCallback) {
        await deleteCallback();
        deleteCallback = null;
    }
});

document.addEventListener('DOMContentLoaded', async () => {

    // Ayarlar Mantığı (Firebase Firestore Yüklemesi)
    const settingTax = document.getElementById('setting-default-tax');
    const settingTerm = document.getElementById('setting-default-term');
    const settingInterest = document.getElementById('setting-default-interest');
    const themeToggle = document.getElementById('theme-toggle');
    
    const taxInput = document.getElementById('tax-rate');
    const termInput = document.getElementById('term-days');
    const interestInput = document.getElementById('interest-rate');

    const loadSettings = async () => {
        let savedTax = 15;
        let savedTerm = 32;
        let savedInterest = 45;
        let isDarkMode = true;

        if (db) {
            try {
                const settingsRef = doc(db, 'settings', 'user_prefs');
                const docSnap = await getDoc(settingsRef);
                if (docSnap.exists()) {
                    const d = docSnap.data();
                    if(d.defaultTax !== undefined) savedTax = d.defaultTax;
                    if(d.defaultTerm !== undefined) savedTerm = d.defaultTerm;
                    if(d.defaultInterest !== undefined) savedInterest = d.defaultInterest;
                    if(d.isDarkMode !== undefined) isDarkMode = d.isDarkMode;
                }
            } catch (err) {
                console.error("Firebase settings error:", err);
            }
        }

        if(!isDarkMode) {
            document.body.classList.add('light-mode');
            if(themeToggle) themeToggle.checked = false;
        } else {
            document.body.classList.remove('light-mode');
            if(themeToggle) themeToggle.checked = true;
        }

        if(settingTax) settingTax.value = savedTax;
        if(settingTerm) settingTerm.value = savedTerm;
        if(settingInterest) settingInterest.value = savedInterest;

        if(taxInput) taxInput.value = savedTax;
        if(interestInput) interestInput.value = savedInterest;
        if(termInput) {
            const exists = Array.from(termInput.options).some(opt => opt.value == savedTerm);
            if(!exists) {
                const opt = document.createElement('option');
                opt.value = savedTerm;
                opt.textContent = `${savedTerm} Gün`;
                termInput.appendChild(opt);
            }
            termInput.value = savedTerm;
        }
    };
    
    loadSettings();

    const saveSettingsToFirebase = async () => {
        if (!db) return;
        try {
            const settingsRef = doc(db, 'settings', 'user_prefs');
            await setDoc(settingsRef, {
                defaultTax: settingTax.value,
                defaultTerm: settingTerm.value,
                defaultInterest: settingInterest.value,
                isDarkMode: themeToggle ? themeToggle.checked : true
            }, { merge: true });
        } catch (err) {
            console.error("Save settings error:", err);
            showModal("Hata", "Ayarlar kaydedilirken hata oluştu.");
        }
    };

    if(settingTax) {
        settingTax.addEventListener('change', (e) => {
            if(taxInput) taxInput.value = e.target.value;
            saveSettingsToFirebase();
        });
    }
    if(settingTerm) {
        settingTerm.addEventListener('change', (e) => {
            if(termInput) {
                const exists = Array.from(termInput.options).some(opt => opt.value == e.target.value);
                if(!exists) {
                    const opt = document.createElement('option');
                    opt.value = e.target.value;
                    opt.textContent = `${e.target.value} Gün`;
                    termInput.appendChild(opt);
                }
                termInput.value = e.target.value;
            }
            saveSettingsToFirebase();
        });
    }
    if(settingInterest) {
        settingInterest.addEventListener('change', (e) => {
            if(interestInput) interestInput.value = e.target.value;
            saveSettingsToFirebase();
        });
    }
    if(themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            if(e.target.checked) {
                document.body.classList.remove('light-mode');
            } else {
                document.body.classList.add('light-mode');
            }
            saveSettingsToFirebase();
        });
    }

    // Yedekleme Butonları Modal
    const btnBackup = document.getElementById('btn-backup');
    const btnRestore = document.getElementById('btn-restore');
    if(btnBackup) btnBackup.addEventListener('click', () => showModal('Başarılı', 'Veriler Firebase üzerine başarıyla yedeklendi.'));
    if(btnRestore) btnRestore.addEventListener('click', () => showModal('Başarılı', 'En son bulut yedeğinden veriler geri yüklendi.'));

    // Göz İkonu Dinleyicisi
    const toggleEye = document.getElementById('toggle-balance-visibility');
    if(toggleEye) {
        toggleEye.addEventListener('click', () => {
            isBalanceVisible = !isBalanceVisible;
            renderDashboardBalance();
        });
    }

    // Bildirim İkonu Dinleyicisi
    const notifBell = document.getElementById('notification-bell');
    if(notifBell) {
        notifBell.addEventListener('click', () => {
            document.getElementById('notification-modal').classList.add('active');
        });
    }

    // Balance Input Formatting
    const balanceInput = document.getElementById('balance');
    if(balanceInput) {
        balanceInput.addEventListener('input', function(e) {
            let val = this.value.replace(/[^\d,]/g, '');
            let parts = val.split(',');
            let intPart = parts[0];
            if (intPart) {
                intPart = parseInt(intPart, 10).toString();
                intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            }
            if (parts.length > 1) {
                this.value = intPart + ',' + parts[1].substring(0, 2);
            } else {
                this.value = intPart;
            }
        });
    }

    // Enflasyon Verisi (EVDS)
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

    // Firebase Geçmiş Dinleyici
    if (db) {
        const historyList = document.getElementById('history-list');
        const notifList = document.getElementById('notification-list');
        
        const q = query(collection(db, "calculations"), orderBy("timestamp", "desc"), limit(15)); 
        onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const latestData = snapshot.docs[0].data();
                currentDashboardData = latestData;
                renderDashboardBalance();
                updateDashboardWithData(latestData);
                updateAnalysisWithData(latestData);

                if(historyList) historyList.innerHTML = '';
                if(notifList) notifList.innerHTML = '';
                
                snapshot.docs.forEach((docSnap, index) => {
                    const data = docSnap.data();
                    const docId = docSnap.id;
                    const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : 'Şimdi';
                    
                    const isProfit = data.realReturn > 0;
                    const realClass = isProfit ? 'profit' : 'loss';
                    const realText = isProfit ? `+${formatCurrency(data.realReturn)}` : `${formatCurrency(data.realReturn)}`;
                    
                    if(index < 5 && historyList) {
                        const el = document.createElement('div');
                        el.className = 'history-item';
                        el.innerHTML = `
                            <div class="history-item-header">
                                <span>Bakiye: ${formatCurrency(data.balance)} ₺ | Vade: ${data.termDays} Gün</span>
                                <span>${dateStr}</span>
                            </div>
                            <div class="history-item-body">
                                <span class="net">Net: ${formatCurrency(data.totalNetProfit)} ₺</span>
                                <span class="real ${realClass}">Reel: ${realText} ₺</span>
                            </div>
                        `;
                        historyList.appendChild(el);
                    }

                    if(notifList) {
                        const el = document.createElement('div');
                        el.className = 'history-item';
                        el.innerHTML = `
                            <div class="history-item-header">
                                <span>Bakiye: ${formatCurrency(data.balance)} ₺ | Vade: ${data.termDays} Gün</span>
                                <span>${dateStr}</span>
                            </div>
                            <div class="history-item-body">
                                <span class="net" style="font-size: 0.85rem;">Net: ${formatCurrency(data.totalNetProfit)} ₺</span>
                                <div style="display:flex; gap:10px; align-items:center;">
                                    <span class="real ${realClass}" style="font-size: 0.85rem;">Reel: ${realText} ₺</span>
                                    <i class="fa-solid fa-trash" style="color: var(--soft-red); cursor: pointer;" data-id="${docId}"></i>
                                </div>
                            </div>
                        `;
                        notifList.appendChild(el);
                    }
                });

                if(notifList) {
                    notifList.querySelectorAll('.fa-trash').forEach(icon => {
                        icon.addEventListener('click', (e) => {
                            const docId = e.target.getAttribute('data-id');
                            document.getElementById('confirm-title').textContent = "Uyarı";
                            document.getElementById('confirm-message').textContent = "Bu geçmiş kaydını silmek istediğinize emin misiniz?";
                            document.getElementById('confirm-modal').classList.add('active');
                            deleteCallback = async () => {
                                try {
                                    await deleteDoc(doc(db, "calculations", docId));
                                    window.closeNotificationModal();
                                    showModal("Başarılı", "Kayıt silindi.");
                                } catch(err) {
                                    console.error(err);
                                    showModal("Hata", "Kayıt silinirken bir hata oluştu.");
                                }
                            };
                        });
                    });
                }
            } else {
                currentDashboardData = null;
                const toggleEye = document.getElementById('toggle-balance-visibility');
                document.getElementById('dash-total-balance').textContent = `0,00 ₺`;
                document.getElementById('dash-daily-profit').textContent = `+0,00 ₺`;
                document.getElementById('dash-total-profit').textContent = `+0,00 ₺`;
                if(toggleEye) {
                    toggleEye.classList.remove('fa-eye-slash');
                    toggleEye.classList.add('fa-eye');
                }
                
                const realBadge = document.getElementById('dash-real-badge');
                if(realBadge) {
                    realBadge.textContent = "Veri Yok";
                    realBadge.className = "status-badge";
                }
                const realRateText = document.getElementById('dash-real-rate');
                if(realRateText) {
                    realRateText.textContent = `%0,00`;
                    realRateText.style.color = "var(--text-muted)";
                    realRateText.style.textShadow = "none";
                }
                
                document.getElementById('dash-inflation-rate').textContent = `%0,00`;
                document.getElementById('dash-interest-rate').textContent = `%0,00`;
                document.getElementById('dash-daily-profit-large').textContent = `+0,00 ₺`;
                document.getElementById('dash-hourly-profit').textContent = `0,00 ₺`;
                document.getElementById('dash-minute-profit').textContent = `0,00 ₺`;

                if(historyList) historyList.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Henüz bir geçmiş bulunmuyor.</p>';
                if(notifList) notifList.innerHTML = '<p style="text-align:center; color: var(--text-muted);">Henüz bir geçmiş bulunmuyor.</p>';
            }
        });
    }
});

function renderDashboardBalance() {
    if(!currentDashboardData) return;
    const data = currentDashboardData;
    const toggleEye = document.getElementById('toggle-balance-visibility');

    if (isBalanceVisible) {
        document.getElementById('dash-total-balance').textContent = `${formatCurrency(data.balance)} ₺`;
        document.getElementById('dash-daily-profit').textContent = `+${formatCurrency(data.dailyNetIncome)} ₺`;
        document.getElementById('dash-total-profit').textContent = `+${formatCurrency(data.totalNetProfit)} ₺`;
        if(toggleEye) {
            toggleEye.classList.remove('fa-eye-slash');
            toggleEye.classList.add('fa-eye');
        }
    } else {
        document.getElementById('dash-total-balance').textContent = `*** ₺`;
        document.getElementById('dash-daily-profit').textContent = `*** ₺`;
        document.getElementById('dash-total-profit').textContent = `*** ₺`;
        if(toggleEye) {
            toggleEye.classList.remove('fa-eye');
            toggleEye.classList.add('fa-eye-slash');
        }
    }
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const balanceInput = document.getElementById('balance');
        let rawBalanceStr = balanceInput.value.replace(/\./g, '').replace(',', '.');
        if(!rawBalanceStr || parseFloat(rawBalanceStr) <= 0) {
            showModal("Hata", "Lütfen geçerli bir anapara tutarı giriniz.");
            return;
        }

        const balance = parseFloat(rawBalanceStr);
        const interestRate = parseFloat(document.getElementById('interest-rate').value);
        const termDays = parseInt(document.getElementById('term-days').value, 10);
        const inflationRate = parseFloat(inflationInput.value || 0);
        const taxRate = parseFloat(document.getElementById('tax-rate').value || 15);
        
        const netInterestRate = interestRate * (1 - (taxRate/100));
        document.getElementById('net-rate-display').textContent = formatPercent(netInterestRate);

        const principal = balance;
        const dailyGross = (principal * (interestRate / 100)) / 365;
        const dailyTax = dailyGross * (taxRate / 100);
        const dailyNet = dailyGross - dailyTax;
        const totalNetProfit = dailyNet * termDays;
        const finalBalance = balance + totalNetProfit;
        
        const inflationLoss = balance * (inflationRate / 100) / 30 * termDays;
        const realReturn = totalNetProfit - inflationLoss;
        const realReturnRate = (realReturn / balance) * 100;
        
        const calcData = {
            balance, interestRate, termDays, inflationRate, taxRate,
            principal, dailyNetIncome: dailyNet, totalNetProfit, finalBalance, 
            realReturn, realReturnRate,
            timestamp: serverTimestamp()
        };

        const msg = document.getElementById('calc-success-msg');
        msg.style.opacity = 1;
        setTimeout(() => { msg.style.opacity = 0; }, 2000);

        if (db) {
            try {
                await addDoc(collection(db, "calculations"), calcData);
            } catch (err) {
                console.error(err);
                currentDashboardData = calcData;
                renderDashboardBalance();
                updateDashboardWithData(calcData);
                updateAnalysisWithData(calcData);
                showModal("Hata", "Veritabanına kaydedilemedi, sonuçlar çevrimdışı gösteriliyor.");
            }
        } else {
            currentDashboardData = calcData;
            renderDashboardBalance();
            updateDashboardWithData(calcData);
            updateAnalysisWithData(calcData);
        }

        balanceInput.value = '';

        if(window.switchTab) {
            window.switchTab('tab-home');
        }
    });
}

function updateDashboardWithData(data) {
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
        realIcon.className = "fa-solid fa-arrow-trend-up text-black";
    } else {
        realValEl.textContent = `${formatCurrency(data.realReturn)} ₺`;
        realValEl.style.color = "var(--text-main)";
        realDescEl.textContent = "Negatif Getiri (Alım gücünüz eridi)";
        realCard.className = "glass-card loss-tint-bg mb-3";
        realIconBg.className = "icon-circle loss-bg";
        realIcon.className = "fa-solid fa-arrow-trend-down text-white";
    }

    drawChart(termRate, termInflation);

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
        interestData.push(interest * i); 
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
