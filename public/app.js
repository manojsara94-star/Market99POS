const API_BASE = '/api';

let authToken = localStorage.getItem('pos_token') || null;
let currentBusiness = localStorage.getItem('pos_business') || '';
let currentRole = localStorage.getItem('pos_role') || 'user';
let currentLogo = localStorage.getItem('pos_logo') || null;
let currentLogoBase64 = localStorage.getItem('pos_logo') || null;
let currentWhatsApp = localStorage.getItem('pos_whatsapp') || '';
let currentAddress = localStorage.getItem('pos_address') || '';

// ==== AUTH LOGIC ====
const authOverlay = document.getElementById('auth-overlay');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

document.getElementById('switch-to-register').addEventListener('click', () => {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Register a new business";
});

document.getElementById('switch-to-login').addEventListener('click', () => {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    document.getElementById('auth-subtitle').textContent = "Login to your account";
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        loginSuccess(data.token, data.business_name, data.role, data.logo, data.whatsapp_number, data.business_address);
    } catch (err) { alert(err.message); }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const business_name = document.getElementById('reg-businessName').value;
    const whatsapp_number = document.getElementById('reg-whatsapp').value;

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, business_name, whatsapp_number })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        loginSuccess(data.token, data.business_name, data.role, data.logo, data.whatsapp_number, data.business_address);
    } catch (err) { alert(err.message); }
});

function loginSuccess(token, businessName, role = 'user', logo = null, whatsapp = '', address = '') {
    authToken = token;
    currentBusiness = businessName;
    currentRole = role;
    currentLogo = logo;
    currentWhatsApp = whatsapp;
    currentAddress = address;
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_business', businessName);
    localStorage.setItem('pos_role', role);
    localStorage.setItem('pos_whatsapp', whatsapp);
    localStorage.setItem('pos_address', address);
    if (logo) localStorage.setItem('pos_logo', logo);
    else localStorage.removeItem('pos_logo');
    checkAuth();
}

document.getElementById('btn-logout').addEventListener('click', () => {
    authToken = null;
    currentBusiness = '';
    currentRole = 'user';
    currentLogo = null;
    currentWhatsApp = '';
    currentAddress = '';
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_business');
    localStorage.removeItem('pos_role');
    localStorage.removeItem('pos_logo');
    localStorage.removeItem('pos_whatsapp');
    localStorage.removeItem('pos_address');
    checkAuth();
});

function checkAuth() {
    if (authToken) {
        authOverlay.classList.remove('active');
        document.getElementById('business-name-display').textContent = currentBusiness;

        if (currentRole === 'admin') {
            document.getElementById('nav-item-admin').style.display = 'block';
        } else {
            document.getElementById('nav-item-admin').style.display = 'none';
        }

        // Re-initialize data
        loadDashboard();
    } else {
        authOverlay.classList.add('active');
    }
}

// Wrapper for fetch requests to include Auth Header
async function fetchAuth(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    options.headers = headers;

    // Explicitly bypass browser cache for dynamic API calls
    if (!options.method || options.method.toUpperCase() === 'GET') {
        options.cache = 'no-store';
    }

    const res = await fetch(url, options);
    if (res.status === 401) {
        // Unauthorized, logout
        document.getElementById('btn-logout').click();
    }
    return res;
}

function showModal(modalElem) {
    if (!modalElem) return;
    modalOverlay.classList.add('active');
    // Hide all internal modals first
    const internalModals = modalOverlay.querySelectorAll('.modal');
    internalModals.forEach(m => m.classList.remove('active'));
    // Show target
    modalElem.classList.add('active');
}

function hideModal() {
    modalOverlay.classList.remove('active');
}

// ==== UTILS ====
let products = [];
let currentBill = [];
let currentTab = 'dashboard-view';
let chartInstance = null;
let currentProductImageBase64 = null;
let notifiedLowStockProducts = new Set();
let currentPOSCategory = 'All';
let customersList = [];

// ==== DOM ELEMENTS ====
const clockEl = document.getElementById('clock');
const navLinks = document.querySelectorAll('.nav-link');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');
const modalOverlay = document.getElementById('modal-overlay');
const productModal = document.getElementById('product-modal');
const invoiceModal = document.getElementById('invoice-modal');
const adminUserModal = document.getElementById('admin-user-modal');
const customerModal = document.getElementById('customer-modal');
const expenseModal = document.getElementById('expense-modal');

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    checkAuth();
    updateClock();
    setInterval(updateClock, 1000);

    setupNavigation();
    setupModals();
});

function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + now.toLocaleDateString();
}

function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const target = link.getAttribute('data-target');
            views.forEach(view => view.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            pageTitle.textContent = link.querySelector('.link-name').textContent;
            currentTab = target;

            // Load specific view data
            if (target === 'dashboard-view') loadDashboard();
            if (target === 'inventory-view') loadInventory();
            if (target === 'customers-view') loadCustomers();
            if (target === 'expenses-view') loadExpenses();
            if (target === 'pos-view') loadPOS();
            if (target === 'invoices-view') loadInvoices();
            if (target === 'reports-view') loadReports();
            if (target === 'admin-view') loadAdminUsers();
            if (target === 'settings-view') loadSettings();
        });
    });

    // ==== MARKETPLACE ====
    const btnMarketplace = document.getElementById('btn-create-marketplace');
    if (btnMarketplace) {
        btnMarketplace.addEventListener('click', async () => {
            try {
                const res = await fetchAuth(`${API_BASE}/marketplace/enable`, { method: 'POST' });
                if (res.ok) {
                    const domain = window.location.origin;
                    const url = `${domain}/${encodeURIComponent(currentBusiness)}`;
                    // Open the marketplace URL in a new window immediately
                    window.open(url, '_blank');
                } else {
                    alert('Failed to enable marketplace. Make sure you have restarted your server.');
                }
            } catch (err) {
                console.error(err);
                alert('Error enabling marketplace. Did you restart the server?');
            }
        });
    }
}

function setupModals() {
    const adminModal = document.getElementById('admin-user-modal');

    window.showModal = function (m) {
        document.getElementById('modal-overlay').classList.add('active');
        m.classList.add('active');
    };

    window.hideModal = function () {
        document.getElementById('modal-overlay').classList.remove('active');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    };

    document.getElementById('btn-close-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-invoice-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-admin-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-category-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-customer-modal').addEventListener('click', hideModal);
    document.getElementById('btn-close-expense-modal').addEventListener('click', hideModal);

    // Add product
    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('product-form').reset();
        document.getElementById('product-id').value = '';
        document.getElementById('product-description').value = '';
        document.getElementById('product-category').value = '';
        document.getElementById('product-cost').value = '';
        document.getElementById('product-low-stock').value = '10';
        currentProductImageBase64 = null;
        document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
        document.getElementById('product-modal-title').textContent = 'Add Product';
        showModal(document.getElementById('product-modal'));
    });

    // Add customer
    document.getElementById('btn-add-customer').addEventListener('click', () => {
        document.getElementById('customer-form').reset();
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-modal-title').textContent = 'Add Customer';
        showModal(document.getElementById('customer-modal'));
    });

    // Add Expense
    document.getElementById('btn-add-expense').addEventListener('click', () => {
        document.getElementById('expense-form').reset();
        document.getElementById('expense-id').value = '';
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('expense-modal-title').textContent = 'Add Expenditure';
        showModal(document.getElementById('expense-modal'));
    });

    // Handle Image Selection
    document.getElementById('product-image').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                currentProductImageBase64 = dataUrl;
                document.getElementById('product-image-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
            }
            img.src = event.target.result;
        }
        reader.readAsDataURL(file);
    });

    // Handle Product Form
    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const name = document.getElementById('product-name').value;
        const description = document.getElementById('product-description').value;
        const category = document.getElementById('product-category').value;
        const qty = document.getElementById('product-qty').value;
        const low_stock_limit = document.getElementById('product-low-stock').value;
        const cost = document.getElementById('product-cost').value;
        const price = document.getElementById('product-price').value;

        const payload = {
            name,
            description,
            category,
            quantity: parseInt(qty),
            low_stock_limit: parseInt(low_stock_limit),
            cost: parseFloat(cost),
            price: parseFloat(price),
            image: currentProductImageBase64
        };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;

        try {
            await fetchAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            hideModal();
            loadInventory();
        } catch (err) {
            console.error(err);
            alert('Error saving product');
        }
    });

    // Handle Customer Form
    document.getElementById('customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('customer-id').value;
        const name = document.getElementById('customer-name').value;
        const contact = document.getElementById('customer-contact').value;
        const address = document.getElementById('customer-address').value;

        const payload = { name, contact, address };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/customers/${id}` : `${API_BASE}/customers`;

        try {
            await fetchAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            hideModal();
            loadCustomers();
        } catch (err) {
            console.error(err);
            alert('Error saving customer');
        }
    });

    // Handle Expense Form
    document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('expense-id').value;
        const title = document.getElementById('expense-title').value;
        const amount = document.getElementById('expense-amount').value;
        const category = document.getElementById('expense-category').value;
        const date = document.getElementById('expense-date').value;
        const note = document.getElementById('expense-note').value;

        const payload = { title, amount: parseFloat(amount), category, date, note };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/expenses/${id}` : `${API_BASE}/expenses`;

        try {
            await fetchAuth(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            hideModal();
            loadExpenses();
            loadDashboard(); // Update profit cards
        } catch (err) {
            console.error(err);
            alert('Error saving expenditure');
        }
    });

    // Handle Category Modal
    document.getElementById('btn-manage-categories').addEventListener('click', (e) => {
        e.preventDefault();
        hideModal(); // hide product modal first if it is open
        document.getElementById('category-form').reset();
        showModal(document.getElementById('category-modal'));
    });

    document.getElementById('category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-category-name').value;
        try {
            await fetchAuth(`${API_BASE}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            hideModal();
            await loadCategories();
            document.getElementById('product-category').value = name;
            showModal(document.getElementById('product-modal')); // jump back
        } catch (err) {
            console.error(err);
            alert('Error creating category');
        }
    });

    // Print Receipt logic
    document.getElementById('btn-print-receipt').addEventListener('click', () => {
        window.print();
    });

    // Admin User Edit Form
    document.getElementById('admin-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-user-id').value;
        const business_name = document.getElementById('admin-business-name').value;
        const email = document.getElementById('admin-email').value;
        const whatsapp_number = document.getElementById('admin-whatsapp').value;
        const marketplace_enabled = document.getElementById('admin-marketplace-enabled').checked;

        try {
            await fetchAuth(`${API_BASE}/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ business_name, email, whatsapp_number, marketplace_enabled })
            });
            hideModal();
            loadAdminUsers();
        } catch (err) {
            console.error(err);
            alert('Error updating user');
        }
    });
}

// ==== CUSTOMERS ====
async function loadCustomers() {
    try {
        const res = await fetchAuth(`${API_BASE}/customers`);
        customersList = await res.json();
        const tbody = document.querySelector('#customers-table tbody');
        tbody.innerHTML = '';

        customersList.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.name}</td>
                <td>${c.contact || '-'}</td>
                <td>${c.address || '-'}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only edit-cust-btn" data-id="${c._id || c.id}"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only del-cust-btn" data-id="${c._id || c.id}"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// Customer table actions
document.querySelector('#customers-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-cust-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const cust = customersList.find(c => (c._id || c.id) == id);
        if (cust) {
            document.getElementById('customer-id').value = id;
            document.getElementById('customer-name').value = cust.name;
            document.getElementById('customer-contact').value = cust.contact || '';
            document.getElementById('customer-address').value = cust.address || '';
            document.getElementById('customer-modal-title').textContent = 'Edit Customer';
            showModal(document.getElementById('customer-modal'));
        }
        return;
    }

    const delBtn = e.target.closest('.del-cust-btn');
    if (delBtn) {
        deleteCustomer(delBtn.dataset.id);
    }
});

async function deleteCustomer(id) {
    if (confirm('Are you sure you want to delete this customer profile?')) {
        try {
            await fetchAuth(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
            loadCustomers();
        } catch (err) {
            console.error(err);
            alert('Error deleting customer');
        }
    }
}

// ==== EXPENSES ====
let expensesList = [];

async function loadExpenses() {
    try {
        const res = await fetchAuth(`${API_BASE}/expenses`);
        expensesList = await res.json();
        const tbody = document.querySelector('#expenses-table tbody');
        tbody.innerHTML = '';

        expensesList.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${e.date}</td>
                <td>${e.title}</td>
                <td><span class="badge">${e.category || 'General'}</span></td>
                <td>${formatCurrency(e.amount)}</td>
                <td style="font-size:12px;color:var(--text-muted);">${e.note || '-'}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only edit-exp-btn" data-id="${e._id || e.id}"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only del-exp-btn" data-id="${e._id || e.id}"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

document.querySelector('#expenses-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-exp-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const exp = expensesList.find(i => (i._id || i.id) == id);
        if (exp) {
            document.getElementById('expense-id').value = id;
            document.getElementById('expense-title').value = exp.title;
            document.getElementById('expense-amount').value = exp.amount;
            document.getElementById('expense-category').value = exp.category || '';
            document.getElementById('expense-date').value = exp.date;
            document.getElementById('expense-note').value = exp.note || '';
            document.getElementById('expense-modal-title').textContent = 'Edit Expenditure';
            showModal(document.getElementById('expense-modal'));
        }
        return;
    }

    const delBtn = e.target.closest('.del-exp-btn');
    if (delBtn) deleteExpense(delBtn.dataset.id);
});

async function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        try {
            await fetchAuth(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
            loadExpenses();
            loadDashboard();
        } catch (err) { alert('Error deleting expense'); }
    }
}

// ==== POS ====
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'LKR' }).format(amount).replace('LKR', 'Rs.');
}

function checkLowStockAlerts(productList) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    productList.forEach(p => {
        const limit = p.low_stock_limit !== undefined ? p.low_stock_limit : 10;
        if (p.quantity <= limit) {
            if (!notifiedLowStockProducts.has(p.id)) {
                new Notification("Low Stock Alert!", {
                    body: `"${p.name}" is running low on stock (Only ${p.quantity} left).`,
                    icon: 'https://cdn-icons-png.flaticon.com/512/5680/5680583.png'
                });
                notifiedLowStockProducts.add(p.id);
            }
        } else {
            notifiedLowStockProducts.delete(p.id);
        }
    });
}

function exportToCSV(filename, rows) {
    let processRow = function (row) {
        let finalVal = '';
        for (let j = 0; j < row.length; j++) {
            let innerValue = row[j] === null ? '' : row[j].toString();
            if (row[j] instanceof Date) { innerValue = row[j].toLocaleString(); }
            let result = innerValue.replace(/"/g, '""');
            if (result.search(/("|,|\n)/g) >= 0) result = '"' + result + '"';
            if (j > 0) finalVal += ',';
            finalVal += result;
        }
        return finalVal + '\n';
    };

    let csvFile = '';
    for (let i = 0; i < rows.length; i++) {
        csvFile += processRow(rows[i]);
    }

    let blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
    let link = document.createElement("a");
    if (link.download !== undefined) {
        let url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// ==== DASHBOARD ====
async function loadDashboard() {
    if (!authToken) return;
    try {
        const res = await fetchAuth(`${API_BASE}/dashboard`);
        const stats = await res.json();

        document.getElementById('dash-bills-today').textContent = stats.totalBillsToday;
        document.getElementById('dash-bills-month').textContent = stats.totalBillsMonth;
        document.getElementById('dash-income-today').textContent = formatCurrency(stats.dailyIncome);
        document.getElementById('dash-income-month').textContent = formatCurrency(stats.monthlyIncome);
        document.getElementById('dash-expenses-today').textContent = formatCurrency(stats.dailyExpenseTotal || 0);
        document.getElementById('dash-expenses-month').textContent = formatCurrency(stats.monthlyExpenseTotal || 0);
        document.getElementById('dash-profit-today').textContent = formatCurrency(stats.dailyProfit);
        document.getElementById('dash-profit-month').textContent = formatCurrency(stats.monthlyProfit);
        document.getElementById('dash-total-products').textContent = stats.totalProducts;
        document.getElementById('dash-low-stock').textContent = stats.lowStockProducts;

        // Load low stock table
        const resAlerts = await fetchAuth(`${API_BASE}/dashboard/low-stock`);
        const alerts = await resAlerts.json();
        const tbody = document.querySelector('#low-stock-table tbody');
        tbody.innerHTML = '';

        alerts.forEach(item => {
            const tr = document.createElement('tr');
            let nameHTML = `<td>${item.name}</td>`;
            if (currentRole === 'admin') {
                nameHTML = `<td>${item.name} <div style="font-size:11px;color:var(--primary);margin-top:2px;">[${item.owner_name}]</div></td>`;
            }

            tr.innerHTML = `
                ${nameHTML}
                <td class="text-danger">${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// ==== INVENTORY ====
let adminInventoryFilter = null;

let cachedCategories = [];

async function loadCategories() {
    try {
        const res = await fetchAuth(`${API_BASE}/categories`);
        cachedCategories = await res.json();

        const sel = document.getElementById('product-category');
        const oldVal = sel.value;
        sel.innerHTML = '<option value="">Select Category</option>';
        cachedCategories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
        if (oldVal) sel.value = oldVal;
    } catch (err) { console.error(err); }
}

async function loadInventory() {
    try {
        await loadCategories();
        const res = await fetchAuth(`${API_BASE}/products`);
        products = await res.json();
        checkLowStockAlerts(products);

        const tbody = document.querySelector('#inventory-table tbody');
        tbody.innerHTML = '';

        // Handle admin inventory filtering
        let productsToRender = products;
        const filterBadge = document.getElementById('inventory-filter-badge');
        if (currentRole === 'admin' && adminInventoryFilter) {
            productsToRender = products.filter(p => p.owner_name === adminInventoryFilter);
            document.getElementById('inventory-filter-name').textContent = adminInventoryFilter;
            filterBadge.style.display = 'flex';
        } else {
            filterBadge.style.display = 'none';
        }

        productsToRender.forEach(p => {
            const imgHtml = p.image ? `<img src="${p.image}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : `<div style="width:40px;height:40px;border-radius:8px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;">No Img</div>`;
            const tr = document.createElement('tr');

            let nameDisplay = `<span>${p.name}</span>`;
            if (currentRole === 'admin') {
                nameDisplay = `<div><span>${p.name}</span><div style="font-size:11px;color:var(--primary);margin-top:2px;">[${p.owner_name}]</div></div>`;
            }

            tr.innerHTML = `
                <td style="display:flex;align-items:center;gap:12px;">${imgHtml} ${nameDisplay}</td>
                <td class="${p.quantity <= (p.low_stock_limit !== undefined ? p.low_stock_limit : 10) ? 'text-danger' : ''}">${p.quantity}</td>
                <td><span class="badge" style="background:#eef2f6;color:var(--text-color);">${p.category || 'General'}</span></td>
                <td>${formatCurrency(p.cost || 0)}</td>
                <td>${formatCurrency(p.price)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only edit-btn" data-id="${p.id}"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only del-btn" data-id="${p.id}"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
    }
}

document.getElementById('btn-clear-inventory-filter').addEventListener('click', () => {
    adminInventoryFilter = null;
    loadInventory();
});

// Event Delegation for Edit and Delete buttons
document.querySelector('#inventory-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        editProduct(editBtn.dataset.id);
        return;
    }

    const delBtn = e.target.closest('.del-btn');
    if (delBtn) {
        deleteProduct(delBtn.dataset.id);
    }
});

function editProduct(id) {
    const p = products.find(prod => prod.id == id);
    if (p) {
        document.getElementById('product-id').value = p.id;
        document.getElementById('product-name').value = p.name;
        document.getElementById('product-description').value = p.description || '';

        // Set category if it exists in select options
        const catSelect = document.getElementById('product-category');
        catSelect.value = p.category || '';
        if (p.category && !catSelect.value) {
            // Category might have been deleted, add temporary option
            const opt = document.createElement('option');
            opt.value = p.category;
            opt.textContent = p.category + " (Deprecated)";
            catSelect.appendChild(opt);
            catSelect.value = p.category;
        }

        document.getElementById('product-qty').value = p.quantity;
        document.getElementById('product-low-stock').value = p.low_stock_limit !== undefined ? p.low_stock_limit : 10;
        document.getElementById('product-cost').value = p.cost || 0;
        document.getElementById('product-price').value = p.price;

        currentProductImageBase64 = p.image || null;
        if (p.image) {
            document.getElementById('product-image-preview').innerHTML = `<img src="${p.image}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
        } else {
            document.getElementById('product-image-preview').innerHTML = '<span style="color:var(--text-muted);font-size:12px;">+ Add Image</span>';
        }

        document.getElementById('product-modal-title').textContent = 'Edit Product';
        showModal(productModal);
    }
}

async function deleteProduct(id) {
    if (confirm('Are you sure you want to delete this product?')) {
        try {
            await fetchAuth(`${API_BASE}/products/${id}`, { method: 'DELETE' });
            loadInventory();
        } catch (err) { console.error(err); }
    }
}

document.getElementById('btn-export-inventory').addEventListener('click', () => {
    const csvData = [['Item Name', 'Category', 'Quantity', 'Low Stock Limit', 'Cost', 'Price']];
    products.forEach(p => csvData.push([p.name, p.category || 'General', p.quantity, p.low_stock_limit !== undefined ? p.low_stock_limit : 10, p.cost || 0, p.price]));
    exportToCSV('products.csv', csvData);
});

// ==== POS (NEW BILL) ====
async function loadPOS() {
    currentBill = [];
    updateBillUI();
    document.getElementById('pos-search-input').value = '';

    try {
        const res = await fetchAuth(`${API_BASE}/products`);
        products = await res.json();
        checkLowStockAlerts(products);
        const cRes = await fetchAuth(`${API_BASE}/customers`);
        customersList = await cRes.json();

        const cList = document.getElementById('pos-customer-list');
        cList.innerHTML = '';
        customersList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            cList.appendChild(opt);
        });

        document.getElementById('pos-customer-name').value = '';
        document.getElementById('pos-customer-contact').value = '';
        document.getElementById('pos-customer-address').value = '';

        renderPOSProducts(products);
    } catch (err) {
        console.error(err);
    }
}

function renderPOSProducts(productArray) {
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';

    productArray.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pos-product-card';
        const imgStyle = p.image ? `background-image:url('${p.image}');background-size:cover;background-position:center;` : `background:#e2e8f0;`;
        div.innerHTML = `
            <div style="width:100%;height:100px;border-radius:8px;margin-bottom:12px;${imgStyle}"></div>
            <h4>${p.name}</h4>
            <div class="price">${formatCurrency(p.price)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Stock: ${p.quantity}</div>
        `;
        div.addEventListener('click', () => addToBill(p));
        grid.appendChild(div);
    });
}

document.getElementById('pos-search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(term));
    renderPOSProducts(filtered);
});

document.getElementById('pos-customer-name').addEventListener('input', (e) => {
    const val = e.target.value;
    const existing = customersList.find(c => c.name === val);
    if (existing) {
        document.getElementById('pos-customer-contact').value = existing.contact || '';
        document.getElementById('pos-customer-address').value = existing.address || '';
    }
});

function addToBill(product) {
    if (product.quantity <= 0) {
        alert('Product out of stock!');
        return;
    }

    const existing = currentBill.find(item => item.id === product.id);
    if (existing) {
        if (existing.quantity >= product.quantity) {
            alert('Cannot add more than available stock!');
            return;
        }
        existing.quantity++;
    } else {
        currentBill.push({
            id: product.id,
            name: product.name,
            cost: product.cost || 0,
            price: product.price,
            discount: 0,
            quantity: 1,
            maxQty: product.quantity
        });
    }
    updateBillUI();
}

function updateBillQuantity(id, change) {
    const item = currentBill.find(i => i.id === id);
    if (item) {
        const newQty = item.quantity + change;
        if (newQty > 0 && newQty <= item.maxQty) {
            item.quantity = newQty;
        } else if (newQty === 0) {
            currentBill = currentBill.filter(i => i.id !== id);
        } else {
            alert('Cannot exceed available stock!');
        }
        updateBillUI();
    }
}

function updateBillUI() {
    const itemsContainer = document.getElementById('pos-bill-items');
    itemsContainer.innerHTML = '';
    let total = 0;
    let totalDiscount = 0;

    currentBill.forEach(item => {
        const itemDiscount = parseFloat(item.discount) || 0;
        const amount = (item.price * item.quantity) - itemDiscount;
        total += amount;
        totalDiscount += itemDiscount;

        const div = document.createElement('div');
        div.className = 'bill-item';
        div.innerHTML = `
            <div class="bill-item-details">
                <h4>${item.name}</h4>
                <p>
                    ${formatCurrency(item.price)} x ${item.quantity}
                </p>
                <div style="margin-top:4px; font-size:12px; display:flex; align-items:center; gap:5px;">
                    Disc: <input type="number" min="0" value="${itemDiscount}" onchange="updateItemDiscount('${item.id}', this.value)" style="width:60px; padding:2px; font-size:12px; border:1px solid var(--border); border-radius:4px;">
                </div>
            </div>
            <div class="bill-item-actions">
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateBillQuantity('${item.id}', 1)">+</button>
                </div>
                <div class="item-total">${formatCurrency(amount)}</div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });

    document.getElementById('pos-total-amount').textContent = formatCurrency(total);

    const discountRow = document.getElementById('pos-discount-row');
    if (totalDiscount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('pos-total-discount').textContent = formatCurrency(totalDiscount);
    } else {
        discountRow.style.display = 'none';
    }
}

window.updateItemDiscount = function (id, val) {
    const item = currentBill.find(i => i.id === id);
    if (item) {
        item.discount = parseFloat(val) || 0;
        updateBillUI();
    }
};

async function submitCurrentBill(autoPrint) {
    if (currentBill.length === 0) {
        alert('Bill is empty!');
        return;
    }

    let total = currentBill.reduce((sum, item) => sum + ((item.price * item.quantity) - (item.discount || 0)), 0);
    let totalDiscount = currentBill.reduce((sum, item) => sum + (item.discount || 0), 0);

    const customerName = document.getElementById('pos-customer-name').value.trim();
    const customerContact = document.getElementById('pos-customer-contact').value.trim();
    const customerAddress = document.getElementById('pos-customer-address').value.trim();

    const now = new Date();
    // Helper to format as local date (YYYY-MM-DD)
    const localDate = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    // Helper to format as local time (HH:MM)
    const localTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    const payload = {
        items: currentBill,
        total_amount: total,
        total_discount: totalDiscount,
        customer_name: customerName,
        customer_contact: customerContact,
        customer_address: customerAddress,
        date: localDate,
        time: localTime
    };

    try {
        const res = await fetchAuth(`${API_BASE}/invoices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to create invoice');

        const data = await res.json();

        // Print
        showInvoicePrintout(data.invoice, autoPrint);

        // Clear bill
        currentBill = [];
        updateBillUI();

        // Reload products & customers cache
        fetchAuth(`${API_BASE}/products`).then(r => r.json()).then(p => {
            products = p;
            checkLowStockAlerts(products);
        });

        fetchAuth(`${API_BASE}/customers`).then(r => r.json()).then(clist => {
            customersList = clist;
            const cDatalist = document.getElementById('pos-customer-list');
            cDatalist.innerHTML = '';
            customersList.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                cDatalist.appendChild(opt);
            });
        });

    } catch (err) {
        console.error(err);
        alert('Error saving bill');
    }
}

document.getElementById('btn-submit-bill').addEventListener('click', () => submitCurrentBill(false));
document.getElementById('btn-submit-print').addEventListener('click', () => submitCurrentBill(true));

function showInvoicePrintout(invoice, autoPrint = true) {
    // Logo in printout
    const receiptLogo = document.getElementById('receipt-logo');
    const logoSource = invoice.owner_logo || currentLogo;
    
    if (logoSource) {
        receiptLogo.src = logoSource;
        receiptLogo.style.display = 'inline-block';
    } else {
        receiptLogo.src = "";
        receiptLogo.style.display = 'none';
    }

    document.getElementById('receipt-business-name').textContent = invoice.owner_name || currentBusiness;
    document.getElementById('receipt-business-address').textContent = invoice.owner_address || currentAddress || "";
    
    const phone = invoice.owner_phone || currentWhatsApp || "";
    const phoneEl = document.getElementById('receipt-business-phone');
    if (phone) {
        phoneEl.textContent = "Tel: " + phone;
        phoneEl.style.display = 'block';
    } else {
        phoneEl.style.display = 'none';
    }

    document.getElementById('receipt-no').textContent = invoice.invoice_number;
    document.getElementById('receipt-date').textContent = invoice.date;
    document.getElementById('receipt-time').textContent = invoice.time;

    const receiptCustBox = document.getElementById('receipt-customer-info');
    if (invoice.customer_name) {
        receiptCustBox.style.display = 'block';
        document.getElementById('receipt-customer-name').textContent = invoice.customer_name;

        const contactRow = document.getElementById('receipt-customer-contact-row');
        if (invoice.customer_contact) {
            contactRow.style.display = 'inline';
            document.getElementById('receipt-customer-contact').textContent = invoice.customer_contact;
        } else { contactRow.style.display = 'none'; }

        const addressRow = document.getElementById('receipt-customer-address-row');
        if (invoice.customer_address) {
            addressRow.style.display = 'inline';
            document.getElementById('receipt-customer-address').textContent = invoice.customer_address;
        } else { addressRow.style.display = 'none'; }
    } else {
        receiptCustBox.style.display = 'none';
    }

    const tbody = document.querySelector('#receipt-items tbody');
    tbody.innerHTML = '';

    let total = 0;
    invoice.items.forEach(item => {
        const itemDiscount = item.discount || 0;
        const amt = (item.price * item.quantity) - itemDiscount;
        total += amt;
        let discountNote = '';
        if (itemDiscount > 0) {
            discountNote = `<div style="font-size: 10px; color: #555;">Disc: -Rs.${parseFloat(itemDiscount).toFixed(2)}</div>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div>${item.product_name || item.name}</div>
                ${discountNote}
            </td>
            <td>${item.quantity}</td>
            <td>${item.price}</td>
            <td>${parseFloat(amt).toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    const discountRow = document.getElementById('receipt-discount-row');
    if (invoice.total_discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('receipt-total-discount').textContent = 'Rs. ' + parseFloat(invoice.total_discount).toFixed(2);
    } else {
        discountRow.style.display = 'none';
    }

    document.getElementById('receipt-total-amount').textContent = 'Rs. ' + parseFloat(total).toFixed(2);

    // Show the modal
    showModal(invoiceModal);

    // If autoPrint, wait for logo loading then print
    if (autoPrint) {
        const printIt = () => {
             // Second small delay to ensure rendering complete
             setTimeout(() => {
                 window.print();
             }, 500);
        };

        if (!logoSource || receiptLogo.complete) {
            printIt();
        } else {
            receiptLogo.onload = printIt;
            receiptLogo.onerror = printIt; // print even if logo fails
        }
    }
}

// ==== INVOICES ====
let invoicesList = [];

async function loadInvoices() {
    const dateFilter = document.getElementById('filter-date').value;
    const monthFilter = document.getElementById('filter-month').value;

    let url = `${API_BASE}/invoices`;
    if (dateFilter) url += `?date=${dateFilter}`;
    else if (monthFilter) url += `?month=${monthFilter}`;

    try {
        const res = await fetchAuth(url);
        invoicesList = await res.json();
        const tbody = document.querySelector('#invoices-table tbody');
        tbody.innerHTML = '';

        invoicesList.forEach(inv => {
            const tr = document.createElement('tr');
            let adminActions = '';
            let invDisplay = inv.invoice_number;
            if (currentRole === 'admin') {
                invDisplay += `<div style="font-size:11px;color:var(--primary);margin-top:2px;">[${inv.owner_name}]</div>`;
                adminActions = `<button class="btn btn-danger btn-icon-only delete-invoice-btn" style="margin-left: 4px;" data-id="${inv.id}"><i class='bx bx-trash'></i></button>`;
            }

            tr.innerHTML = `
                <td>${invDisplay}</td>
                <td>${inv.date}</td>
                <td>${inv.time}</td>
                <td style="font-weight:bold">${formatCurrency(inv.total_amount)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-invoice-btn" data-id="${inv.id}"><i class='bx bx-show'></i></button>
                    <button class="btn btn-primary btn-icon-only print-invoice-btn" data-id="${inv.id}"><i class='bx bx-printer'></i></button>
                    ${adminActions}
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.view-invoice-btn, .print-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const autoPrint = e.currentTarget.classList.contains('print-invoice-btn');
                const id = e.currentTarget.dataset.id;
                try {
                    const res = await fetchAuth(`${API_BASE}/invoices/${id}`);
                    const inv = await res.json();
                    showInvoicePrintout(inv, autoPrint);
                } catch (err) { console.error(err); }
            });
        });

        document.querySelectorAll('.delete-invoice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Are you sure you want to delete this invoice? (This will restock the inventory automatically)')) {
                    const id = e.currentTarget.dataset.id;
                    try {
                        await fetchAuth(`${API_BASE}/invoices/${id}`, { method: 'DELETE' });
                        loadInvoices();
                    } catch (err) { console.error(err); }
                }
            });
        });

    } catch (err) {
        console.error(err);
    }
}

document.getElementById('filter-date').addEventListener('change', () => {
    document.getElementById('filter-month').value = '';
    loadInvoices();
});
document.getElementById('filter-month').addEventListener('change', () => {
    document.getElementById('filter-date').value = '';
    loadInvoices();
});
document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-month').value = '';
    loadInvoices();
});

document.getElementById('btn-export-invoices').addEventListener('click', () => {
    const csvData = [['Invoice Number', 'Date', 'Time', 'Total Amount']];
    invoicesList.forEach(i => csvData.push([i.invoice_number, i.date, i.time, i.total_amount]));
    exportToCSV('invoices.csv', csvData);
});

// ==== REPORTS ====
let currentReportMode = 'sales';

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(td => td.classList.remove('active'));
        e.target.classList.add('active');
        currentReportMode = e.target.getAttribute('data-report');
        loadReports();
    });
});

async function loadReports() {
    const thead = document.querySelector('#reports-table document, #reports-table thead');
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';

    try {
        if (currentReportMode === 'sales') {
            thead.innerHTML = `<tr><th>Date</th><th>Total Sales</th><th>Total Profit</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/sales`);
            const data = await res.json();
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.date}</td><td>${formatCurrency(row.total_sales)}</td><td style="color:var(--success);font-weight:bold;">${formatCurrency(row.total_profit)}</td>`;
                tbody.appendChild(tr);
            });
        } else {
            thead.innerHTML = `<tr><th>Product Name</th><th>Quantity Sold</th><th>Revenue</th><th>Profit</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/product-sales`);
            const data = await res.json();
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.product_name}</td><td>${row.quantity_sold}</td><td>${formatCurrency(row.revenue)}</td><td style="color:var(--success);font-weight:bold;">${formatCurrency(row.profit)}</td>`;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

// ==== ADMIN VIEW ====
let adminUsersList = [];

async function loadAdminUsers() {
    try {
        const res = await fetchAuth(`${API_BASE}/admin/users`);
        adminUsersList = await res.json();

        const tbody = document.querySelector('#admin-users-table tbody');
        tbody.innerHTML = '';

        adminUsersList.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.business_name}</td>
                <td>${user.email}</td>
                <td>${user.marketplace_enabled ? '<span class="text-success" style="color:var(--success);font-weight:600;">Enabled</span>' : '<span class="text-muted">Disabled</span>'}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-user-inventory-btn" data-id="${user.id}" title="View Inventory"><i class='bx bx-box'></i></button>
                    <button class="btn btn-outline btn-icon-only admin-edit-btn" data-id="${user.id}" title="Edit User"><i class='bx bx-edit'></i></button>
                    <button class="btn btn-danger btn-icon-only admin-del-btn" data-id="${user.id}" title="Delete User"><i class='bx bx-trash'></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

// Event Delegation for Admin Users Edit/Delete
document.querySelector('#admin-users-table tbody').addEventListener('click', async (e) => {
    const viewInvBtn = e.target.closest('.view-user-inventory-btn');
    if (viewInvBtn) {
        const id = viewInvBtn.dataset.id;
        const user = adminUsersList.find(u => u.id === id);
        if (user) {
            // Set filter and switch tabs
            adminInventoryFilter = user.business_name;

            navLinks.forEach(l => l.classList.remove('active'));
            document.querySelector('[data-target="inventory-view"]').classList.add('active');

            views.forEach(v => v.classList.remove('active'));
            document.getElementById('inventory-view').classList.add('active');

            pageTitle.textContent = "Inventory";
            currentTab = 'inventory-view';
            loadInventory();
        }
        return;
    }

    const editBtn = e.target.closest('.admin-edit-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const user = adminUsersList.find(u => u.id === id);
        if (user) {
            document.getElementById('admin-user-id').value = user.id;
            document.getElementById('admin-business-name').value = user.business_name;
            document.getElementById('admin-email').value = user.email;
            document.getElementById('admin-whatsapp').value = user.whatsapp_number || '';
            document.getElementById('admin-marketplace-enabled').checked = user.marketplace_enabled;
            showModal(adminUserModal);
        }
        return;
    }

    const delBtn = e.target.closest('.admin-del-btn');
    if (delBtn) {
        if (confirm('Are you sure you want to permanently delete this user and ALL their data (products, invoices)?')) {
            try {
                await fetchAuth(`${API_BASE}/admin/users/${delBtn.dataset.id}`, { method: 'DELETE' });
                loadAdminUsers();
            } catch (err) { console.error(err); }
        }
    }
});

// ==== SETTINGS ====
async function loadSettings() {
    try {
        const res = await fetchAuth(`${API_BASE}/user/settings`);
        const user = await res.json();

        currentBusiness = user.business_name;
        currentLogo = user.logo;
        currentWhatsApp = user.whatsapp_number || '';
        currentAddress = user.business_address || '';
        localStorage.setItem('pos_business', currentBusiness);
        localStorage.setItem('pos_whatsapp', currentWhatsApp);
        localStorage.setItem('pos_address', currentAddress);
        if (currentLogo) localStorage.setItem('pos_logo', currentLogo);
        else localStorage.removeItem('pos_logo');

        document.getElementById('settings-business-name').value = currentBusiness;
        document.getElementById('settings-contact-number').value = currentWhatsApp;
        document.getElementById('settings-business-address').value = currentAddress;
        document.getElementById('business-name-display').textContent = currentBusiness;

        const preview = document.getElementById('settings-logo-preview');
        const removeBtn = document.getElementById('btn-remove-logo');
        if (currentLogo) {
            preview.innerHTML = `<img src="${currentLogo}" style="width:100%;height:100%;object-fit:contain;">`;
            removeBtn.style.display = 'inline-block';
        } else {
            preview.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">+ Add Logo</span>`;
            removeBtn.style.display = 'none';
        }
        currentLogoBase64 = currentLogo;
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

document.getElementById('settings-logo-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 300;
            const MAX_HEIGHT = 300;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/png', 0.8);
            currentLogoBase64 = dataUrl;
            document.getElementById('settings-logo-preview').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;">`;
            document.getElementById('btn-remove-logo').style.display = 'inline-block';
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

document.getElementById('btn-remove-logo').addEventListener('click', () => {
    currentLogoBase64 = null;
    document.getElementById('settings-logo-preview').innerHTML = `<span style="color:var(--text-muted);font-size:12px;">+ Add Logo</span>`;
    document.getElementById('btn-remove-logo').style.display = 'none';
    document.getElementById('settings-logo-input').value = '';
});

document.getElementById('settings-business-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const business_name = document.getElementById('settings-business-name').value.trim();
    const whatsapp_number = document.getElementById('settings-contact-number').value.trim();
    const business_address = document.getElementById('settings-business-address').value.trim();
    if (!business_name) return;

    try {
        const res = await fetchAuth(`${API_BASE}/user/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ business_name, logo: currentLogoBase64, whatsapp_number, business_address })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update settings');

        // Update local state
        currentBusiness = data.business_name;
        currentLogo = data.logo;
        currentWhatsApp = data.whatsapp_number || '';
        currentAddress = data.business_address || '';
        localStorage.setItem('pos_business', currentBusiness);
        localStorage.setItem('pos_whatsapp', currentWhatsApp);
        localStorage.setItem('pos_address', currentAddress);
        if (currentLogo) localStorage.setItem('pos_logo', currentLogo);
        else localStorage.removeItem('pos_logo');

        document.getElementById('business-name-display').textContent = currentBusiness;

        alert('Settings updated successfully!');
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
});

document.getElementById('settings-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('settings-new-password').value;
    const confirmPassword = document.getElementById('settings-confirm-password').value;

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    try {
        const res = await fetchAuth(`${API_BASE}/user/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update password');

        document.getElementById('settings-password-form').reset();
        alert('Password updated successfully!');
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
});
