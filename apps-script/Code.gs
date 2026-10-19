/** OFRENDA 50 — instalar como script VINCULADO al Google Sheets existente. */
const O={c:'CENSO',r:'RESPUESTAS',v:'RAMOS_QR',h:'HISTORICO_REPRESENTANTES',p:'REPRESENTANTES',cfg:'CONFIGURACION',logo:'https://stgarchivosutd.blob.core.windows.net/mailing/2Mesa_de_trabajo.png'};
const CH=['ID','Nombre','Apellidos','Grupo','Activo','Estado','Participa','Flor','Email','Última actualización','Inscripción ID'];
const RH=['Fecha','Inscripción ID','ID fallero','Nombre completo','Email','Participa','Flor','Acción'];
const VH=['ID fallero','Hash QR','Código manual','Estado','Entregado el','Voluntario','Actualizado el'];
function sh(n){let s=SpreadsheetApp.getActive().getSheetByName(n);if(!s)throw Error('Falta pestaña '+n);return s;}
function rows(n,w){let s=sh(n),l=s.getLastRow();return l<2?[]:s.getRange(2,1,l-1,w).getValues();}
function t(x){return String(x==null?'':x).trim();}
function sha(x){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,x).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function prop(k){return PropertiesService.getScriptProperties().getProperty(k)||'';}
function conf(k,d=''){let f=rows(O.cfg,2).find(x=>t(x[0])===k);return f?t(f[1]):d;}
function esc(x){return t(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function lock(f){let l=LockService.getScriptLock();l.waitLock(30000);try{return f()}finally{l.releaseLock()}}
function onOpen(){SpreadsheetApp.getUi().createMenu('🌸 OFRENDA 50').addItem('Preparar backend Netlify','instalarSistema').addItem('Configurar conexión y PIN','configurarAccesos').addItem('Reenviar QR (revisar previamente)','reenviarQRExistentes').addToUi();}
function instalarSistema(){
 let ss=SpreadsheetApp.getActive();
 [[O.c,CH],[O.r,RH],[O.v,VH],[O.cfg,['Parámetro','Valor']]].forEach(([name,head])=>{
  let s=ss.getSheetByName(name)||ss.insertSheet(name),a=s.getRange(1,1,1,head.length).getDisplayValues()[0];
  if(a.every(x=>!x))s.getRange(1,1,1,head.length).setValues([head]);
  else if(head.some((x,i)=>x!==a[i]))throw Error('Cabeceras incompatibles en '+name+'. Se conservan los datos; revisa la estructura.');
  s.setFrozenRows(1);s.getRange(1,1,1,head.length).setFontWeight('bold').setBackground('#eee6d7');
 });
 if(sh(O.cfg).getLastRow()<2)sh(O.cfg).getRange(2,1,4,2).setValues([['NOMBRE_FALLA','Falla R. de Cepeda - Lzo. Palmireno'],['FECHA_OFRENDA','13 de diciembre de 2026'],['FORMULARIO_ACTIVO','Sí'],['ESCUDO_URL',O.logo]]);
 SpreadsheetApp.getUi().alert('Estructura comprobada. No se han borrado datos. Configura accesos.');
}
function configurarAccesos(){
 const ui=SpreadsheetApp.getUi();let a=ui.prompt('Clave entre Netlify y Apps Script','Introduce una clave aleatoria de al menos 32 caracteres; configura la misma en Netlify (OFRENDA_API_KEY).',ui.ButtonSet.OK_CANCEL);
 if(a.getSelectedButton()!==ui.Button.OK)return;if(a.getResponseText().length<32)throw Error('La clave debe tener 32 caracteres mínimo');
 PropertiesService.getScriptProperties().setProperty('API_KEY',a.getResponseText());
 let b=ui.prompt('PIN administrativo','Introduce un PIN de al menos 8 caracteres para lector y panel.',ui.ButtonSet.OK_CANCEL);
 if(b.getSelectedButton()!==ui.Button.OK)return;if(b.getResponseText().length<8)throw Error('PIN insuficiente');
 PropertiesService.getScriptProperties().setProperty('ADMIN_PIN_HASH',sha(b.getResponseText()));ui.alert('Claves guardadas en Script Properties, no en celdas.');
}
function json(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){try{
 let q=JSON.parse(e.postData.contents||'{}');if(!prop('API_KEY')||q.apiKey!==prop('API_KEY'))throw Error('No autorizado');
 const a=q.action,data=q.data||{};
 const map={catalogo:catalogo,inscribir:inscribir,editar:editar,consulta:consulta,entregar:entregar,estadisticas:estadisticas,tarjeta:tarjeta};
 if(!map[a])throw Error('Acción no permitida');return json({ok:true,data:map[a](data)});
 }catch(err){console.error(err);return json({ok:false,error:String(err.message||err)});}}
function censo(){return rows(O.c,CH.length)}
function catalogo(){if(conf('FORMULARIO_ACTIVO','Sí')!=='Sí')throw Error('Formulario cerrado');return censo().filter(x=>t(x[0])&&t(x[4])==='Sí').map(x=>({id:t(x[0]),nombre:t(x[1])+' '+t(x[2]),grupo:t(x[3]),ocupado:t(x[5])==='Respondido'})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));}
function code(){return String(Math.floor(100000+Math.random()*900000));}
function newVoucher(id,all){let other=new Set(all.map(r=>t(r[2])));let n='';do{n=code()}while(other.has(n));return [id,sha('QR-'+n),n,'Pendiente','','',new Date()];}
function reconcile(id,allowed,vrs){let at=vrs.findIndex(r=>t(r[0])===id);let old=at<0?null:vrs[at];
 if(!allowed){if(old){old[3]='Anulado';old[6]=new Date();}return {changed:!!old,record:old};}
 if(old&&t(old[3])==='Entregado')return {changed:false,record:old};
 if(old&&t(old[3])==='Pendiente')return {changed:false,record:old};
 let item=newVoucher(id,vrs);return {changed:true,record:item};
}
function saveVoucher(vrs){let s=sh(O.v);if(vrs.length)s.getRange(2,1,vrs.length,VH.length).setValues(vrs);}
function inscribir(q){return lock(()=>{
 if(conf('FORMULARIO_ACTIVO','Sí')!=='Sí')throw Error('Formulario cerrado');
 let email=t(q.email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Correo incorrecto');
 let entries=q.personas;if(!Array.isArray(entries)||!entries.length||entries.length>30)throw Error('Selecciona entre 1 y 30 personas');
 let ids=entries.map(x=>t(x.id));if(new Set(ids).size!==ids.length)throw Error('Personas duplicadas');
 let all=censo(),vrs=rows(O.v,VH.length),token=t(q.token),key=token?sha('EDIT-'+token):'',prev=token?all.filter(r=>t(r[10])===key):[];
 if(token&&!prev.length)throw Error('Enlace de edición no válido');
 if(token&&(prev.length!==ids.length||prev.some(r=>!ids.includes(t(r[0])))))throw Error('En edición no se pueden cambiar integrantes; consulta con la comisión');
 let map=new Map(all.map((r,i)=>[t(r[0]),{r,i}]));let staged=[];
 for(const x of entries){let k=map.get(t(x.id));if(!k||t(k.r[4])!=='Sí')throw Error('Falleros no disponibles');
 if(t(k.r[10])&&t(k.r[10])!==key)throw Error(k.r[1]+' '+k.r[2]+' ya tiene inscripción');
 if(typeof x.participa!=='boolean'||(x.participa&&typeof x.flor!=='boolean'))throw Error('Responde asistencia y flor de cada persona');
 let v=vrs.find(z=>t(z[0])===t(x.id));if(v&&t(v[3])==='Entregado'&&(!x.participa||!x.flor))throw Error('No se puede cancelar un ramo ya entregado');
 staged.push({x,k});}
 const editToken=token||Utilities.getUuid()+Utilities.getUuid(),hash=sha('EDIT-'+editToken),now=new Date(),hist=[],cards=[];
 staged.forEach(({x,k})=>{let r=k.r.slice();r[5]='Respondido';r[6]=x.participa?'Sí':'No';r[7]=x.participa?(x.flor?'Sí':'No'):'No aplica';r[8]=email;r[9]=now;r[10]=hash;
 sh(O.c).getRange(k.i+2,1,1,CH.length).setValues([r]);
 hist.push([now,hash,t(x.id),t(r[1])+' '+t(r[2]),email,r[6],r[7],token?'Edición':'Alta']);
 const oldIndex=vrs.findIndex(z=>t(z[0])===t(x.id)),v=reconcile(t(x.id),x.participa&&x.flor,vrs);
 if(v.changed){if(oldIndex>=0)vrs[oldIndex]=v.record;else vrs.push(v.record);}
 if(x.participa&&x.flor&&v.record)cards.push({nombre:t(r[1])+' '+t(r[2]),grupo:t(r[3]),codigo:t(v.record[2])});
 });
 const hr=sh(O.r);hr.getRange(hr.getLastRow()+1,1,hist.length,RH.length).setValues(hist);saveVoucher(vrs);SpreadsheetApp.flush();
 let err='';try{enviarCorreo(email,staged.map(({x,k})=>({nombre:t(k.r[1])+' '+t(k.r[2]),participa:x.participa,flor:!!x.flor})),cards,editToken);}catch(e){err='Inscripción guardada pero hubo un error al enviar el correo: '+e.message;console.error(e);}
 return {mensaje:'Respuesta guardada',aviso:err};
 });}
function editar(q){let key=sha('EDIT-'+t(q.token));let all=censo().filter(r=>t(r[10])===key);if(!q.token||!all.length)throw Error('Enlace no válido');return {email:t(all[0][8]),personas:all.map(r=>({id:t(r[0]),participa:r[6]==='Sí',flor:r[7]==='Sí'}))};}
function auth(q){if(!prop('ADMIN_PIN_HASH')||sha(t(q.pin))!==prop('ADMIN_PIN_HASH'))throw Error('PIN incorrecto');}
function findCode(value){let inp=t(value).toUpperCase().replace(/[\s-]/g,'');let v=rows(O.v,VH.length).find(r=>t(r[2])===inp||t(r[1])===sha('QR-'+inp));return v;}
function consulta(q){auth(q);let v=findCode(q.codigo);if(!v)throw Error('Código no encontrado');let c=censo().find(r=>t(r[0])===t(v[0]));return {id:t(v[0]),nombre:c?t(c[1])+' '+t(c[2]):t(v[0]),grupo:c?t(c[3]):'',estado:t(v[3]),codigo:t(v[2])};}
function entregar(q){auth(q);return lock(()=>{let vrs=rows(O.v,VH.length),ix=vrs.findIndex(r=>t(r[2])===t(q.codigo).replace(/[\s-]/g,'')||t(r[1])===sha('QR-'+t(q.codigo).replace(/[\s-]/g,'')));if(ix<0)throw Error('Código no encontrado');let r=vrs[ix];if(t(r[3])!=='Pendiente')throw Error('No se puede entregar: '+r[3]);let c=censo().find(x=>t(x[0])===t(r[0]));if(!c||t(c[6])!=='Sí'||t(c[7])!=='Sí')throw Error('No tiene flor confirmada');r[3]='Entregado';r[4]=new Date();r[5]=t(q.voluntario).slice(0,80)||'Sin nombre';r[6]=new Date();saveVoucher(vrs);return {nombre:t(c[1])+' '+t(c[2]),estado:'Entregado'};});}
function estadisticas(q){auth(q);let all=censo().filter(r=>t(r[0])&&t(r[4])==='Sí'),v=rows(O.v,VH.length);let groups=['Hombres','Mujeres','Niños','Niñas'].map(g=>{let p=all.filter(r=>t(r[3])===g);return {grupo:g,censo:p.length,respondido:p.filter(r=>t(r[5])==='Respondido').length,participa:p.filter(r=>t(r[6])==='Sí').length,flores:p.filter(r=>t(r[6])==='Sí'&&t(r[7])==='Sí').length};});
 return {total:all.length,respuestas:all.filter(r=>t(r[5])==='Respondido').length,participan:all.filter(r=>t(r[6])==='Sí').length,flores:all.filter(r=>t(r[6])==='Sí'&&t(r[7])==='Sí').length,entregados:v.filter(r=>t(r[3])==='Entregado').length,grupos:groups,pendientes:all.filter(r=>t(r[5])!=='Respondido').map(r=>({nombre:t(r[1])+' '+t(r[2]),grupo:t(r[3])}))};}
function tarjeta(q){let code=t(q.codigo);let r=findCode(code);if(!r||t(r[3])==='Anulado')throw Error('Tarjeta no disponible');let c=censo().find(x=>t(x[0])===t(r[0]));if(!c||t(c[6])!=='Sí'||t(c[7])!=='Sí')throw Error('No hay flor activa');return {nombre:t(c[1])+' '+t(c[2]),grupo:t(c[3]),codigo:t(r[2]),fecha:conf('FECHA_OFRENDA','13 de diciembre de 2026'),logo:conf('ESCUDO_URL',O.logo)};}
function enviarCorreo(email,personas,cards,editToken){
 const site=prop('SITE_URL').replace(/\/$/,'');if(!site)throw Error('Falta SITE_URL en propiedades del script');
 const rowsHtml=personas.map(p=>'<li><b>'+esc(p.nombre)+'</b>: '+(p.participa?'Asistirá':'No asistirá')+(p.participa?' · Flor: '+(p.flor?'Sí':'No'):'')+'</li>').join('');
 let attachments=[];let htmlCards='';
 cards.forEach((c,i)=>{let url=site+'/tarjeta.html?codigo='+encodeURIComponent(c.codigo),qr='https://quickchart.io/qr?size=260&text='+encodeURIComponent('OF50:'+c.codigo);
 htmlCards+='<div style="border:1px solid #ddd;border-radius:14px;padding:18px;text-align:center;margin:18px 0"><h3>'+esc(c.nombre)+'</h3><p>Retirada de ramo</p><img width="200" src="'+qr+'"><p style="font-size:24px;font-weight:bold;letter-spacing:4px">'+esc(c.codigo)+'</p><a href="'+esc(url)+'">Abrir y descargar tarjeta</a></div>';
 try{attachments.push(pdfVoucher(c,'Tarjeta_'+(i+1)+'.pdf'));}catch(e){console.error('PDF '+c.nombre,e);}
 });
 let link=site+'/?editar='+encodeURIComponent(editToken),logo=conf('ESCUDO_URL',O.logo);
 const body='<div style="font-family:Arial;max-width:650px;margin:auto"><div style="text-align:center"><img src="'+esc(logo)+'" width="110"><h2>Ofrenda del 50 Aniversario</h2></div><p>Gracias por responder y acompañarnos en este aniversario.</p><p><b>'+esc(conf('FECHA_OFRENDA','13 de diciembre de 2026'))+'</b></p><ul>'+rowsHtml+'</ul><p>Para desfilar es obligatorio ir ataviado. Los representantes irán destacados y no se desfilará por parejas o familias.</p>'+htmlCards+'<p><a href="'+esc(link)+'">Modificar mi inscripción</a></p></div>';
 MailApp.sendEmail({to:email,subject:'Confirmación · Ofrenda del 50 Aniversario',body:'Gracias por responder. Consulta tu inscripción: '+link,htmlBody:body,attachments:attachments,name:conf('NOMBRE_FALLA','La Falla')});
}
function pdfVoucher(c,name){
 const doc=DocumentApp.create('TEMP_OFRENDA_'+Utilities.getUuid());try{let b=doc.getBody();try{const escudo=UrlFetchApp.fetch(conf('ESCUDO_URL',O.logo)).getBlob();b.appendImage(escudo).setWidth(74).setHeight(95);}catch(e){console.error('No se pudo insertar el escudo en PDF',e);}b.appendParagraph('OFRENDA DEL 50 ANIVERSARIO').setHeading(DocumentApp.ParagraphHeading.HEADING1);b.appendParagraph('13 de diciembre de 2026');b.appendParagraph(c.nombre).setHeading(DocumentApp.ParagraphHeading.HEADING2);b.appendParagraph('TARJETA DE RETIRADA DE RAMO');
 // La imagen QR se solicita a un servicio externo usando únicamente un código aleatorio.
 const blob=UrlFetchApp.fetch('https://quickchart.io/qr?size=300&text='+encodeURIComponent('OF50:'+c.codigo)).getBlob();b.appendImage(blob).setWidth(210).setHeight(210);b.appendParagraph('CÓDIGO MANUAL: '+c.codigo).editAsText().setBold(true);b.appendParagraph('Presenta este documento para retirar tu ramo.');doc.saveAndClose();return DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName(name);
 }finally{try{doc.saveAndClose();DriveApp.getFileById(doc.getId()).setTrashed(true)}catch(_){}}}
function reenviarQRExistentes(){throw Error('Por seguridad, no se ejecuta un reenvío masivo automático. Revisa primero los destinatarios y solicita una rutina de reenvío selectivo.');}
