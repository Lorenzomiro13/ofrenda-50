/* Utilidades compartidas */
const ESCUDO='https://stgarchivosutd.blob.core.windows.net/mailing/2Mesa_de_trabajo.png';
const $=id=>document.getElementById(id);
const clean=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(action,data={}){
  let r;
  try{r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data}),cache:'no-store'});}
  catch(e){throw Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.');}
  let j;try{j=await r.json();}catch(e){throw Error('El servidor no responde correctamente. Inténtalo en unos minutos.');}
  if(!j.ok)throw Error(j.error||'Error del servidor');
  return j.data;
}

/* Mensaje fijo dentro de la página (id="msg") */
function info(text,bad=false){
  const m=$('msg');if(!m)return toast(text,bad);
  m.className='notice '+(bad?'error':'success');m.textContent=text;m.hidden=false;
  m.scrollIntoView({behavior:'smooth',block:'center'});
}
/* Aviso flotante breve */
function toast(text,bad=false){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.textContent=text;t.setAttribute('role','status');
  document.body.appendChild(t);setTimeout(()=>t.remove(),3200);
}
/* Botón en estado "cargando" */
function busy(btn,on,label){
  if(!btn)return;
  if(on){btn.dataset.txt=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span class="spin" aria-hidden="true"></span>'+(label||'Un momento…');}
  else{btn.disabled=false;if(btn.dataset.txt)btn.innerHTML=btn.dataset.txt;}
}
/* PIN de la comisión: se guarda solo mientras la pestaña esté abierta */
const session={
  get(k){try{return sessionStorage.getItem('of50_'+k)||''}catch(e){return ''}},
  set(k,v){try{sessionStorage.setItem('of50_'+k,v)}catch(e){}},
  clear(){try{['pin','vol'].forEach(k=>sessionStorage.removeItem('of50_'+k))}catch(e){}}
};
const initials=n=>String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const norm=s=>String(s||'').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g,'');
