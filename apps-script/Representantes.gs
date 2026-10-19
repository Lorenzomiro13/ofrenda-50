/**
 * OFRENDA 50 — Representantes y Dashboard (Representantes.gs)
 * Archivo ADICIONAL. No modifica Código.gs.
 *
 * Ejecutar desde el editor (desplegable de funciones › Ejecutar):
 *
 *   actualizarRepresentantes
 *     1. Importa el histórico (HISTORICO_REPRESENTANTES → REPRESENTANTES).
 *     2. Vincula cada representante con su fila del CENSO (nombre flexible,
 *        sin confundir padres/hijos ni hermanos).
 *     3. Los que NO están en el censo se AÑADEN una sola vez (ID «REP-…»),
 *        aunque hayan sido representantes varios años.
 *     4. Si alguien añadido como REP- aparece después en el censo oficial
 *        (JCF-), se pasa a su ficha JCF y la REP- se desactiva (sin duplicar).
 *     5. Marca la columna «Representante» del CENSO y rehace el DASHBOARD.
 *
 *   actualizarDashboard            → rehace la pestaña DASHBOARD (sin #ERROR!).
 *   activarActualizacionAutomatica → refresca el DASHBOARD cada 10 minutos.
 */

const REP_COL_CENSO = 12; // Columna L de CENSO
const REP_STOP = new Set(['DE','DEL','LA','LAS','LOS','Y','I','D','EL','SR','SRA','DNA','DON','DONA']);
const REP_ABREV = {M:'MARIA',MA:'MARIA',MARI:'MARIA',FCO:'FRANCISCO',FCA:'FRANCISCA',FRAN:'FRANCISCO',
  JOSEP:'JOSE',VTE:'VICENTE',VTA:'VICENTA',VICENT:'VICENTE',ANT:'ANTONIO',ANTO:'ANTONIO',
  INMA:'INMACULADA',CONCHA:'CONCEPCION',CONCHI:'CONCEPCION',LOLA:'DOLORES',PEPA:'JOSEFA',PEPE:'JOSE',
  RAFA:'RAFAEL',ENRIC:'ENRIQUE',JOAN:'JUAN',JOAQUIM:'JOAQUIN'};

// El menú antiguo («Actualizar dashboard», «Actualizar todo») usará el dashboard nuevo.
crearDashboard = function(){ actualizarDashboard(); };

function repTokens_(s){
  const t=String(s||'').replace(/[ªº]/g,'A ').replace(/\./g,' ');
  return norm_(t).split(' ').map(w=>REP_ABREV[w]||w).filter(w=>w.length>1&&!REP_STOP.has(w));
}
function repAviso_(msg){ try{SpreadsheetApp.getUi().alert(msg);}catch(e){console.log(msg);} return msg; }
function repMismo_(a,b){ // Mismo nombre si todas las palabras de uno están en el otro
  if(a.length<2||b.length<2)return false;
  const sa=new Set(a),sb=new Set(b);
  return a.every(t=>sb.has(t))||b.every(t=>sa.has(t));
}

/** Mapa ID fallero → [{anio,tipo}] */
function repMapa_(){
  const s=SpreadsheetApp.getActive().getSheetByName(APP.sheets.rep);
  const m=new Map(); if(!s)return m;
  valores_(s,APP.hp.length).forEach(r=>{
    const id=str_(r[0]); if(!id)return;
    if(!m.has(id))m.set(id,[]);
    m.get(id).push({anio:str_(r[1]),tipo:str_(r[2])});
  });
  m.forEach(v=>v.sort((a,b)=>a.anio.localeCompare(b.anio)));
  return m;
}
function repTexto_(lista){ return (lista||[]).map(x=>x.tipo+' '+x.anio).join(' · '); }

/** Grupo según el cargo más reciente: FM/FMI → mujer, PI/Presidente → hombre */
function repGrupo_(tipo,anio){
  const t=norm_(tipo),y=Number((String(anio).match(/\d{4}/)||[0])[0]),hoy=new Date().getFullYear();
  const infantil=/^(FMI|PI)$/.test(t)||/INFANTIL/.test(t);
  const mujer=/^FMI?$/.test(t)||/FALLERA|PRESIDENTA|REINA|DAMA|MADRINA/.test(t);
  const hombre=/^PI$/.test(t)||/PRESIDENTE|FALLERO|PADRINO/.test(t);
  if(mujer===hombre)return '';
  const nino=infantil&&y&&hoy-y<=12;
  return nino?(mujer?'Niñas':'Niños'):(mujer?'Mujeres':'Hombres');
}
/** «Mª del Remedio Olmo Boronat» → ['Mª del Remedio','Olmo Boronat'] */
function repSepararNombre_(full){
  const s=str_(full).replace(/\s+/g,' ');
  if(s.indexOf(',')>0){const p=s.split(',');return [str_(p[1]),str_(p[0])];}
  const p=s.split(' ');
  if(p.length>=3)return [p.slice(0,-2).join(' '),p.slice(-2).join(' ')];
  return [p[0]||'',p.slice(1).join(' ')];
}

function actualizarRepresentantes(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  let res;
  try{
    try{sincronizarRepresentantes();}catch(e){console.warn('Sincronización: '+e.message);}
    const r=hoja_(APP.sheets.rep),datos=valores_(r,APP.hp.length);
    r.getRange(1,6).setValue('Vinculación');
    const c=hoja_(APP.sheets.censo);
    const filasCenso=valores_(c,APP.hc.length);
    const persona=x=>({id:str_(x[0]),tokens:repTokens_(str_(x[1])+' '+str_(x[2])),activo:str_(x[4])==='Sí',rep:/^REP-/.test(str_(x[0])),respondido:str_(x[5])==='Respondido'});

    // 0) Fusionar: REP- que ya existe en el censo oficial (JCF-) → usar la JCF y desactivar la REP-
    const oficiales=filasCenso.map(persona).filter(p=>p.id&&!p.rep);
    const fusion=new Map(); let fusionados=0;
    filasCenso.forEach((x,i)=>{
      const p=persona(x); if(!p.rep||!p.activo)return;
      const m=oficiales.filter(o=>repMismo_(p.tokens,o.tokens));
      if(m.length===1&&!p.respondido){fusion.set(p.id,m[0].id);c.getRange(i+2,5).setValue('No');x[4]='No';fusionados++;}
    });
    datos.forEach(row=>{ if(fusion.has(str_(row[0]))){row[0]=fusion.get(str_(row[0]));row[5]='Vinculado (auto)';} });

    // 1) Vincular con el censo activo
    const censo=filasCenso.map(persona).filter(p=>p.id&&p.activo);
    let auto=0,manual=0,varios=0,vacios=0;
    const sinCenso=[];
    datos.forEach((row,i)=>{
      const estado=str_(row[5]);
      if(str_(row[0])&&!/^Vinculado \(auto\)|^Añadido|^No está|^Varias/.test(estado)){ if(!/^Vinculado/.test(estado))row[5]='Vinculado (manual)'; manual++; return; }
      row[0]='';
      const t=repTokens_(row[4]);
      if(t.length<2){row[5]='Sin nombre';vacios++;return;}
      const cand=[...new Set(censo.filter(p=>repMismo_(t,p.tokens)).map(p=>p.id))];
      if(cand.length===1){row[0]=cand[0];row[5]=/^REP-/.test(cand[0])?'Añadido al censo':'Vinculado (auto)';auto++;}
      else if(cand.length>1){row[5]='Varias coincidencias: '+cand.slice(0,4).join(', ');varios++;}
      else sinCenso.push(i);
    });

    // 2) Añadir al censo a los que no están, UNA vez por persona
    const grupos=[];
    sinCenso.forEach(i=>{
      const t=repTokens_(datos[i][4]);
      const g=grupos.find(x=>repMismo_(t,x.tokens));
      if(g){g.filas.push(i);if(t.length>g.tokens.length){g.tokens=t;g.nombre=str_(datos[i][4]);}}
      else grupos.push({tokens:t,nombre:str_(datos[i][4]),filas:[i]});
    });
    const ids=new Set(filasCenso.map(x=>str_(x[0]))),nuevos=[],sinGrupo=[];
    grupos.forEach(g=>{
      const ult=g.filas.map(i=>datos[i]).sort((a,b)=>str_(b[1]).localeCompare(str_(a[1])))[0];
      const grupo=repGrupo_(ult[2],ult[1]);
      if(!grupo){g.filas.forEach(i=>datos[i][5]='Revisar: no se sabe el grupo');sinGrupo.push(g.nombre);return;}
      const id='REP-'+digest_(repTokens_(g.nombre).sort().join(' ')).slice(0,8).toUpperCase();
      if(!ids.has(id)){const [nom,ap]=repSepararNombre_(g.nombre);nuevos.push([id,nom,ap,grupo,'Sí','Pendiente','','','','','']);ids.add(id);}
      g.filas.forEach(i=>{datos[i][0]=id;datos[i][5]='Añadido al censo';});
    });
    if(nuevos.length)c.getRange(c.getLastRow()+1,1,nuevos.length,APP.hc.length).setValues(nuevos);
    if(datos.length)r.getRange(2,1,datos.length,APP.hp.length).setValues(datos);
    marcarRepresentantesEnCenso_();
    actualizarDashboard();
    res='Representantes vinculados con su ficha: '+(auto+manual)+
      '\nAñadidos al censo (no eran falleros): '+nuevos.length+' personas'+
      (fusionados?'\nFichas REP- fusionadas con su ficha oficial: '+fusionados:'')+
      (varios?'\nCon varias coincidencias: '+varios+' → escribe el ID correcto en la columna A de REPRESENTANTES y vuelve a ejecutar.':'')+
      (sinGrupo.length?'\nSin añadir (no se sabe el grupo): '+sinGrupo.join(', '):'')+
      (vacios?'\nFilas sin nombre («-»): '+vacios:'');
  }finally{lock.releaseLock();}
  return repAviso_(res);
}

/** CENSO columna L: «FM 1998 · FMI 1985» */
function marcarRepresentantesEnCenso_(){
  const c=hoja_(APP.sheets.censo),n=c.getLastRow();
  c.getRange(1,REP_COL_CENSO).setValue('Representante').setFontWeight('bold').setBackground('#eee7d9');
  if(n<2)return;
  const ids=c.getRange(2,1,n-1,1).getValues(),m=repMapa_();
  c.getRange(2,REP_COL_CENSO,n-1,1).setValues(ids.map(r=>[repTexto_(m.get(str_(r[0])))]));
}

/** Lista de representantes (para el panel web y el DASHBOARD) */
function repPanel_(){
  const m=repMapa_(); if(!m.size)return [];
  const qr=new Map(qrDatos_().map(r=>[str_(r[0]),str_(r[2])]));
  return valores_(hoja_(APP.sheets.censo),APP.hc.length).filter(r=>m.has(str_(r[0]))&&str_(r[4])==='Sí').map(r=>{
    const id=str_(r[0]),resp=str_(r[5])==='Respondido';
    return {id,nombre:str_(r[1])+' '+str_(r[2]),grupo:str_(r[3]),cargos:repTexto_(m.get(id)),primero:(m.get(id)[0]||{}).anio||'',
      estado:!resp?'Sin responder':(str_(r[6])==='Sí'?'Asiste':'No asiste'),flor:str_(r[7])==='Sí',ramo:qr.get(id)||''};
  }).sort((a,b)=>a.primero.localeCompare(b.primero)||a.nombre.localeCompare(b.nombre,'es'));
}

/** DASHBOARD con valores calculados (no depende del idioma de la hoja) */
function actualizarDashboard(){
  const ss=SpreadsheetApp.getActive(),s=ss.getSheetByName(APP.sheets.dash)||ss.insertSheet(APP.sheets.dash);
  const m=repMapa_(),qr=new Map(qrDatos_().map(r=>[str_(r[0]),str_(r[2])]));
  const cen=valores_(hoja_(APP.sheets.censo),APP.hc.length).filter(r=>str_(r[0])&&str_(r[4])==='Sí');
  const resp=r=>str_(r[5])==='Respondido',part=r=>str_(r[6])==='Sí',flor=r=>part(r)&&str_(r[7])==='Sí',esRep=r=>m.has(str_(r[0]));
  const cuenta=f=>cen.filter(f).length;
  const flores=cuenta(flor),entregados=cen.filter(r=>flor(r)&&qr.get(str_(r[0]))==='Entregado').length;
  const reps=repPanel_();
  s.clear();s.clearConditionalFormatRules();
  const H='#14284b',HT='#ffffff',SUB='#e7ecf5';
  let fila=1;
  s.getRange(fila,1,1,2).setValues([['OFRENDA 50 ANIVERSARIO',configurar_('FECHA_OFRENDA',APP.fecha)]]).setFontWeight('bold').setFontSize(14);
  s.getRange(fila,4).setValue('Actualizado: '+Utilities.formatDate(new Date(),'Europe/Madrid','dd/MM/yyyy HH:mm')).setFontColor('#6b7280');
  fila=3;
  const resumen=[['RESUMEN','TOTAL'],['Total censados',cen.length],['Han respondido',cuenta(resp)],['Participarán',cuenta(part)],
    ['No participarán',cen.filter(r=>resp(r)&&!part(r)).length],['Sin responder',cen.length-cuenta(resp)],['Ofrecerán flor',flores],
    ['Ramos entregados',entregados],['Ramos pendientes',flores-entregados],
    ['Representantes en el censo',reps.length],['Representantes que participan',reps.filter(x=>x.estado==='Asiste').length],
    ['Representantes sin responder',reps.filter(x=>x.estado==='Sin responder').length]];
  s.getRange(fila,1,resumen.length,2).setValues(resumen);
  s.getRange(fila,1,1,2).setBackground(H).setFontColor(HT).setFontWeight('bold');
  s.getRange(fila+9,1,3,2).setBackground(SUB);
  fila+=resumen.length+2;
  const g=[['GRUPO','Censo','Respondido','Participarán','Sin responder','Flores','Representantes']].concat(
    ['Hombres','Mujeres','Niños','Niñas'].map(x=>{const a=cen.filter(r=>str_(r[3])===x);
      return [x,a.length,a.filter(resp).length,a.filter(part).length,a.length-a.filter(resp).length,a.filter(flor).length,a.filter(esRep).length];}));
  s.getRange(fila,1,g.length,7).setValues(g);
  s.getRange(fila,1,1,7).setBackground(H).setFontColor(HT).setFontWeight('bold');
  fila+=g.length+2;
  s.getRange(fila,1).setValue('REPRESENTANTES ('+reps.length+')').setFontWeight('bold').setFontSize(12);fila++;
  const rt=[['ID','Nombre','Grupo','Cargos','Estado','Flor','Ramo']].concat(
    reps.map(x=>[x.id,x.nombre,x.grupo,x.cargos,x.estado,x.flor?'Sí':'',x.flor?(x.ramo||'Pendiente'):'']));
  s.getRange(fila,1,rt.length,7).setValues(rt);
  s.getRange(fila,1,1,7).setBackground(H).setFontColor(HT).setFontWeight('bold');
  if(reps.length){
    const est=s.getRange(fila+1,5,reps.length,1);
    s.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Asiste').setBackground('#e1f2e8').setFontColor('#1f6b45').setRanges([est]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Sin responder').setBackground('#fdf0d5').setFontColor('#8a5a00').setRanges([est]).build()]);
  }
  fila+=rt.length+2;
  const pend=cen.filter(r=>!resp(r));
  s.getRange(fila,1).setValue('FALLEROS SIN RESPONDER ('+pend.length+')').setFontWeight('bold').setFontSize(12);fila++;
  const pt=[['ID','Nombre','Apellidos','Grupo','Representante']].concat(pend.map(r=>[str_(r[0]),str_(r[1]),str_(r[2]),str_(r[3]),repTexto_(m.get(str_(r[0])))]));
  s.getRange(fila,1,pt.length,5).setValues(pt);
  s.getRange(fila,1,1,5).setBackground(H).setFontColor(HT).setFontWeight('bold');
  s.setFrozenRows(1);s.autoResizeColumns(1,7);
  return 'Dashboard actualizado';
}

/** Refresca el DASHBOARD cada 10 minutos (ejecutar una sola vez) */
function activarActualizacionAutomatica(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='actualizarDashboard').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('actualizarDashboard').timeBased().everyMinutes(10).create();
  return repAviso_('El DASHBOARD se actualizará solo cada 10 minutos.');
}
