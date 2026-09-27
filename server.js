const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

const db = new Database(path.join(__dirname, "cafe.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  image TEXT,
  available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  table_no TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id),
  FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
);
`);

const adminEmail = "admin@chaikcafe.com";
const adminPassword = "admin123";
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)")
    .run("Cafe Admin", adminEmail, bcrypt.hashSync(adminPassword, 10), "admin");
}

const menuCount = db.prepare("SELECT COUNT(*) AS c FROM menu_items").get().c;
if (!menuCount) {
  const seed = db.prepare(`
    INSERT INTO menu_items (name,description,category,price,image) VALUES (?,?,?,?,?)
  `);
  const items = [
    ["Classic Cutting Chai","Strong Indian tea with a comforting spice finish.","Chai",90,"https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=900&q=85"],
    ["Masala Chai","Slow-brewed chai with aromatic Indian spices.","Chai",120,"https://images.unsplash.com/photo-1597318181409-cf64d0f5a780?auto=format&fit=crop&w=900&q=85"],
    ["Cold Coffee","Creamy chilled coffee with a rich café finish.","Coffee",180,"https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=85"],
    ["Hazelnut Latte","Silky espresso, steamed milk and roasted hazelnut.","Coffee",220,"https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=900&q=85"],
    ["Peri Peri Fries","Crispy fries tossed in house peri-peri seasoning.","Snacks",160,"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85"],
    ["Cheese Garlic Bread","Toasted bread, garlic butter and melted cheese.","Snacks",190,"https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=900&q=85"],
    ["Paneer Tikka","Smoky charred paneer with peppers and onions.","Mains",280,"https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=85"],
    ["Loaded Club Sandwich","Triple-layer café sandwich with fresh fillings.","Mains",260,"https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=85"],
    ["Chocolate Brownie","Warm fudgy brownie made for late-night cravings.","Desserts",170,"https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85"],
    ["Lotus Cheesecake","Creamy cheesecake with a caramelized biscuit crust.","Desserts",240,"https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=900&q=85"]
  ];
  const tx = db.transaction(() => items.forEach(i => seed.run(...i)));
  tx();
}

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next) {
  const token = req.headers.authorization?.replace("Bearer ","");
  if (!token) return res.status(401).json({error:"Login required"});
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({error:"Invalid or expired session"});
  }
}
function adminOnly(req,res,next) {
  if (req.user?.role !== "admin") return res.status(403).json({error:"Admin access required"});
  next();
}

app.post("/api/auth/register",(req,res)=>{
  const {name,email,password} = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({error:"Name, email and a 6+ character password are required"});
  try {
    const hash = bcrypt.hashSync(password,10);
    const info = db.prepare("INSERT INTO users (name,email,password_hash) VALUES (?,?,?)")
      .run(name.trim(),email.trim().toLowerCase(),hash);
    const user = {id:Number(info.lastInsertRowid),name:name.trim(),email:email.trim().toLowerCase(),role:"customer"};
    const token = jwt.sign(user,JWT_SECRET,{expiresIn:"7d"});
    res.json({token,user});
  } catch {
    res.status(409).json({error:"An account with this email already exists"});
  }
});

app.post("/api/auth/login",(req,res)=>{
  const {email,password} = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get((email||"").trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password||"",user.password_hash))
    return res.status(401).json({error:"Incorrect email or password"});
  const safe = {id:user.id,name:user.name,email:user.email,role:user.role};
  const token = jwt.sign(safe,JWT_SECRET,{expiresIn:"7d"});
  res.json({token,user:safe});
});

app.get("/api/menu",(req,res)=>{
  res.json(db.prepare("SELECT * FROM menu_items WHERE available=1 ORDER BY category,id").all());
});

app.post("/api/orders",auth,(req,res)=>{
  if (req.user.role !== "customer") return res.status(403).json({error:"Customer account required"});
  const {tableNo,items} = req.body;
  if (!tableNo || !Array.isArray(items) || !items.length)
    return res.status(400).json({error:"Table number and cart items are required"});
  const ids = items.map(x=>Number(x.id));
  const placeholders = ids.map(()=>"?").join(",");
  const menu = db.prepare(`SELECT * FROM menu_items WHERE id IN (${placeholders}) AND available=1`).all(...ids);
  const byId = Object.fromEntries(menu.map(x=>[x.id,x]));
  let total = 0;
  const normalized = [];
  for (const row of items) {
    const product = byId[Number(row.id)];
    const qty = Math.max(1,Math.min(20,Number(row.quantity)||1));
    if (!product) return res.status(400).json({error:"One or more menu items are unavailable"});
    total += product.price * qty;
    normalized.push({product,qty});
  }

  const create = db.transaction(()=>{
    const order = db.prepare(
      "INSERT INTO orders (user_id,customer_name,table_no,total) VALUES (?,?,?,?)"
    ).run(req.user.id,req.user.name,String(tableNo),total);
    const insertItem = db.prepare(
      "INSERT INTO order_items (order_id,menu_item_id,name,quantity,price) VALUES (?,?,?,?,?)"
    );
    normalized.forEach(({product,qty}) =>
      insertItem.run(order.lastInsertRowid,product.id,product.name,qty,product.price)
    );
    return Number(order.lastInsertRowid);
  });
  const orderId = create();
  res.json({success:true,orderId,total});
});

app.get("/api/orders/my",auth,(req,res)=>{
  const orders = db.prepare(`
    SELECT * FROM orders WHERE user_id=? ORDER BY id DESC
  `).all(req.user.id);
  const itemStmt = db.prepare("SELECT name,quantity,price FROM order_items WHERE order_id=?");
  orders.forEach(o=>o.items=itemStmt.all(o.id));
  res.json(orders);
});

app.get("/api/admin/orders",auth,adminOnly,(req,res)=>{
  const orders = db.prepare(`
    SELECT id,customer_name,table_no,total,status,created_at
    FROM orders ORDER BY id DESC
  `).all();
  const itemStmt = db.prepare("SELECT name,quantity,price FROM order_items WHERE order_id=?");
  orders.forEach(o=>o.items=itemStmt.all(o.id));
  res.json(orders);
});

app.patch("/api/admin/orders/:id",auth,adminOnly,(req,res)=>{
  const allowed = ["New","Preparing","Ready","Served","Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({error:"Invalid status"});
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,req.params.id);
  res.json({success:true});
});

app.get("/api/admin/stats",auth,adminOnly,(req,res)=>{
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      COALESCE(SUM(CASE WHEN status!='Cancelled' THEN total ELSE 0 END),0) AS revenue,
      COUNT(CASE WHEN status IN ('New','Preparing') THEN 1 END) AS active_orders
    FROM orders
  `).get();
  res.json(stats);
});

app.get("/{*splat}",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,()=>console.log(`Chai-K Cafe running on http://localhost:${PORT}`));
