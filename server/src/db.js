"use strict";
// Unified PostgreSQL access: real server via DATABASE_URL (pg Pool) or embedded PGlite otherwise.
// Same SQL dialect, constraints and transactions in both modes.
const cfg = require("./config");
let mode = "pglite", pool = null, lite = null, ready = false;
async function init() {
  if (ready) return mode;
  if (cfg.dbUrl) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: cfg.dbUrl });
    await pool.query("SELECT 1");
    mode = "pg";
  } else {
    const { PGlite } = require("@electric-sql/pglite");
    if (cfg.pgDataDir) { try { require("fs").mkdirSync(cfg.pgDataDir, { recursive: true }); } catch (_) {} }
    lite = new PGlite(cfg.pgDataDir || undefined);
    await lite.query("SELECT 1");
    mode = "pglite";
  }
  ready = true;
  return mode;
}
const getMode = () => mode;
async function query(text, params) {
  if (mode === "pg") return pool.query(text, params || []);
  return lite.query(text, params || []);
}
async function exec(sql) {
  if (mode === "pg") { await pool.query(sql); return; }
  await lite.exec(sql);
}
// Transaction on a single client: fn(client:{query}) — COMMIT or ROLLBACK.
async function tx(fn) {
  if (mode === "pg") {
    const c = await pool.connect();
    try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
    catch (e) { try { await c.query("ROLLBACK"); } catch (_) {} throw e; }
    finally { c.release(); }
  }
  await lite.query("BEGIN");
  try { const r = await fn(lite); await lite.query("COMMIT"); return r; }
  catch (e) { try { await lite.query("ROLLBACK"); } catch (_) {} throw e; }
}
const num = v => (v === null || v === undefined ? 0 : Number(v));
async function close() {
  if (pool) { try { await pool.end(); } catch (_) {} pool = null; }
  if (lite) { try { await lite.close(); } catch (_) {} lite = null; }
  ready = false;
}
module.exports = { init, getMode, query, exec, tx, num, close };
