const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, initializeDatabase, User, Product, Invoice, Category, Customer, Expense } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB when running locally
if (process.env.NODE_ENV !== 'production') {
    connectDB().then(() => {
        initializeDatabase();
    });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==== AUTH API ====

app.post('/api/auth/register', async (req, res) => {
    const { email, password, business_name, whatsapp_number } = req.body;
    if (!email || !password || !business_name || !whatsapp_number) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const user = await User.create({ email, password, business_name, whatsapp_number });
        res.status(201).json({ 
            token: user._id.toString(), 
            business_name: user.business_name, 
            role: user.role,
            logo: user.logo
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const user = await User.findOne({ email, password });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ token: user._id.toString(), business_name: user.business_name, role: user.role, logo: user.logo });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== AUTH MIDDLEWARE ====
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    try {
        const user = await User.findById(token);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth') || req.path.startsWith('/public')) return next();
    return authMiddleware(req, res, next);
});

// ==== ADMIN API ====

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only' });
    }
};

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
        const mappedUsers = users.map(u => ({
            id: u._id.toString(),
            email: u.email,
            business_name: u.business_name,
            whatsapp_number: u.whatsapp_number,
            marketplace_enabled: u.marketplace_enabled,
            role: u.role
        }));
        res.json(mappedUsers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id', adminMiddleware, async (req, res) => {
    const { email, business_name, whatsapp_number, marketplace_enabled } = req.body;
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { email, business_name, whatsapp_number, marketplace_enabled },
            { new: true }
        ).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndDelete(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Also delete associated products and invoices
        await Product.deleteMany({ user_id: userId });
        await Invoice.deleteMany({ user_id: userId });
        
        res.json({ message: 'User and all associated data deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== DASHBOARD API ====

app.get('/api/dashboard', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // YYYY-MM
    const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
    
    try {
        // Daily Stats
        const dailyInvoices = await Invoice.find({ ...queryFilter, date: today });
        const monthlyInvoices = await Invoice.find({ ...queryFilter, date: new RegExp('^' + currentMonth) });
        
        // Income & Counts
        const dailyIncome = dailyInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const monthlyIncome = monthlyInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
        const totalBillsToday = dailyInvoices.length;
        const totalBillsMonth = monthlyInvoices.length;

        // Profit 
        const dailyProfitRaw = dailyInvoices.reduce((sum, inv) => sum + (inv.total_profit || 0), 0);
        const monthlyProfitRaw = monthlyInvoices.reduce((sum, inv) => sum + (inv.total_profit || 0), 0);

        // Fetch Expenses
        const dailyExpenses = await Expense.find({ ...queryFilter, date: today });
        const monthlyExpenses = await Expense.find({ ...queryFilter, date: new RegExp('^' + currentMonth) });

        const dailyExpenseTotal = dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
        const monthlyExpenseTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

        // Product Counts
        const totalProducts = await Product.countDocuments(queryFilter);
        const lowStockProducts = await Product.countDocuments({ ...queryFilter, $expr: { $lte: ["$quantity", { $ifNull: ["$low_stock_limit", 10] }] } });

        res.json({
            totalBillsToday,
            totalBillsMonth,
            dailyIncome,
            monthlyIncome,
            dailyExpenseTotal,
            monthlyExpenseTotal,
            dailyProfit: dailyProfitRaw - dailyExpenseTotal,
            monthlyProfit: monthlyProfitRaw - monthlyExpenseTotal,
            totalProducts,
            lowStockProducts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard/low-stock', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const lowStockQuery = { 
            ...queryFilter, 
            $expr: { $lte: ["$quantity", { $ifNull: ["$low_stock_limit", 10] }] }
        };
        const products = await Product.find(lowStockQuery)
            .populate('user_id', 'business_name')
            .sort({ quantity: 1 })
            .limit(10);
            
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            quantity: p.quantity,
            price: p.price,
            owner_name: p.user_id ? p.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedProducts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== CATEGORIES API ====

app.get('/api/categories', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const categories = await Category.find(queryFilter).sort({ name: 1 });
        res.json(categories.map(c => ({ id: c._id.toString(), name: c.name })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        const category = await Category.create({ user_id: req.user._id, name });
        res.status(201).json({ id: category._id.toString(), name: category.name });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const category = await Category.findOneAndDelete(queryFilter);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/expenses', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const expenses = await Expense.find(queryFilter).sort({ date: -1 });
        res.json(expenses);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    const { title, amount, category, date, note } = req.body;
    if (!title || !amount || !date) return res.status(400).json({ error: 'Title, amount and date are required' });
    try {
        const expense = await Expense.create({ user_id: req.user._id, title, amount, category, date, note });
        res.status(201).json(expense);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    const { title, amount, category, date, note } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const expense = await Expense.findOneAndUpdate(
            queryFilter,
            { title, amount, category, date, note },
            { new: true }
        );
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        res.json(expense);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const expense = await Expense.findOneAndDelete(queryFilter);
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        res.json({ message: 'Expense deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/customers', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const customers = await Customer.find(queryFilter).sort({ name: 1 });
        res.json(customers);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/customers', async (req, res) => {
    const { name, contact, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        const customer = await Customer.create({ user_id: req.user._id, name, contact, address });
        res.status(201).json(customer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/customers/:id', async (req, res) => {
    const { name, contact, address } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const customer = await Customer.findOneAndUpdate(
            queryFilter,
            { name, contact, address },
            { new: true }
        );
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json(customer);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const customer = await Customer.findOneAndDelete(queryFilter);
        if (!customer) return res.status(404).json({ error: 'Customer not found' });
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== INVENTORY (PRODUCTS) API ====

app.get('/api/products', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const products = await Product.find(queryFilter)
            .populate('user_id', 'business_name')
            .sort({ name: 1 });
        
        // Map _id to id for the frontend
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            description: p.description,
            category: p.category || 'General',
            quantity: p.quantity,
            low_stock_limit: p.low_stock_limit !== undefined ? p.low_stock_limit : 10,
            cost: p.cost || 0,
            price: p.price,
            image: p.image,
            owner_name: p.user_id ? p.user_id.business_name : 'Unknown'
        }));
        
        res.json(mappedProducts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { name, description, category, quantity, low_stock_limit, cost, price, image } = req.body;
    if (!name || quantity === undefined || price === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const product = await Product.create({
            user_id: req.user._id,
            name,
            description,
            category: category || 'General',
            quantity,
            low_stock_limit: low_stock_limit !== undefined ? low_stock_limit : 10,
            cost: cost || 0,
            price,
            image
        });
        res.status(201).json({ id: product._id.toString(), name, description, category: product.category, quantity, low_stock_limit: product.low_stock_limit, cost: product.cost, price, image });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const { name, description, category, quantity, low_stock_limit, cost, price, image } = req.body;
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOneAndUpdate(
            queryFilter,
            { name, description, category: category || 'General', quantity, low_stock_limit: low_stock_limit !== undefined ? low_stock_limit : 10, cost, price, image },
            { new: true }
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const product = await Product.findOneAndDelete(queryFilter);
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== INVOICES API ====

app.get('/api/invoices', async (req, res) => {
    const { date, month } = req.query;
    let query = req.user.role === 'admin' ? {} : { user_id: req.user._id };

    if (date) {
        query.date = date;
    } else if (month) {
        query.date = new RegExp('^' + month);
    }

    try {
        const invoices = await Invoice.find(query)
            .populate('user_id', 'business_name logo whatsapp_number')
            .sort({ date: -1, time: -1 });
        
        // Map _id to id for frontend
        const mappedInvoices = invoices.map(inv => ({
            id: inv._id.toString(),
            invoice_number: inv.invoice_number,
            date: inv.date,
            time: inv.time,
            total_amount: inv.total_amount,
            owner_name: inv.user_id ? inv.user_id.business_name : 'Unknown',
            owner_logo: inv.user_id ? inv.user_id.logo : null,
            owner_info: inv.user_id ? inv.user_id.whatsapp_number : ''
        }));
        
        res.json(mappedInvoices);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const invoice = await Invoice.findOne(queryFilter).populate('user_id', 'business_name logo whatsapp_number');
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        
        const response = {
            id: invoice._id.toString(),
            invoice_number: invoice.invoice_number,
            date: invoice.date,
            time: invoice.time,
            total_amount: invoice.total_amount,
            owner_name: invoice.user_id ? invoice.user_id.business_name : '',
            owner_logo: invoice.user_id ? invoice.user_id.logo : null,
            owner_info: invoice.user_id ? invoice.user_id.whatsapp_number : '',
            items: invoice.items.map(item => ({
                id: item._id ? item._id.toString() : null,
                product_name: item.product_name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.subtotal
            }))
        };
        res.json(response);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    const { items, total_amount, total_discount, customer_name, customer_contact, customer_address, date: clientDate, time: clientTime } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Invoice must have items' });
    }

    const today = new Date();
    const date = clientDate || today.toISOString().split('T')[0];
    const time = clientTime || today.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    const invoice_number = 'INV-' + today.getTime().toString().slice(-6);

    const formattedItems = items.map(item => {
        const itemCost = item.cost || 0;
        const itemDiscount = item.discount || 0;
        const subtotal = (item.price * item.quantity) - itemDiscount;
        const itemProfit = subtotal - (itemCost * item.quantity);
        return {
            product_name: item.name,
            quantity: item.quantity,
            cost: itemCost,
            price: item.price,
            discount: itemDiscount,
            subtotal: subtotal,
            profit: itemProfit
        };
    });

    const total_profit = formattedItems.reduce((sum, item) => sum + item.profit, 0);

    // We can use a MongoDB transaction if it's a replica set, 
    // but typically Atlas free tier supports them. 
    // Standard Mongoose write:
    try {
        const invoice = await Invoice.create({
            user_id: req.user._id,
            invoice_number,
            date,
            time,
            customer_name: customer_name || '',
            customer_contact: customer_contact || '',
            customer_address: customer_address || '',
            total_amount,
            total_discount: total_discount || 0,
            total_profit,
            items: formattedItems
        });

        // Update product stock manually
        for (const item of items) {
            await Product.findOneAndUpdate(
                { name: item.name, user_id: req.user._id },
                { $inc: { quantity: -item.quantity } }
            );
        }

        // Auto-save/Update the customer profile
        if (customer_name) {
            let existingCustomer = await Customer.findOne({ user_id: req.user._id, name: customer_name });
            if (!existingCustomer) {
                await Customer.create({ 
                    user_id: req.user._id, 
                    name: customer_name, 
                    contact: customer_contact || '', 
                    address: customer_address || '' 
                });
            } else {
                // Update profile if new data is provided
                let updated = false;
                if (customer_contact && existingCustomer.contact !== customer_contact) {
                    existingCustomer.contact = customer_contact;
                    updated = true;
                }
                if (customer_address && existingCustomer.address !== customer_address) {
                    existingCustomer.address = customer_address;
                    updated = true;
                }
                if (updated) await existingCustomer.save();
            }
        }

        res.status(201).json({ 
            invoice: {
                ...invoice.toObject(),
                id: invoice._id.toString(),
                owner_name: req.user.business_name,
                owner_logo: req.user.logo,
                owner_info: req.user.whatsapp_number
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/invoices/:id', async (req, res) => {
    try {
        const queryFilter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user_id: req.user._id };
        const invoice = await Invoice.findOneAndDelete(queryFilter);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        
        // Need to add back the stock quantities
        if (invoice.user_id) {
            for (const item of invoice.items) {
                await Product.findOneAndUpdate(
                    { name: item.product_name, user_id: invoice.user_id },
                    { $inc: { quantity: item.quantity } }
                );
            }
        }
        res.json({ message: 'Invoice deleted successfully. Inventory restocked.' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== REPORTS API ====

app.get('/api/reports/sales', async (req, res) => {
    try {
        const queryMatch = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const result = await Invoice.aggregate([
            { $match: queryMatch },
            { $group: { _id: "$date", total_sales: { $sum: "$total_amount" }, total_profit: { $sum: "$total_profit" } } },
            { $project: { date: "$_id", total_sales: 1, total_profit: 1, _id: 0 } },
            { $sort: { date: -1 } }
        ]);
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/product-sales', async (req, res) => {
    try {
        const queryMatch = req.user.role === 'admin' ? {} : { user_id: req.user._id };
        const result = await Invoice.aggregate([
            { $match: queryMatch },
            { $unwind: "$items" },
            { $group: { 
                _id: "$items.product_name", 
                quantity_sold: { $sum: "$items.quantity" },
                revenue: { $sum: "$items.subtotal" },
                profit: { $sum: "$items.profit" }
            }},
            { $project: { product_name: "$_id", quantity_sold: 1, revenue: 1, profit: 1, _id: 0 } },
            { $sort: { quantity_sold: -1 } }
        ]);
        res.json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== MARKETPLACE API ====

app.post('/api/marketplace/enable', async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { marketplace_enabled: true });
        res.json({ message: 'Marketplace enabled successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ==== USER SETTINGS API ====

app.get('/api/user/settings', async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.put('/api/user/settings', async (req, res) => {
    const { business_name, password, logo } = req.body;
    try {
        const updateData = {};
        if (business_name) updateData.business_name = business_name;
        if (password) updateData.password = password;
        if (logo !== undefined) updateData.logo = logo;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No data to update' });
        }

        const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ 
            message: 'Settings updated successfully', 
            business_name: user.business_name,
            logo: user.logo
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/public/store/:business_name', async (req, res) => {
    try {
        const storeOwner = await User.findOne({ business_name: req.params.business_name });
        if (!storeOwner || storeOwner.marketplace_enabled !== true) {
            return res.status(404).json({ error: 'Store not found or marketplace is disabled' });
        }
        
        // Return products that have stock
        const products = await Product.find({ user_id: storeOwner._id, quantity: { $gt: 0 } }).sort({ name: 1 });
        const mappedProducts = products.map(p => ({
            id: p._id.toString(),
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image
        }));
        
        // Return store info and products
        res.json({
            business_name: storeOwner.business_name,
            whatsapp_number: storeOwner.whatsapp_number,
            products: mappedProducts
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Serves the public marketplace UI
app.get('/:business_name', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'marketplace.html'));
});

// Export app for Vercel, listen for local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
module.exports = app;
