// Константы количества фигур в наборе (для одного цвета)
const PIECES_MULTIPLIER = {
    king: 1, queen: 1, bishop: 2, knight: 2, rook: 2, pawn: 8
};

// Временные базы данных (до внедрения Firebase)
let resinsDB = [];
let setsDB = [];

// Навигация по вкладкам
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Добавление смолы
function addResin() {
    const resin = {
        id: Date.now(),
        brand: document.getElementById('resin-brand').value,
        name: document.getElementById('resin-name').value,
        color: document.getElementById('resin-color').value,
        price: parseFloat(document.getElementById('resin-price').value), // за 1 кг
        density: parseFloat(document.getElementById('resin-density').value) // g/cm3
    };
    
    resinsDB.push(resin);
    updateSelects();
    alert('Смола добавлена!');
}

// Добавление набора
function addSet() {
    const set = {
        id: Date.now(),
        name: document.getElementById('set-name').value,
        timeWhite: parseFloat(document.getElementById('time-white').value),
        timeBlack: parseFloat(document.getElementById('time-black').value),
        weights: {
            king: parseFloat(document.getElementById('w-king').value),
            queen: parseFloat(document.getElementById('w-queen').value),
            bishop: parseFloat(document.getElementById('w-bishop').value),
            knight: parseFloat(document.getElementById('w-knight').value),
            rook: parseFloat(document.getElementById('w-rook').value),
            pawn: parseFloat(document.getElementById('w-pawn').value),
        }
    };
    
    setsDB.push(set);
    updateSelects();
    alert('Набор добавлен!');
}

// Обновление выпадающих списков
function updateSelects() {
    const setSelect = document.getElementById('select-set');
    const rwSelect = document.getElementById('select-resin-white');
    const rbSelect = document.getElementById('select-resin-black');
    
    setSelect.innerHTML = setsDB.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    const resinOptions = resinsDB.map(r => `<option value="${r.id}">${r.brand} ${r.name} (${r.color})</option>`).join('');
    rwSelect.innerHTML = resinOptions;
    rbSelect.innerHTML = resinOptions;
}

// Главный расчет
function calculateTotal() {
    const setId = document.getElementById('select-set').value;
    const rwId = document.getElementById('select-resin-white').value;
    const rbId = document.getElementById('select-resin-black').value;

    if (!setId || !rwId || !rbId) {
        alert("Добавьте и выберите набор и смолы!");
        return;
    }

    const set = setsDB.find(s => s.id == setId);
    const rWhite = resinsDB.find(r => r.id == rwId);
    const rBlack = resinsDB.find(r => r.id == rbId);

    // Подсчет веса одной половины (16 фигур)
    let halfWeight = 0;
    for (const [piece, count] of Object.entries(PIECES_MULTIPLIER)) {
        halfWeight += set.weights[piece] * count;
    }

    // Функция расчета для цвета
    const calcSide = (weight, resin, time) => {
        const costPerGram = resin.price / 1000;
        const totalCost = weight * costPerGram;
        const volumeMl = weight / resin.density; // 1 g/cm3 = 1 ml
        return { cost: totalCost, vol: volumeMl, weight: weight, time: time };
    };

    const whiteData = calcSide(halfWeight, rWhite, set.timeWhite);
    const blackData = calcSide(halfWeight, rBlack, set.timeBlack);

    const resDiv = document.getElementById('results');
    resDiv.classList.remove('hidden');
    
    resDiv.innerHTML = `
        <h3>Расчет: ${set.name}</h3>
        <p>⚪ <strong>Белые:</strong> ${whiteData.weight.toFixed(1)} г | ${whiteData.vol.toFixed(1)} мл | ${whiteData.time} ч | <strong>${whiteData.cost.toFixed(2)} грн</strong></p>
        <p>⚫ <strong>Черные:</strong> ${blackData.weight.toFixed(1)} г | ${blackData.vol.toFixed(1)} мл | ${blackData.time} ч | <strong>${blackData.cost.toFixed(2)} грн</strong></p>
        <hr style="margin: 10px 0; border: 0; border-top: 1px solid rgba(0,0,0,0.1);">
        <p class="total-highlight">📊 ИТОГО: ${(whiteData.cost + blackData.cost).toFixed(2)} грн</p>
        <p>Общий объем: ${(whiteData.vol + blackData.vol).toFixed(1)} мл</p>
        <p>Общее время: ${(whiteData.time + blackData.time)} часов</p>
    `;
}
