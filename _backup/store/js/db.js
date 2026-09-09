/* DMM — Database layer (IndexedDB). All app data lives here. No hard-coded catalog in UI. */
(function(g){
"use strict";
const U=g.DMM_UTILS;
const DBNAME="dmm_db",VER=1;
const STORES=["users","sellers","categories","brands","products","addresses","carts","wishlists","orders","coupons","promos","reviews","messages","notifications","media","themes","kv","audit","searchlog"];
let db=null;
function open(){return new Promise((res,rej)=>{ if(db)return res(db);
  const r=indexedDB.open(DBNAME,VER);
  r.onupgradeneeded=e=>{const d=e.target.result;
    const mk=(n,k,idx)=>{let s; if(d.objectStoreNames.contains(n))return;
      s=d.createObjectStore(n,{keyPath:k||"id"}); (idx||[]).forEach(i=>s.createIndex(i,i,{unique:false}));};
    mk("users","id",["email","role"]); mk("sellers","id",["userId","status"]);
    mk("categories","id",["parentId","slug"]); mk("brands","id",["slug"]);
    mk("products","id",["sellerId","categoryId","brandId","status"]);
    mk("addresses","id",["userId"]); mk("carts","userId"); mk("wishlists","userId");
    mk("orders","id",["customerId","status"]); mk("coupons","id",["code"]);
    mk("promos","id",["status"]); mk("reviews","id",["productId","status"]);
    mk("messages","id",["thread","userId"]); mk("notifications","id",["userId"]);
    mk("media","id",["kind"]); mk("themes","id"); mk("kv","k"); mk("audit","id",["userId"]); mk("searchlog","id",["userId"]);
  };
  r.onsuccess=e=>{db=e.target.result;res(db);}; r.onerror=()=>rej(r.error);});}
function tx(st,mode){return open().then(d=>d.transaction(st,mode||"readonly").objectStore(st));}
const D={
  open,
  all:st=>tx(st).then(s=>new Promise((res,rej)=>{const q=s.getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);})),
  get:(st,id)=>tx(st).then(s=>new Promise((res,rej)=>{const q=s.get(id);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error);})),
  put:(st,o)=>open().then(d=>new Promise((res,rej)=>{const q=d.transaction(st,"readwrite").objectStore(st).put(o);q.onsuccess=()=>res(o);q.onerror=()=>rej(q.error);})),
  del:(st,id)=>open().then(d=>new Promise((res,rej)=>{const q=d.transaction(st,"readwrite").objectStore(st).delete(id);q.onsuccess=()=>res(1);q.onerror=()=>rej(q.error);})),
  idx:(st,index,val)=>tx(st).then(s=>new Promise((res,rej)=>{const q=s.index(index).getAll(val);q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);})),
  kvGet:k=>D.get("kv",k).then(r=>r?r.v:null),
  kvPut:(k,v)=>D.put("kv",{k,v,updatedAt:U.now()}),
  audit:(userId,action,target)=>D.put("audit",{id:U.uid("log"),userId:userId||"guest",action,target:target||"",at:U.now()})
};
/* ---------------- SEED ---------------- */
const GRADS=[["#6c5cff","#00d4ff"],["#f97316","#ec4899"],["#10b981","#a3e635"],["#0ea5e9","#818cf8"],["#ef4444","#f59e0b"],["#8b5cf6","#d946ef"],["#14b8a6","#84cc16"],["#f43f5e","#fb7185"]];
const G=(i,em)=>({t:"g",g:i%GRADS.length,em});
async function mkUser(id,name,email,pw,role,extra){const salt=U.genSalt();const h=await U.hashPass(pw,salt);
  return Object.assign({id,name,email:email.toLowerCase(),salt,passHash:h,role,status:"active",avatar:"",phone:"",createdAt:U.now()},extra||{});}
async function seed(){const flag=await D.kvGet("seeded_v1"); if(flag)return false;
  const waits=[];
  const admin=await mkUser("u_admin","Store Admin","admin@demo.com","admin123","admin");
  const s1=await mkUser("u_s1","Tech Store","seller@demo.com","seller123","seller",{phone:"+49170000001"});
  const s2=await mkUser("u_s2","Fashion House","seller2@demo.com","seller123","seller");
  const c1=await mkUser("u_c1","Demo Customer","customer@demo.com","customer123","customer",{phone:"+49170000002"});
  [admin,s1,s2,c1].forEach(u=>waits.push(D.put("users",u)));
  const sellers=[
    {id:"s_tech",userId:"u_s1",storeName:"TechNova",slug:"technova",logo:G(0,"⚡"),banner:G(3,"⚡"),desc:"Latest electronics & gadgets with warranty.",status:"approved",rating:4.7,createdAt:U.now()},
    {id:"s_fash",userId:"u_s2",storeName:"Moda House",slug:"moda-house",logo:G(1,"👗"),banner:G(5,"👗"),desc:"Modern fashion for everyone.",status:"approved",rating:4.5,createdAt:U.now()}];
  sellers.forEach(s=>waits.push(D.put("sellers",s)));
  const cats=[
    {id:"c_elec",name:{ar:"إلكترونيات",en:"Electronics",de:"Elektronik"},slug:"electronics",parentId:null,img:G(0,"📱"),order:1,active:true},
    {id:"c_fash",name:{ar:"أزياء",en:"Fashion",de:"Mode"},slug:"fashion",parentId:null,img:G(1,"👗"),order:2,active:true},
    {id:"c_home",name:{ar:"المنزل",en:"Home",de:"Zuhause"},slug:"home",parentId:null,img:G(2,"🏠"),order:3,active:true},
    {id:"c_beau",name:{ar:"الجمال",en:"Beauty",de:"Schönheit"},slug:"beauty",parentId:null,img:G(5,"💄"),order:4,active:true},
    {id:"c_sport",name:{ar:"رياضة",en:"Sports",de:"Sport"},slug:"sports",parentId:null,img:G(6,"⚽"),order:5,active:true},
    {id:"c_phones",name:{ar:"هواتف",en:"Phones",de:"Handys"},slug:"phones",parentId:"c_elec",img:G(0,"📱"),order:1,active:true},
    {id:"c_lap",name:{ar:"لابتوب",en:"Laptops",de:"Laptops"},slug:"laptops",parentId:"c_elec",img:G(3,"💻"),order:2,active:true},
    {id:"c_men",name:{ar:"رجالي",en:"Men",de:"Herren"},slug:"men",parentId:"c_fash",img:G(4,"👔"),order:1,active:true},
    {id:"c_women",name:{ar:"نسائي",en:"Women",de:"Damen"},slug:"women",parentId:"c_fash",img:G(1,"👚"),order:2,active:true}];
  cats.forEach(c=>waits.push(D.put("categories",c)));
  const brands=[["b_nova","NovaTech","⚡",0],["b_pulse","Pulse","🎧",3],["b_urban","UrbanWear","🧥",1],["b_velvet","Velvet","💄",5],["b_fit","FitPro","🏋️",6],["b_luma","LumaHome","🛋️",2],["b_aero","Aero","⌚",4],["b_orbit","Orbit","🚀",7]]
    .map(b=>({id:b[0],name:b[1],slug:U.slug(b[1]),logo:G(b[3],b[2]),desc:"",active:true}));
  brands.forEach(b=>waits.push(D.put("brands",b)));
  const P=(id,seller,name,cat,brand,price,old,stock,em,gi,extra)=>Object.assign(
    {id,sellerId:seller,name,desc:"High quality product with warranty and fast delivery.",categoryId:cat,brandId:brand,
     price,oldPrice:old||null,stock,sku:"SKU-"+id.toUpperCase(),images:[G(gi,em)],video:"",
     variants:[],status:"published",featured:false,rating:4+Math.random(),reviewsCount:Math.floor(Math.random()*180)+5,
     sales:Math.floor(Math.random()*900)+20,createdAt:U.now()},extra||{});
  const prods=[
    P("p1","s_tech","Nova X5 Smartphone 256GB","c_phones","b_nova",699,849,42,"📱",0,{featured:true,variants:[{name:"Color",options:["Black","Blue"]},{name:"Storage",options:["128GB","256GB"]}]}),
    P("p2","s_tech","Pulse Wireless Headphones Pro","c_elec","b_pulse",149,199,120,"🎧",3,{featured:true}),
    P("p3","s_tech","Aero Smart Watch Series 7","c_elec","b_aero",249,329,65,"⌚",4,{featured:true}),
    P("p4","s_tech","UltraBook Pro 14 Laptop","c_lap","b_nova",1299,1499,18,"💻",3,{variants:[{name:"RAM",options:["16GB","32GB"]}]}),
    P("p5","s_tech","Orbit Drone 4K Camera","c_elec","b_orbit",499,649,25,"🚁",7),
    P("p6","s_tech","Volt Power Bank 20000mAh","c_elec","b_nova",39,59,300,"🔋",2),
    P("p7","s_fash","Urban Denim Jacket","c_men","b_urban",89,129,80,"🧥",1,{featured:true,variants:[{name:"Size",options:["S","M","L","XL"]}]}),
    P("p8","s_fash","Velvet Matte Lipstick Set","c_beau","b_velvet",29,45,200,"💄",5),
    P("p9","s_fash","Summer Linen Dress","c_women","b_urban",59,85,95,"👗",1,{variants:[{name:"Size",options:["XS","S","M","L"]}],featured:true}),
    P("p10","s_fash","Classic Leather Sneakers","c_men","b_urban",119,159,60,"👟",4,{variants:[{name:"Size",options:["40","41","42","43","44"]}]}),
    P("p11","s_tech","Luma Smart Lamp","c_home","b_luma",49,69,140,"💡",2),
    P("p12","s_tech","Ergo Office Chair","c_home","b_luma",199,279,30,"🪑",6),
    P("p13","s_fash","FitPro Yoga Mat Premium","c_sport","b_fit",35,50,180,"🧘",6,{featured:true}),
    P("p14","s_fash","Hydro Steel Bottle 1L","c_sport","b_fit",25,35,250,"🍶",2),
    P("p15","s_tech","Mech Keyboard RGB","c_elec","b_pulse",99,139,75,"⌨️",0),
    P("p16","s_fash","Silk Scarf Collection","c_women","b_velvet",45,65,110,"🧣",5),
    P("p17","s_tech","Thunder Gaming Mouse","c_elec","b_pulse",59,79,160,"🖱️",7),
    P("p18","s_fash","Runner Pro Shoes","c_sport","b_fit",139,189,55,"👟",4),
    P("p19","s_tech","Echo Smart Speaker","c_elec","b_nova",79,109,130,"🔊",3),
    P("p20","s_fash","Gold Hoop Earrings","c_women","b_velvet",39,55,90,"💍",5),
    P("p21","s_tech","Vision 27\" 4K Monitor","c_lap","b_nova",349,449,22,"🖥️",3),
    P("p22","s_fash","Wool Winter Coat","c_women","b_urban",159,219,40,"🧥",1,{variants:[{name:"Size",options:["S","M","L"]}]}),
    P("p23","s_tech","Charge Cable 100W 2m","c_elec","b_nova",15,25,500,"🔌",2),
    P("p24","s_fash","Canvas Travel Backpack","c_men","b_urban",69,95,85,"🎒",6)
  ];
  prods.forEach(p=>waits.push(D.put("products",p)));
  waits.push(D.put("coupons",{id:"cp_welcome",code:"WELCOME10",type:"percent",value:10,maxDisc:50,minOrder:30,usageLimit:1000,used:0,perUser:1,start:U.now(),end:"2030-01-01",active:true,scope:"all"}));
  waits.push(D.put("coupons",{id:"cp_flash",code:"FLASH20",type:"percent",value:20,maxDisc:100,minOrder:100,usageLimit:200,used:0,perUser:1,start:U.now(),end:"2030-01-01",active:true,scope:"all"}));
  waits.push(D.put("promos",{id:"flash1",title:"⚡ Flash Deals",type:"flash",discount:25,productIds:["p1","p2","p7","p9","p13"],start:U.now(),end:new Date(Date.now()+3*864e5).toISOString(),status:"active"}));
  waits.push(D.put("kv",{k:"heroes",v:[
    {id:"h1",title:"Next-Gen Tech, Unbeatable Prices",sub:"Top brands, flash deals daily, delivered to your door.",cta:"Shop Electronics",link:"#/c/c_elec",art:"🚀",on:true,order:1},
    {id:"h2",title:"New Season Fashion Drop",sub:"Up to 40% off on trending styles.",cta:"Explore Fashion",link:"#/c/c_fash",art:"👗",on:true,order:2},
    {id:"h3",title:"Sell to Millions",sub:"Open your store today. Zero setup fees.",cta:"Become a Seller",link:"#/seller/apply",art:"🏪",on:true,order:3}],updatedAt:U.now()}));
  waits.push(D.put("kv",{k:"banners",v:[
    {id:"b1",title:"Gadget Week",sub:"Up to 30% off tech",cta:"Shop now",link:"#/c/c_elec",g:0,on:true},
    {id:"b2",title:"Beauty Essentials",sub:"New arrivals",cta:"Discover",link:"#/c/c_beau",g:5,on:true}],updatedAt:U.now()}));
  waits.push(D.put("kv",{k:"sections",v:[
    {id:"s_flash",type:"flash",title:"Flash Deals",on:true,order:1},
    {id:"s_cats",type:"categories",title:"Shop by Category",on:true,order:2},
    {id:"s_trend",type:"trending",title:"Trending Now",on:true,order:3},
    {id:"s_feat",type:"featured",title:"Featured Products",on:true,order:4},
    {id:"s_banner",type:"banners",title:"",on:true,order:5},
    {id:"s_brands",type:"brands",title:"Top Brands",on:true,order:6},
    {id:"s_new",type:"new",title:"New Arrivals",on:true,order:7},
    {id:"s_best",type:"bestsellers",title:"Best Sellers",on:true,order:8},
    {id:"s_rec",type:"recommended",title:"Recommended For You",on:true,order:9}],updatedAt:U.now()}));
  waits.push(D.put("kv",{k:"settings",v:{storeName:"Deutsch Master Marketplace",logoText:"DM",currency:{code:"USD",symbol:"$",decimals:2,pos:"before"},
    taxRate:0,shipMethods:[{id:"std",name:"Standard",fee:5,eta:"3-5 days"},{id:"exp",name:"Express",fee:12,eta:"1-2 days"},{id:"free",name:"Free (orders $50+)",fee:0,eta:"5-7 days",minFree:50}],
    langs:["ar","en","de"],defaultLang:"ar",seo:{title:"Deutsch Master Marketplace",desc:"Global multi-vendor marketplace"},
    social:{x:"",instagram:"",facebook:"",youtube:""},footerAbout:"Global multi-vendor marketplace. Quality, speed and trust.",
    announcements:"🎉 Free shipping on orders over $50 — use code WELCOME10 for 10% off"},updatedAt:U.now()}));
  waits.push(D.put("kv",{k:"navlinks",v:{header:[],footer:[{t:"Help Center",l:"#/help"},{t:"Contact",l:"#/contact"},{t:"Academy (Learn German)",l:"academy.html"}]},updatedAt:U.now()}));
  await Promise.all(waits);
  await D.kvPut("seeded_v1",true); return true;
}
g.DMM_DB=D; g.DMM_SEED=seed;
})(typeof self!=="undefined"?self:this);
