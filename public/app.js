const CHANNEL="https://t.me/ioscedrixddconfig";
let items=[], activeCategory="Tümü", selectedId=null;
const $=s=>document.querySelector(s);
function safeText(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function validTelegram(url){try{const u=new URL(url);return u.protocol==="https:"&&u.hostname==="t.me"}catch{return false}}
async function loadItems(){
  try{const r=await fetch('/api/items',{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('API '+r.status);const data=await r.json();items=Array.isArray(data.items)?data.items:[];render();}
  catch(e){items=[];render();const status=$('#apiStatus');if(status)status.textContent='İçerik servisine şu anda ulaşılamıyor.';}
}
function render(){
 const q=$('#searchInput').value.trim().toLocaleLowerCase('tr');
 const filtered=items.filter(x=>(activeCategory==='Tümü'||x.category===activeCategory)&&(!q||(x.name+' '+x.category+' '+(x.description||'')).toLocaleLowerCase('tr').includes(q)));
 $('#resultCount').textContent=filtered.length+' içerik';
 $('#cards').innerHTML=filtered.map(x=>`<article class="card"><button class="card-image" data-detail="${safeText(x.id)}" aria-label="${safeText(x.name)} detaylarını aç">${x.image_url?`<img src="${safeText(x.image_url)}" alt="${safeText(x.name)}" loading="lazy">`:`<span class="image-placeholder">Y</span>`}<span class="tag">${safeText(x.category)}</span></button><div class="card-body"><h3>${safeText(x.name)}</h3><div class="card-meta">${safeText(x.category)} · ${safeText(x.version||'Güncel')}</div><div class="card-bottom"><span class="views">YargıConfig arşivi</span><a class="btn btn-red" href="${validTelegram(x.telegram_url)?safeText(x.telegram_url):CHANNEL}" target="_blank" rel="noopener">➤ Telegram'da gör</a></div></div></article>`).join('')||'<div class="empty catalog-empty"><span class="image-placeholder">Y</span><h3>Henüz içerik eklenmedi</h3><p>Yeni içerikler eklendiğinde burada görüntülenecek.</p></div>';
 $('#cards').querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.detail)));
 if(selectedId&&items.some(x=>x.id===selectedId))showDetail(selectedId);else if(!selectedId)$('#detailPanel').innerHTML='<div class="detail-empty"><span class="detail-icon">↗</span><h3>İçerik arşivi</h3><p>Bir içerik eklendiğinde ayrıntıları burada görüntüleyebilirsin.</p></div>';
}
function showDetail(id){const x=items.find(i=>i.id===id);if(!x)return;selectedId=id;$('#detailPanel').innerHTML=`${x.image_url?`<img src="${safeText(x.image_url)}" alt="${safeText(x.name)}">`:`<div class="card-image"><span class="image-placeholder">Y</span></div>`}<h3>${safeText(x.name)}</h3><div class="detail-tags"><span>${safeText(x.category)}</span><span>${safeText(x.version||'Güncel')}</span></div><p>${safeText(x.description||'')}</p><p class="muted">Bu sitede dosya barındırılmaz. İçeriğin asıl paylaşımına Telegram üzerinden ulaşabilirsin.</p><a class="btn btn-red" href="${validTelegram(x.telegram_url)?safeText(x.telegram_url):CHANNEL}" target="_blank" rel="noopener">➤ Telegram paylaşımına git</a>`}
$('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;activeCategory=b.dataset.category;$('#chips').querySelectorAll('.chip').forEach(c=>c.classList.toggle('selected',c===b));render()});
$('#searchInput').addEventListener('input',render);$('#focusSearch').addEventListener('click',()=>{$('#searchInput').focus();$('#catalog').scrollIntoView({behavior:'smooth'})});
$('#mobileMenu').addEventListener('click',()=>{const open=$('#nav').classList.toggle('open');$('#mobileMenu').setAttribute('aria-expanded',String(open))});
$('#nav').addEventListener('click',e=>{if(e.target.closest('a')){$('#nav').classList.remove('open');$('#mobileMenu').setAttribute('aria-expanded','false')}});
$('#year').textContent=new Date().getFullYear();loadItems();
