// --- ИНИЦИАЛИЗАЦИЯ FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAXGZBBUFANaFuLP0jHUEJqc6tobWViTxI",
    authDomain: "chessprintcalc.firebaseapp.com",
    projectId: "chessprintcalc",
    storageBucket: "chessprintcalc.firebasestorage.app",
    messagingSenderId: "840227012372",
    appId: "1:840227012372:web:b73569955efe82f7278c01"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage(); // Подключаем Storage

const PIECES_MULTIPLIER = { king: 1, queen: 1, bishop: 2, knight: 2, rook: 2, pawn: 8 };
const pieceTypes = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];

let resinsDB = [];
let setsDB = [];
let currentUser = null;
let currentTab = 'view';

// Состояния редактирования
let editingResinId = null;
let editingSetId = null;

// --- НАВИГАЦИЯ ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        
        if (currentTab.includes('admin')) {
            if (currentUser) {
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('admin-workspace').classList.remove('hidden');
                document.getElementById(currentTab).classList.add('active');
            } else {
                document.getElementById('login-section').classList.remove('hidden');
                document.getElementById('admin-workspace').classList.add('hidden');
            }
        } else {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('admin-workspace').classList.add('hidden');
            document.getElementById(currentTab).classList.add('active');
        }
    });
});

// --- АВТОРИЗАЦИЯ ---
auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        document.getElementById('admin-email-display').innerText = user.email;
        if (currentTab.includes('admin')) {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('admin-workspace').classList.remove('hidden');
            document.getElementById(currentTab).classList.add('active');
        }
    }
});

function loginAdmin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Ошибка: " + e.message));
}

function logoutAdmin() {
    auth.signOut().then(() => location.reload());
}

// --- СЛУШАТЕЛИ БД В РЕАЛЬНОМ ВРЕМЕНИ ---
db.collection("resins").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    resinsDB = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateSelects();
    renderAdminResins();
});

db.collection("chess_sets").orderBy("createdAt", "desc").onSnapshot(snapshot => {
    setsDB = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateSelects();
    renderAdminSets();
});

// --- РАБОТА СО СМОЛАМИ (CRUD) ---
function saveResin() {
    const resinData = {
        brand: document.getElementById('resin-brand').value,
        name: document.getElementById('resin-name').value,
        color: document.getElementById('resin-color').value,
        price: parseFloat(document.getElementById('resin-price').value) || 0,
        density: parseFloat(document.getElementById('resin-density').value) || 0,
        createdAt: editingResinId ? undefined : firebase.firestore.FieldValue.serverTimestamp() // сохраняем старое время при ред.
    };

    if (editingResinId) {
        db.collection("resins").doc(editingResinId).update(resinData)
            .then(() => { alert("Обновлено!"); cancelResinEdit(); })
            .catch(e => alert("Ошибка: " + e.message));
    } else {
        db.collection("resins").add(resinData)
            .then(() => { alert("Добавлено!"); cancelResinEdit(); })
            .catch(e => alert("Ошибка: " + e.message));
    }
}

function editResin(id) {
    const r = resinsDB.find(x => x.id === id);
    if(!r) return;
    
    editingResinId = id;
    document.getElementById('resin-form-title').innerText = "Редактировать смолу";
    document.getElementById('resin-brand').value = r.brand;
    document.getElementById('resin-name').value = r.name;
    document.getElementById('resin-color').value = r.color;
    document.getElementById('resin-price').value = r.price;
    document.getElementById('resin-density').value = r.density;
    
    document.getElementById('btn-save-resin').innerText = "Сохранить изменения";
    document.getElementById('btn-cancel-resin').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteResin(id) {
    if(confirm("Удалить эту смолу?")) {
        db.collection("resins").doc(id).delete();
    }
}

function cancelResinEdit() {
    editingResinId = null;
    document.getElementById('resin-form-title').innerText = "Добавить смолу";
    document.getElementById('btn-save-resin').innerText = "Сохранить";
    document.getElementById('btn-cancel-resin').classList.add('hidden');
    ['brand', 'name', 'color', 'price', 'density'].forEach(id => document.getElementById(`resin-${id}`).value = '');
}

function renderAdminResins() {
    const container = document.getElementById('admin-resin-list');
    container.innerHTML = resinsDB.map(r => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${r.brand} ${r.name}</strong>
                <span>Цвет: ${r.color} | ${r.price} грн | ${r.density} g/cm³</span>
            </div>
            <div class="list-actions">
                <button class="btn-edit" onclick="editResin('${r.id}')">Ред.</button>
                <button class="btn-delete" onclick="deleteResin('${r.id}')">Удал.</button>
            </div>
        </div>
    `).join('');
}

// --- РАБОТА С НАБОРАМИ И ФОТО (CRUD) ---

// Превью выбранного фото
document.getElementById('set-photo-file').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('preview-img').src = URL.createObjectURL(file);
        document.getElementById('upload-preview').classList.remove('hidden');
    }
});

async function saveSet() {
    const btn = document.getElementById('btn-save-set');
    btn.innerText = "Сохранение...";
    btn.disabled = true;

    try {
        let photoUrl = document.getElementById('set-photo-url').value; // если уже была (при редактировании)
        const fileInput = document.getElementById('set-photo-file');
        const file = fileInput.files[0];

        // Если выбрали новое фото - грузим в Storage
        if (file) {
            const storageRef = storage.ref('chess_sets/' + Date.now() + '_' + file.name);
            const snapshot = await storageRef.put(file);
            photoUrl = await snapshot.ref.getDownloadURL();
        }

        const piecesData = {};
        pieceTypes.forEach(p => {
            piecesData[p] = {
                weight: parseFloat(document.getElementById(`w-${p}`).value) || 0,
                height: parseFloat(document.getElementById(`h-${p}`).value) || 0,
                diameter: parseFloat(document.getElementById(`d-${p}`).value) || 0
            };
        });

        const setData = {
            name: document.getElementById('set-name').value,
            photo: photoUrl,
            timeWhite: parseFloat(document.getElementById('time-white').value) || 0,
            timeBlack: parseFloat(document.getElementById('time-black').value) || 0,
            pieces: piecesData
        };

        if (editingSetId) {
            await db.collection("chess_sets").doc(editingSetId).update(setData);
            alert("Набор обновлен!");
        } else {
            setData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("chess_sets").add(setData);
            alert("Набор добавлен!");
        }
        
        cancelSetEdit();
    } catch (e) {
        alert("Ошибка сохранения: " + e.message);
    } finally {
        btn.innerText = editingSetId ? "Сохранить изменения" : "Сохранить набор";
        btn.disabled = false;
    }
}

function editSet(id) {
    const s = setsDB.find(x => x.id === id);
    if(!s) return;
    
    editingSetId = id;
    document.getElementById('set-form-title').innerText = "Редактировать набор";
    document.getElementById('set-name').value = s.name;
    document.getElementById('time-white').value = s.timeWhite;
    document.getElementById('time-black').value = s.timeBlack;
    document.getElementById('set-photo-url').value = s.photo || "";
    
    if(s.photo) {
        document.getElementById('preview-img').src = s.photo;
        document.getElementById('upload-preview').classList.remove('hidden');
    }

    pieceTypes.forEach(p => {
        if(s.pieces && s.pieces[p]) {
            document.getElementById(`w-${p}`).value = s.pieces[p].weight || '';
            document.getElementById(`h-${p}`).value = s.pieces[p].height || '';
            document.getElementById(`d-${p}`).value = s.pieces[p].diameter || '';
        }
    });

    document.getElementById('btn-save-set').innerText = "Сохранить изменения";
    document.getElementById('btn-cancel-set').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteSet(id) {
    if(confirm("Точно удалить набор?")) {
        db.collection("chess_sets").doc(id).delete();
    }
}

function cancelSetEdit() {
    editingSetId = null;
    document.getElementById('set-form-title').innerText = "Добавить набор шахмат";
    document.getElementById('btn-save-set').innerText = "Сохранить набор";
    document.getElementById('btn-cancel-set').classList.add('hidden');
    document.getElementById('set-name').value = '';
    document.getElementById('time-white').value = '';
    document.getElementById('time-black').value = '';
    document.getElementById('set-photo-url').value = '';
    document.getElementById('set-photo-file').value = '';
    document.getElementById('upload-preview').classList.add('hidden');
    
    pieceTypes.forEach(p => {
        document.getElementById(`w-${p}`).value = '';
        document.getElementById(`h-${p}`).value = '';
        document.getElementById(`d-${p}`).value = '';
    });
}

function renderAdminSets() {
    const container = document.getElementById('admin-sets-list');
    container.innerHTML = setsDB.map(s => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${s.name}</strong>
                <span>Время: Б ${s.timeWhite}ч / Ч ${s.timeBlack}ч</span>
            </div>
            <div class="list-actions">
                <button class="btn-edit" onclick="editSet('${s.id}')">Ред.</button>
                <button class="btn-delete" onclick="deleteSet('${s.id}')">Удал.</button>
            </div>
        </div>
    `).join('');
}

// --- ИНТЕРФЕЙС КАЛЬКУЛЯТОРА ---
function updateSelects() {
    const rw = document.getElementById('select-resin-white');
    const rb = document.getElementById('select-resin-black');
    const ss = document.getElementById('select-set');
    
    const rOpts = '<option value="">Выберите смолу...</option>' + resinsDB.map(r => `<option value="${r.id}">${r.brand} ${r.name} (${r.color})</option>`).join('');
    if(rw && rw.options.length <= 1) rw.innerHTML = rOpts;
    if(rb && rb.options.length <= 1) rb.innerHTML = rOpts;
    
    if(ss && ss.options.length <= 1) {
        ss.innerHTML = '<option value="">Выберите набор...</option>' + setsDB.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
}

function updateCalcPhoto() {
    const setId = document.getElementById('select-set').value;
    const photoContainer = document.getElementById('calc-photo-container');
    const photoImg = document.getElementById('calc-set-photo');
    
    if(!setId) { photoContainer.style.display = 'none'; return; }
    
    const set = setsDB.find(s => s.id === setId);
    if(set && set.photo) {
        photoImg.src = set.photo;
        photoContainer.style.display = 'block';
    } else {
        photoContainer.style.display = 'none';
    }
}

function calculateTotal() {
    const setId = document.getElementById('select-set').value;
    const rwId = document.getElementById('select-resin-white').value;
    const rbId = document.getElementById('select-resin-black').value;

    if (!setId || !rwId || !rbId) { alert("Выберите набор и обе смолы!"); return; }

    const set = setsDB.find(s => s.id === setId);
    const rWhite = resinsDB.find(r => r.id === rwId);
    const rBlack = resinsDB.find(r => r.id === rbId);

    let halfWeight = 0;
    for (const [piece, count] of Object.entries(PIECES_MULTIPLIER)) {
        if(set.pieces && set.pieces[piece]) halfWeight += (set.pieces[piece].weight * count);
    }

    const calcSide = (weight, resin, time) => {
        return { cost: weight * (resin.price / 1000), vol: weight / resin.density, weight: weight, time: time };
    };

    const whiteData = calcSide(halfWeight, rWhite, set.timeWhite);
    const blackData = calcSide(halfWeight, rBlack, set.timeBlack);
    const totalVol = whiteData.vol + blackData.vol;

    const resDiv = document.getElementById('results');
    resDiv.classList.remove('hidden');
    
    resDiv.innerHTML = `
        <h3>Смета: ${set.name}</h3>
        <p>⚪ <strong>Белые:</strong> ${whiteData.weight.toFixed(1)}г | ${whiteData.vol.toFixed(1)}мл | ${whiteData.time}ч | <strong>${whiteData.cost.toFixed(2)} грн</strong></p>
        <p>⚫ <strong>Черные:</strong> ${blackData.weight.toFixed(1)}г | ${blackData.vol.toFixed(1)}мл | ${blackData.time}ч | <strong>${blackData.cost.toFixed(2)} грн</strong></p>
        <hr style="margin: 15px 0; border: 0; border-top: 1px solid rgba(0,0,0,0.1);">
        <p class="total-highlight">Итоговая себестоимость: ${(whiteData.cost + blackData.cost).toFixed(2)} грн</p>
        <p style="color: #555; font-size: 13px; margin-top: 5px;">Общий объем: ${totalVol.toFixed(1)} мл (≈ ${(totalVol/1000).toFixed(2)} л)</p>
        <p style="color: #555; font-size: 13px;">Общее время: ${(whiteData.time + blackData.time)} часов</p>
    `;
}
