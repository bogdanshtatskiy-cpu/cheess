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
const storage = firebase.storage();

const PIECES_MULTIPLIER = { king: 1, queen: 1, bishop: 2, knight: 2, rook: 2, pawn: 8 };
const pieceTypes = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];

let resinsDB = [];
let setsDB = [];
let currentUser = null;

let editingResinId = null;
let editingSetId = null;

// --- АВТОРИЗАЦИЯ И UI ---
auth.onAuthStateChanged(user => {
    currentUser = user;
    const authBtn = document.getElementById('header-auth-btn');
    const adminTabs = document.querySelectorAll('.admin-only');
    
    if (user) {
        authBtn.innerText = "Выйти";
        authBtn.onclick = logoutAdmin;
        adminTabs.forEach(tab => tab.classList.remove('hidden'));
        closeAuthModal();
    } else {
        authBtn.innerText = "Войти";
        authBtn.onclick = openAuthModal;
        adminTabs.forEach(tab => tab.classList.add('hidden'));
        // Возврат на вкладку просмотра, если вышли из админки
        document.querySelector('[data-tab="view"]').click();
    }
});

function openAuthModal() {
    document.getElementById('auth-modal-overlay').classList.remove('hidden');
}

function closeAuthModal() {
    document.getElementById('auth-modal-overlay').classList.add('hidden');
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-pass').value = '';
}

function loginAdmin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert("Ошибка входа: " + e.message));
}

function logoutAdmin() {
    auth.signOut();
}

// --- НАВИГАЦИЯ ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            setTimeout(() => c.style.display = 'none', 50); // плавный fade
        });
        
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.tab);
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 50);
    });
});

// --- БАЗА ДАННЫХ (РЕАЛ-ТАЙМ) ---
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

// --- СМОЛЫ (CRUD) ---
function saveResin() {
    const data = {
        brand: document.getElementById('resin-brand').value,
        name: document.getElementById('resin-name').value,
        color: document.getElementById('resin-color').value,
        price: parseFloat(document.getElementById('resin-price').value) || 0,
        density: parseFloat(document.getElementById('resin-density').value) || 0,
        createdAt: editingResinId ? undefined : firebase.firestore.FieldValue.serverTimestamp()
    };

    const action = editingResinId 
        ? db.collection("resins").doc(editingResinId).update(data)
        : db.collection("resins").add(data);

    action.then(() => cancelResinEdit()).catch(e => alert("Ошибка: " + e.message));
}

function editResin(id) {
    const r = resinsDB.find(x => x.id === id);
    if(!r) return;
    
    editingResinId = id;
    document.getElementById('resin-form-title').innerText = "Редактирование";
    document.getElementById('resin-brand').value = r.brand;
    document.getElementById('resin-name').value = r.name;
    document.getElementById('resin-color').value = r.color;
    document.getElementById('resin-price').value = r.price;
    document.getElementById('resin-density').value = r.density;
    
    document.getElementById('btn-save-resin').innerText = "Обновить";
    document.getElementById('btn-cancel-resin').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteResin(id) {
    if(confirm("Удалить смолу?")) db.collection("resins").doc(id).delete();
}

function cancelResinEdit() {
    editingResinId = null;
    document.getElementById('resin-form-title').innerText = "Добавить смолу";
    document.getElementById('btn-save-resin').innerText = "Сохранить";
    document.getElementById('btn-cancel-resin').classList.add('hidden');
    ['brand', 'name', 'color', 'price', 'density'].forEach(id => document.getElementById(`resin-${id}`).value = '');
}

function renderAdminResins() {
    document.getElementById('admin-resin-list').innerHTML = resinsDB.map(r => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${r.brand} ${r.name}</strong>
                <span>${r.color} | ${r.price} грн | ${r.density} g/cm³</span>
            </div>
            <div class="list-actions">
                <button class="btn-edit" onclick="editResin('${r.id}')">Ред</button>
                <button class="btn-delete" onclick="deleteResin('${r.id}')">Удал</button>
            </div>
        </div>
    `).join('');
}

// --- НАБОРЫ (CRUD) ---
document.getElementById('set-photo-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('preview-img').src = URL.createObjectURL(file);
        document.getElementById('upload-preview').classList.remove('hidden');
    }
});

async function saveSet() {
    const btn = document.getElementById('btn-save-set');
    btn.innerText = "Сохранение..."; btn.disabled = true;

    try {
        let photoUrl = document.getElementById('set-photo-url').value;
        const file = document.getElementById('set-photo-file').files[0];

        if (file) {
            const ref = storage.ref('chess_sets/' + Date.now() + '_' + file.name);
            const snap = await ref.put(file);
            photoUrl = await snap.ref.getDownloadURL();
        }

        const piecesData = {};
        pieceTypes.forEach(p => {
            piecesData[p] = {
                weight: parseFloat(document.getElementById(`w-${p}`).value) || 0,
                height: parseFloat(document.getElementById(`h-${p}`).value) || 0,
                diameter: parseFloat(document.getElementById(`d-${p}`).value) || 0
            };
        });

        const data = {
            name: document.getElementById('set-name').value,
            photo: photoUrl,
            timeWhite: parseFloat(document.getElementById('time-white').value) || 0,
            timeBlack: parseFloat(document.getElementById('time-black').value) || 0,
            pieces: piecesData
        };

        if (editingSetId) {
            await db.collection("chess_sets").doc(editingSetId).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("chess_sets").add(data);
        }
        cancelSetEdit();
    } catch (e) {
        alert("Ошибка: " + e.message);
    } finally {
        btn.innerText = editingSetId ? "Обновить" : "Сохранить набор";
        btn.disabled = false;
    }
}

function editSet(id) {
    const s = setsDB.find(x => x.id === id);
    if(!s) return;
    
    editingSetId = id;
    document.getElementById('set-form-title').innerText = "Редактирование";
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

    document.getElementById('btn-save-set').innerText = "Обновить";
    document.getElementById('btn-cancel-set').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteSet(id) {
    if(confirm("Удалить набор?")) db.collection("chess_sets").doc(id).delete();
}

function cancelSetEdit() {
    editingSetId = null;
    document.getElementById('set-form-title').innerText = "Добавить набор";
    document.getElementById('btn-save-set').innerText = "Сохранить набор";
    document.getElementById('btn-cancel-set').classList.add('hidden');
    document.getElementById('set-name').value = '';
    document.getElementById('time-white').value = '';
    document.getElementById('time-black').value = '';
    document.getElementById('set-photo-url').value = '';
    document.getElementById('set-photo-file').value = '';
    document.getElementById('upload-preview').classList.add('hidden');
    
    pieceTypes.forEach(p => {
        ['w', 'h', 'd'].forEach(prefix => document.getElementById(`${prefix}-${p}`).value = '');
    });
}

function renderAdminSets() {
    document.getElementById('admin-sets-list').innerHTML = setsDB.map(s => `
        <div class="list-item">
            <div class="list-item-info">
                <strong>${s.name}</strong>
                <span>Б: ${s.timeWhite}ч | Ч: ${s.timeBlack}ч</span>
            </div>
            <div class="list-actions">
                <button class="btn-edit" onclick="editSet('${s.id}')">Ред</button>
                <button class="btn-delete" onclick="deleteSet('${s.id}')">Удал</button>
            </div>
        </div>
    `).join('');
}

// --- КАЛЬКУЛЯТОР ---
function updateSelects() {
    const rw = document.getElementById('select-resin-white');
    const rb = document.getElementById('select-resin-black');
    const ss = document.getElementById('select-set');
    
    const rOpts = '<option value="">Выберите смолу...</option>' + resinsDB.map(r => `<option value="${r.id}">${r.brand} ${r.name} (${r.color})</option>`).join('');
    if(rw) rw.innerHTML = rOpts;
    if(rb) rb.innerHTML = rOpts;
    
    if(ss) ss.innerHTML = '<option value="">Выберите набор...</option>' + setsDB.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function updateCalcPhoto() {
    const setId = document.getElementById('select-set').value;
    const cont = document.getElementById('calc-photo-container');
    const img = document.getElementById('calc-set-photo');
    
    const set = setsDB.find(s => s.id === setId);
    if(set && set.photo) {
        img.src = set.photo;
        cont.style.display = 'block';
    } else {
        cont.style.display = 'none';
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

    let weight = 0;
    for (const [p, count] of Object.entries(PIECES_MULTIPLIER)) {
        if(set.pieces && set.pieces[p]) weight += (set.pieces[p].weight * count);
    }

    const wData = { cost: weight * (rWhite.price / 1000), vol: weight / rWhite.density, t: set.timeWhite };
    const bData = { cost: weight * (rBlack.price / 1000), vol: weight / rBlack.density, t: set.timeBlack };

    const res = document.getElementById('results');
    res.classList.remove('hidden');
    
    res.innerHTML = `
        <p>⚪ <strong>Белые:</strong> ${weight.toFixed(1)}г | ${wData.vol.toFixed(1)}мл | ${wData.t}ч <br>
        <span style="color:var(--text-secondary)">Стоимость:</span> <strong>${wData.cost.toFixed(2)} грн</strong></p>
        <div style="height:1px; background:var(--glass-border); margin:10px 0;"></div>
        <p>⚫ <strong>Черные:</strong> ${weight.toFixed(1)}г | ${bData.vol.toFixed(1)}мл | ${bData.t}ч <br>
        <span style="color:var(--text-secondary)">Стоимость:</span> <strong>${bData.cost.toFixed(2)} грн</strong></p>
        
        <div class="total-highlight">Итого: ${(wData.cost + bData.cost).toFixed(2)} грн</div>
        <p style="font-size:13px; color:var(--text-secondary); margin-top:8px;">Общий объем: ${(wData.vol + bData.vol).toFixed(1)} мл</p>
        <p style="font-size:13px; color:var(--text-secondary);">Общее время: ${(wData.t + bData.t)} ч</p>
    `;
}
