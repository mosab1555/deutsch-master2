"use strict";
const fs = require("fs");
const path = require("path");
const db = require("./db");
const cfg = require("./config");
async function migrate() {
  await db.init();
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await db.exec(sql);
  return db.getMode();
}
if (require.main === module) {
  migrate().then(m => { console.log("migrated (" + m + ")"); process.exit(0); })
    .catch(e => { console.error("migrate failed:", e.message); process.exit(1); });
}
module.exports = { migrate };
