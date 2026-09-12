const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'pikta_web.db');

let db = null;
let dbReady = null;

async function getDb() {
  if (db) return db;
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const SQL = await initSqlJs();
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } catch {
      db = new SQL.Database();
    }
    return db;
  })();

  return dbReady;
}

function saveDb() {
  if (db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function initDb() {
  const SQL = require('sql.js');
}

async function setupDb() {
  const database = await getDb();

  database.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL,
      nombre_completo TEXT
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS productos_menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      precio REAL NOT NULL,
      categoria TEXT,
      emoji TEXT,
      disponible BOOLEAN DEFAULT 1,
      imagen_url TEXT,
      created_at TEXT,
      prep_duration INTEGER DEFAULT 15
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      cliente_telefono TEXT,
      cliente_nombre TEXT,
      items TEXT NOT NULL,
      subtotal REAL,
      descuento REAL DEFAULT 0,
      total REAL NOT NULL,
      estado TEXT DEFAULT 'RECIBIDO',
      canal TEXT,
      metodo_pago TEXT,
      pagado BOOLEAN DEFAULT 0,
      notas TEXT,
      mesa TEXT,
      sesion_id INTEGER,
      usuario_id INTEGER,
      created_at TEXT,
      updated_at TEXT,
      preparacion_inicio TEXT,
      preparacion_duracion INTEGER
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingrediente TEXT NOT NULL UNIQUE,
      cantidad REAL NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL,
      stock_minimo REAL NOT NULL DEFAULT 0,
      costo_unitario REAL,
      proveedor_id INTEGER,
      activo BOOLEAN DEFAULT 1,
      updated_at TEXT
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabla TEXT NOT NULL,
      accion TEXT NOT NULL,
      usuario TEXT,
      detalles TEXT,
      datos_previos TEXT,
      datos_nuevos TEXT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT,
      details TEXT,
      created_at TEXT
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS caja_sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      monto_apertura REAL,
      monto_cierre REAL,
      fecha_apertura TEXT,
      fecha_cierre TEXT,
      estado TEXT DEFAULT 'ABIERTO',
      resumen_ventas TEXT,
      inicio TEXT,
      inicial REAL,
      cierre_total REAL,
      cierre_at TEXT,
      reporte_texto TEXT,
      ingresos_efectivo REAL,
      ingresos_otros REAL
    )
  `);

  // Create sucursales table
  database.run(`
    CREATE TABLE IF NOT EXISTS sucursales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      activa BOOLEAN DEFAULT 1
    )
  `);

  // Add sucursal_id to existing tables (ALTER fails if column exists, so try/catch)
  try { database.run('ALTER TABLE usuarios ADD COLUMN sucursal_id INTEGER'); } catch (e) {}
  try { database.run('ALTER TABLE pedidos ADD COLUMN sucursal_id INTEGER'); } catch (e) {}
  try { database.run('ALTER TABLE inventario ADD COLUMN sucursal_id INTEGER'); } catch (e) {}
  try { database.run('ALTER TABLE caja_sesiones ADD COLUMN sucursal_id INTEGER'); } catch (e) {}

  // Seed default sucursales
  const sucCount = database.exec("SELECT COUNT(*) as count FROM sucursales");
  if (!sucCount.length || sucCount[0].values[0][0] === 0) {
    database.run("INSERT INTO sucursales (id, nombre, activa) VALUES (?, ?, ?)", [1, 'David', 1]);
    database.run("INSERT INTO sucursales (id, nombre, activa) VALUES (?, ?, ?)", [2, 'Boquete', 1]);
  }

  // Assign existing users to sucursal 1 (David) if not assigned
  database.run("UPDATE usuarios SET sucursal_id = 1 WHERE sucursal_id IS NULL");
  database.run("UPDATE pedidos SET sucursal_id = 1 WHERE sucursal_id IS NULL");
  database.run("UPDATE inventario SET sucursal_id = 1 WHERE sucursal_id IS NULL");
  database.run("UPDATE caja_sesiones SET sucursal_id = 1 WHERE sucursal_id IS NULL");

  // Insert default admin
  const bcrypt = require('bcryptjs');
  const adminCheck = database.exec("SELECT id FROM usuarios WHERE username = 'admin'");
  if (!adminCheck.length || !adminCheck[0].values.length) {
    const hashed = bcrypt.hashSync('admin', 10);
    database.run("INSERT INTO usuarios (username, password, rol, nombre_completo, sucursal_id) VALUES (?, ?, ?, ?, ?)", ['admin', hashed, 'Administrador', 'Administrador Sistema', 1]);
  }

  // Default users
  const defaultUsers = [
    ['Davis', '1234', 'Administrador', 'Davis Admin'],
    ['Rommel', '1234', 'Supervisor', 'Rommel Supervisor'],
    ['Estefani', '1234', 'Cajera', 'Estefani Cajera'],
    ['cocina', '1234', 'Cocina', 'Personal de Cocina'],
    ['mesero', '1234', 'Mesero', 'Personal de Mesas'],
  ];
  for (const [u, p, r, n] of defaultUsers) {
    const exists = database.exec(`SELECT id FROM usuarios WHERE username = '${u}'`);
    if (!exists.length || !exists[0].values.length) {
      const hashed = bcrypt.hashSync(p, 10);
      database.run("INSERT INTO usuarios (username, password, rol, nombre_completo, sucursal_id) VALUES (?, ?, ?, ?, ?)", [u, hashed, r, n, 1]);
    }
  }

  // Default products
  const prodCount = database.exec("SELECT COUNT(*) as count FROM productos_menu");
  if (!prodCount.length || prodCount[0].values[0][0] === 0) {
    const products = [
      ['Hamburguesa Clásica', 8.50, '🍔 Combos', '🍔', 15],
      ['Pizza Pepperoni', 12.00, '🍔 Combos', '🍕', 20],
      ['Papas Fritas XL', 4.50, '🍟 Extras', '🍟', 10],
      ['Alitas BBQ (6 unidades)', 7.25, '🍟 Extras', '🍗', 15],
      ['Coca Cola 600ml', 2.00, '🥤 Bebidas', '🥤', 2],
      ['Jugo de Naranja Natural', 3.50, '🥤 Bebidas', '🍊', 5],
      ['Hamburguesa Doble Carne', 12.00, '🍔 Combos', '🍔', 18],
      ['Pizza Hawaiana', 11.00, '🍔 Combos', '🍕', 20],
      ['Aros de Cebolla', 5.50, '🍟 Extras', '🧅', 12],
      ['Agua 500ml', 1.50, '🥤 Bebidas', '💧', 1],
      ['Pepsi 600ml', 2.00, '🥤 Bebidas', '🥤', 2],
      ['Brownie con Helado', 6.00, '🍰 Postres', '🍫', 8],
      ['Tres Leches', 5.00, '🍰 Postres', '🍰', 5],
      ['Flan Casero', 4.50, '🍰 Postres', '🍮', 5],
    ];
    for (const [nombre, precio, categoria, emoji, prep] of products) {
      database.run(
        "INSERT INTO productos_menu (nombre, precio, categoria, emoji, prep_duration) VALUES (?, ?, ?, ?, ?)",
        [nombre, precio, categoria, emoji, prep]
      );
    }
  }

  saveDb();
  console.log('Base de datos inicializada correctamente');
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid() as id");
  saveDb();
  return {
    lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : null,
    changes: db.getRowsModified()
  };
}

function getSucursales() {
  return queryAll('SELECT id, nombre, activa FROM sucursales WHERE activa = 1');
}

module.exports = { getDb, setupDb, saveDb, queryAll, queryOne, runSql, getSucursales };
