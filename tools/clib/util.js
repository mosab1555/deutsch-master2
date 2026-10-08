/* Shared deterministic utils for content-library builders. */
"use strict";
function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function rng(seed){return mulberry32(xmur3(seed)());}
function pick(r,arr){return arr[Math.floor(r()*arr.length)];}
function shuffle(r,arr){arr=arr.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=arr[i];arr[i]=arr[j];arr[j]=t;}return arr;}
// normalize for dedup
function normDE(s){return String(s||"").toLowerCase().replace(/[\s ]+/g," ").trim().replace(/[„“”"«»]/g,"").replace(/[.?!…,;:]+$/g,"").replace(/\s+/g," ");}
if(typeof module!=="undefined")module.exports={xmur3,mulberry32,rng,pick,shuffle,normDE};
