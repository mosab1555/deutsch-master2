"use strict";
// Email: real SMTP when credentials exist, otherwise development logger (never breaks).
const nodemailer = require("nodemailer");
const cfg = require("./config");
const db = require("./db");
let transporter = null;
if (cfg.smtp.host && cfg.smtp.user) {
  transporter = nodemailer.createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.port === 465,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass } });
}
const TPL = {
  welcome: s => `Welcome to the marketplace, ${s}!`,
  order: o => `Order ${o.code} confirmed — total ${o.total}.`,
  shipping: o => `Order ${o.code} update: ${o.status}.`,
  reset: t => `Reset your password: ${cfg.appUrl}/#/reset/${t.token}`,
  seller_status: s => `Your store "${s.store}" is now: ${s.status}.`,
};
async function sendMail(to, template, subject, data) {
  const text = (TPL[template] || (x => JSON.stringify(x)))(data || {});
  try {
    if (transporter && to) await transporter.sendMail({ from: cfg.smtp.from, to, subject, text });
    else console.log(`[MAIL:${template}]`, to || "(no recipient)", subject);
    await db.query("INSERT INTO mail_log(to_addr,template,subject) VALUES($1,$2,$3)", [to || "", template, subject]);
  } catch (e) { console.error("[mail-error]", e.message); }
  return { ok: true, mode: transporter ? "smtp" : "logger" };
}
module.exports = { sendMail };
