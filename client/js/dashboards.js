/* DMM — Dashboards: customer account, seller center, admin control */
(function(g){
"use strict";
const U=g.DMM_UTILS, I=g.DMM_I18N, T=I.T, App=g.DMM_APP, A=g.DMM_API;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const D={}; g.DMM_DASH=D;
const lay=(menu,active,content)=>`<div class="sec"><div class="dash"><aside class="side">${menu.map(m=>`<button data-m="${m[0]}" class="${active===m[0]?"on":""}">${m[1]} ${m[2]}</button>`).join("")}</aside><div id="dBody">${content}</div></div></div>`;
const bindMenu=base=>{$$("[data-m]").forEach(b=>b.onclick=()=>location.hash="#/"+base+"/"+b.dataset.m);};
const tbl=(heads,rows)=>`<div class="tbl-wrap"><table class="tbl"><tr>${heads.map(h=>`<th>${h}</th>`).join("")}</tr>${rows.join("")}</table></div>`;
const bars=data=>{const mx=Math.max(1,...data.map(d=>d.v));
  return `<div style="display:flex;align-items:flex-end;gap:6px;height:150px;padding:.6rem;background:var(--color-surface-2);border-radius:12px">${data.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" title="${U.esc(d.k)}: ${Math.round(d.v)}"><div style="width:100%;background:var(--gradient-primary);border-radius:6px;height:${Math.max(4,Math.round(d.v/mx*120))}px"></div><small style="font-size:.62rem;color:var(--color-muted)">${U.esc(String(d.k).slice(5)||d.k)}</small></div>`).join("")}</div>`;};
const stBadge=s=>{const m={pending:"warn",confirmed:"warn",processing:"warn",shipped:"warn",out_for_delivery:"warn",delivered:"ok",cancelled:"err",returned:"warn",refunded:"warn",approved:"ok",suspended:"err",active:"ok",disabled:"err",published:"ok",hidden:"warn",paid:"ok"};return `<span class="badge ${m[s]||""}">${U.esc(s)}</span>`;};
/* ==================== ACCOUNT ==================== */
D.account=async(sub,v,q)=>{const u=await A.me();if(!u){location.hash="#/login";return;}
  const menu=[["overview","📊",T("dashboard")],["orders","📦",T("orders")],["addresses","📍",T("address")],["notifications","🔔",T("notif")],["messages","💬",T("messages")],["security","🔒",T("security")],["settings","⚙️",T("settings")]];
  v.innerHTML=lay(menu,sub,`<div class="grid-prod">${App.skel(4)}</div>`);bindMenu("account");
  const b=$("#dBody");
  if(sub==="overview"){const [orders,wl,nt]=await Promise.all([A.orders(),A.wishlist().catch(()=>[]),A.myNotifs()]);
    b.innerHTML=`<h2>${T("welcome")}، ${U.esc(u.name)} 👋</h2><div class="stat-grid" style="margin-top:1rem">
    <div class="card stat"><div class="v">${orders.length}</div><div class="l">📦 ${T("orders")}</div></div>
    <div class="card stat"><div class="v">${wl.length}</div><div class="l">🤍 ${T("wishlist")}</div></div>
    <div class="card stat"><div class="v">${nt.filter(n=>!n.read).length}</div><div class="l">🔔 ${T("notif")}</div></div></div>
    <h3>${T("myOrders")}</h3>${orders.slice(0,5).map(o=>`<div class="card" style="padding:.8rem;margin:.5rem 0;display:flex;justify-content:space-between;align-items:center"><span><b>${U.esc(o.code)}</b><br><small style="color:var(--color-muted)">${o.createdAt.slice(0,10)} · ${App.money(o.total)}</small></span><span>${stBadge(o.status)} <a class="btn btn-sm btn-sec" href="#/account/orders?id=${o.id}">${T("view")}</a></span></div>`).join("")||App.empty(T("empty"))}`;}
  else if(sub==="orders"){const orders=await A.orders();
    if(q.id){const o=await A.order(q.id);
      b.innerHTML=`<button class="btn btn-ghost btn-sm" onclick="location.hash='#/account/orders'">← ${T("orders")}</button>
      <div class="card" style="padding:1.4rem;margin-top:.8rem"><h3>${U.esc(o.code)} ${stBadge(o.status)}</h3>
      ${o.items.map(i=>`<div class="sum-row"><span>${U.esc(i.name)} × ${i.qty}</span><b>${App.money(i.price*i.qty)}</b></div>`).join("")}
      <div class="sum-row"><span>${T("shipping")}</span><b>${App.money(o.shipping)}</b></div>
      <div class="sum-row total"><span>${T("total")}</span><span>${App.money(o.total)}</span></div>
      <p style="font-size:.85rem;color:var(--color-muted)">💳 ${U.esc(o.payMethod)} · ${U.esc(o.payStatus)}</p>
      <div style="display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap"><a class="btn btn-sec btn-sm" href="#/track?q=${U.esc(o.code)}">📦 ${T("track")}</a>
      ${o.status==="pending"?`<button class="btn btn-danger btn-sm" id="cxO">${T("cancel")}</button>`:""}
      <button class="btn btn-sec btn-sm" id="ctS">💬 ${T("seller")}</button></div></div>`;
      const cx=$("#cxO");if(cx)cx.onclick=async()=>{if(await App.confirm(T("confirmDel"))){try{await A.setOrderStatus(o.id,"cancelled");App.toast(T("success"),"ok");D.account("orders",v,{});}catch(e){App.toast(e.message,"err");}}};
      $("#ctS").onclick=()=>contactSeller(o);}
    else b.innerHTML=`<h2>📦 ${T("orders")}</h2>${orders.length?tbl([T("date"),"Code",T("total"),T("status"),""],orders.map(o=>`<tr><td>${o.createdAt.slice(0,10)}</td><td><b>${U.esc(o.code)}</b></td><td>${App.money(o.total)}</td><td>${stBadge(o.status)}</td><td><a class="btn btn-sm btn-sec" href="#/account/orders?id=${o.id}">${T("view")}</a></td></tr>`)):App.empty(T("empty"))}`;}
  else if(sub==="addresses"){const list=await A.addresses();
    b.innerHTML=`<h2>📍 ${T("address")}</h2><div class="addr-grid" style="margin:.8rem 0">${list.map(a=>`<div class="card addr-card ${a.isDefault?"on":""}"><b>${U.esc(a.label)}</b>${a.isDefault?' <span class="badge ok">default</span>':""}<p style="font-size:.85rem;color:var(--color-muted)">${U.esc(a.street)}, ${U.esc(a.city)}</p><div style="display:flex;gap:.4rem;margin-top:.5rem"><button class="btn btn-sm btn-sec" data-ea="${a.id}">${T("edit")}</button><button class="btn btn-sm btn-ghost" data-da="${a.id}">${T("del")}</button></div></div>`).join("")}</div>
    <button class="btn btn-pri btn-sm" id="adNew">+ ${T("add")}</button><div id="adF"></div>`;
    const form=(a)=>{$("#adF").innerHTML=`<div class="card" style="padding:1rem;margin-top:.8rem"><div class="form-grid"><div><label class="f">Label*</label><input id="aL" value="${U.esc(a?a.label:"")}"></div><div><label class="f">City*</label><input id="aC" value="${U.esc(a?a.city:"")}"></div><div class="full"><label class="f">Street*</label><input id="aS" value="${U.esc(a?a.street:"")}"></div><div><label class="f">ZIP</label><input id="aZ" value="${U.esc(a?a.zip:"")}"></div><div><label class="f">${T("phone")}</label><input id="aP" value="${U.esc(a?a.phone:"")}"></div><div class="full"><label style="font-size:.85rem"><input type="checkbox" id="aD" style="width:auto" ${a&&a.isDefault?"checked":""}> default</label></div></div><button class="btn btn-pri btn-sm" id="aSv" style="margin-top:.7rem">${T("save")}</button></div>`;
      $("#aSv").onclick=async()=>{try{await A.saveAddress({id:a?a.id:null,label:$("#aL").value,city:$("#aC").value,street:$("#aS").value,zip:$("#aZ").value,phone:$("#aP").value,isDefault:$("#aD").checked});App.toast(T("success"),"ok");D.account("addresses",v,{});}catch(e){App.toast(e.message,"err");}};};
    $("#adNew").onclick=()=>form(null);
    $$("[data-ea]").forEach(x=>x.onclick=async()=>form((await A.addresses()).find(a=>a.id===x.dataset.ea)));
    $$("[data-da]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delAddress(x.dataset.da);D.account("addresses",v,{});}});}
  else if(sub==="notifications"){const nt=await A.myNotifs();
    const label={order:"📦 Order",shipping:"🚚 Shipping",seller_order:"🏪 New order",seller_status:"🏪 Store",promo:"🎉 Promo",message:"💬 Message",welcome:"👋 Welcome",contact:"✉️",broadcast:"📢"};
    b.innerHTML=`<h2>🔔 ${T("notif")}</h2>${nt.map(n=>`<div class="card" style="padding:.8rem;margin:.5rem 0;${n.read?"opacity:.65":""}"><b>${label[n.kind]||n.kind}</b><p style="font-size:.85rem">${U.esc(JSON.stringify(n.data))}</p><small style="color:var(--color-muted)">${n.at.slice(0,16).replace("T"," ")}</small> ${n.read?"":`<button class="btn btn-sm btn-sec" data-rn="${n.id}">✓</button>`}</div>`).join("")||App.empty(T("empty"))}`;
    $$("[data-rn]").forEach(x=>x.onclick=async()=>{await A.readNotif(x.dataset.rn);D.account("notifications",v,{});App.refreshNotif();});}
  else if(sub==="messages")return msgUI(b,null);
  else if(sub==="security"){b.innerHTML=`<h2>🔒 ${T("security")}</h2><div class="card" style="padding:1.4rem;max-width:440px"><label class="f">Current password</label><input id="sO" type="password"><label class="f" style="margin-top:.6rem">New password (6+)</label><input id="sN" type="password"><div class="f-err" id="sE"></div><button class="btn btn-pri" id="sB" style="margin-top:.8rem">${T("save")}</button></div>`;
    $("#sB").onclick=async()=>{try{await A.changePass($("#sO").value,$("#sN").value);App.toast(T("success"),"ok");}catch(e){$("#sE").textContent=e.message;}};}
  else if(sub==="settings"){b.innerHTML=`<h2>⚙️ ${T("settings")}</h2><div class="card" style="padding:1.4rem;max-width:520px">
    <label class="f">${T("name")}</label><input id="pN" value="${U.esc(u.name)}"><label class="f" style="margin-top:.6rem">${T("phone")}</label><input id="pT" value="${U.esc(u.phone||"")}" dir="ltr">
    <label class="f" style="margin-top:.6rem">Language</label><select id="pL"><option value="ar">عربي</option><option value="en">English</option><option value="de">Deutsch</option></select>
    <div style="display:flex;gap:.5rem;margin-top:.8rem"><button class="btn btn-pri" id="pS">${T("save")}</button><button class="btn btn-sec" id="pT2">🎨 ${T("theme")}</button></div></div>`;
    $("#pL").value=I.cur();
    $("#pS").onclick=async()=>{try{const r=await A.updateProfile({name:$("#pN").value,phone:$("#pT").value});App.user=Object.assign(App.user,r);I.setLang($("#pL").value);App.toast(T("success"),"ok");location.reload();}catch(e){App.toast(e.message,"err");}};
    $("#pT2").onclick=()=>App.themePanel();}
  App.resolveMedia();};
async function contactSeller(order){const s0=order.items[0];if(!s0)return;
  const text=prompt("Message:");if(!text)return;
  try{await A.sendMsgToSeller(s0.sellerId,text,order.id);App.toast(T("success"),"ok");}catch(e){App.toast(e.message,"err");}}
async function msgUI(b,thread){const th=await A.threads();
  b.innerHTML=`<h2>💬 ${T("messages")}</h2><div style="display:grid;grid-template-columns:220px 1fr;gap:1rem">
  <div>${th.map(t=>`<button class="btn ${thread===t.thread?"btn-pri":"btn-sec"} btn-sm" style="width:100%;margin-bottom:.4rem" data-th="${t.thread}">${U.esc((t.last.fromName||"").slice(0,14))} (${t.count})</button>`).join("")||App.empty(T("empty"))}</div>
  <div><div class="chat-box"><div class="chat-msgs" id="cm"></div><div style="display:flex;gap:.5rem;padding:.7rem;border-top:1px solid var(--color-border)"><input id="mi" placeholder="…"><button class="btn btn-pri btn-sm" id="ms">➤</button></div></div></div></div>`;
  $$("[data-th]").forEach(x=>x.onclick=()=>msgUI(b,x.dataset.th));
  const paint=async()=>{if(!thread){$("#cm").innerHTML=App.empty(T("empty"));return;}
    const ms=await A.thread(thread);
    $("#cm").innerHTML=ms.map(m=>`<div class="msg ${m.from===App.user.id?"me":"them"}">${U.esc(m.text)}<br><small style="opacity:.7">${U.esc(m.fromName)} · ${m.at.slice(11,16)}</small></div>`).join("");
    $("#cm").scrollTop=1e6;};
  await paint();
  const snd=$("#ms");if(snd)snd.onclick=async()=>{const inp=$("#mi");if(!inp.value.trim())return;
    const ms=await A.thread(thread);const other=ms.length?(ms[0].from===App.user.id?ms[0].to:ms[0].from):null;
    if(!other)return App.toast(T("error"),"err");
    await A.sendMsg(thread,other,inp.value);inp.value="";paint();};}
/* ==================== PRODUCT FORM (shared) ==================== */
async function productModal(p,fixedSeller){const cats=await A.cats(),brands=await A.brands(),media=await A.media();
  const sellers=fixedSeller?[]:await A.allSellers().catch(()=>[]);
  const EM=["📱","💻","🎧","⌚","👗","👔","👟","💄","🏠","💡","⚽","🎒","⌨️","🖱️","🔊","💍","🖥️","🔋","🚁","🍶","🧘","🧣","🔌","🪑"];
  p=p||{name:"",desc:"",price:"",oldPrice:"",stock:10,sku:"",images:[{t:"g",g:0,em:"📦"}],variants:[],categoryId:"",brandId:"",video:""};
  App.modal(`<h3>${p.id?"✏️":"➕"} ${T("products")}</h3><div class="form-grid" style="margin-top:.8rem">
  <div class="full"><label class="f">Name*</label><input id="pfN" value="${U.esc(p.name)}"></div>
  <div class="full"><label class="f">${T("description")}</label><textarea id="pfD" rows="2">${U.esc(p.desc||"")}</textarea></div>
  <div><label class="f">${T("price")}*</label><input id="pfP" type="number" step="0.01" value="${p.price}"></div>
  <div><label class="f">Old price (sale)</label><input id="pfO" type="number" step="0.01" value="${p.oldPrice||""}"></div>
  <div><label class="f">Stock*</label><input id="pfS" type="number" value="${p.stock}"></div>
  <div><label class="f">SKU</label><input id="pfK" value="${U.esc(p.sku||"")}"></div>
  <div><label class="f">${T("categories")}</label><select id="pfC">${cats.map(c=>`<option value="${c.id}" ${p.categoryId===c.id?"selected":""}>${U.esc(App.catName(c))}</option>`).join("")}</select></div>
  <div><label class="f">${T("brands")}</label><select id="pfB">${brands.map(x=>`<option value="${x.id}" ${p.brandId===x.id?"selected":""}>${U.esc(x.name)}</option>`).join("")}</select></div>
  ${sellers.length?`<div class="full"><label class="f">${T("seller")}</label><select id="pfSL">${sellers.map(s=>`<option value="${s.id}" ${p.sellerId===s.id?"selected":""}>${U.esc(s.storeName)} (${s.status})</option>`).join("")}</select></div>`:""}
  <div class="full"><label class="f">Image (pick)</label><div style="display:flex;gap:.4rem;flex-wrap:wrap" id="pfEm">${EM.map(e=>`<button class="btn btn-sm ${((p.images[0]||{}).em===e)?"btn-pri":"btn-sec"}" data-em="${e}">${e}</button>`).join("")}</div>
  <div style="display:flex;gap:.5rem;margin-top:.5rem"><input id="pfU" placeholder="https:// image URL"><select id="pfM" style="max-width:180px"><option value="">📁 media…</option>${media.map(m=>`<option value="${m.id}">${U.esc(m.name)}</option>`).join("")}</select></div></div>
  <div class="full"><label class="f">Variants (Name: opt1,opt2 | one per line)</label><textarea id="pfV" rows="2">${(p.variants||[]).map(x=>x.name+": "+x.options.join(",")).join("\n")}</textarea></div>
  <div class="full"><label class="f">Video URL</label><input id="pfVd" value="${U.esc(p.video||"")}" dir="ltr"></div></div>
  <div class="card" style="padding:.8rem;margin-top:.8rem" id="pfPrev"></div>
  <div class="f-err" id="pfE"></div>
  <div style="display:flex;gap:.6rem;margin-top:.8rem;justify-content:flex-end"><button class="btn btn-ghost" onclick="DMM_APP.closeModal()">${T("cancel")}</button><button class="btn btn-pri" id="pfS2">${T("save")}</button></div>`,true);
  let em=(p.images[0]||{}).em||"📦",gi=0,url="",mid="";
  const prev=()=>{$("#pfPrev").innerHTML=`<b>Preview:</b> ${$("#pfN").value} — <b>${$("#pfP").value}</b><div style="width:80px;margin-top:.4rem">${App.img(mid?{t:"media",id:mid}:url?{t:"url",src:url}:{t:"g",g:gi,em})}</div>`;App.resolveMedia();};
  $$("#pfEm [data-em]").forEach(x=>x.onclick=()=>{em=x.dataset.em;url="";mid="";$$("#pfEm [data-em]").forEach(y=>y.className="btn btn-sm btn-sec");x.className="btn btn-sm btn-pri";prev();});
  $("#pfU").oninput=e=>{url=e.target.value;if(url){mid="";}prev();};
  $("#pfM").onchange=e=>{mid=e.target.value;if(mid)url="";prev();};
  $("#pfN").oninput=prev;$("#pfP").oninput=prev;prev();
  $("#pfS2").onclick=async()=>{try{
    const vars=$("#pfV").value.split("\n").map(l=>l.trim()).filter(Boolean).map(l=>{const [n,...r]=l.split(":");return {name:n.trim(),options:r.join(":").split(",").map(s=>s.trim()).filter(Boolean)};}).filter(x=>x.name&&x.options.length);
    const img=mid?{t:"media",id:mid}:url?{t:"url",src:url}:{t:"g",g:gi,em};
    const o=await A.saveProduct({id:p.id,name:$("#pfN").value,desc:$("#pfD").value,price:$("#pfP").value,oldPrice:$("#pfO").value||null,stock:$("#pfS").value,sku:$("#pfK").value,categoryId:$("#pfC").value,brandId:$("#pfB").value,images:[img],variants:vars,video:$("#pfVd").value,sellerId:fixedSeller||($("#pfSL")&&$("#pfSL").value)});
    App.closeModal();App.toast(T("success")+(o.status==="pending"?" (pending approval)":""),"ok");return o;}
    catch(e){$("#pfE").textContent=e.message;return null;}};}
/* ==================== SELLER ==================== */
D.seller=async(sub,v,q)=>{const u=await A.me();if(!u){location.hash="#/login";return;}
  if(u.role!=="seller"&&u.role!=="admin"){location.hash="#/seller/apply";return;}
  const my=await A.mySeller().catch(()=>null);
  const menu=[["overview","📊",T("dashboard")],["products","📦",T("products")],["orders","🧾",T("orders")],["store","🏪",T("store")],["messages","💬",T("messages")],["reviews","⭐",T("reviews")],["promos","🎉",T("promos")]];
  if(my&&my.status!=="approved"&&u.role!=="admin"){v.innerHTML=`<div class="sec" style="max-width:560px;margin:auto"><div class="card" style="padding:2rem;text-align:center"><h2>⏳ Store ${U.esc(my.status)}</h2><p style="color:var(--color-muted)">Waiting for admin approval.</p></div></div>`;return;}
  v.innerHTML=lay(menu,sub,`<div class="grid-prod">${App.skel(4)}</div>`);bindMenu("seller");
  const b=$("#dBody");
  if(sub==="overview"){const s=await A.sellerStats();
    b.innerHTML=`<h2>📊 ${T("dashboard")}</h2><div class="stat-grid" style="margin:1rem 0">
    <div class="card stat"><div class="v">${App.money(s.revenue)}</div><div class="l">💰 ${T("revenue")}</div></div>
    <div class="card stat"><div class="v">${s.orders}</div><div class="l">🧾 ${T("orders")}</div></div>
    <div class="card stat"><div class="v">${s.units}</div><div class="l">📦 units</div></div>
    <div class="card stat"><div class="v">${s.products}</div><div class="l">🛍️ ${T("products")}</div></div>
    <div class="card stat"><div class="v">${s.lowStock}</div><div class="l">⚠️ ${T("lowStock")}</div></div></div>
    <h3>7-day sales</h3>${bars(s.byDay)}<h3 style="margin-top:1rem">Top products</h3>
    ${tbl(["Product","Sales","Stock"],s.top.map(p=>`<tr><td>${U.esc(p.name)}</td><td>${p.sales}</td><td>${p.stock}</td></tr>`))}`;}
  else if(sub==="products"){const list=await A.sellerProducts();
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">📦 ${T("products")} (${list.length})</h2><button class="btn btn-pri btn-sm" id="np">+ ${T("add")}</button></div>
    ${tbl(["Product","Price","Stock",T("status"),""],list.map(p=>`<tr><td><b>${U.esc(p.name)}</b><br><small>${U.esc(p.sku||"")}</small></td><td>${App.money(p.price)}${p.oldPrice?`<br><s style="color:var(--color-muted)">${App.money(p.oldPrice)}</s>`:""}</td><td>${p.stock}</td><td>${stBadge(p.status)}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-sec" data-ep="${p.id}">${T("edit")}</button> <button class="btn btn-sm btn-ghost" data-dp="${p.id}">✕</button></td></tr>`))}`;
    $("#np").onclick=async()=>{const o=await productModal(null,my&&my.id);if(o)D.seller("products",v,{});};
    $$("[data-ep]").forEach(x=>x.onclick=async()=>{const p=await A.getProductAny(x.dataset.ep);const o=await productModal(p,my&&my.id);if(o)D.seller("products",v,{});});
    $$("[data-dp]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delProduct(x.dataset.dp);D.seller("products",v,{});}});}
  else if(sub==="orders")return orderUI(b,await A.sellerOrders(),false);
  else if(sub==="store"){const s=my||{};
    b.innerHTML=`<h2>🏪 ${T("store")}</h2><div class="card" style="padding:1.4rem;max-width:560px"><label class="f">Store name</label><input id="stN" value="${U.esc(s.storeName||"")}">
    <label class="f" style="margin-top:.6rem">Description</label><textarea id="stD" rows="3">${U.esc(s.desc||"")}</textarea>
    <label class="f" style="margin-top:.6rem">Contact</label><input id="stC" value="${U.esc(s.contact||"")}">
    <label class="f" style="margin-top:.6rem">Logo emoji</label><input id="stL" value="${U.esc((s.logo||{}).em||"🏪")}" maxlength="4">
    <button class="btn btn-pri" id="stS" style="margin-top:.8rem">${T("save")}</button></div>`;
    $("#stS").onclick=async()=>{await A.saveStore({storeName:$("#stN").value,desc:$("#stD").value,contact:$("#stC").value,logo:{t:"g",g:0,em:$("#stL").value}});App.toast(T("success"),"ok");};}
  else if(sub==="messages")return msgUI(b,q.th);
  else if(sub==="reviews"){const plist=await A.sellerProducts();let all=[];
    for(const p of plist)all=all.concat((await A.reviews(p.id)).map(r=>Object.assign({pname:p.name},r)));
    b.innerHTML=`<h2>⭐ ${T("reviews")}</h2>${all.map(r=>`<div class="rev"><b>${U.esc(r.pname)}</b> — ${U.esc(r.userName)} <span class="p-rate">${U.stars(r.rating)}</span><p>${U.esc(r.text)}</p>${r.reply?`<p style="font-size:.85rem">↩️ ${U.esc(r.reply.text)}</p>`:`<button class="btn btn-sm btn-sec" data-rp="${r.id}">↩️ Reply</button>`}</div>`).join("")||App.empty(T("empty"))}`;
    $$("[data-rp]").forEach(x=>x.onclick=()=>{const t=prompt("Reply:");if(t)A.replyReview(x.dataset.rp,t).then(()=>D.seller("reviews",v,{}));});}
  else if(sub==="promos"){const plist=await A.sellerProducts();const promos=await A.activePromos();
    b.innerHTML=`<h2>🎉 ${T("promos")}</h2><div class="card" style="padding:1.2rem"><h4>Set sale prices (bulk discount on my products)</h4>
    <div style="display:flex;gap:.5rem;margin-top:.6rem"><input id="dPc" type="number" placeholder="% off" style="max-width:140px"><button class="btn btn-pri btn-sm" id="dGo">${T("apply")}</button></div>
    <p style="font-size:.8rem;color:var(--color-muted)">Sets oldPrice = current price, price = discounted.</p></div>
    <h3 style="margin-top:1rem">Active platform promos</h3>${promos.filter(p=>p.status==="active").map(p=>`<div class="card" style="padding:.8rem;margin:.4rem 0"><b>${U.esc(p.title)}</b> −${p.discount}%</div>`).join("")||"—"}
    <h3 style="margin-top:1rem">My coupons</h3><button class="btn btn-sec btn-sm" id="nc">+ coupon (my store only)</button><div id="cl"></div>`;
    const paintC=async()=>{const cs=await A.coupons();
      $("#cl").innerHTML=cs.map(c=>`<div class="card" style="padding:.7rem;margin:.4rem 0;display:flex;justify-content:space-between"><b>${U.esc(c.code)}</b><span>${c.value}% · min ${App.money(c.minOrder)}</span></div>`).join("")||"—";};
    await paintC();
    $("#dGo").onclick=async()=>{const pc=Number($("#dPc").value);if(!(pc>0&&pc<90))return App.toast(T("error"),"err");
      for(const p of plist){const np=Math.round((p.oldPrice||p.price)*(1-pc/100)*100)/100;
        await A.saveProduct({id:p.id,name:p.name,desc:p.desc,price:np,oldPrice:p.oldPrice||p.price,stock:p.stock,sku:p.sku,categoryId:p.categoryId,brandId:p.brandId,images:p.images,variants:p.variants||[]});}
      App.toast(T("success"),"ok");};
    $("#nc").onclick=()=>{const code=prompt("CODE:");if(!code)return;const val=Number(prompt("% off:"));if(!val)return;
      A.saveSellerCoupon({code,type:"percent",value:val,minOrder:0}).then(()=>{App.toast(T("success"),"ok");paintC();}).catch(e=>App.toast(e.message,"err"));};}
  App.resolveMedia();};
async function orderUI(b,list,isAdmin){const sel=isAdmin?null:(await A.mySeller().catch(()=>null));
  b.innerHTML=`<h2>🧾 ${T("orders")} (${list.length})</h2>${list.length?tbl(["Code",T("date"),"Items",T("total"),T("status"),""],list.map(o=>`<tr><td><b>${U.esc(o.code)}</b></td><td>${o.createdAt.slice(0,10)}</td><td>${o.items?o.items.reduce((a,i)=>a+i.qty,0):(o.qty_sum||0)}</td><td>${App.money(o.total)}</td><td>${stBadge(o.status)}</td><td><button class="btn btn-sm btn-sec" data-vo="${o.id}">${T("view")}</button></td></tr>`)):App.empty(T("empty"))}<div id="od"></div>`;
  $$("[data-vo]").forEach(x=>x.onclick=async()=>{const o=await A.order(x.dataset.vo);
    const scope=!isAdmin&&sel?sel.id:"all";
    const myItems=!isAdmin&&sel?o.items.filter(i=>i.sellerId===sel.id):o.items;
    $("#od").innerHTML=`<div class="card" style="padding:1.4rem;margin-top:1rem"><h3>${U.esc(o.code)} ${stBadge(o.status)}</h3>
    ${myItems.map(i=>`<div class="sum-row"><span>${U.esc(i.name)} × ${i.qty}</span><b>${App.money(i.price*i.qty)}</b></div>`).join("")}
    ${!isAdmin&&sel?`<p style="font-size:.82rem;color:var(--color-muted)">My group: ${stBadge(o.groups[sel.id].status)} ${U.esc(o.groups[sel.id].tracking||"")}</p>`:""}
    <div style="display:flex;gap:.5rem;margin-top:.8rem;flex-wrap:wrap"><select id="osS" style="max-width:220px">${["pending","confirmed","processing","shipped","out_for_delivery","delivered","cancelled","returned","refunded"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select>
    <input id="osT" placeholder="tracking #" style="max-width:200px" value="${U.esc(!isAdmin&&sel?(o.groups[sel.id].tracking||""):"")}">
    <button class="btn btn-pri btn-sm" id="osB">${T("save")}</button></div></div>`;
    $("#osB").onclick=async()=>{try{await A.setOrderStatus(o.id,$("#osS").value,{tracking:$("#osT").value});App.toast(T("success"),"ok");orderUI(b,await (isAdmin?A.allOrders():A.sellerOrders()),isAdmin);}catch(e){App.toast(e.message,"err");}};});}
/* ==================== ADMIN ==================== */
D.admin=async(sub,v,q)=>{const u=await A.me();if(!u||u.role!=="admin"){v.innerHTML=App.err("403 — admin only");return;}
  const menu=[["overview","📊",""],["products","📦",""],["orders","🧾",""],["users","👥",""],["sellers","🏪",""],["categories","🗂️",""],["brands","™️",""],["reviews","⭐",""],["coupons","🏷️",""],["promos","🎉",""],["media","🖼️",""],["themes","🎨",""],["homepage","🏠",""],["ship","🚚",""],["notif","📢",""],["settings","⚙️",""],["audit","📜",""],["reports","📈",""]];
  const names={overview:T("dashboard"),products:T("products"),orders:T("orders"),users:T("users"),sellers:T("sellers"),categories:T("categories"),brands:T("brands"),reviews:T("reviews"),coupons:T("coupons"),promos:T("promos"),media:T("media"),themes:T("theme"),homepage:T("homepage"),ship:T("shipping"),notif:T("notif"),settings:T("settings"),audit:T("audit"),reports:T("reports")};
  v.innerHTML=lay(menu.map(m=>[m[0],m[1],names[m[0]]]),sub,`<div class="grid-prod">${App.skel(4)}</div>`);bindMenu("admin");
  const b=$("#dBody"),H=t=>`<h2>${t}</h2>`;
  if(sub==="overview"){const s=await A.adminStats();
    b.innerHTML=H("📊 "+T("dashboard"))+`<div class="stat-grid" style="margin:1rem 0">
    ${[["👥 "+T("users"),s.users],["🏪 "+T("sellers"),s.sellers],["📦 "+T("products"),s.prods],["🧾 "+T("orders"),s.orders],["💰 "+T("revenue"),App.money(s.revenue)],["⏳ pending",s.pendingOrders+" / "+s.pendingSellers+" / "+s.pendingProducts]].map(x=>`<div class="card stat"><div class="v">${x[1]}</div><div class="l">${x[0]}</div></div>`).join("")}</div>
    <h3>14-day revenue</h3>${bars(s.byDay)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem"><div><h3>Recent orders</h3>${s.recentOrders.map(o=>`<div class="card" style="padding:.6rem;margin:.4rem 0;font-size:.85rem"><b>${U.esc(o.code)}</b> ${App.money(o.total)} ${stBadge(o.status)}</div>`).join("")}</div>
    <div><h3>Top products</h3>${s.topProducts.map(p=>`<div class="card" style="padding:.6rem;margin:.4rem 0;font-size:.85rem">${U.esc(p.name)} — ${p.sales} sold</div>`).join("")}</div></div>`;}
  else if(sub==="products"){const list=U.sortBy(await A.allProducts(),"createdAt","desc");
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">📦 ${T("products")} (${list.length})</h2><button class="btn btn-pri btn-sm" id="np">+ ${T("add")}</button></div>
    ${tbl(["Product","Seller","Price","Stock",T("status"),""],list.map(p=>`<tr><td><b>${U.esc(p.name)}</b></td><td style="font-size:.78rem">${p.sellerId}</td><td>${App.money(p.price)}</td><td>${p.stock}</td><td>${stBadge(p.status)}${p.featured?' <span class="badge sale">★</span>':""}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-sec" data-ep="${p.id}">${T("edit")}</button> <button class="btn btn-sm btn-sec" data-fp="${p.id}">★</button> <button class="btn btn-sm btn-sec" data-ap="${p.id}">✓</button> <button class="btn btn-sm btn-ghost" data-dp="${p.id}">✕</button></td></tr>`))}`;
    $("#np").onclick=async()=>{const o=await productModal(null,null);if(o)D.admin("products",v,{});};
    $$("[data-ep]").forEach(x=>x.onclick=async()=>{const p=list.find(y=>y.id===x.dataset.ep);const o=await productModal(p,p.sellerId);if(o)D.admin("products",v,{});});
    $$("[data-fp]").forEach(x=>x.onclick=async()=>{const p=list.find(y=>y.id===x.dataset.fp);await A.setFeatured(p.id,p.status,!p.featured);D.admin("products",v,{});});
    $$("[data-ap]").forEach(x=>x.onclick=async()=>{await A.approveProduct(x.dataset.ap,"published");D.admin("products",v,{});});
    $$("[data-dp]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delProduct(x.dataset.dp);D.admin("products",v,{});}});}
  else if(sub==="orders")return orderUI(b,await A.allOrders(),true);
  else if(sub==="users"){const list=await A.users();
    b.innerHTML=H("👥 "+T("users"))+tbl(["Name","Email","Role",T("status"),""],list.map(x=>`<tr><td>${U.esc(x.name)}</td><td style="font-size:.8rem">${U.esc(x.email)}</td><td>${x.role}</td><td>${stBadge(x.status)}</td><td style="white-space:nowrap"><select data-ur="${x.id}" style="width:auto;padding:.3rem"><option value="">role…</option>${["customer","seller","admin"].map(r=>`<option ${x.role===r?"selected":""}>${r}</option>`).join("")}</select> <button class="btn btn-sm btn-sec" data-us="${x.id}">${x.status==="active"?"🚫":"✓"}</button></td></tr>`));
    $$("[data-ur]").forEach(s=>s.onchange=()=>s.value&&A.setUser(s.dataset.ur,{role:s.value}).then(()=>D.admin("users",v,{})));
    $$("[data-us]").forEach(x=>x.onclick=async()=>{const usr=list.find(y=>y.id===x.dataset.us);await A.setUser(usr.id,{status:usr.status==="active"?"disabled":"active"});D.admin("users",v,{});});}
  else if(sub==="sellers"){const list=await A.allSellers();
    b.innerHTML=H("🏪 "+T("sellers"))+tbl(["Store","Owner","Rating",T("status"),""],list.map(s=>`<tr><td><b>${U.esc(s.storeName)}</b></td><td style="font-size:.78rem">${s.userId}</td><td>${App.stars(s.rating||0)}</td><td>${stBadge(s.status)}</td><td style="white-space:nowrap">${["pending","approved","suspended"].map(st=>`<button class="btn btn-sm ${s.status===st?"btn-pri":"btn-sec"}" data-ss="${s.id}|${st}">${st}</button>`).join(" ")}</td></tr>`));
    $$("[data-ss]").forEach(x=>x.onclick=async()=>{const [id,st]=x.dataset.ss.split("|");await A.setSellerStatus(id,st);D.admin("sellers",v,{});});}
  else if(sub==="categories"){const list=U.sortBy(await A.cats(),"order","asc");
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">🗂️ ${T("categories")}</h2><button class="btn btn-pri btn-sm" id="nc">+ ${T("add")}</button></div>
    ${tbl(["Name","Slug","Parent","Order","Active",""],list.map(c=>`<tr><td><b>${U.esc(App.catName(c))}</b></td><td>${U.esc(c.slug)}</td><td>${c.parentId||"—"}</td><td>${c.order}</td><td>${c.active?"✓":"✕"}</td><td style="white-space:nowrap"><button class="btn btn-sm btn-sec" data-ec="${c.id}">${T("edit")}</button> <button class="btn btn-sm btn-ghost" data-dc="${c.id}">✕</button></td></tr>`))}`;
    const form=(c)=>{c=c||{name:{ar:"",en:"",de:""},parentId:"",order:0,active:true};
      App.modal(`<h3>Category</h3><label class="f">AR*</label><input id="cnA" value="${U.esc(c.name.ar||"")}"><label class="f" style="margin-top:.5rem">EN*</label><input id="cnE" value="${U.esc(c.name.en||"")}" dir="ltr"><label class="f" style="margin-top:.5rem">DE</label><input id="cnD" value="${U.esc(c.name.de||"")}" dir="ltr"><label class="f" style="margin-top:.5rem">Parent</label><select id="cnP"><option value="">— top —</option>${list.filter(x=>x.id!==(c.id||"")).map(x=>`<option value="${x.id}" ${c.parentId===x.id?"selected":""}>${U.esc(App.catName(x))}</option>`).join("")}</select><label class="f" style="margin-top:.5rem">Order / Emoji</label><div style="display:flex;gap:.5rem"><input id="cnO" type="number" value="${c.order||0}"><input id="cnI" value="${U.esc(((c.img||{}).em)||"📦")}" maxlength="4"></div><label style="font-size:.85rem"><input type="checkbox" id="cnAc" style="width:auto" ${c.active!==false?"checked":""}> active</label><button class="btn btn-pri" id="cnS" style="width:100%;margin-top:.7rem">${T("save")}</button>`);
      $("#cnS").onclick=async()=>{try{await A.saveCategory({id:c.id,name:{ar:$("#cnA").value,en:$("#cnE").value,de:$("#cnD").value},parentId:$("#cnP").value||null,order:$("#cnO").value,img:{t:"g",g:0,em:$("#cnI").value},active:$("#cnAc").checked});App.closeModal();D.admin("categories",v,{});}catch(e){App.toast(e.message,"err");}};};
    $("#nc").onclick=()=>form(null);
    $$("[data-ec]").forEach(x=>x.onclick=async()=>form(list.find(y=>y.id===x.dataset.ec)));
    $$("[data-dc]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delCategory(x.dataset.dc).catch(e=>App.toast(e.message,"err"));D.admin("categories",v,{});}});}
  else if(sub==="brands"){const list=await A.brands();
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">™️ ${T("brands")}</h2><button class="btn btn-pri btn-sm" id="nb">+ ${T("add")}</button></div>
    ${tbl(["Brand","Slug","Active",""],list.map(x=>`<tr><td><b>${U.esc(x.name)}</b></td><td>${U.esc(x.slug)}</td><td>${x.active?"✓":"✕"}</td><td><button class="btn btn-sm btn-sec" data-eb="${x.id}">${T("edit")}</button> <button class="btn btn-sm btn-ghost" data-db="${x.id}">✕</button></td></tr>`))}`;
    const form=(x)=>{x=x||{name:"",active:true};App.modal(`<h3>Brand</h3><label class="f">Name*</label><input id="bn" value="${U.esc(x.name)}"><label class="f" style="margin-top:.5rem">Logo emoji</label><input id="be" value="${U.esc(((x.logo||{}).em)||"™")}" maxlength="4"><button class="btn btn-pri" id="bs" style="width:100%;margin-top:.7rem">${T("save")}</button>`);
      $("#bs").onclick=async()=>{await A.saveBrand({id:x.id,name:$("#bn").value,logo:{t:"g",g:1,em:$("#be").value}});App.closeModal();D.admin("brands",v,{});};};
    $("#nb").onclick=()=>form(null);
    $$("[data-eb]").forEach(x=>x.onclick=async()=>form(list.find(y=>y.id===x.dataset.eb)));
    $$("[data-db]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delBrand(x.dataset.db);D.admin("brands",v,{});}});}
  else if(sub==="reviews"){const list=U.sortBy(await A.allReviews(),"createdAt","desc").slice(0,100);
    b.innerHTML=H("⭐ "+T("reviews"))+tbl(["Product","User","★","Text",T("status"),""],list.map(r=>`<tr><td style="font-size:.78rem">${r.productId}</td><td>${U.esc(r.userName)}</td><td>${r.rating}</td><td style="max-width:260px">${U.esc(r.text.slice(0,80))}</td><td>${stBadge(r.status)}</td><td><button class="btn btn-sm btn-sec" data-mr="${r.id}">${r.status==="visible"?"🙈":"👁"}</button></td></tr>`));
    $$("[data-mr]").forEach(x=>x.onclick=async()=>{const r=list.find(y=>y.id===x.dataset.mr);await A.moderateReview(r.id,r.status==="visible"?"hidden":"visible");D.admin("reviews",v,{});});}
  else if(sub==="coupons"){const list=await A.coupons();
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">🏷️ ${T("coupons")}</h2><button class="btn btn-pri btn-sm" id="nc">+ ${T("add")}</button></div>
    ${tbl(["Code","Type","Value","Min","Used","Scope","Active",""],list.map(c=>`<tr><td><b>${U.esc(c.code)}</b></td><td>${c.type}</td><td>${c.value}${c.type==="percent"?"%":""}</td><td>${App.money(c.minOrder)}</td><td>${c.used||0}/${c.usageLimit}</td><td style="font-size:.75rem">${U.esc(c.scope||"all")}</td><td>${c.active?"✓":"✕"}</td><td><button class="btn btn-sm btn-ghost" data-dc="${c.id}">✕</button></td></tr>`))}`;
    $("#nc").onclick=()=>{App.modal(`<h3>Coupon</h3><div class="form-grid"><div><label class="f">CODE*</label><input id="cc" dir="ltr"></div><div><label class="f">Type</label><select id="ct"><option value="percent">percent</option><option value="fixed">fixed</option></select></div><div><label class="f">Value*</label><input id="cv" type="number"></div><div><label class="f">Min order</label><input id="cm" type="number" value="0"></div><div><label class="f">Max discount</label><input id="cmx" type="number"></div><div><label class="f">End</label><input id="ce" type="date" value="2030-01-01"></div></div><button class="btn btn-pri" id="cs" style="width:100%;margin-top:.7rem">${T("save")}</button>`);
      $("#cs").onclick=async()=>{await A.saveCoupon({code:$("#cc").value,type:$("#ct").value,value:$("#cv").value,minOrder:$("#cm").value,maxDisc:$("#cmx").value||null,end:$("#ce").value});App.closeModal();D.admin("coupons",v,{});};};
    $$("[data-dc]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delCoupon(x.dataset.dc);D.admin("coupons",v,{});}});}
  else if(sub==="promos"){const list=await A.promos();const allP=await A.allProducts();
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">🎉 Flash / ${T("promos")}</h2><button class="btn btn-pri btn-sm" id="np2">+ ${T("add")}</button></div>
    ${list.map(p=>`<div class="card" style="padding:1rem;margin:.6rem 0"><b>${U.esc(p.title)}</b> ${stBadge(p.status)} <small>−${p.discount}% · ${(p.productIds||[]).length} products · ends ${(p.end||"").slice(0,10)}</small><div><button class="btn btn-sm btn-ghost" data-dpr="${p.id}">${T("del")}</button></div></div>`).join("")||App.empty(T("empty"))}`;
    $("#np2").onclick=()=>{App.modal(`<h3>Flash sale</h3><label class="f">Title</label><input id="pt" value="⚡ Flash Deals"><label class="f" style="margin-top:.5rem">Discount %</label><input id="pd" type="number" value="20"><label class="f" style="margin-top:.5rem">Products (ctrl+click)</label><select id="pp" multiple style="height:140px">${allP.filter(p=>p.status==="published").map(p=>`<option value="${p.id}">${U.esc(p.name)}</option>`).join("")}</select><label class="f" style="margin-top:.5rem">End date</label><input id="pe" type="date" value="2030-01-01"><button class="btn btn-pri" id="ps" style="width:100%;margin-top:.7rem">${T("save")}</button>`);
      $("#ps").onclick=async()=>{await A.savePromo({title:$("#pt").value,discount:$("#pd").value,productIds:[...$("#pp").selectedOptions].map(o=>o.value),end:$("#pe").value,type:"flash",status:"active"});App.closeModal();D.admin("promos",v,{});};};
    $$("[data-dpr]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delPromo(x.dataset.dpr);D.admin("promos",v,{});}});}
  else if(sub==="media"){const list=await A.media();
    b.innerHTML=`<div class="toolbar"><h2 style="flex:1">🖼️ ${T("media")}</h2><label class="btn btn-pri btn-sm">⬆ Upload <input type="file" id="mU" accept="image/*" hidden></label></div>
    <div class="grid-prod">${list.map(m=>`<div class="card"><div class="p-media"><img data-media="${m.id}" loading="lazy"></div><div class="p-body"><small>${U.esc(m.name)}</small><small style="color:var(--color-muted)">${m.id}</small><button class="btn btn-sm btn-ghost" data-dm="${m.id}">${T("del")}</button></div></div>`).join("")||App.empty(T("empty"))}</div>`;
    App.resolveMedia();
    $("#mU").onchange=async e=>{try{await A.mediaAdd(e.target.files[0]);App.toast(T("success"),"ok");D.admin("media",v,{});}catch(err){App.toast(err.message,"err");}};
    $$("[data-dm]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.mediaDel(x.dataset.dm);D.admin("media",v,{});}});}
  else if(sub==="themes"){const customs=await A.customThemes();const st=await A.settings();
    b.innerHTML=H("🎨 "+T("theme"))+`<div class="card" style="padding:1.2rem"><h4>Default site theme</h4><div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0">${["midnight","ocean","aurora","royal","neon","sunset","cyber","emerald","luxury","crystal","fire","galaxy","arctic","rose","electric","desert","forest","violet","sapphire","platinum"].map(t=>`<button class="btn btn-sm ${((st.defaultTheme||{}).id||"midnight")===t?"btn-pri":"btn-sec"}" data-dt="${t}">${t}</button>`).join("")}</div>
    <button class="btn btn-sec btn-sm" id="thOpen">🎨 Open theme studio</button></div>
    <h3 style="margin-top:1rem">Custom themes (${customs.length})</h3>${customs.map(t=>`<div class="card" style="padding:.7rem;margin:.4rem 0;display:flex;gap:.6rem;align-items:center"><b style="flex:1">${U.esc(t.name)}</b><button class="btn btn-sm btn-sec" data-at="${t.id}">${T("apply")}</button><button class="btn btn-sm btn-ghost" data-xt="${t.id}">✕</button></div>`).join("")||"—"}`;
    $$("[data-dt]").forEach(x=>x.onclick=async()=>{await A.saveSettings({defaultTheme:{id:x.dataset.dt}});App.toast(T("success"),"ok");D.admin("themes",v,{});});
    $("#thOpen").onclick=()=>App.themePanel();
    $$("[data-at]").forEach(x=>x.onclick=async()=>{const t=customs.find(y=>y.id===x.dataset.at);App.applyTheme("custom",t.tokens,t.mode);App.persistThemePref();App.toast(T("success"),"ok");});
    $$("[data-xt]").forEach(x=>x.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await A.delTheme(x.dataset.xt);D.admin("themes",v,{});}});}
  else if(sub==="homepage")return homeCMS(b);
  else if(sub==="ship"){const st=await A.settings();
    b.innerHTML=H("🚚 "+T("shipping")+" / 💳 "+T("payment"))+`<div class="card" style="padding:1.2rem;max-width:640px">
    <label class="f">Tax %</label><input id="shT" type="number" value="${st.taxRate||0}">
    <label class="f" style="margin-top:.6rem">Currency code / symbol / position</label><div style="display:flex;gap:.5rem"><input id="shC" value="${U.esc((st.currency||{}).code||"USD")}" dir="ltr"><input id="shS" value="${U.esc((st.currency||{}).symbol||"$")}"><select id="shP"><option value="before">before</option><option value="after" ${st.currency&&st.currency.pos==="after"?"selected":""}>after</option></select></div>
    <h4 style="margin:.8rem 0 .4rem">Shipping methods (JSON)</h4><textarea id="shM" rows="5" dir="ltr">${U.esc(JSON.stringify(st.shipMethods||[],null,1))}</textarea>
    <h4 style="margin:.8rem 0 .4rem">Secrets (.env keys: STRIPE_KEY, PAYPAL_ID, SHIP_API_KEY, SMTP_*)</h4><div style="display:flex;gap:.5rem"><input id="skK" placeholder="KEY" dir="ltr"><input id="skV" placeholder="value" dir="ltr"><button class="btn btn-sec btn-sm" id="skB">${T("save")}</button></div>
    <div class="ok-box" style="font-size:.8rem">Payments run in TEST/MOCK mode until live keys are set. Card data is never stored.</div>
    <button class="btn btn-pri" id="shS2" style="margin-top:.6rem">${T("save")}</button></div>
    <h3 style="margin-top:1rem">📧 Mail log (test provider)</h3><div id="ml"></div>`;
    $("#shS2").onclick=async()=>{try{await A.saveSettings({taxRate:Number($("#shT").value),currency:{code:$("#shC").value,symbol:$("#shS").value,pos:$("#shP").value},shipMethods:JSON.parse($("#shM").value)});App.settings=await A.settings();App.cur=App.settings.currency;App.toast(T("success"),"ok");}catch(e){App.toast("Invalid JSON","err");}};
    $("#skB").onclick=()=>A.setSecret($("#skK").value,$("#skV").value).then(()=>App.toast(T("success"),"ok"));
    $("#ml").innerHTML=(await A.mailLog()).slice(0,20).map(m=>`<div class="card" style="padding:.6rem;margin:.3rem 0;font-size:.8rem">[${m.tpl}] ${U.esc(m.to||"")} — ${U.esc(m.subject)} <small>${m.at.slice(0,16)}</small></div>`).join("")||"—";}
  else if(sub==="notif"){b.innerHTML=H("📢 "+T("notif"))+`<div class="card" style="padding:1.2rem;max-width:560px"><label class="f">Broadcast to all users</label><textarea id="bcT" rows="2"></textarea><button class="btn btn-pri btn-sm" id="bcB" style="margin-top:.6rem">📢 Send</button></div><div id="nl"></div>`;
    $("#bcB").onclick=async()=>{await A.broadcast("broadcast",$("#bcT").value);App.toast(T("success"),"ok");};
    $("#nl").innerHTML=(await A.adminNotifs()).slice(0,20).map(n=>`<div class="card" style="padding:.6rem;margin:.3rem 0;font-size:.8rem">[${U.esc(n.kind)}] ${U.esc(JSON.stringify(n.data).slice(0,120))}</div>`).join("");}
  else if(sub==="settings"){const st=await A.settings();
    b.innerHTML=H("⚙️ "+T("settings"))+`<div class="card" style="padding:1.2rem;max-width:640px"><div class="form-grid">
    <div><label class="f">Store name</label><input id="st1" value="${U.esc(st.storeName||"")}"></div><div><label class="f">Logo text</label><input id="st2" value="${U.esc(st.logoText||"DM")}"></div>
    <div class="full"><label class="f">Announcement bar</label><input id="st3" value="${U.esc(st.announcements||"")}"></div>
    <div class="full"><label class="f">Footer about</label><textarea id="st4" rows="2">${U.esc(st.footerAbout||"")}</textarea></div>
    <div><label class="f">SEO title</label><input id="st5" value="${U.esc((st.seo||{}).title||"")}"></div><div><label class="f">SEO desc</label><input id="st6" value="${U.esc((st.seo||{}).desc||"")}"></div>
    <div><label class="f">Default lang</label><select id="st7"><option value="ar">ar</option><option value="en" ${st.defaultLang==="en"?"selected":""}>en</option><option value="de" ${st.defaultLang==="de"?"selected":""}>de</option></select></div>
    <div><label class="f">Social (x,instagram,facebook,youtube JSON)</label><input id="st8" value="${U.esc(JSON.stringify(st.social||{}))}" dir="ltr"></div></div>
    <button class="btn btn-pri" id="stS" style="margin-top:.8rem">${T("save")}</button></div>`;
    $("#stS").onclick=async()=>{await A.saveSettings({storeName:$("#st1").value,logoText:$("#st2").value,announcements:$("#st3").value,footerAbout:$("#st4").value,seo:{title:$("#st5").value,desc:$("#st6").value},defaultLang:$("#st7").value,social:JSON.parse($("#st8").value||"{}")});App.toast(T("success"),"ok");};}
  else if(sub==="audit"){const log=await A.auditLog();
    b.innerHTML=H("📜 "+T("audit"))+tbl(["Time","User","Action","Target"],log.map(l=>`<tr><td style="font-size:.75rem">${l.at.slice(0,16).replace("T"," ")}</td><td style="font-size:.75rem">${l.userId}</td><td>${U.esc(l.action)}</td><td style="font-size:.75rem">${U.esc(String(l.target).slice(0,60))}</td></tr>`));}
  else if(sub==="reports"){b.innerHTML=H("📈 "+T("reports"))+`<div class="toolbar"><input type="date" id="rpF"><input type="date" id="rpT"><button class="btn btn-pri btn-sm" id="rpB">${T("view")}</button></div><div id="rpR"></div>`;
    $("#rpB").onclick=async()=>{const r=await A.report({from:$("#rpF").value,to:$("#rpT").value});
      $("#rpR").innerHTML=`<div class="stat-grid"><div class="card stat"><div class="v">${r.orders}</div><div class="l">orders</div></div><div class="card stat"><div class="v">${App.money(r.revenue)}</div><div class="l">revenue</div></div><div class="card stat"><div class="v">${App.money(r.avg)}</div><div class="l">avg order</div></div></div>
      <h4>By payment</h4>${Object.entries(r.byPay).map(([k,v2])=>`<div class="sum-row"><span>${k}</span><b>${v2}</b></div>`).join("")}
      <h4>By status</h4>${r.byStatus.map(s=>`<div class="sum-row"><span>${s.k}</span><b>${s.n}</b></div>`).join("")}`;};}
  App.resolveMedia();};
/* ---------- Homepage CMS ---------- */
async function homeCMS(b){const home=await A.home();
  const secs=U.sortBy(home.sections||[],"order","asc");
  b.innerHTML=`<h2>🏠 ${T("homepage")} CMS</h2>
  <h3>Sections (reorder with ↑↓, toggle, rename)</h3>
  ${secs.map((s,i)=>`<div class="card" style="padding:.7rem;margin:.4rem 0;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
    <b style="min-width:120px">${U.esc(s.type)}</b><input data-st="${s.id}" value="${U.esc(s.title||"")}" style="flex:1;min-width:140px">
    <button class="btn btn-sm ${s.on?"btn-ok":"btn-ghost"}" data-so="${s.id}">${s.on?"👁":"🚫"}</button>
    <button class="btn btn-sm btn-sec" data-su="${s.id}" ${i===0?"disabled":""}>↑</button>
    <button class="btn btn-sm btn-sec" data-sd="${s.id}" ${i===secs.length-1?"disabled":""}>↓</button></div>`).join("")}
  <button class="btn btn-pri btn-sm" id="secS" style="margin:.6rem 0">${T("save")} sections</button>
  <h3>Hero slides</h3><div id="heroes">${(home.heroes||[]).map((h,i)=>`<div class="card" style="padding:.8rem;margin:.4rem 0"><div class="form-grid"><div><label class="f">Title</label><input data-h="title|${i}" value="${U.esc(h.title)}"></div><div><label class="f">Sub</label><input data-h="sub|${i}" value="${U.esc(h.sub)}"></div><div><label class="f">CTA</label><input data-h="cta|${i}" value="${U.esc(h.cta)}"></div><div><label class="f">Link</label><input data-h="link|${i}" value="${U.esc(h.link)}" dir="ltr"></div><div><label class="f">Art emoji</label><input data-h="art|${i}" value="${U.esc(h.art||"")}" maxlength="4"></div><div><label class="f">Order</label><input data-h="order|${i}" type="number" value="${h.order}"></div></div><div style="display:flex;gap:.5rem;margin-top:.5rem"><button class="btn btn-sm ${h.on?"btn-ok":"btn-ghost"}" data-ho="${i}">${h.on?"on":"off"}</button><button class="btn btn-sm btn-ghost" data-hd="${i}">✕</button></div></div>`).join("")}</div>
  <button class="btn btn-sec btn-sm" id="hAdd">+ slide</button> <button class="btn btn-pri btn-sm" id="hSave">${T("save")} heroes</button>
  <h3 style="margin-top:1rem">Banners</h3><div id="bans">${(home.banners||[]).map((x,i)=>`<div class="card" style="padding:.8rem;margin:.4rem 0"><div class="form-grid"><div><label class="f">Title</label><input data-b="title|${i}" value="${U.esc(x.title)}"></div><div><label class="f">Sub</label><input data-b="sub|${i}" value="${U.esc(x.sub)}"></div><div><label class="f">CTA</label><input data-b="cta|${i}" value="${U.esc(x.cta)}"></div><div><label class="f">Link</label><input data-b="link|${i}" value="${U.esc(x.link)}" dir="ltr"></div></div><button class="btn btn-sm btn-ghost" data-bd="${i}" style="margin-top:.4rem">✕</button></div>`).join("")}</div>
  <button class="btn btn-sec btn-sm" id="bAdd">+ banner</button> <button class="btn btn-pri btn-sm" id="bSave">${T("save")} banners</button>`;
  const H=()=>home;
  $("#secS").onclick=async()=>{secs.forEach(s=>{const inp=document.querySelector(`[data-st="${s.id}"]`);if(inp)s.title=inp.value;});
    await A.saveHome({sections:secs});App.toast(T("success"),"ok");};
  $$("[data-so]").forEach(x=>x.onclick=async()=>{const s=secs.find(y=>y.id===x.dataset.so);s.on=!s.on;await A.saveHome({sections:secs});homeCMS(b);});
  $$("[data-su]").forEach(x=>x.onclick=async()=>{const i=secs.findIndex(y=>y.id===x.dataset.su);[secs[i-1],secs[i]]=[secs[i],secs[i-1]];secs.forEach((s,k)=>s.order=k+1);await A.saveHome({sections:secs});homeCMS(b);});
  $$("[data-sd]").forEach(x=>x.onclick=async()=>{const i=secs.findIndex(y=>y.id===x.dataset.sd);[secs[i+1],secs[i]]=[secs[i],secs[i+1]];secs.forEach((s,k)=>s.order=k+1);await A.saveHome({sections:secs});homeCMS(b);});
  const readH=()=>{const hs=[...document.querySelectorAll("#heroes .card")];return hs.map((c,i)=>{const o={id:home.heroes[i]?home.heroes[i].id:U.uid("h"),on:home.heroes[i]?home.heroes[i].on:true};
    c.querySelectorAll("[data-h]").forEach(inp=>{const [k]=inp.dataset.h.split("|");o[k]=k==="order"?Number(inp.value):inp.value;});return o;});};
  $$("[data-ho]").forEach(x=>x.onclick=()=>{const hs=readH();hs[Number(x.dataset.ho)].on=!hs[Number(x.dataset.ho)].on;A.saveHome({heroes:hs}).then(()=>homeCMS(b));});
  $$("[data-hd]").forEach(x=>x.onclick=()=>{const hs=readH();hs.splice(Number(x.dataset.hd),1);A.saveHome({heroes:hs}).then(()=>homeCMS(b));});
  $("#hAdd").onclick=()=>{home.heroes.push({id:U.uid("h"),title:"New",sub:"",cta:"Shop",link:"#/shop",art:"🛍️",on:true,order:home.heroes.length+1});homeCMS(b);};
  $("#hSave").onclick=async()=>{await A.saveHome({heroes:readH()});App.toast(T("success"),"ok");};
  const readB=()=>{const cs=[...document.querySelectorAll("#bans .card")];return cs.map((c,i)=>{const o={id:home.banners[i]?home.banners[i].id:U.uid("b"),on:true,g:i};
    c.querySelectorAll("[data-b]").forEach(inp=>{const [k]=inp.dataset.b.split("|");o[k]=inp.value;});return o;});};
  $$("[data-bd]").forEach(x=>x.onclick=()=>{const bs=readB();bs.splice(Number(x.dataset.bd),1);A.saveHome({banners:bs}).then(()=>homeCMS(b));});
  $("#bAdd").onclick=()=>{home.banners.push({id:U.uid("b"),title:"New",sub:"",cta:"Shop",link:"#/shop",g:0,on:true});homeCMS(b);};
  $("#bSave").onclick=async()=>{await A.saveHome({banners:readB()});App.toast(T("success"),"ok");};}
})(typeof self!=="undefined"?self:this);
