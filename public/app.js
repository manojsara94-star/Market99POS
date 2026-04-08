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

        // Update Sidebar Branding & Header Avatar
        const sidebarLogoContainer = document.getElementById('sidebar-logo-container');
        const userAvatar = document.getElementById('header-user-avatar');
        
        if (currentLogo) {
            sidebarLogoContainer.innerHTML = `<img src="${currentLogo}" alt="${currentBusiness}">`;
        } else {
            sidebarLogoContainer.innerHTML = `<i class='bx bx-store-alt icon'></i> <span class="logo-name">Retail POS</span>`;
        }
        
        userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentBusiness)}&background=4f46e5&color=fff`;

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
let suppliersList = [];
let purchasesList = [];
let currentPurchaseItems = [];
let currentBill = [];
let currentTab = 'dashboard-view';
let chartInstance = null;
let currentProductImageBase64 = null;
let notifiedLowStockProducts = new Set();
let currentPOSCategory = 'All';
let customersList = [];
let lastInvoiceShown = null;
let currentInventoryCategory = 'All';

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
const supplierModal = document.getElementById('supplier-modal');
const purchaseModal = document.getElementById('purchase-modal');
const purchasePaymentModal = document.getElementById('purchase-payment-modal');
const invoicePaymentModal = document.getElementById('invoice-payment-modal');

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
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    // Format as YYYY-MM-DD
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    clockEl.innerHTML = `<i class='bx bx-time-five'></i> <span>${timeStr}</span> <span style="opacity:0.7; font-weight:400; margin-left:10px; padding-left:10px; border-left:1px solid rgba(255,255,255,0.3);">${dateStr}</span>`;
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
            if (target === 'suppliers-view') loadSuppliers();
            if (target === 'purchases-view') loadPurchases();
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
        const supplier = document.getElementById('product-supplier').value;

        const payload = {
            name,
            description,
            category,
            quantity: parseInt(qty) || 0,
            low_stock_limit: parseInt(low_stock_limit) || 10,
            cost: parseFloat(cost) || 0,
            price: parseFloat(price) || 0,
            supplier: supplier || null,
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

    // WhatsApp Share logic (updated to include subtotal)
    document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
        if (!lastInvoiceShown) return;
        
        const inv = lastInvoiceShown;
        let message = `*Invoice: ${inv.invoice_number}*\n`;
        message += `*Date:* ${inv.date} ${inv.time}\n`;
        message += `*Business:* ${inv.owner_name || currentBusiness}\n`;
        message += `--------------------------\n`;
        
        inv.items.forEach(item => {
            const amt = (item.price * item.quantity) - (item.discount || 0);
            message += `${item.product_name || item.name} x ${item.quantity} = Rs.${amt.toFixed(2)}\n`;
        });
        
        message += `--------------------------\n`;
        message += `*Sub Total: Rs.${(parseFloat(inv.total_amount) + (parseFloat(inv.total_discount) || 0)).toFixed(2)}*\n`;
        if (inv.total_discount > 0) {
            message += `*Discount: -Rs.${parseFloat(inv.total_discount).toFixed(2)}*\n`;
        }
        message += `*NET TOTAL: Rs.${parseFloat(inv.total_amount).toFixed(2)}*\n\n`;
        message += `Thank you for your business!`;

        const encodedMsg = encodeURIComponent(message);
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
        window.open(whatsappUrl, '_blank');
    });

    // Share PDF Logic
    document.getElementById('btn-share-pdf').addEventListener('click', async () => {
        if (!lastInvoiceShown) return;
        const inv = lastInvoiceShown;
        const element = document.getElementById('print-area');
        
        // Save original styles
        const originalWidth = element.style.width;
        const originalBg = element.style.background;
        const originalPadding = element.style.padding;

        // Force 80mm width for perfect PDF conversion
        element.style.width = "80mm";
        element.style.background = "white";
        element.style.padding = "10px";

        const options = {
            margin: 0,
            filename: `Invoice_${inv.invoice_number}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 4, useCORS: true, logging: false, letterRendering: true },
            jsPDF: { unit: 'mm', format: [80, 297], orientation: 'portrait' }
        };

        try {
            const pdfBlob = await html2pdf().set(options).from(element).output('blob');
            const file = new File([pdfBlob], `Invoice_${inv.invoice_number}.pdf`, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Invoice ${inv.invoice_number}`,
                    text: `Here is the PDF bill for Invoice ${inv.invoice_number}`
                });
            } else {
                // Fallback: Download
                html2pdf().set(options).from(element).save();
                alert('PDF generated! Please share the downloaded file manually via WhatsApp.');
            }
        } catch (err) {
            console.error('PDF sharing error:', err);
            alert('Failed to generate PDF. Make sure your browser supports this feature.');
        } finally {
            element.style.width = originalWidth;
            element.style.background = originalBg;
            element.style.padding = originalPadding;
        }
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

// ==== SUPPLIERS ====

async function loadSuppliers() {
    try {
        const res = await fetchAuth(`${API_BASE}/suppliers`);
        suppliersList = await res.json();
        
        // Populating the grid
        const tbody = document.querySelector('#suppliers-table tbody');
        tbody.innerHTML = '';
        suppliersList.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.name}</strong></td>
                <td>${s.contact || '-'}</td>
                <td>${s.address || '-'}</td>
                <td><small>${s.note || '-'}</small></td>
                <td>
                    <div class="header-actions">
                         <button class="btn btn-outline btn-icon-only edit-supp-btn" data-id="${s.id}"><i class='bx bx-edit'></i></button>
                         <button class="btn btn-danger btn-icon-only del-supp-btn" data-id="${s.id}"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Updating the dropdown in product modal
        const prodSuppSelect = document.getElementById('product-supplier');
        if (prodSuppSelect) {
            const currentVal = prodSuppSelect.value;
            prodSuppSelect.innerHTML = '<option value="">Select Supplier (Optional)</option>';
            suppliersList.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                prodSuppSelect.appendChild(opt);
            });
            prodSuppSelect.value = currentVal;
        }
    } catch (err) {
        console.error(err);
    }
}

document.getElementById('btn-add-supplier').addEventListener('click', () => {
    document.getElementById('supplier-form').reset();
    document.getElementById('supplier-id').value = '';
    document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
    showModal(supplierModal);
});

document.getElementById('btn-close-supplier-modal').addEventListener('click', hideModal);

document.getElementById('supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('supplier-id').value;
    const name = document.getElementById('supplier-name').value;
    const contact = document.getElementById('supplier-contact').value;
    const address = document.getElementById('supplier-address').value;
    const note = document.getElementById('supplier-note').value;

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/suppliers/${id}` : `${API_BASE}/suppliers`;
        const res = await fetchAuth(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact, address, note })
        });
        if (!res.ok) throw new Error('Action failed');
        hideModal();
        loadSuppliers();
    } catch (err) {
        alert(err.message);
    }
});

document.querySelector('#suppliers-table tbody').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-supp-btn');
    if (editBtn) {
        const id = editBtn.dataset.id;
        const supp = suppliersList.find(s => s.id == id);
        if (supp) {
            document.getElementById('supplier-id').value = id;
            document.getElementById('supplier-name').value = supp.name;
            document.getElementById('supplier-contact').value = supp.contact || '';
            document.getElementById('supplier-address').value = supp.address || '';
            document.getElementById('supplier-note').value = supp.note || '';
            document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
            showModal(supplierModal);
        }
    }
    const delBtn = e.target.closest('.del-supp-btn');
    if (delBtn) {
        if (confirm('Delete this supplier?')) {
            fetchAuth(`${API_BASE}/suppliers/${delBtn.dataset.id}`, { method: 'DELETE' })
                .then(() => loadSuppliers());
        }
    }
});

// ==== PURCHASES (STOCK-IN) ====

async function loadPurchases() {
    try {
        const res = await fetchAuth(`${API_BASE}/purchases`);
        purchasesList = await res.json();
        const tbody = document.querySelector('#purchases-table tbody');
        tbody.innerHTML = '';

        purchasesList.forEach(p => {
            const tr = document.createElement('tr');
            const balanceVal = p.balance_amount || 0;
            const statusText = balanceVal <= 0 ? 'Paid' : (p.paid_amount > 0 ? 'Partial' : 'Credit');
            const statusClass = statusText === 'Paid' ? 'success' : (statusText === 'Partial' ? 'warning' : 'danger');

            tr.innerHTML = `
                <td><strong>${p.purchase_number}</strong></td>
                <td>${p.date}</td>
                <td>${p.supplier_name || 'N/A'}</td>
                <td>${formatCurrency(p.total_amount)}</td>
                <td style="color:var(--primary);">${formatCurrency(p.paid_amount || 0)}</td>
                <td style="color:var(--danger);">${formatCurrency(p.balance_amount || 0)}</td>
                <td><span class="badge" style="background:var(--${statusClass}-light); color:var(--text-color);">${statusText}</span></td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-purchase-btn" data-id="${p._id || p.id}"><i class='bx bx-show'></i></button>
                    ${balanceVal > 0 ? `<button class="btn btn-primary btn-icon-only pay-purchase-btn" data-id="${p._id || p.id}" style="margin-left:5px;" title="Add Payment"><i class='bx bx-money'></i></button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); }
}

document.querySelector('#purchases-table tbody').addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.view-purchase-btn');
    if (viewBtn) {
        const id = viewBtn.dataset.id;
        const purchase = purchasesList.find(p => (p._id || p.id) == id);
        if (purchase) {
            // View Mode
            document.getElementById('purchase-supplier').disabled = true;
            document.getElementById('purchase-date').disabled = true;
            document.getElementById('btn-add-item-to-purchase').style.display = 'none';
            document.getElementById('purchase-product-search').parentElement.parentElement.style.display = 'none';
            document.getElementById('btn-save-purchase').style.display = 'none';
            document.getElementById('purchase-paid-amount').disabled = true;
            document.querySelector('#purchase-modal h3').textContent = `Purchase Detail: ${purchase.purchase_number}`;

            // Ensure suppliers are loaded into dropdown first
            const suppSelect = document.getElementById('purchase-supplier');
            suppSelect.innerHTML = '<option value="">Select Supplier</option>';
            suppliersList.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                suppSelect.appendChild(opt);
            });

            currentPurchaseItems = purchase.items || [];
            document.getElementById('purchase-supplier').value = purchase.supplier_id || '';
            document.getElementById('purchase-date').value = purchase.date;
            document.getElementById('purchase-paid-amount').value = purchase.paid_amount;
            
            updatePurchaseListUI();
            
            // Hide delete buttons in rows for view mode
            setTimeout(() => {
                document.querySelectorAll('.remove-pur-item').forEach(b => b.style.display = 'none');
            }, 100);

            showModal(purchaseModal);
        }
    }
    const payBtn = e.target.closest('.pay-purchase-btn');
    if (payBtn) {
        const id = payBtn.dataset.id;
        const purchase = purchasesList.find(p => (p._id || p.id) == id);
        if (purchase) {
            document.getElementById('pay-pur-id').value = id;
            document.getElementById('pay-pur-number').textContent = purchase.purchase_number;
            document.getElementById('pay-pur-balance').textContent = formatCurrency(purchase.balance_amount);
            document.getElementById('pay-pur-amount').value = purchase.balance_amount;
            document.getElementById('pay-pur-amount').max = purchase.balance_amount;
            showModal(purchasePaymentModal);
        }
    }
});

document.getElementById('btn-close-pay-pur-modal').addEventListener('click', hideModal);

document.getElementById('purchase-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('pay-pur-id').value;
    const amount = document.getElementById('pay-pur-amount').value;

    try {
        const res = await fetchAuth(`${API_BASE}/purchases/${id}/payment`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        if (res.ok) {
            hideModal();
            loadPurchases();
            loadDashboard();
            alert('Payment recorded successfully');
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to record payment');
        }
    } catch (err) { console.error(err); }
});

document.getElementById('btn-new-purchase').addEventListener('click', async () => {
    // Reset view-only states
    document.getElementById('purchase-supplier').disabled = false;
    document.getElementById('purchase-date').disabled = false;
    document.getElementById('btn-add-item-to-purchase').style.display = 'block';
    document.getElementById('purchase-product-search').parentElement.parentElement.style.display = 'flex';
    document.getElementById('btn-save-purchase').style.display = 'block';
    document.getElementById('purchase-paid-amount').disabled = false;
    document.querySelector('#purchase-modal h3').textContent = 'New Stock Entry (Purchase)';

    currentPurchaseItems = [];
    document.getElementById('purchase-paid-amount').value = 0;
    document.getElementById('purchase-date').value = new Date().toISOString().split('T')[0];
    
    try {
        // Fetch latest products and suppliers
        const [prodRes, suppRes] = await Promise.all([
            fetchAuth(`${API_BASE}/products`),
            fetchAuth(`${API_BASE}/suppliers`)
        ]);
        products = await prodRes.json();
        suppliersList = await suppRes.json();

        // Load suppliers into dropdown
        const suppSelect = document.getElementById('purchase-supplier');
        suppSelect.innerHTML = '<option value="">Select Supplier</option>';
        suppliersList.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            suppSelect.appendChild(opt);
        });

        // Load products into search list
        const prodList = document.getElementById('purchase-prod-list');
        prodList.innerHTML = '';
        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            prodList.appendChild(opt);
        });
    } catch (err) {
        console.error('Error initializing purchase modal:', err);
    }

    updatePurchaseListUI();
    showModal(purchaseModal);
});

document.getElementById('btn-close-purchase-modal').addEventListener('click', hideModal);

document.getElementById('purchase-product-search').addEventListener('input', (e) => {
    const val = e.target.value;
    const prod = products.find(p => p.name === val);
    if (prod) {
        document.getElementById('purchase-qty').value = 1;
        document.getElementById('purchase-cost').value = prod.cost || 0;
    }
});

document.getElementById('btn-add-item-to-purchase').addEventListener('click', () => {
    const searchInput = document.getElementById('purchase-product-search');
    const searchVal = searchInput.value.trim();
    const qtyInput = document.getElementById('purchase-qty');
    const costInput = document.getElementById('purchase-cost');
    
    const qty = parseInt(qtyInput.value);
    const cost = parseFloat(costInput.value);

    if (!searchVal) return alert('Please select a product');

    const prod = products.find(p => p.name.trim().toLowerCase() === searchVal.toLowerCase());
    
    if (!prod) {
        return alert('Product not found. Please select an item from the search list.');
    }
    
    if (isNaN(qty) || qty <= 0) return alert('Enter a valid quantity');
    if (isNaN(cost)) return alert('Enter a valid cost price');

    const existing = currentPurchaseItems.find(i => i.product_id === prod.id || i.product_id === prod._id);
    if (existing) {
        existing.quantity += qty;
        existing.cost = cost;
        existing.subtotal = existing.quantity * existing.cost;
    } else {
        currentPurchaseItems.push({
            product_id: prod.id || prod._id,
            product_name: prod.name,
            quantity: qty,
            cost: cost,
            subtotal: qty * cost
        });
    }

    // Reset inputs
    searchInput.value = '';
    qtyInput.value = 1;
    costInput.value = '';
    searchInput.focus();
    
    updatePurchaseListUI();
});

function updatePurchaseListUI() {
    const tbody = document.querySelector('#purchase-items-table tbody');
    tbody.innerHTML = '';
    let total = 0;

    currentPurchaseItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.cost)}</td>
            <td>${formatCurrency(item.subtotal)}</td>
            <td><button class="btn btn-danger btn-icon-only remove-pur-item" data-index="${index}"><i class='bx bx-trash'></i></button></td>
        `;
        tbody.appendChild(tr);
        total += item.subtotal;
    });

    document.getElementById('purchase-total-display').textContent = formatCurrency(total);
    updatePurchaseBalance();
}

document.querySelector('#purchase-items-table tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-pur-item');
    if (btn) {
        const index = parseInt(btn.dataset.index);
        currentPurchaseItems.splice(index, 1);
        updatePurchaseListUI();
    }
});

function updatePurchaseBalance() {
    const total = currentPurchaseItems.reduce((sum, i) => sum + i.subtotal, 0);
    const paid = parseFloat(document.getElementById('purchase-paid-amount').value) || 0;
    const balance = total - paid;
    document.getElementById('purchase-balance-display').textContent = `Balance: ${formatCurrency(balance)}`;
}

document.getElementById('purchase-paid-amount').addEventListener('input', updatePurchaseBalance);

document.getElementById('btn-save-purchase').addEventListener('click', async () => {
    if (currentPurchaseItems.length === 0) return alert('Add items to entry first');
    const supplierId = document.getElementById('purchase-supplier').value;
    const date = document.getElementById('purchase-date').value;
    const paidAmount = parseFloat(document.getElementById('purchase-paid-amount').value) || 0;
    const totalAmount = currentPurchaseItems.reduce((sum, i) => sum + i.subtotal, 0);

    if (!supplierId || !date) return alert('Supplier and Date are required');

    const supplier = suppliersList.find(s => s.id === supplierId);

    const payload = {
        supplier_id: supplierId,
        supplier_name: supplier ? supplier.name : 'Unknown',
        date,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        items: currentPurchaseItems
    };

    try {
        const res = await fetchAuth(`${API_BASE}/purchases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            hideModal();
            loadPurchases();
            loadInventory();
            loadDashboard();
            alert('Stock entry and inventory update completed!');
        } else {
            const err = await res.json();
            alert(err.error || 'Failed to complete entry');
        }
    } catch (err) { console.error(err); }
});

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
    const val = parseFloat(amount) || 0;
    return 'Rs. ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        document.getElementById('dash-asset-value').textContent = formatCurrency(stats.totalAssetValue);
        document.getElementById('dash-low-stock').textContent = stats.lowStockProducts;
        document.getElementById('dash-supplier-credit').textContent = formatCurrency(stats.supplierCredit || 0);

        // Show/Hide Low Stock Alert Banner
        const alertBanner = document.getElementById('low-stock-alert-banner');
        if (stats.lowStockProducts > 0) {
            alertBanner.classList.add('active');
            document.getElementById('low-stock-alert-text').textContent = `You have ${stats.lowStockProducts} item(s) running below the minimum quantity threshold.`;
        } else {
            alertBanner.classList.remove('active');
        }

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
        const invSel = document.getElementById('inventory-category-filter');
        const oldVal = sel.value;
        const oldInvVal = invSel ? invSel.value : 'All';
        
        sel.innerHTML = '<option value="">Select Category</option>';
        if (invSel) invSel.innerHTML = '<option value="All">All Categories</option>';
        
        cachedCategories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            sel.appendChild(opt);
            
            if (invSel) {
                const optInv = document.createElement('option');
                optInv.value = c.name;
                optInv.textContent = c.name;
                invSel.appendChild(optInv);
            }
        });
        if (oldVal) sel.value = oldVal;
        if (invSel) invSel.value = oldInvVal;
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
        
        // Handle Category Filtering
        if (currentInventoryCategory !== 'All') {
            productsToRender = productsToRender.filter(p => (p.category || 'General') === currentInventoryCategory);
        }

        const filterBadge = document.getElementById('inventory-filter-badge');
        if (currentRole === 'admin' && adminInventoryFilter) {
            productsToRender = productsToRender.filter(p => p.owner_name === adminInventoryFilter);
            document.getElementById('inventory-filter-name').textContent = adminInventoryFilter;
            filterBadge.style.display = 'flex';
        } else {
            filterBadge.style.display = 'none';
        }

        await loadSuppliers(); // Fetch latest suppliers
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
                <td style="font-size:13px; font-weight:600; color:var(--text-muted);">${p.supplier_name || 'No Supplier'}</td>
                <td>${formatCurrency(p.cost || 0)}</td>
                <td>${formatCurrency(p.price)}</td>
                <td>
                    <div class="header-actions">
                        <button class="btn btn-outline btn-icon-only edit-btn" data-id="${p.id}"><i class='bx bx-edit'></i></button>
                        <button class="btn btn-danger btn-icon-only del-btn" data-id="${p.id}"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
    }
}

document.getElementById('inventory-category-filter').addEventListener('change', (e) => {
    currentInventoryCategory = e.target.value;
    loadInventory();
});

document.getElementById('btn-clear-inventory-filter').addEventListener('click', () => {
    adminInventoryFilter = null;
    currentInventoryCategory = 'All';
    document.getElementById('inventory-category-filter').value = 'All';
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
        document.getElementById('product-supplier').value = p.supplier_id || '';

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
        const subtotal = item.price * item.quantity;
        total += subtotal - itemDiscount;
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
                <div class="item-total">${formatCurrency(subtotal - itemDiscount)}</div>
            </div>
        `;
        itemsContainer.appendChild(div);
    });

    document.getElementById('pos-sub-total').textContent = formatCurrency(total + totalDiscount);
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
    lastInvoiceShown = invoice;
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
    invoice.items.forEach((item, index) => {
        const itemDiscount = item.discount || 0;
        const amt = (item.price * item.quantity) - itemDiscount;
        total += amt;
        let discountNote = '';
        if (itemDiscount > 0) {
            discountNote = `<div style="font-size: 10px; color: #555;">Disc: -${formatCurrency(itemDiscount)}</div>`;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <div>${item.product_name || item.name}</div>
                ${discountNote}
            </td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price).replace('Rs. ', '')}</td>
            <td>${formatCurrency(amt).replace('Rs. ', '')}</td>
        `;
        tbody.appendChild(tr);
    });

    const discountRow = document.getElementById('receipt-discount-row');
    if (invoice.total_discount > 0) {
        discountRow.style.display = 'flex';
        document.getElementById('receipt-total-discount').textContent = formatCurrency(invoice.total_discount).replace('Rs. ', '');
    } else {
        discountRow.style.display = 'none';
    }

    document.getElementById('receipt-sub-total').textContent = formatCurrency(parseFloat(invoice.total_amount) + (parseFloat(invoice.total_discount) || 0));
    document.getElementById('receipt-total-amount').textContent = formatCurrency(invoice.total_amount);

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
            let invDisplay = inv.invoice_number;
            if (currentRole === 'admin') {
                invDisplay += `<div style="font-size:11px;color:var(--primary);margin-top:2px;">[${inv.owner_name}]</div>`;
            }

            tr.innerHTML = `
                <td>${invDisplay}</td>
                <td>${inv.date}</td>
                <td>${inv.time}</td>
                <td style="font-weight:bold">${formatCurrency(inv.total_amount)}</td>
                <td>
                    <button class="btn btn-outline btn-icon-only view-invoice-btn" data-id="${inv.id}" title="View Details"><i class='bx bx-show'></i></button>
                    <button class="btn btn-primary btn-icon-only print-invoice-btn" data-id="${inv.id}" title="Print Receipt"><i class='bx bx-printer'></i></button>
                    <button class="btn btn-danger btn-icon-only delete-invoice-btn" data-id="${inv.id}" title="Delete Invoice"><i class='bx bx-trash'></i></button>
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
let currentReportMode = 'products';

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(td => td.classList.remove('active'));
        e.target.classList.add('active');
        currentReportMode = e.target.getAttribute('data-report');
        loadReports();
    });
});

async function loadReports() {
    const thead = document.querySelector('#reports-table thead');
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';
    thead.innerHTML = '';

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
        } else if (currentReportMode === 'products') {
            thead.innerHTML = `<tr><th>Product Name</th><th>Quantity Sold</th><th>Revenue</th><th>Profit</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/product-sales`);
            const data = await res.json();
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.product_name}</td><td>${row.quantity_sold}</td><td>${formatCurrency(row.revenue)}</td><td style="color:var(--success);font-weight:bold;">${formatCurrency(row.profit)}</td>`;
                tbody.appendChild(tr);
            });
        } else if (currentReportMode === 'customers') {
            thead.innerHTML = `<tr><th>Customer Name</th><th>No. of Bills</th><th>Total Revenue</th><th>Total Profit</th></tr>`;
            const res = await fetchAuth(`${API_BASE}/reports/customer-sales`);
            const data = await res.json();
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.customer_name}</td><td>${row.bills_count}</td><td>${formatCurrency(row.revenue)}</td><td style="color:var(--success);font-weight:bold;">${formatCurrency(row.profit)}</td>`;
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
