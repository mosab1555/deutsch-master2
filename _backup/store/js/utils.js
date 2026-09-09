/* DMM — pure helpers (no DOM, no IndexedDB): testable in Node */
(function(g){
"use strict";
const U={};
U.uid=p=> (p||"id")+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
U.now=()=>new Date().toISOString();
U.fmtMoney=(n,cur)=>{const s=(cur&&cur.symbol)||"$",p=(cur&&cur.decimals!=null)?cur.decimals:2;
  const v=Number(n||0).toFixed(p).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return ((cur&&cur.pos==="after")? v+" "+s : s+v);};
U.calcCart=(items,coupon,shipFee,taxRate)=>{ // items:[{price,qty}]
  const sub=items.reduce((a,i)=>a+Number(i.price)*Number(i.qty),0);
  let disc=0;
  if(coupon){ if(sub>=(coupon.minOrder||0)){
    disc=coupon.type==="percent"? Math.min(sub*(coupon.value/100),coupon.maxDisc||Infinity) : Math.min(coupon.value,sub); }}
  const ship=items.length? Number(shipFee||0):0;
  const tax=sub*(Number(taxRate||0)/100);
  return {sub, disc, ship, tax, total:Math.max(0,sub-disc+ship+tax)};};
U.valid={
  email:v=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||"").trim()),
  pass:v=>String(v||"").length>=6,
  phone:v=>!v||/^[+\d][\d\s-]{5,18}$/.test(String(v).trim()),
  required:v=>String(v==null?"":v).trim().length>0,
  num:(v,min,max)=>{const n=Number(v);return isFinite(n)&&(min==null||n>=min)&&(max==null||n<=max);},
  url:v=>!v||/^https?:\/\/.+\..+/.test(String(v).trim())
};
U.esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
U.debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms||300);};};
U.groupBy=(arr,k)=>arr.reduce((m,o)=>{(m[o[k]]=m[o[k]]||[]).push(o);return m;},{});// pure logic, no DOM/IDB
U.pick=(o,ks)=>{const r={};ks.forEach(k=>{if(o[k]!==undefined)r[k]=o[k];});return r;};
U.paginate=(arr,page,per)=>{page=Math.max(1,page|0||1);per=Math.min(60,Math.max(1,per|0||12));
  const t=arr.length,pages=Math.max(1,Math.ceil(t/per));
  return {items:arr.slice((page-1)*per,page*per),total:t,pages,page:Math.min(page,pages),per};};
U.sortBy=(arr,key,dir)=>{const d=dir==="asc"?1:-1;return [...arr].sort((a,b)=>{
  const x=a[key],y=b[key]; if(x==null&&y==null)return 0; if(x==null)return d; if(y==null)return -d;
  return (x>y?1:x<y?-1:0)*d;});};
U.stars=r=>{r=Math.round(Number(r||0));let s="";for(let i=1;i<=5;i++)s+=i<=r?"★":"☆";return s;};
U.discPct=(p,o)=>o>p&&o>0?Math.round((1-p/o)*100):0;
U.slug=s=>String(s||"").trim().toLowerCase().replace(/[^\w\u0600-\u06FF\u00C0-\u024F]+/g,"-").replace(/^-+|-+$/g,"");
/* password hashing: salted SHA-256 (async, WebCrypto) with sync fallback */
U.genSalt=()=>{try{const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("");}catch(e){return Math.random().toString(36).slice(2)+Date.now().toString(36);}};
U.hashPass=async(pw,salt)=>{const s=salt+"::"+pw;
  try{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
  catch(e){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
    h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
    return (h2>>>0).toString(16)+(h1>>>0).toString(16);}};
if(typeof module!=="undefined"&&module.exports)module.exports=U; else g.DMM_UTILS=U;
})(typeof self!=="undefined"?self:this);
