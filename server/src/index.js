"use strict";
const { migrate } = require("./migrate");
const cfg = require("./config");
migrate().then(mode => {
  const app = require("./app");
  app.listen(cfg.port, () => console.log(`DMM API on :${cfg.port} (db=${mode}, env=${cfg.env})`));
}).catch(e => { console.error("boot failed:", e.message); process.exit(1); });
