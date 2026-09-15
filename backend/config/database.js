const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let dbReady = null;

function convertPlaceholders(sql, params = []) {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return { text: converted, values: params };
}

async function getDb() {
  if (dbReady) return dbReady;
  dbReady = pool.connect();
  return dbReady;
}

async function setupDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT NOT NULL,
        nombre_completo TEXT,
        sucursal_id INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS productos_menu (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        precio REAL NOT NULL,
        categoria TEXT,
        emoji TEXT,
        disponible BOOLEAN DEFAULT true,
        imagen_url TEXT,
        created_at TEXT,
        prep_duration INTEGER DEFAULT 15,
        sucursal_id INTEGER DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(255) UNIQUE NOT NULL,
        cliente_telefono TEXT,
        cliente_nombre TEXT,
        items TEXT NOT NULL,
        subtotal REAL,
        descuento REAL DEFAULT 0,
        total REAL NOT NULL,
        estado TEXT DEFAULT 'RECIBIDO',
        canal TEXT,
        metodo_pago TEXT,
        pagado BOOLEAN DEFAULT false,
        notas TEXT,
        mesa TEXT,
        sesion_id INTEGER,
        usuario_id INTEGER,
        created_at TEXT,
        updated_at TEXT,
        preparacion_inicio TEXT,
        preparacion_duracion INTEGER,
        sucursal_id INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventario (
        id SERIAL PRIMARY KEY,
        ingrediente TEXT NOT NULL UNIQUE,
        cantidad REAL NOT NULL DEFAULT 0,
        unidad TEXT NOT NULL,
        stock_minimo REAL NOT NULL DEFAULT 0,
        costo_unitario REAL,
        proveedor_id INTEGER,
        activo BOOLEAN DEFAULT true,
        updated_at TEXT,
        sucursal_id INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        tabla TEXT NOT NULL,
        accion TEXT NOT NULL,
        usuario TEXT,
        detalles TEXT,
        datos_previos TEXT,
        datos_nuevos TEXT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        action TEXT,
        details TEXT,
        created_at TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS caja_sesiones (
        id SERIAL PRIMARY KEY,
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
        ingresos_otros REAL,
        sucursal_id INTEGER
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sucursales (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        activa BOOLEAN DEFAULT true
      )
    `);

    // Add sucursal_id columns if missing
    const alterCols = [
      'usuarios', 'pedidos', 'inventario', 'caja_sesiones'
    ];
    for (const table of alterCols) {
      try {
        await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS sucursal_id INTEGER`);
      } catch (e) { /* ignore */ }
    }

    // Seed default sucursales
    const sucCount = await client.query("SELECT COUNT(*)::int as count FROM sucursales");
    if (sucCount.rows[0].count === 0) {
      await client.query("INSERT INTO sucursales (id, nombre, activa) VALUES ($1, $2, $3)", [1, 'David', true]);
      await client.query("INSERT INTO sucursales (id, nombre, activa) VALUES ($1, $2, $3)", [2, 'Boquete', true]);
    }

    // Assign existing users to sucursal 1 (David) if not assigned
    await client.query("UPDATE usuarios SET sucursal_id = 1 WHERE sucursal_id IS NULL");
    await client.query("UPDATE pedidos SET sucursal_id = 1 WHERE sucursal_id IS NULL");
    await client.query("UPDATE inventario SET sucursal_id = 1 WHERE sucursal_id IS NULL");
    await client.query("UPDATE caja_sesiones SET sucursal_id = 1 WHERE sucursal_id IS NULL");

    // Insert default admin
    const bcrypt = require('bcryptjs');
    const adminCheck = await client.query("SELECT id FROM usuarios WHERE username = 'admin'");
    if (adminCheck.rows.length === 0) {
      const hashed = bcrypt.hashSync('admin', 10);
      await client.query("INSERT INTO usuarios (username, password, rol, nombre_completo, sucursal_id) VALUES ($1, $2, $3, $4, $5)", ['admin', hashed, 'Administrador', 'Administrador Sistema', 1]);
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
      const exists = await client.query(`SELECT id FROM usuarios WHERE username = $1`, [u]);
      if (exists.rows.length === 0) {
        const hashed = bcrypt.hashSync(p, 10);
        await client.query("INSERT INTO usuarios (username, password, rol, nombre_completo, sucursal_id) VALUES ($1, $2, $3, $4, $5)", [u, hashed, r, n, 1]);
      }
    }

    // Default products
    const prodCount = await client.query("SELECT COUNT(*)::int as count FROM productos_menu");
    if (prodCount.rows[0].count === 0) {
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
        await client.query(
          "INSERT INTO productos_menu (nombre, precio, categoria, emoji, prep_duration) VALUES ($1, $2, $3, $4, $5)",
          [nombre, precio, categoria, emoji, prep]
        );
      }
    }

    console.log('Base de datos PostgreSQL inicializada correctamente');
  } finally {
    client.release();
  }
}

function queryAll(sql, params = []) {
  const { text, values } = convertPlaceholders(sql, params);
  return pool.query(text, values).then(r => r.rows);
}

function queryOne(sql, params = []) {
  return queryAll(sql, params).then(rows => rows.length > 0 ? rows[0] : null);
}

async function runSql(sql, params = []) {
  const { text, values } = convertPlaceholders(sql, params);
  const result = await pool.query(text, values);
  let lastInsertRowid = null;

  if (result.rows.length > 0 && result.rows[0].id) {
    lastInsertRowid = result.rows[0].id;
  } else {
    try {
      const lastId = await pool.query("SELECT lastval() as id");
      if (lastId.rows.length > 0) lastInsertRowid = lastId.rows[0].id;
    } catch (e) {
      // lastval() fails if no sequence has been used yet
    }
  }

  return {
    lastInsertRowid,
    changes: result.rowCount
  };
}

function getSucursales() {
  return queryAll('SELECT id, nombre, activa FROM sucursales WHERE activa = true');
}

module.exports = { getDb, setupDb, queryAll, queryOne, runSql, getSucursales };
