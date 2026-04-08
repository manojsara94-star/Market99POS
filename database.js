const mongoose = require('mongoose');

// Global variable to cache the mongoose connection
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb) {
        console.log('Using cached MongoDB connection');
        return cachedDb;
    }

    try {
        const uri = process.env.MONGO_URI || 'mongodb+srv://Manoj1994:Manoj1994@cluster0.j5cvscw.mongodb.net/?appName=Cluster0';
        const db = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000 // Tweak timeout down so Serverless fails faster instead of hanging
        });
        
        cachedDb = db;
        console.log('Connected to MongoDB database');
        return db;
    } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        throw err; // don't process.exit(1) in serverless!
    }
};

// -- SCHEMAS --

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    business_name: { type: String, required: true },
    whatsapp_number: { type: String },
    business_address: { type: String },
    marketplace_enabled: { type: Boolean, default: false },
    role: { type: String, default: 'user' },
    logo: { type: String },
    invoice_counter: { type: Number, default: 0 }
});

const ProductSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String },
    quantity: { type: Number, default: 0 },
    low_stock_limit: { type: Number, default: 10 },
    cost: { type: Number, default: 0.0 },
    price: { type: Number, default: 0.0 },
    category: { type: String, default: 'General'},
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    image: { type: String }
});

const InvoiceItemSchema = new mongoose.Schema({
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true },
    cost: { type: Number, default: 0.0 },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0.0 },
    subtotal: { type: Number, required: true },
    profit: { type: Number, default: 0.0 }
});

const InvoiceSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoice_number: { type: String, required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    time: { type: String, required: true }, // Format: HH:MM
    customer_name: { type: String, default: '' },
    customer_contact: { type: String, default: '' },
    customer_address: { type: String, default: '' },
    total_amount: { type: Number, default: 0.0 },
    total_discount: { type: Number, default: 0.0 },
    total_profit: { type: Number, default: 0.0 },
    items: [InvoiceItemSchema]
});

const CategorySchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true }
});

const CustomerSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    contact: { type: String, default: '' },
    address: { type: String, default: '' }
});

const ExpenseSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, default: 'General' },
    date: { type: String, required: true }, // YYYY-MM-DD
    note: { type: String }
});

const SupplierSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    contact: { type: String, default: '' },
    address: { type: String, default: '' },
    note: { type: String, default: '' }
});

// -- MODELS --
const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Category = mongoose.model('Category', CategorySchema);
const Customer = mongoose.model('Customer', CustomerSchema);
const Expense = mongoose.model('Expense', ExpenseSchema);

const Supplier = mongoose.model('Supplier', SupplierSchema);

// Create default admin user
const initializeDatabase = async () => {
    try {
        const adminExists = await User.findOne({ email: 'Admin' });
        if (!adminExists) {
            await User.create({
                email: 'Admin',
                password: 'Abc@12345',
                business_name: 'Admin Portal',
                role: 'admin'
            });
            console.log('Admin user created.');
        } else if (adminExists.role !== 'admin') {
            await User.updateOne({ email: 'Admin' }, { role: 'admin' });
            console.log('Admin role updated for existing admin user.');
        }
    } catch (err) {
        console.error('Error initializing default user:', err.message);
    }
};

module.exports = {
    connectDB,
    initializeDatabase,
    User,
    Product,
    Invoice,
    Category,
    Customer,
    Expense,
    Supplier
};
