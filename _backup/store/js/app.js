/* DMM — Frontend App: layout, router, theme engine, shop pages */
(function(g){
"use strict";
const U=g.DMM_UTILS, I=g.DMM_I18N, T=I.T;
const GRADS=[["#6c5cff","#00d4ff"],["#f97316","#ec4899"],["#10b981","#a3e635"],["#0ea5e9","#818cf8"],["#ef4444","#f59e0b"],["#8b5cf6","#d946ef"],["#14b8a6","#84cc16"],["#f43f5e","#fb7185"]];
const THEMES=["midnight","ocean","aurora","royal","neon","sunset","cyber","emerald","luxury","crystal","fire","galaxy","arctic","rose","electric","desert","forest","violet","sapphire","platinum"];
const App={pages:{},user:null,settings:null,cur:{symbol:"$",decimals:2},lang:I.cur()};
g.DMM_APP=App;
/* ---------- helpers ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
App.esc=U.esc;
App.money=n=>U.fmtMoney(n,App.cur);
App.img=(im,style)=>{im=im||{t:"g",g:0,em:"📦"};
  if(im.t==="url"&&im.src)return `<img src="${U.esc(im.src)}" alt="" loading="lazy" style="${style||""}">`;
  if(im.t==="media")return `<img data-media="${im.id}" alt="" loading="lazy" style="${style||""}">`;
  const c=GRADS[(im.g||0)%GRADS.length];
  return `<div class="ph" style="background:linear-gradient(135deg,${c[0]},${c[1]});${style||""}">${U.esc(im.em||"📦")}</div>`;};
App.resolveMedia=()=>{$$("[data-media]").forEach(async el=>{const u=await g.DMM_API.mediaUrl(el.dataset.media);if(u)el.src=u;});};
App.toast=(msg,kind)=>{const d=document.createElement("div");d.className="toast "+(kind||"");d.textContent=msg;
  $("#toasts").appendChild(d);setTimeout(()=>{d.style.opacity="0";setTimeout(()=>d.remove(),300);},3200);};
App.modal=(html,wide)=>{$("#modalBox").className="modal-box"+(wide?" wide":"");$("#modalBox").innerHTML=html;$("#modal").classList.add("open");};
App.closeModal=()=>$("#modal").classList.remove("open");
App.confirm=(msg)=>new Promise(res=>{App.modal(`<h3>${U.esc(msg)}</h3><div style="display:flex;gap:.6rem;margin-top:1.2rem;justify-content:flex-end"><button class="btn btn-ghost" id="cfN">${T("no")}</button><button class="btn btn-danger" id="cfY">${T("yes")}</button></div>`);
  $("#cfN").onclick=()=>{App.closeModal();res(false);};$("#cfY").onclick=()=>{App.closeModal();res(true);};});
App.skel=n=>Array(n||8).fill(`<div class="card"><div class="skel" style="aspect-ratio:1"></div><div style="padding:.9rem"><div class="skel" style="height:14px;margin-bottom:.5rem"></div><div class="skel" style="height:14px;width:60%"></div></div></div>`).join("");
App.empty=(t,cta)=>`<div class="empty"><div class="big">🛍️</div><p>${t||T("empty")}</p>${cta||""}</div>`;
App.err=(m)=>`<div class="err-box">⚠️ ${U.esc(m)} <button class="btn btn-sm btn-sec" onclick="location.reload()">${T("retry")}</button></div>`;
App.stars=r=>`<span class="p-rate">${U.stars(r)} ${(Number(r)||0).toFixed(1)}</span>`;
App.pager=(pg,base)=>{if(pg.pages<=1)return "";let h=`<div style="display:flex;gap:.4rem;justify-content:center;margin-top:1.2rem;flex-wrap:wrap">`;
  for(let i=1;i<=pg.pages;i++)h+=`<button class="btn btn-sm ${i===pg.page?"btn-pri":"btn-sec"}" data-pg="${i}">${i}</button>`;
  return h+`</div>`;};
App.bindPager=(fn)=>{$$("[data-pg]").forEach(b=>b.onclick=()=>fn(Number(b.dataset.pg)));};
App.catName=c=>I.N(c.name||c.slug||"");
/* ---------- THEME ENGINE ---------- */
App.applyTheme=(id,tokens,mode)=>{const r=document.documentElement;
  r.dataset.theme=id||"midnight";
  if(tokens)Object.entries(tokens).forEach(([k,v])=>r.style.setProperty("--c-"+k,v));
  let m=mode||"dark"; try{m=localStorage.getItem("dmm-mode")||m;}catch(e){}
  if(mode)try{localStorage.setItem("dmm-mode",mode);}catch(e){}
  const eff=m==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):m;
  r.dataset.mode=eff; r.dataset.modelock=m;
  try{localStorage.setItem("dmm-theme",JSON.stringify({id:r.dataset.theme,tokens:tokens||null}));}catch(e){}};
App.loadTheme=async()=>{let saved=null;try{saved=JSON.parse(localStorage.getItem("dmm-theme")||"null");}catch(e){}
  if(App.user&&App.user.themePref)saved=App.user.themePref;
  const def=App.settings&&App.settings.defaultTheme;
  if(saved)App.applyTheme(saved.id,saved.tokens);
  else if(def)App.applyTheme(def.id||"midnight",def.tokens);
  else App.applyTheme("midnight");};
App.themePanel=async()=>{const customs=await g.DMM_API.customThemes();
  const cur=document.documentElement.dataset.theme;
  const F=[["p","Primary"],["s","Secondary"],["a","Accent"],["bg","Background"],["sf","Surface"],["tx","Text"],["bd","Border"],["g1","Gradient 1"],["g2","Gradient 2"]];
  App.modal(`<h3>🎨 ${T("theme")}</h3>
  <div style="display:flex;gap:.5rem;margin:1rem 0">${["light","dark","system"].map(m=>`<button class="btn btn-sm ${document.documentElement.dataset.modelock===m?"btn-pri":"btn-sec"}" data-mode="${m}">${T(m)}</button>`).join("")}</div>
  <h4 style="margin:.6rem 0">Presets</h4><div class="swatches">
  ${THEMES.map(id=>`<button class="swatch ${cur===id?"on":""}" data-th="${id}"><div class="sp" data-thbg="${id}"></div><span>${id}</span></button>`).join("")}
  </div><h4 style="margin:1rem 0 .4rem">${T("customTheme")}</h4>
  <div id="cEdit">${F.map(f=>`<div class="color-row"><input type="color" id="cc-${f[0]}" value="#6c5cff"><label>${f[1]}</label></div>`).join("")}
  <div style="display:flex;gap:.5rem;margin-top:.6rem"><button class="btn btn-sm btn-pri" id="cPrev">Preview</button>
  <button class="btn btn-sm btn-sec" id="cSave">💾 ${T("save")}</button></div></div>
  <h4 style="margin:1rem 0 .4rem">${T("myThemes")}</h4>
  <div id="thList">${customs.length?customs.map(t=>`<div class="color-row"><b style="flex:1">${U.esc(t.name)}</b><button class="btn btn-sm btn-sec" data-apply="${t.id}">${T("apply")}</button><button class="btn btn-sm btn-ghost" data-delth="${t.id}">✕</button></div>`).join(""): `<p style="color:var(--color-muted);font-size:.85rem">—</p>`}</div>`,true);
  const paint=()=>{$$("[data-thbg]").forEach(el=>{const cs=getComputedStyle(document.querySelector(`[data-theme="${el.dataset.thbg}"]`)||document.documentElement);});};
  $$("#modalBox [data-th]").forEach(b=>{const id=b.dataset.th;
    const tmp=document.createElement("div");tmp.dataset.theme=id;tmp.style.display="none";document.body.appendChild(tmp);
    const cs=getComputedStyle(tmp);b.querySelector(".sp").style.background=`linear-gradient(135deg,${cs.getPropertyValue("--t-p")},${cs.getPropertyValue("--t-g2")})`;tmp.remove();
    b.onclick=()=>{App.applyTheme(id);App.persistThemePref();App.themePanel();};});
  $$("#modalBox [data-mode]").forEach(b=>b.onclick=()=>{App.applyTheme(document.documentElement.dataset.theme,App.curTokens(),b.dataset.mode);App.themePanel();});
  const read=()=>{const o={};F.forEach(f=>o[f[0]]= $("#cc-"+f[0]).value);return o;};
  $("#cPrev").onclick=()=>{App._ct=read();App.applyTheme("custom",App._ct);};
  $("#cSave").onclick=async()=>{const name=prompt("Theme name:");if(!name)return;
    await g.DMM_API.saveTheme({name,tokens:read(),mode:document.documentElement.dataset.modelock});App.toast(T("success"),"ok");App.themePanel();};
  $$("#modalBox [data-apply]").forEach(b=>b.onclick=async()=>{const t=(await g.DMM_API.customThemes()).find(x=>x.id===b.dataset.apply);
    App.applyTheme("custom",t.tokens,t.mode);App.persistThemePref();App.closeModal();});
  $$("#modalBox [data-delth]").forEach(b=>b.onclick=async()=>{if(await App.confirm(T("confirmDel"))){await g.DMM_API.delTheme(b.dataset.delth);App.themePanel();}});};
App.curTokens=()=>document.documentElement.dataset.theme==="custom"?App._ct||null:null;
App.persistThemePref=async()=>{if(!App.user)return; // guests: localStorage only (already saved)
  try{await g.DMM_API.updateProfile({themePref:{id:document.documentElement.dataset.theme,tokens:App.curTokens()}});App.user.themePref={id:document.documentElement.dataset.theme,tokens:App.curTokens()};}catch(e){}};
/* ---------- LAYOUT ---------- */
async function layout(){const s=App.settings;
  document.body.innerHTML=`
  <div class="top-strip">${U.esc(s.announcements||"")}</div>
  <header class="hd"><div class="wrap">
    <div class="hd-row">
      <button class="icon-btn hamburger" id="mMenu">☰</button>
      <a class="logo" href="#/"><span class="logo-mark">${U.esc(s.logoText||"DM")}</span><span>${U.esc(T("appName"))}</span></a>
      <div class="search-box"><span class="s-ico">🔍</span><input id="q" placeholder="${U.esc(T("searchPh"))}" autocomplete="off"><div class="suggest" id="sg" style="display:none"></div></div>
      <div class="hd-actions">
        <select id="langSel" class="hide-m" style="width:auto" title="Language"><option value="ar">عربي</option><option value="en">EN</option><option value="de">DE</option></select>
        <button class="icon-btn" id="thBtn" title="${U.esc(T("theme"))}">🎨</button>
        <button class="icon-btn hide-m" id="ntBtn" title="${U.esc(T("notif"))}">🔔<span class="count-bub" id="ntC" style="display:none"></span></button>
        <button class="icon-btn" id="wBtn" title="${U.esc(T("wishlist"))}">🤍</button>
        <button class="icon-btn" id="cBtn" title="${U.esc(T("cart"))}">🛒<span class="count-bub" id="cC">0</span></button>
        <button class="icon-btn" id="aBtn" title="${U.esc(T("account"))}">${App.user?"👤":"🔑"}</button>
      </div>
    </div></div>
    <nav class="nav-cat"><div class="wrap nav-cat-in" id="catNav"></div></nav>
    <div class="mega" id="mega"><div class="wrap mega-grid" id="megaGrid"></div></div>
  </header>
  <main class="wrap" id="view" style="padding-top:1.2rem"></main>
  <footer class="ft"><div class="wrap"><div class="ft-grid" id="ftGrid"></div>
    <div class="ft-bottom"><span>© ${new Date().getFullYear()} ${U.esc(s.storeName||"")} — ${T("rights")}</span><span id="ftSocial"></span></div></div></footer>
  <nav class="bottom-nav" id="bNav">
    <button data-r="#/"><span class="b-ico">🏠</span>${T("home")}</button>
    <button data-r="#/shop"><span class="b-ico">🛍️</span>${T("shop")}</button>
    <button data-r="#/wishlist"><span class="b-ico">🤍</span>${T("wishlist")}</button>
    <button data-r="#/cart"><span class="b-ico">🛒</span>${T("cart")}</button>
    <button data-r="#/account"><span class="b-ico">👤</span>${T("account")}</button>
  </nav>
  <div class="scrim" id="scrim"></div>
  <aside class="drawer" id="drawer" aria-label="cart"></aside>
  <div class="theme-panel" id="thPanel"></div>
  <div class="modal" id="modal"><div class="modal-box" id="modalBox"></div></div>
  <div id="toasts"></div>`;
  $("#langSel").value=App.lang;
  $("#langSel").onchange=e=>{I.setLang(e.target.value);App.lang=I.cur();location.reload();};
  $("#thBtn").onclick=()=>App.themePanel();
  $("#cBtn").onclick=()=>{location.hash="#/cart";openDrawer();};
  $("#wBtn").onclick=()=>location.hash="#/wishlist";
  $("#aBtn").onclick=()=>location.hash=App.user?"#/account":"#/login";
  $("#ntBtn").onclick=()=>location.hash="#/account/notifications";
  $("#mMenu").onclick=()=>{App.modal(`<div style="display:flex;flex-direction:column;gap:.4rem" id="mNav"></div>`);
    const n=$("#mNav");if(n){n.innerHTML=$("#catNav").innerHTML;n.querySelectorAll("button").forEach(b=>b.onclick=()=>{App.closeModal();location.hash=b.dataset.h;});}};
  $$("#bNav button").forEach(b=>b.onclick=()=>location.hash=b.dataset.r);
  $("#modal").addEventListener("click",e=>{if(e.target.id==="modal")App.closeModal();});
  $("#scrim").onclick=closeDrawer;
  bindSearch(); await renderCatNav(); renderFooter(); refreshCartCount(); refreshNotif();
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){App.closeModal();closeDrawer();}});}
function bindSearch(){const q=$("#q"),sg=$("#sg");
  const go=v=>{location.hash="#/search?q="+encodeURIComponent(v);sg.style.display="none";};
  q.addEventListener("focus",async()=>{sg.innerHTML=await suggestHtml("");sg.style.display="block";});
  q.addEventListener("input",U.debounce(async()=>{sg.innerHTML=await suggestHtml(q.value);sg.style.display="block";},250));
  q.addEventListener("keydown",e=>{if(e.key==="Enter"&&q.value.trim())go(q.value.trim());});
  document.addEventListener("click",e=>{if(!e.target.closest(".search-box"))sg.style.display="none";});
  sg.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)go(b.dataset.go);
    const l=e.target.closest("[data-link]");if(l)location.hash=l.dataset.link;});}
async function suggestHtml(v){const A=g.DMM_API;let h="";
  if(!v){const [rc,pp]=await Promise.all([A.recentSearches(App.user&&App.user.id),A.popularSearches()]);
    if(rc.length)h+=`<div class="sg-sec">🕘 Recent</div>`+rc.map(x=>`<button class="sg-item" data-go="${U.esc(x)}">${U.esc(x)}</button>`).join("");
    if(pp.length)h+=`<div class="sg-sec">🔥 Popular</div>`+pp.map(x=>`<button class="sg-item" data-go="${U.esc(x)}">${U.esc(x)}</button>`).join("");
    return h||`<div class="sg-sec">${T("search")}</div>`;}
  const r=await A.search(v,App.user&&App.user.id);
  h+=r.products.map(p=>`<button class="sg-item" data-link="#/p/${p.id}">${App.img(p.images[0],"width:34px;height:34px;border-radius:8px")}<span>${U.esc(p.name)} — <b>${App.money(p.price)}</b></span></button>`).join("");
  h+=r.cats.map(c=>`<button class="sg-item" data-link="#/c/${c.id}">📂 ${U.esc(App.catName(c))}</button>`).join("");
  h+=r.brands.map(b=>`<button class="sg-item" data-link="#/shop?brand=${b.id}">™️ ${U.esc(b.name)}</button>`).join("");
  h+=`<button class="sg-item" data-go="${U.esc(v)}">🔍 ${T("search")}: <b>${U.esc(v)}</b></button>`;
  return h;}
async function renderCatNav(){const cats=await g.DMM_API.cats();const tops=cats.filter(c=>!c.parentId);
  $("#catNav").innerHTML=`<button data-h="#/shop">🛍️ ${T("shop")}</button>`+tops.map(c=>`<button data-c="${c.id}" data-h="#/c/${c.id}">▸ ${U.esc(App.catName(c))}</button>`).join("")+`<button data-h="#/sellers">🏪 ${T("sellers")}</button><button data-h="#/track">📦 ${T("track")}</button>`;
  $$("#catNav button").forEach(b=>{b.onclick=()=>location.hash=b.dataset.h;
    b.onmouseenter=async()=>{if(!b.dataset.c)return hideMega();
      const subs=cats.filter(c=>c.parentId===b.dataset.c);
      const ps=await g.DMM_API.products({categoryId:b.dataset.c,per:4});
      $("#megaGrid").innerHTML=`<div><h4>${U.esc(T("categories"))}</h4>${subs.map(s2=>`<a href="#/c/${s2.id}">${U.esc(App.catName(s2))}</a>`).join("")||"<a>—</a>"}</div>
      <div><h4>${U.esc(T("products"))}</h4>${ps.items.map(p=>`<a href="#/p/${p.id}">${U.esc(p.name)}</a>`).join("")}</div>`;
      $("#mega").classList.add("open");};});
  const mn=$("#mNav");if(mn)mn.innerHTML=$("#catNav").innerHTML;}
function hideMega(){$("#mega")&&$("#mega").classList.remove("open");}
function renderFooter(){const s=App.settings;
  $("#ftGrid").innerHTML=`<div><div class="logo"><span class="logo-mark">${U.esc(s.logoText||"DM")}</span><b>${U.esc(s.storeName||"")}</b></div><p style="color:var(--color-muted);font-size:.85rem;margin-top:.6rem">${U.esc(s.footerAbout||"")}</p></div>
  <div><h4>${T("shop")}</h4><a href="#/shop">${T("all")} ${T("products")}</a><a href="#/shop?sale=1">🏷️ Flash</a><a href="#/sellers">${T("sellers")}</a><a href="#/track">${T("track")}</a></div>
  <div><h4>${T("account")}</h4><a href="#/account">${T("dashboard")}</a><a href="#/account/orders">${T("orders")}</a><a href="#/wishlist">${T("wishlist")}</a><a href="#/seller/apply">${T("sell")}</a></div>
  <div><h4>${T("help")}</h4><a href="#/help">${T("help")}</a><a href="#/contact">✉️ Contact</a><a href="academy.html">🎓 Academy (Learn German)</a><a href="#/admin">${T("admin")}</a></div>
  <div class="news-band" style="padding:1.2rem"><h4>📧 ${T("newsletter")}</h4><div style="display:flex;gap:.5rem;margin-top:.7rem"><input id="nlE" placeholder="${T("email")}"><button class="btn btn-pri btn-sm" id="nlB">${T("subscribe")}</button></div></div>`;
  const b=$("#nlB");if(b)b.onclick=async()=>{const e=$("#nlE").value;
    if(!U.valid.email(e))return App.toast(T("error"),"err");
    try{await g.DMM_API.contact({name:"newsletter",email:e,message:"subscribe"});App.toast(T("success"),"ok");$("#nlE").value="";}catch(err){App.toast(err.message,"err");}};}
async function refreshCartCount(){try{$("#cC").textContent=await g.DMM_API.cartCount();}catch(e){}}
async function refreshNotif(){try{const n=await g.DMM_API.myNotifs();const c=n.filter(x=>!x.read).length;
  const el=$("#ntC");if(el){el.style.display=c?"flex":"none";el.textContent=c;}}catch(e){}}
App.refreshCartCount=refreshCartCount; App.refreshNotif=refreshNotif;
/* ---------- CART DRAWER ---------- */
async function openDrawer(){const A=g.DMM_API;const c=await A.cart();const t=U.calcCart(c.items,null,0,0);
  $("#drawer").innerHTML=`<div style="padding:1.2rem;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center"><h3>🛒 ${T("cart")} (${c.items.length})</h3><button class="icon-btn" onclick="document.querySelector('#scrim').click()">✕</button></div>
  <div style="flex:1;overflow-y:auto;padding:1rem">${c.items.length?c.items.map(i=>`
    <div class="cart-item"><div class="ci-img">${App.img(i.img,"width:100%;height:100%")}</div>
    <div style="flex:1"><b style="font-size:.86rem">${U.esc(i.name)}</b><div style="font-size:.78rem;color:var(--color-muted)">${U.esc(i.seller)} ${U.esc(i.variant)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem"><div class="qty"><button data-dec="${i.pid}|${U.esc(i.variant)}">−</button><b>${i.qty}</b><button data-inc="${i.pid}|${U.esc(i.variant)}">+</button></div><b>${App.money(i.price*i.qty)}</b></div></div>
    <button class="icon-btn" style="width:32px;height:32px" data-rm="${i.pid}|${U.esc(i.variant)}">🗑️</button></div>`).join(""):App.empty(T("empty"),`<a class="btn btn-pri" href="#/shop">${T("emptyCta")}</a>`)}</div>
  <div style="padding:1.2rem;border-top:1px solid var(--color-border)"><div class="sum-row total"><span>${T("subtotal")}</span><span>${App.money(t.sub)}</span></div>
  <div style="display:flex;gap:.5rem;margin-top:.8rem"><a class="btn btn-sec" style="flex:1" href="#/cart">${T("view")}</a><a class="btn btn-pri" style="flex:2" href="#/checkout">${T("checkout")}</a></div></div>`;
  $("#drawer").classList.add("open");$("#scrim").classList.add("open");
  $$("#drawer [data-inc]").forEach(b=>b.onclick=async()=>{const [p,v]=b.dataset.inc.split("|");const it=c.items.find(x=>x.pid===p);
    await A.cartQty(p,v,it.qty+1).catch(e=>App.toast(e.message,"err"));openDrawer();refreshCartCount();});
  $$("#drawer [data-dec]").forEach(b=>b.onclick=async()=>{const [p,v]=b.dataset.dec.split("|");const it=c.items.find(x=>x.pid===p);
    if(it.qty>1){await A.cartQty(p,v,it.qty-1);}else{await A.cartRemove(p,v);}openDrawer();refreshCartCount();});
  $$("#drawer [data-rm]").forEach(b=>b.onclick=async()=>{const [p,v]=b.dataset.rm.split("|");await A.cartRemove(p,v);openDrawer();refreshCartCount();});}
function closeDrawer(){$("#drawer")&&$("#drawer").classList.remove("open");$("#scrim")&&$("#scrim").classList.remove("open");}
App.openDrawer=openDrawer;
/* ---------- PRODUCT CARD ---------- */
App.card=p=>{const d=U.discPct(p.price,p.oldPrice);
  return `<div class="card hov p-card"><div class="p-media"><a href="#/p/${p.id}" style="display:block;height:100%">${App.img(p.images[0])}</a>
  ${d?`<span class="badge sale p-disc">−${d}%</span>`:""}
  <button class="p-wish" data-w="${p.id}" aria-label="wishlist">🤍</button>
  <div class="p-quick"><button class="btn btn-sec btn-sm" style="width:100%" data-qv="${p.id}">👁 ${T("quickView")}</button></div></div>
  <div class="p-body"><a class="p-name" href="#/p/${p.id}">${U.esc(p.name)}</a>
  <div>${App.stars(p.rating)} <small style="color:var(--color-muted)">(${(p.reviewsCount||0)})</small></div>
  <div class="p-price"><span class="now">${App.money(p.price)}</span>${p.oldPrice?`<span class="old">${App.money(p.oldPrice)}</span>`:""}</div>
  <div class="p-foot"><button class="btn btn-pri btn-sm" data-add="${p.id}">🛒 ${T("addCart")}</button></div></div></div>`;};
App.bindCards=()=>{$$("[data-add]").forEach(b=>b.onclick=async e=>{e.preventDefault();
    try{await g.DMM_API.cartAdd(b.dataset.add,1,"");App.toast("🛒 "+T("success"),"ok");refreshCartCount();
      b.animate([{transform:"scale(1)"},{transform:"scale(1.15)"},{transform:"scale(1)"}],{duration:300});}catch(err){App.toast(err.message,"err");}});
  $$("[data-w]").forEach(async b=>{const on=await g.DMM_API.wishHas(b.dataset.w);if(on){b.classList.add("on");b.textContent="❤️";}
    b.onclick=async e=>{e.preventDefault();try{const r=await g.DMM_API.wishToggle(b.dataset.w);
      b.classList.toggle("on",r.on);b.textContent=r.on?"❤️":"🤍";App.toast(T("success"),"ok");}catch(err){location.hash="#/login";}};});
  $$("[data-qv]").forEach(b=>b.onclick=async e=>{e.preventDefault();quickView(b.dataset.qv);});};
async function quickView(id){const p=await g.DMM_API.product(id);
  App.modal(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem" class="qv">
  <div>${App.img(p.images[0],"width:100%;border-radius:14px;aspect-ratio:1")}</div>
  <div><h3>${U.esc(p.name)}</h3><div>${App.stars(p.rating)} (${p.reviewsCount||0})</div>
  <div class="p-price" style="margin:.6rem 0"><span class="now" style="font-size:1.4rem">${App.money(p.price)}</span>${p.oldPrice?`<span class="old">${App.money(p.oldPrice)}</span>`:""}</div>
  <div style="display:flex;gap:.5rem;margin-top:1rem"><button class="btn btn-pri" data-add="${p.id}">🛒 ${T("addCart")}</button><a class="btn btn-sec" href="#/p/${p.id}" onclick="DMM_APP.closeModal()">${T("view")}</a></div></div></div>`);
  App.bindCards();}
/* ---------- ROUTER (pages register on DMM_PAGES from pages-shop.js) ---------- */
function parseHash(){const h=(location.hash||"#/").slice(1);const [path,qs]=h.split("?");
  const seg=path.split("/").filter(Boolean);const q={};(qs||"").split("&").forEach(p=>{const [k,v]=p.split("=");if(k)q[decodeURIComponent(k)]=decodeURIComponent(v||"");});
  return {seg,q};}
async function route(){hideMega();closeDrawer();const {seg,q}=parseHash();const v=$("#view");
  window.scrollTo({top:0});v.innerHTML=`<div class="grid-prod">${App.skel(8)}</div>`;
  try{
    if(seg[0]==="c")return g.DMM_PAGES["/c"](seg[1],q,v);
    if(seg[0]==="p")return g.DMM_PAGES["/p"](seg[1],v);
    if(seg[0]==="seller"&&seg[1]==="store")return g.DMM_PAGES["/store"](seg[2],v);
    if(seg[0]==="reset")return g.DMM_PAGES["/reset"](seg[1],v);
    if(seg[0]==="order"&&seg[1]==="done")return g.DMM_PAGES["/done"](seg[2],v);
    if(seg[0]==="account")return g.DMM_DASH.account(seg[1]||"overview",v,q);
    if(seg[0]==="seller"&&(!seg[1]||["overview","products","orders","store","messages","reviews","promos","settings"].includes(seg[1])))return g.DMM_DASH.seller(seg[1]||"overview",v,q);
    if(seg[0]==="admin")return g.DMM_DASH.admin(seg[1]||"overview",v,q);
    const fullKey="/"+seg.join("/");
    const fn=g.DMM_PAGES[fullKey]||g.DMM_PAGES["/"+(seg[0]||"")];
    if(fn)return fn(v,q);
    v.innerHTML=App.err("404 — page not found");
  }catch(e){console.error(e);
    if(e.code===401){location.hash="#/login";return;}
    if(e.code===403){v.innerHTML=App.err("403 — forbidden");return;}
    v.innerHTML=App.err(e.message||T("error"));}
  finally{App.resolveMedia();$$(".rv").forEach(el=>new IntersectionObserver((es,o)=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add("vis");o.disconnect();}})).observe(el));}}
/* reveal helper after each render */setInterval(()=>{$$(".rv:not(.vis)").forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight)el.classList.add("vis");});},400);
/* ---------- BOOT ---------- */
App.boot=async()=>{I.setLang(App.lang);App.lang=I.cur();
  try{App.settings=await g.DMM_API.settings();App.cur=App.settings.currency||App.cur;}
  catch(e){throw new Error("API unreachable ("+(g.DMM_API.apiBase?g.DMM_API.apiBase():"?")+"). Start the backend: node server/src/index.js");}
  try{const u=await g.DMM_API.me();if(u)App.user=u;}catch(e){}
  await App.loadTheme(); await layout();
  document.title=(App.settings.seo&&App.settings.seo.title)||"Deutsch Master Marketplace";
  window.addEventListener("hashchange",route); await route();};
g.DMM_PAGES=g.DMM_PAGES||{};

})(typeof self!=="undefined"?self:this);
