/* DMM — Shop pages (home/CMS, listing, PDP, cart, checkout, auth, misc) */
(function(g){
"use strict";
const U=g.DMM_UTILS, I=g.DMM_I18N, T=I.T, App=g.DMM_APP, A=g.DMM_API;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const P=g.DMM_PAGES;
const secHead=(t,l)=>`<div class="sec-head"><h2>${t}</h2>${l?`<a class="link-more" href="${l}">← ${T("view")}</a>`:""}</div>`;
/* countdown ticker */
setInterval(()=>{$$("[data-cd]").forEach(el=>{let s=Math.max(0,Math.floor((new Date(el.dataset.cd)-Date.now())/1000));
  const d=Math.floor(s/86400);s%=86400;const h=String(Math.floor(s/3600)).padStart(2,"0"),m=String(Math.floor(s%3600/60)).padStart(2,"0"),ss=String(s%60).padStart(2,"0");
  el.innerHTML=`<div><b>${d}</b><span>day</span></div><div><b>${h}</b><span>hr</span></div><div><b>${m}</b><span>min</span></div><div><b>${ss}</b><span>sec</span></div>`;});},1000);
/* ================= HOME ================= */
P["/"]=async v=>{const [home,flash]=await Promise.all([A.home(),A.flash()]);
  const heroes=(home.heroes||[]).filter(h=>h.on).sort((a,b)=>a.order-b.order);
  const secs=(home.sections||[]).filter(s=>s.on).sort((a,b)=>a.order-b.order);
  const prods=(await A.products({per:60})).items;
  const viewed=await A.viewed();
  let h=`<section class="sec" style="padding-top:.6rem"><div class="hero" id="hero">
    ${heroes.map((s,i)=>`<div class="hero-slide ${i===0?"on":""}"><div class="hero-txt"><h1>${U.esc(s.title)}</h1><p>${U.esc(s.sub)}</p><a class="btn btn-pri" href="${U.esc(s.link)}">${U.esc(s.cta)}</a></div><div class="hero-art"><div class="art">${U.esc(s.art||"🛍️")}</div></div></div>`).join("")}
    <button class="icon-btn hero-nav prev" id="hP">‹</button><button class="icon-btn hero-nav next" id="hN">›</button>
    <div class="hero-dots">${heroes.map((_,i)=>`<button data-hd="${i}" class="${i===0?"on":""}"></button>`).join("")}</div></div></section>`;
  const byIds=ids=>ids.map(id=>prods.find(p=>p.id===id)).filter(Boolean);
  const row=list=>`<div class="grid-prod">${list.map(App.card).join("")}</div>`;
  for(const s of secs){
    if(s.type==="flash"&&flash)h+=`<section class="sec rv"><div class="flash-head"><b style="font-size:1.2rem">${U.esc(s.title||flash.title)}</b><span class="badge" style="background:rgba(0,0,0,.3);color:#fff;border:none">−${flash.discount}%</span><div class="countdown" data-cd="${flash.end}"></div></div>${row(flash._products.slice(0,8))}</section>`;
    else if(s.type==="categories"){const cats=(await A.cats()).filter(c=>!c.parentId);
      h+=`<section class="sec rv">${secHead("🗂️ "+U.esc(s.title||T("shopByCat")),"#/shop")}<div class="grid-prod">${cats.map(c=>`<a class="card hov" href="#/c/${c.id}"><div class="p-media">${App.img(c.img)}</div><div class="p-body"><b>${U.esc(App.catName(c))}</b></div></a>`).join("")}</div></section>`;}
    else if(s.type==="trending")h+=`<section class="sec rv">${secHead("🔥 "+U.esc(s.title||T("trending")),"#/shop?sort=pop")}${row(U.sortBy(prods,"sales","desc").slice(0,8))}</section>`;
    else if(s.type==="featured")h+=`<section class="sec rv">${secHead("⭐ "+U.esc(s.title||T("featured")),"#/shop")}${row(prods.filter(p=>p.featured).slice(0,8))}</section>`;
    else if(s.type==="banners"){const bn=(home.banners||[]).filter(b=>b.on);
      h+=`<section class="sec rv"><div class="banner-row">${bn.map(b=>{const c=[["#6c5cff","#00d4ff"],["#f43f5e","#fb7185"]][b.g%2];return `<div class="banner" style="background:linear-gradient(135deg,${c[0]},${c[1]})"><h3>${U.esc(b.title)}</h3><p>${U.esc(b.sub)}</p><a class="btn btn-sec btn-sm" style="align-self:flex-start" href="${U.esc(b.link)}">${U.esc(b.cta)}</a></div>`;}).join("")}</div></section>`;}
    else if(s.type==="brands"){const bs=await A.brands();
      h+=`<section class="sec rv">${secHead("™️ "+U.esc(s.title||T("topBrands")),"#/shop")}<div class="brands-row">${bs.map((b,i)=>`<a class="brand-chip" href="#/shop?brand=${b.id}"><div class="bl" style="background:linear-gradient(135deg,#6c5cff,#00d4ff)">${U.esc((b.logo||{}).em||"™")}</div>${U.esc(b.name)}</a>`).join("")}</div></section>`;}
    else if(s.type==="new")h+=`<section class="sec rv">${secHead("🆕 "+U.esc(s.title||T("newArrivals")),"#/shop?sort=new")}${row(U.sortBy(prods,"createdAt","desc").slice(0,8))}</section>`;
    else if(s.type==="best")h+=`<section class="sec rv">${secHead("🏆 "+U.esc(s.title||T("bestSellers")),"#/shop?sort=pop")}${row(U.sortBy(prods,"sales","desc").slice(0,4))}</section>`;
    else if(s.type==="recommended"){const r=await A.recommend(null,App.user&&App.user.id);
      h+=`<section class="sec rv">${secHead("💡 "+U.esc(s.title||T("recommended")),"#/shop")}${row(r.slice(0,8))}</section>`;}
  }
  if(viewed.length)h+=`<section class="sec rv">${secHead("🕘 "+T("recentlyViewed"))}${row(viewed.slice(0,8))}</section>`;
  h+=`<section class="sec rv"><div class="news-band"><h2>📧 ${T("newsletter")}</h2><p style="color:var(--color-muted)">${U.esc(App.settings.footerAbout||"")}</p><div style="display:flex;gap:.5rem;max-width:440px;margin:1rem auto 0"><input id="nlE2" placeholder="${T("email")}"><button class="btn btn-pri" id="nlB2">${T("subscribe")}</button></div></div></section>`;
  v.innerHTML=h; App.bindCards(); App.resolveMedia();
  const b2=$("#nlB2");if(b2)b2.onclick=async()=>{if(!U.valid.email($("#nlE2").value))return App.toast(T("error"),"err");
    try{await A.contact({name:"newsletter",email:$("#nlE2").value,message:"subscribe"});App.toast(T("success"),"ok");}catch(e){App.toast(e.message,"err");}};
  // hero slider
  let cur=0;const slides=$$("#hero .hero-slide"),dots=$$("#hero [data-hd]");
  const show=i=>{cur=(i+slides.length)%slides.length;slides.forEach((s,k)=>s.classList.toggle("on",k===cur));dots.forEach((d,k)=>d.classList.toggle("on",k===cur));};
  let timer=setInterval(()=>show(cur+1),5000);
  $("#hero").addEventListener("mouseenter",()=>clearInterval(timer));
  $("#hero").addEventListener("mouseleave",()=>timer=setInterval(()=>show(cur+1),5000));
  $("#hP").onclick=()=>show(cur-1);$("#hN").onclick=()=>show(cur+1);
  dots.forEach(d=>d.onclick=()=>show(Number(d.dataset.hd)));};
/* ================= SHOP / CATEGORY / SEARCH ================= */
async function listing(v,q,preset){const cats=await A.cats(),brands=await A.brands();
  const f={categoryId:q.cat||preset||"",brandId:q.brand||"",search:q.q||"",min:q.min?Number(q.min):null,max:q.max?Number(q.max):null,
    minRating:q.rate?Number(q.rate):0,onSale:q.sale?1:0,inStock:q.stock?1:0,sort:q.sort||"pop",page:q.page?Number(q.page):1,per:12};
  v.innerHTML=`<div class="sec"><div class="toolbar">
    <select id="fCat"><option value="">${T("categories")}: ${T("all")}</option>${cats.map(c=>`<option value="${c.id}" ${f.categoryId===c.id?"selected":""}>${U.esc(App.catName(c))}</option>`).join("")}</select>
    <select id="fBrand"><option value="">${T("brands")}: ${T("all")}</option>${brands.map(b=>`<option value="${b.id}" ${f.brandId===b.id?"selected":""}>${U.esc(b.name)}</option>`).join("")}</select>
    <input id="fMin" type="number" placeholder="min $" value="${f.min||""}" style="max-width:110px"><input id="fMax" type="number" placeholder="max $" value="${f.max||""}" style="max-width:110px">
    <select id="fSort"><option value="pop">🔥 pop</option><option value="new">🆕 new</option><option value="priceAsc">💲 ↑</option><option value="priceDesc">💲 ↓</option><option value="rating">⭐ rating</option></select>
    <button class="btn btn-sec btn-sm" id="vGrid">▦</button><button class="btn btn-sec btn-sm" id="vList">☰</button></div>
  <div class="toolbar"><label style="font-size:.82rem"><input type="checkbox" id="fSale" style="width:auto" ${f.onSale?"checked":""}> 🏷️ sale</label>
    <label style="font-size:.82rem"><input type="checkbox" id="fStock" style="width:auto" ${f.inStock?"checked":""}> 📦 ${T("inStock")}</label>
    <select id="fRate" style="max-width:150px"><option value="0">⭐ ${T("all")}</option><option value="4" ${f.minRating===4?"selected":""}>⭐ 4+</option><option value="3" ${f.minRating===3?"selected":""}>⭐ 3+</option></select>
    <button class="btn btn-pri btn-sm" id="fGo">${T("filter")}</button></div>
  <div id="lst"></div></div>`;
  $("#fSort").value=f.sort;
  const apply=async(page)=>{f.page=page||1;const r=await A.products(f);
    $("#lst").innerHTML=r.items.length?`<p style="color:var(--color-muted);font-size:.85rem;margin-bottom:.8rem">${r.total} ${T("products")}</p><div class="grid-prod" id="gp">${r.items.map(App.card).join("")}</div>${App.pager(r)}`:
    App.empty(T("empty"),`<a class="btn btn-pri" href="#/shop">${T("emptyCta")}</a>`);
    App.bindCards();App.resolveMedia();App.bindPager(apply);};
  const read=()=>{location.hash="#/shop?cat="+$("#fCat").value+"&brand="+$("#fBrand").value+"&min="+$("#fMin").value+"&max="+$("#fMax").value+"&sort="+$("#fSort").value+(($("#fSale").checked)?"&sale=1":"")+(($("#fStock").checked)?"&stock=1":"")+("&rate="+$("#fRate").value)+(q.q?("&q="+encodeURIComponent(q.q)):"");};
  $("#fGo").onclick=read;
  $("#vList").onclick=()=>{const g2=$("#gp");if(g2)g2.classList.add("list");};
  $("#vGrid").onclick=()=>{const g2=$("#gp");if(g2)g2.classList.remove("list");};
  await apply(f.page);}
P["/shop"]=async(v,q)=>listing(v,q||{});
P["/c"]=async(id,q,v)=>{const c=await A.category(id);
  if(!c){v.innerHTML=App.err("Category not found");return;}
  const cats=await A.cats();const subs=cats.filter(x=>x.parentId===id);
  v.innerHTML=`<div class="sec"><h2>📂 ${U.esc(App.catName(c))}</h2>
  ${subs.length?`<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.8rem 0">${subs.map(s=>`<a class="btn btn-sec btn-sm" href="#/c/${s.id}">${U.esc(App.catName(s))}</a>`).join("")}</div>`:""}
  <div id="sub"></div></div>`;
  const inner=document.createElement("div");$("#sub").replaceWith(inner);
  await listing(inner,Object.assign({},q,{cat:id}),id);};
P["/search"]=async(v,q)=>{const term=q.q||"";
  if(!term){v.innerHTML=App.empty("🔍 "+T("search"));return;}
  v.innerHTML=`<div class="sec"><h2>🔍 "${U.esc(term)}"</h2><div id="sub"></div></div>`;
  const inner=document.createElement("div");$("#sub").replaceWith(inner);
  await listing(inner,{q:term},null);};
/* ================= PDP ================= */
P["/p"]=async(id,v)=>{const p=await A.product(id);A.markViewed(id);
  const sellers=await A.sellers();const s=sellers.find(x=>x.id===p.sellerId)||{};
  const revs=await A.reviews(id);const rel=await A.recommend(id);
  const together=(await A.products({categoryId:p.categoryId,per:4})).items.filter(x=>x.id!==id).slice(0,3);
  const wished=await A.wishHas(id);
  let img=0;
  v.innerHTML=`<div class="sec"><div class="pdp">
  <div><div class="gal-main" id="gMain">${App.img(p.images[0],"width:100%;height:100%")}</div>
  <div class="gal-thumbs">${p.images.map((im,i)=>`<button data-th="${i}" class="${i===0?"on":""}">${App.img(im,"width:100%;height:100%")}</button>`).join("")}</div></div>
  <div class="pdp-info"><div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
    <span class="badge">${U.esc(p.sku||"")}</span>${p.stock<=0?`<span class="badge err">${T("outStock")}</span>`:p.stock<10?`<span class="badge warn">${T("lowStock")}: ${p.stock}</span>`:`<span class="badge ok">${T("inStock")}</span>`}</div>
  <h1 style="margin:.5rem 0">${U.esc(p.name)}</h1>
  <div>${App.stars(p.rating)} <a href="#rv" style="color:var(--color-muted);font-size:.85rem">${p.reviewsCount||0} ${T("reviews")}</a> · 🏪 <a href="#/seller/store/${p.sellerId}" style="color:var(--color-primary)">${U.esc(s.storeName||"")}</a></div>
  <div class="p-price" style="margin:.8rem 0"><span class="now" style="font-size:1.8rem">${App.money(p.price)}</span>${p.oldPrice?`<span class="old" style="font-size:1.1rem">${App.money(p.oldPrice)}</span><span class="badge sale">−${U.discPct(p.price,p.oldPrice)}%</span>`:""}</div>
  <p style="color:var(--color-muted);font-size:.9rem">🚚 ${T("delivery")}: ${(App.settings.shipMethods||[]).map(m=>U.esc(m.name)+" "+App.money(m.fee)).join(" · ")}</p>
  <div id="vars">${(p.variants||[]).map((vr,vi)=>`<div><label class="f">${U.esc(vr.name)}</label><div class="var-row" data-vr="${vi}">${vr.options.map((o,oi)=>`<button class="${oi===0?"on":""}" data-vo="${U.esc(o)}">${U.esc(o)}</button>`).join("")}</div></div>`).join("")}</div>
  <div style="display:flex;gap:.8rem;align-items:center;margin:1rem 0"><div class="qty"><button id="qD">−</button><b id="qV">1</b><button id="qI">+</button></div>
  <button class="icon-btn ${wished?"on":""}" id="wB" style="${wished?"color:#f43f5e":""}">${wished?"❤️":"🤍"}</button>
  <button class="icon-btn" id="shB" title="share">🔗</button></div>
  <div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn btn-pri" id="addB" style="flex:1" ${p.stock<=0?"disabled":""}>🛒 ${T("addCart")}</button>
  <button class="btn btn-sec" id="buyB" style="flex:1" ${p.stock<=0?"disabled":""}>⚡ ${T("buyNow")}</button></div>
  </div></div>
  <div class="tabs"><button class="on" data-tb="d">${T("description")}</button><button data-tb="s">${T("specs")}</button><button data-tb="r" id="rv">⭐ ${T("reviews")} (${revs.length})</button></div>
  <div id="tb-d"><p>${U.esc(p.desc||"")}</p></div>
  <div id="tb-s" style="display:none"><table class="tbl"><tr><th>SKU</th><td>${U.esc(p.sku||"")}</td></tr><tr><th>${T("seller")}</th><td>${U.esc(s.storeName||"")}</td></tr><tr><th>${T("status")}</th><td>${p.stock>0?T("inStock"):T("outStock")}</td></tr></table></div>
  <div id="tb-r" style="display:none">${revs.length?revs.map(r=>`<div class="rev"><b>${U.esc(r.userName)}</b> ${r.verified?'<span class="badge ok">✓ verified</span>':""} <span class="p-rate">${U.stars(r.rating)}</span><p>${U.esc(r.text)}</p>${r.reply?`<div style="background:var(--color-surface-2);border-radius:8px;padding:.6rem;margin-top:.5rem;font-size:.85rem">🏪 <b>${T("seller")}:</b> ${U.esc(r.reply.text)}</div>`:""}</div>`).join(""):App.empty(T("empty"))}
  <button class="btn btn-sec" id="rvB">✍️ ${T("add")} ${T("reviews")}</button></div>
  ${together.length?`<div style="margin-top:2rem">${secHead("🛒 Frequently bought together")}<div class="grid-prod">${together.map(App.card).join("")}</div></div>`:""}
  <div style="margin-top:2rem">${secHead("💡 "+T("related"),"#/shop")}<div class="grid-prod">${rel.slice(0,4).map(App.card).join("")}</div></div>
  </div>`;
  App.bindCards();App.resolveMedia();
  let qty=1;$("#qI").onclick=()=>{qty=Math.min(p.stock,qty+1);$("#qV").textContent=qty;};
  $("#qD").onclick=()=>{qty=Math.max(1,qty-1);$("#qV").textContent=qty;};
  $$("#gMain").forEach(gm=>gm.onclick=()=>App.modal(`<div style="text-align:center">${App.img(p.images[img],"max-height:70vh;width:auto;margin:auto;border-radius:12px")}</div>`,true));
  $$("[data-th]").forEach(b=>b.onclick=()=>{img=Number(b.dataset.th);$("#gMain").innerHTML=App.img(p.images[img],"width:100%;height:100%");App.resolveMedia();$$("[data-th]").forEach(x=>x.classList.remove("on"));b.classList.add("on");});
  $$("[data-vr]").forEach(r=>r.querySelectorAll("button").forEach(b=>b.onclick=()=>{r.querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");}));
  const varStr=()=>$$("[data-vr]").map(r=>r.querySelector(".on")?r.querySelector(".on").dataset.vo:"").filter(Boolean).join(" / ");
  $("#addB").onclick=async()=>{try{await A.cartAdd(id,qty,varStr());App.toast("🛒 "+T("success"),"ok");App.refreshCartCount();App.openDrawer();}catch(e){App.toast(e.message,"err");}};
  $("#buyB").onclick=async()=>{try{await A.cartAdd(id,qty,varStr());location.hash="#/checkout";}catch(e){App.toast(e.message,"err");}};
  $("#wB").onclick=async()=>{try{const r=await A.wishToggle(id);$("#wB").textContent=r.on?"❤️":"🤍";App.toast(T("success"),"ok");}catch(e){location.hash="#/login";}};
  $("#shB").onclick=()=>{try{navigator.clipboard.writeText(location.href);App.toast("🔗 "+T("success"),"ok");}catch(e){App.toast(location.href);}};
  $$("[data-tb]").forEach(b=>b.onclick=()=>{$$("[data-tb]").forEach(x=>x.classList.remove("on"));b.classList.add("on");["d","s","r"].forEach(k=>$("#tb-"+k).style.display=k===b.dataset.tb?"block":"none");});
  $("#rvB").onclick=()=>{if(!App.user){location.hash="#/login";return;}
    App.modal(`<h3>⭐ ${T("reviews")}</h3><label class="f">Rating (1-5)</label><input id="rr" type="number" min="1" max="5" value="5"><label class="f" style="margin-top:.6rem">Review</label><textarea id="rt" rows="3"></textarea><button class="btn btn-pri" id="rs" style="margin-top:.8rem;width:100%">${T("save")}</button>`);
    $("#rs").onclick=async()=>{try{await A.addReview(id,Number($("#rr").value),$("#rt").value);App.closeModal();App.toast(T("success"),"ok");route0();}catch(e){App.toast(e.message,"err");}};};
  function route0(){location.reload();}};
/* ================= CART PAGE ================= */
P["/cart"]=async v=>{const c=await A.cart();
  if(!c.items.length){v.innerHTML=`<div class="sec">${App.empty(T("empty"),`<a class="btn btn-pri" href="#/shop">${T("emptyCta")}</a>`)}</div>`;return;}
  const sellers=await A.sellers();
  v.innerHTML=`<div class="sec"><h2>🛒 ${T("cart")}</h2><div style="display:grid;grid-template-columns:1fr 340px;gap:1.4rem;margin-top:1rem" class="co-grid">
  <div>${Object.entries(c.groups).map(([sid,items])=>{const sn=(sellers.find(s=>s.id===sid)||{}).storeName||sid;
    return `<div class="card" style="padding:1rem;margin-bottom:1rem"><b>🏪 ${U.esc(sn)}</b>${items.map(i=>`
    <div class="cart-item" style="margin-top:.7rem"><div class="ci-img">${App.img(i.img)}</div>
    <div style="flex:1"><a href="#/p/${i.pid}"><b style="font-size:.86rem">${U.esc(i.name)}</b></a><div style="font-size:.78rem;color:var(--color-muted)">${U.esc(i.variant)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem"><div class="qty"><button data-dec="${i.pid}|${U.esc(i.variant)}">−</button><b>${i.qty}</b><button data-inc="${i.pid}|${U.esc(i.variant)}">+</button></div><b>${App.money(i.price*i.qty)}</b></div></div>
    <button class="icon-btn" style="width:32px;height:32px" data-rm="${i.pid}|${U.esc(i.variant)}">🗑️</button></div>`).join("")}</div>`;}).join("")}</div>
  <div><div class="summary"><div id="sumBody"></div>
    <div style="display:flex;gap:.5rem;margin:.7rem 0"><input id="cpI" placeholder="${T("coupon")}"><button class="btn btn-sec btn-sm" id="cpB">${T("apply")}</button></div>
    <a class="btn btn-pri" style="width:100%" href="#/checkout">${T("checkout")} →</a></div></div></div></div>`;
  const paint=async(code)=>{const st=App.settings;const cp=code?await A.coupon(code):null;
    const t=U.calcCart(c.items,cp,Number((st.shipMethods||[])[0].fee||0),Number(st.taxRate||0));
    $("#sumBody").innerHTML=`<div class="sum-row"><span>${T("subtotal")}</span><b>${App.money(t.sub)}</b></div>
    ${t.disc?`<div class="sum-row" style="color:var(--color-success)"><span>${T("discount")}</span><b>−${App.money(t.disc)}</b></div>`:""}
    <div class="sum-row"><span>${T("total")}</span><b>${App.money(t.total)}</b></div>`;
    if(code&&!cp)App.toast(T("error"),"err");};
  await paint("");App.resolveMedia();
  $("#cpB").onclick=()=>paint($("#cpI").value);
  const re=()=>P["/cart"](v);
  $$("[data-inc]").forEach(b=>b.onclick=async()=>{const [p,x]=b.dataset.inc.split("|");const it=c.items.find(i=>i.pid===p);
    await A.cartQty(p,x,it.qty+1).catch(e=>App.toast(e.message,"err"));re();App.refreshCartCount();});
  $$("[data-dec]").forEach(b=>b.onclick=async()=>{const [p,x]=b.dataset.dec.split("|");const it=c.items.find(i=>i.pid===p);
    it.qty>1?await A.cartQty(p,x,it.qty-1):await A.cartRemove(p,x);re();App.refreshCartCount();});
  $$("[data-rm]").forEach(b=>b.onclick=async()=>{const [p,x]=b.dataset.rm.split("|");await A.cartRemove(p,x);re();App.refreshCartCount();});};
/* ================= CHECKOUT ================= */
const CO={step:1,addr:null,ship:null,pay:"cod",coupon:"",note:""};
P["/checkout"]=async v=>{const u=await A.me();if(!u){location.hash="#/login";return;}
  const c=await A.cart();if(!c.items.length){location.hash="#/cart";return;}
  const addrs=await A.addresses();const st=App.settings;
  if(!CO.ship)CO.ship=(st.shipMethods||[])[0].id;
  const steps=[T("cart"),T("address"),T("shipping"),T("payment"),T("reviewOrder")];
  const t=await A.checkoutTotals(CO.coupon,CO.ship).catch(()=>null);
  v.innerHTML=`<div class="sec"><h2>💳 ${T("checkout")}</h2>
  <div class="steps">${steps.map((s,i)=>`<div class="step ${CO.step===i+1?"on":CO.step>i+1?"done":""}" data-n="${i+1}">${s}</div>`).join("")}</div>
  <div style="display:grid;grid-template-columns:1fr 340px;gap:1.4rem" class="co-grid"><div id="coBody"></div>
  <div><div class="summary" id="coSum"></div></div></div></div>`;
  const paintSum=async()=>{try{const tt=await A.checkoutTotals(CO.coupon,CO.ship);
    $("#coSum").innerHTML=`<div class="sum-row"><span>${T("subtotal")}</span><b>${App.money(tt.sub)}</b></div>
    ${tt.disc?`<div class="sum-row" style="color:var(--color-success)"><span>${T("discount")} (${U.esc(CO.coupon)})</span><b>−${App.money(tt.disc)}</b></div>`:""}
    <div class="sum-row"><span>${T("shipping")}</span><b>${App.money(tt.ship)}</b></div>
    ${tt.tax?`<div class="sum-row"><span>${T("tax")}</span><b>${App.money(tt.tax)}</b></div>`:""}
    <div class="sum-row total"><span>${T("total")}</span><span>${App.money(tt.total)}</span></div>
    <div style="display:flex;gap:.5rem;margin-top:.7rem"><input id="cpI2" placeholder="${T("coupon")}" value="${U.esc(CO.coupon)}"><button class="btn btn-sec btn-sm" id="cpB2">${T("apply")}</button></div>`;
    $("#cpB2").onclick=async()=>{CO.coupon=$("#cpI2").value;await paintSum();step();};}catch(e){$("#coSum").innerHTML=App.err(e.message);}};
  const step=()=>{const b=$("#coBody");
    if(CO.step===1){b.innerHTML=`${c.items.map(i=>`<div class="cart-item"><div class="ci-img">${App.img(i.img)}</div><div style="flex:1"><b>${U.esc(i.name)}</b><div style="font-size:.8rem;color:var(--color-muted)">${U.esc(i.seller)} × ${i.qty}</div></div><b>${App.money(i.price*i.qty)}</b></div>`).join("")}<button class="btn btn-pri" id="nx">${T("confirm")} →</button>`;$("#nx").onclick=()=>{CO.step=2;P["/checkout"](v);};}
    else if(CO.step===2){b.innerHTML=`<div class="addr-grid">${addrs.map(a=>`<div class="card addr-card ${CO.addr===a.id?"on":""}" data-ad="${a.id}"><b>${U.esc(a.label)}</b>${a.isDefault?' <span class="badge ok">default</span>':""}<p style="font-size:.85rem;color:var(--color-muted)">${U.esc(a.street)}, ${U.esc(a.city)} ${U.esc(a.zip)}</p></div>`).join("")||App.empty(T("empty"))}</div>
      <button class="btn btn-sec btn-sm" id="adNew" style="margin:.8rem 0">+ ${T("add")} ${T("address")}</button><div id="adF"></div>
      <div style="display:flex;gap:.6rem;margin-top:1rem"><button class="btn btn-ghost" id="bk">←</button><button class="btn btn-pri" id="nx" ${CO.addr?"":"disabled"}>${T("confirm")} →</button></div>`;
      $$("[data-ad]").forEach(x=>x.onclick=()=>{CO.addr=x.dataset.ad;step();});
      $("#bk").onclick=()=>{CO.step=1;P["/checkout"](v);};
      $("#nx").onclick=()=>{CO.step=3;P["/checkout"](v);};
      $("#adNew").onclick=()=>{$("#adF").innerHTML=`<div class="card" style="padding:1rem"><div class="form-grid"><div><label class="f">Label*</label><input id="aL" placeholder="Home"></div><div><label class="f">City*</label><input id="aC"></div><div class="full"><label class="f">Street*</label><input id="aS"></div><div><label class="f">ZIP</label><input id="aZ"></div><div><label class="f">${T("phone")}</label><input id="aP"></div></div><button class="btn btn-pri btn-sm" id="aSv" style="margin-top:.7rem">${T("save")}</button></div>`;
        $("#aSv").onclick=async()=>{try{const a=await A.saveAddress({label:$("#aL").value,city:$("#aC").value,street:$("#aS").value,zip:$("#aZ").value,phone:$("#aP").value});CO.addr=a.id;P["/checkout"](v);}catch(e){App.toast(e.message,"err");}};};}
    else if(CO.step===3){b.innerHTML=`${(st.shipMethods||[]).map(m=>`<label class="card addr-card ${CO.ship===m.id?"on":""}" style="display:flex;gap:.8rem;padding:1rem;margin-bottom:.6rem;cursor:pointer"><input type="radio" name="sh" value="${m.id}" style="width:auto" ${CO.ship===m.id?"checked":""}><span style="flex:1"><b>${U.esc(m.name)}</b><br><small style="color:var(--color-muted)">⏱ ${U.esc(m.eta||"")}</small></span><b>${App.money(m.fee)}</b></label>`).join("")}
      <div style="display:flex;gap:.6rem;margin-top:1rem"><button class="btn btn-ghost" id="bk">←</button><button class="btn btn-pri" id="nx">${T("confirm")} →</button></div>`;
      $$("input[name=sh]").forEach(r=>r.onchange=()=>{CO.ship=r.value;paintSum();step();});
      $("#bk").onclick=()=>{CO.step=2;P["/checkout"](v);};$("#nx").onclick=()=>{CO.step=4;P["/checkout"](v);};}
    else if(CO.step===4){b.innerHTML=`${[["cod","💵 "+T("cod")],["card","💳 "+T("card")+" (test)"],["wallet","👛 "+T("wallet")+" (test)"]].map(m=>`<label class="card addr-card ${CO.pay===m[0]?"on":""}" style="display:block;padding:1rem;margin-bottom:.6rem;cursor:pointer"><input type="radio" name="pm" value="${m[0]}" style="width:auto" ${CO.pay===m[0]?"checked":""}> <b>${m[1]}</b></label>`).join("")}
      <div id="cardF" style="display:${CO.pay==="card"?"block":"none"}" class="card"><div style="padding:1rem"><div class="ok-box">🧪 Test mode — use card 4242 4242 4242 4242. Never stored.</div><div class="form-grid"><div class="full"><label class="f">Card number</label><input id="ccN" placeholder="4242 4242 4242 4242" maxlength="19"></div><div><label class="f">Expiry</label><input id="ccE" placeholder="12/30"></div><div><label class="f">CVC</label><input id="ccC" placeholder="123" maxlength="4"></div></div></div></div>
      <div style="display:flex;gap:.6rem;margin-top:1rem"><button class="btn btn-ghost" id="bk">←</button><button class="btn btn-pri" id="nx">${T("reviewOrder")} →</button></div>`;
      $$("input[name=pm]").forEach(r=>r.onchange=()=>{CO.pay=r.value;step();});
      $("#bk").onclick=()=>{CO.step=3;P["/checkout"](v);};
      $("#nx").onclick=()=>{if(CO.pay==="card"){const n=$("#ccN").value.replace(/\s/g,"");if(!/^4242\d{12}$/.test(n)&&!/^\d{15,16}$/.test(n))return App.toast("Invalid test card","err");}CO.step=5;P["/checkout"](v);};}
    else{b.innerHTML=`<div class="card" style="padding:1rem"><h3>${T("reviewOrder")}</h3>
      ${c.items.map(i=>`<div class="sum-row"><span>${U.esc(i.name)} × ${i.qty}</span><b>${App.money(i.price*i.qty)}</b></div>`).join("")}
      <label class="f" style="margin-top:.8rem">Note</label><input id="oN" placeholder="…" value="${U.esc(CO.note)}">
      <div style="display:flex;gap:.6rem;margin-top:1rem"><button class="btn btn-ghost" id="bk">←</button><button class="btn btn-pri" id="pl" style="flex:1">✅ ${T("placeOrder")}</button></div></div>`;
      $("#bk").onclick=()=>{CO.step=4;P["/checkout"](v);};
      $("#pl").onclick=async e=>{e.target.disabled=true;e.target.textContent=T("loading");CO.note=$("#oN").value;
        try{const o=await A.placeOrder({addressId:CO.addr,shipId:CO.ship,payMethod:CO.pay,couponCode:CO.coupon,note:CO.note});
          CO.step=1;CO.addr=null;CO.coupon="";App.refreshCartCount();location.hash="#/order/done/"+o.id;}
        catch(err){App.toast(err.message,"err");e.target.disabled=false;e.target.textContent="✅ "+T("placeOrder");}};}};
  await paintSum();step();App.resolveMedia();};
P["/done"]=async(id,v)=>{const o=await A.order(id).catch(()=>null);
  v.innerHTML=`<div class="sec" style="text-align:center"><div style="font-size:4rem">✅</div><h2>${T("success")}</h2>
  ${o?`<p>${T("orders")} <b>${U.esc(o.code)}</b> — ${App.money(o.total)}</p><div style="display:flex;gap:.6rem;justify-content:center;margin-top:1rem"><a class="btn btn-pri" href="#/track?q=${U.esc(o.code)}">📦 ${T("track")}</a><a class="btn btn-sec" href="#/account/orders">${T("myOrders")}</a></div>`:""}
  <p style="margin-top:1rem"><a class="link-more" href="#/shop">${T("emptyCta")} →</a></p></div>`;};
/* ================= TRACKING ================= */
P["/track"]=async(v,q)=>{v.innerHTML=`<div class="sec" style="max-width:640px;margin:auto"><h2>📦 ${T("track")}</h2>
  <div style="display:flex;gap:.5rem;margin:1rem 0"><input id="tQ" placeholder="DM-XXXX" value="${U.esc(q.q||"")}"><button class="btn btn-pri" id="tB">${T("track")}</button></div><div id="tR"></div></div>`;
  const show=async code=>{code=String(code||"").trim();if(!code)return;
    const all=await A.orders().catch(()=>[]);const mine=all.find(o=>o.code.toLowerCase()===code.toLowerCase());
    let o=mine;
    if(!o&&App.user&&App.user.role==="admin"){const ao=await A.allOrders();o=ao.find(x=>x.code.toLowerCase()===code.toLowerCase());}
    if(!o){$("#tR").innerHTML=App.err("Order not found");return;}
    const flow=["pending","confirmed","processing","shipped","out_for_delivery","delivered"];
    const idx=flow.indexOf(o.status);
    $("#tR").innerHTML=`<div class="card" style="padding:1.4rem"><h3>${U.esc(o.code)} — <span class="badge ${o.status==="delivered"?"ok":o.status==="cancelled"?"err":"warn"}">${U.esc(o.status)}</span></h3>
    <div class="timeline" style="margin-top:1rem">${flow.map((s,i)=>`<div class="tl-item ${i<idx?"done":i===idx?(o.status==="delivered"?"done":"now"):""}"><b>${U.esc(s)}</b><br><small style="color:var(--color-muted)">${U.esc(((o.timeline.find(t=>t.s===s)||{}).at||"").slice(0,16).replace("T"," "))}</small></div>`).join("")}</div>
    <p style="font-size:.85rem;color:var(--color-muted)">💳 ${U.esc(o.payMethod)} · ${U.esc(o.payStatus)} · 🚚 ${App.money(o.shipping)}</p></div>`;};
  $("#tB").onclick=()=>show($("#tQ").value);if(q.q)show(q.q);};
/* ================= WISHLIST ================= */
P["/wishlist"]=async v=>{if(!App.user){location.hash="#/login";return;}
  const w=await A.wishlist();
  v.innerHTML=`<div class="sec">${secHead("🤍 "+T("wishlist"))}${w.length?`<div class="grid-prod">${w.map(App.card).join("")}</div>`:App.empty(T("empty"),`<a class="btn btn-pri" href="#/shop">${T("emptyCta")}</a>`)}</div>`;
  App.bindCards();App.resolveMedia();};
/* ================= AUTH ================= */
const authWrap=(t,inner)=>`<div class="sec" style="max-width:440px;margin:auto"><div class="card" style="padding:2rem"><h2 style="text-align:center">${t}</h2><div style="margin-top:1.2rem">${inner}</div></div></div>`;
P["/login"]=async v=>{if(App.user){location.hash="#/account";return;}
  v.innerHTML=authWrap("🔑 "+T("login"),`<label class="f">${T("email")}*</label><input id="lE" type="email" dir="ltr"><label class="f" style="margin-top:.7rem">${T("password")}*</label><input id="lP" type="password" dir="ltr"><div class="f-err" id="lEr"></div>
  <button class="btn btn-pri" id="lB" style="width:100%;margin-top:.6rem">${T("login")}</button>
  <p style="text-align:center;margin-top:.8rem;font-size:.88rem"><a class="link-more" href="#/forgot">${T("forgot")}</a> · <a class="link-more" href="#/register">${T("noAcc")} ${T("register")}</a></p>
  <div class="ok-box" style="font-size:.78rem">Demo: admin@demo.com / admin123 · seller@demo.com / seller123 · customer@demo.com / customer123</div>`);
  $("#lB").onclick=async()=>{try{const u=await A.login($("#lE").value,$("#lP").value);App.user=u;await App.loadTheme();
    App.toast(T("welcome")+" "+u.name,"ok");location.hash=u.role==="admin"?"#/admin":u.role==="seller"?"#/seller":"#/account";location.reload();}
    catch(e){$("#lEr").textContent=e.message;}};};
P["/register"]=async v=>{v.innerHTML=authWrap("📝 "+T("register"),`<div class="form-grid"><div class="full"><label class="f">${T("name")}*</label><input id="rN"></div>
  <div class="full"><label class="f">${T("email")}*</label><input id="rE" type="email" dir="ltr"></div>
  <div><label class="f">${T("password")}* (6+)</label><input id="rP" type="password" dir="ltr"></div><div><label class="f">${T("phone")}</label><input id="rT" dir="ltr"></div>
  <div class="full"><label class="f">Role</label><select id="rR"><option value="customer">Customer</option><option value="seller">Seller</option></select></div></div>
  <div class="f-err" id="rEr"></div><button class="btn btn-pri" id="rB" style="width:100%;margin-top:.6rem">${T("register")}</button>
  <p style="text-align:center;margin-top:.8rem;font-size:.88rem"><a class="link-more" href="#/login">${T("haveAcc")} ${T("login")}</a></p>`);
  $("#rB").onclick=async()=>{try{const u=await A.register({name:$("#rN").value,email:$("#rE").value,password:$("#rP").value,phone:$("#rT").value,role:$("#rR").value});
    App.user=u;App.toast(T("welcome")+" "+u.name,"ok");location.hash=u.role==="seller"?"#/seller":"#/account";location.reload();}
    catch(e){$("#rEr").textContent=e.message;}};};
P["/forgot"]=async v=>{v.innerHTML=authWrap("🔓 "+T("forgot"),`<label class="f">${T("email")}*</label><input id="fE" type="email" dir="ltr"><button class="btn btn-pri" id="fB" style="width:100%;margin-top:.8rem">${T("save")}</button><div id="fR"></div>`);
  $("#fB").onclick=async()=>{const r=await A.forgot($("#fE").value);
    $("#fR").innerHTML=`<div class="ok-box">✓ Check your email (mock mode). ${r.token?`Token: <a class="link-more" href="#/reset/${r.token}">${U.esc(r.token)}</a>`:""}</div>`;};};
P["/reset"]=async(tok,v)=>{v.innerHTML=authWrap("🔓 Reset",`<label class="f">${T("password")}* (6+)</label><input id="nP" type="password" dir="ltr"><button class="btn btn-pri" id="nB" style="width:100%;margin-top:.8rem">${T("save")}</button><div class="f-err" id="nE"></div>`);
  $("#nB").onclick=async()=>{try{await A.reset(tok,$("#nP").value);App.toast(T("success"),"ok");location.hash="#/login";}catch(e){$("#nE").textContent=e.message;}};};
/* ================= SELLERS / STORE ================= */
P["/sellers"]=async v=>{const ss=await A.sellers();
  v.innerHTML=`<div class="sec">${secHead("🏪 "+T("sellers"))}<div class="grid-prod">${ss.map(s=>`<a class="card hov" href="#/seller/store/${s.id}"><div class="p-media">${App.img(s.banner)}</div><div class="p-body"><b>${U.esc(s.storeName)}</b><div>${App.stars(s.rating||0)}</div><p style="font-size:.82rem;color:var(--color-muted)">${U.esc((s.desc||"").slice(0,80))}</p></div></a>`).join("")}</div></div>`;
  App.resolveMedia();};
P["/store"]=async(id,v)=>{const s=await A.getSeller(id);if(!s||s.status!=="approved"){v.innerHTML=App.err("Store not found");return;}
  const r=await A.products({sellerId:id,per:24});
  v.innerHTML=`<div class="sec"><div class="banner" style="background:linear-gradient(135deg,#6c5cff,#00d4ff)"><h2>🏪 ${U.esc(s.storeName)}</h2><p>${U.esc(s.desc||"")} · ${App.stars(s.rating||0)}</p></div>
  <div style="margin-top:1.4rem" class="grid-prod">${r.items.map(App.card).join("")}</div></div>`;
  App.bindCards();App.resolveMedia();};
P["/seller/apply"]=async v=>{const u=App.user;
  if(u&&u.role==="seller"){const s=await A.mySeller();
    v.innerHTML=`<div class="sec" style="max-width:560px;margin:auto"><div class="card" style="padding:2rem;text-align:center"><h2>🏪 ${U.esc(s?s.storeName:"")}</h2><p><span class="badge ${s&&s.status==="approved"?"ok":"warn"}">${U.esc(s?s.status:"")}</span></p><a class="btn btn-pri" href="#/seller">${T("dashboard")}</a></div></div>`;return;}
  v.innerHTML=`<div class="sec" style="max-width:560px;margin:auto"><div class="card" style="padding:2rem"><h2>🏪 ${T("sell")}</h2><p style="color:var(--color-muted)">Open your store. Zero setup fees. Admin approval required.</p>
  ${u?"":`<div class="ok-box">Please <a class="link-more" href="#/login">login</a> or <a class="link-more" href="#/register">register</a> first.</div>`}
  <label class="f">Store name*</label><input id="sN"><label class="f" style="margin-top:.6rem">Description</label><textarea id="sD" rows="3"></textarea>
  <button class="btn btn-pri" id="sB" style="width:100%;margin-top:.8rem" ${u?"":"disabled"}>${T("confirm")}</button><div class="f-err" id="sE"></div></div></div>`;
  const b=$("#sB");if(b)b.onclick=async()=>{try{
    const r=await A.applyStore({storeName:$("#sN").value||undefined,desc:$("#sD").value||""});
    App.user.role=r.role;App.toast(T("success"),"ok");location.hash="#/seller";}catch(e){$("#sE").textContent=e.message;}};};
/* ================= STATIC ================= */
P["/help"]=async v=>{v.innerHTML=`<div class="sec" style="max-width:720px;margin:auto"><h2>❓ ${T("help")}</h2>
  ${[["🛒 How to order?","Browse → add to cart → checkout → pay → track with your code."],["📦 How to track?","Open Track page and enter your order code (DM-XXXX)."],["🏪 How to sell?","Register as seller → create store → admin approves → add products."],["🎨 Themes?","Click 🎨 in header to change colors, dark/light, or build your own theme."],["💳 Payments?","Cash on delivery + test cards. Real gateways plug in via settings."]].map(x=>`<div class="card" style="padding:1rem;margin:.6rem 0"><b>${x[0]}</b><p style="color:var(--color-muted);font-size:.9rem">${x[1]}</p></div>`).join("")}</div>`;};
P["/contact"]=async v=>{v.innerHTML=`<div class="sec" style="max-width:560px;margin:auto"><div class="card" style="padding:2rem"><h2>✉️ Contact</h2>
  <label class="f">${T("name")}*</label><input id="cN"><label class="f" style="margin-top:.6rem">${T("email")}*</label><input id="cE" dir="ltr"><label class="f" style="margin-top:.6rem">Message*</label><textarea id="cM" rows="4"></textarea>
  <button class="btn btn-pri" id="cB" style="width:100%;margin-top:.8rem">${T("save")}</button></div></div>`;
  $("#cB").onclick=async()=>{if(!$("#cN").value||!U.valid.email($("#cE").value)||!$("#cM").value)return App.toast(T("error"),"err");
    try{await A.contact({name:$("#cN").value,email:$("#cE").value,message:$("#cM").value});App.toast(T("success"),"ok");location.hash="#/";}catch(e){App.toast(e.message,"err");}};};
})(typeof self!=="undefined"?self:this);
