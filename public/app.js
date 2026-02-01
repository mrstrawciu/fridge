// --- State ---
let products = [];
let config = { users: [], categories: [], units: [] };
let currentTab = 'products';

// --- DOM Elements ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadProducts();
  setupTabs();
  setupForm();
  setupSearch();
  setupModal();
  checkExpiring();
});

// --- API helpers ---
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res.json();
}

// --- Config ---
async function loadConfig() {
  config = await api('/api/config');
  populateSelects();
}

function populateSelects() {
  // Category filter
  const catFilter = $('#categoryFilter');
  catFilter.innerHTML = '<option value="">Wszystkie kategorie</option>';
  config.categories.forEach(c => {
    catFilter.innerHTML += `<option value="${c}">${c}</option>`;
  });

  // Form category
  const catSelect = $('#productCategory');
  catSelect.innerHTML = '';
  config.categories.forEach(c => {
    catSelect.innerHTML += `<option value="${c}">${c}</option>`;
  });

  // Form unit
  const unitSelect = $('#productUnit');
  unitSelect.innerHTML = '';
  config.units.forEach(u => {
    unitSelect.innerHTML += `<option value="${u}">${u}</option>`;
  });

  // Users
  const userSelect = $('#currentUser');
  userSelect.innerHTML = '';
  config.users.forEach(u => {
    userSelect.innerHTML += `<option value="${u}">${u}</option>`;
  });

  // Restore saved user
  const savedUser = localStorage.getItem('fridgeUser');
  if (savedUser) userSelect.value = savedUser;
  userSelect.addEventListener('change', () => {
    localStorage.setItem('fridgeUser', userSelect.value);
  });
}

// --- Products ---
async function loadProducts() {
  products = await api('/api/products');
  renderProducts();
}

function getExpiryStatus(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { status: 'expired', label: `Przeterminowany (${Math.abs(diffDays)} dni temu)`, class: 'expired' };
  if (diffDays === 0) return { status: 'expired', label: 'Przeterminowany dzisiaj!', class: 'expired' };
  if (diffDays <= 2) return { status: 'soon', label: `Za ${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'}`, class: 'soon' };
  return { status: 'ok', label: formatDate(dateStr), class: 'ok' };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderProducts() {
  const list = $('#productList');
  const empty = $('#emptyState');
  const search = $('#searchInput').value.toLowerCase();
  const catFilter = $('#categoryFilter').value;

  let filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search);
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  // Sort: expired first, then by expiry date
  filtered.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = filtered.map(p => {
    const exp = getExpiryStatus(p.expiryDate);
    const cardClass = exp.status === 'expired' ? 'expired' : (exp.status === 'soon' ? 'expiring-soon' : '');

    return `
      <div class="product-card ${cardClass}" data-id="${p.id}">
        <div class="product-card-header">
          <span class="product-name">${escapeHtml(p.name)}</span>
          <div class="product-actions">
            <button onclick="editProduct(${p.id})" title="Edytuj">&#x270F;&#xFE0F;</button>
            <button onclick="showDeleteModal(${p.id})" title="Usuń">&#x1F5D1;&#xFE0F;</button>
          </div>
        </div>
        <div class="product-meta">
          <span class="badge badge-category">${escapeHtml(p.category)}</span>
          <span>${p.quantity} ${escapeHtml(p.unit)}</span>
          <span class="badge badge-expiry ${exp.class}">${exp.label}</span>
          <span>dodał/a: ${escapeHtml(p.addedBy)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// --- Tabs ---
function setupTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      $(`#tab-${target}`).classList.add('active');
      currentTab = target;

      if (target === 'history') loadHistory();
    });
  });
}

function switchToTab(tabName) {
  $$('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  $$('.tab-content').forEach(tc => tc.classList.remove('active'));
  $(`#tab-${tabName}`).classList.add('active');
  currentTab = tabName;
}

// --- Form ---
function setupForm() {
  const form = $('#productForm');
  const cancelBtn = $('#cancelEditBtn');

  // Set default date to today + 7 days
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  $('#productExpiry').value = defaultDate.toISOString().split('T')[0];

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = $('#editId').value;

    const data = {
      name: $('#productName').value,
      category: $('#productCategory').value,
      quantity: parseFloat($('#productQuantity').value),
      unit: $('#productUnit').value,
      expiryDate: $('#productExpiry').value,
      addedBy: $('#currentUser').value
    };

    if (editId) {
      await api(`/api/products/${editId}`, { method: 'PUT', body: data });
    } else {
      await api('/api/products', { method: 'POST', body: data });
    }

    resetForm();
    await loadProducts();
    switchToTab('products');
    checkExpiring();
  });

  cancelBtn.addEventListener('click', () => {
    resetForm();
  });
}

function resetForm() {
  $('#editId').value = '';
  $('#productName').value = '';
  $('#productCategory').selectedIndex = 0;
  $('#productQuantity').value = 1;
  $('#productUnit').selectedIndex = 0;

  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  $('#productExpiry').value = defaultDate.toISOString().split('T')[0];

  $('#submitBtn').textContent = 'Dodaj produkt';
  $('#cancelEditBtn').classList.add('hidden');
}

// --- Edit ---
window.editProduct = function(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  $('#editId').value = product.id;
  $('#productName').value = product.name;
  $('#productCategory').value = product.category;
  $('#productQuantity').value = product.quantity;
  $('#productUnit').value = product.unit;
  $('#productExpiry').value = product.expiryDate;

  $('#submitBtn').textContent = 'Zapisz zmiany';
  $('#cancelEditBtn').classList.remove('hidden');

  switchToTab('add');
};

// --- Delete Modal ---
let deleteTargetId = null;

function setupModal() {
  $('#modalCancel').addEventListener('click', hideModal);
  $('.modal-backdrop').addEventListener('click', hideModal);

  $('#modalUsed').addEventListener('click', () => deleteProduct('used'));
  $('#modalExpired').addEventListener('click', () => deleteProduct('expired'));
}

window.showDeleteModal = function(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  deleteTargetId = id;
  $('#modalText').textContent = `Co zrobić z "${product.name}"?`;
  $('#modal').classList.remove('hidden');
};

function hideModal() {
  $('#modal').classList.add('hidden');
  deleteTargetId = null;
}

async function deleteProduct(reason) {
  if (!deleteTargetId) return;
  await api(`/api/products/${deleteTargetId}?reason=${reason}`, { method: 'DELETE' });
  hideModal();
  await loadProducts();
  checkExpiring();
}

// --- Search ---
function setupSearch() {
  $('#searchInput').addEventListener('input', renderProducts);
  $('#categoryFilter').addEventListener('change', renderProducts);
}

// --- History ---
async function loadHistory() {
  const history = await api('/api/history');
  const list = $('#historyList');
  const empty = $('#historyEmpty');
  const clearBtn = $('#clearHistoryBtn');

  if (history.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    clearBtn.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  clearBtn.classList.remove('hidden');

  list.innerHTML = history.map(p => {
    const reasonText = p.reason === 'expired' ? 'Przeterminowany' : 'Zużyty';
    const reasonClass = `reason-${p.reason || 'used'}`;
    const removedDate = p.removedAt ? formatDate(p.removedAt.split('T')[0]) : '-';

    return `
      <div class="history-card ${reasonClass}">
        <div class="product-card-header">
          <span class="product-name">${escapeHtml(p.name)}</span>
          <span class="badge badge-category">${escapeHtml(p.category)}</span>
        </div>
        <div class="history-meta">
          <span>${reasonText}</span>
          <span>Usunięty: ${removedDate}</span>
          <span>${p.quantity} ${escapeHtml(p.unit)}</span>
          <span>dodał/a: ${escapeHtml(p.addedBy)}</span>
        </div>
      </div>
    `;
  }).join('');

  clearBtn.onclick = async () => {
    if (confirm('Czy na pewno wyczyścić całą historię?')) {
      await api('/api/history/clear', { method: 'POST' });
      loadHistory();
    }
  };
}

// --- Expiring alert ---
function checkExpiring() {
  const alertBar = $('#alertBar');
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expiring = products.filter(p => {
    const exp = new Date(p.expiryDate);
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  });

  if (expiring.length === 0) {
    alertBar.classList.add('hidden');
    return;
  }

  const expired = expiring.filter(p => new Date(p.expiryDate) <= now);
  const soon = expiring.filter(p => new Date(p.expiryDate) > now);

  let msg = '';
  if (expired.length > 0) {
    msg += `&#x26A0;&#xFE0F; ${expired.length} ${expired.length === 1 ? 'produkt przeterminowany' : 'produkty przeterminowane'}! `;
  }
  if (soon.length > 0) {
    msg += `&#x23F3; ${soon.length} ${soon.length === 1 ? 'produkt traci' : 'produkty tracą'} ważność w ciągu 2 dni.`;
  }

  alertBar.innerHTML = msg;
  alertBar.classList.remove('hidden');
}

// --- Utility ---
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
