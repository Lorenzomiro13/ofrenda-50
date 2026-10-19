/**
 * OFRENDA 50 — Conexión con Netlify (Api.gs)
 * Añadir como ARCHIVO NUEVO junto al Código.gs actual. No sustituye nada:
 * usa las funciones que ya existen (cargarFormulario, enviarInscripcion,
 * estadoQR, confirmarRamo, panelDatos, cargarTarjetaQR), así los QR,
 * el PIN y los enlaces de edición ya enviados siguen funcionando.
 *
 * Requisito: Configuración del proyecto › Propiedades del script › API_KEY
 * (la misma clave que se pone en Netlify como OFRENDA_API_KEY).
 */
function doPost(e){
  try{
    const q=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    const key=PropertiesService.getScriptProperties().getProperty('API_KEY');
    if(!key||q.apiKey!==key)throw Error('No autorizado');
    const fn=API_[q.action];
    if(!fn)throw Error('Acción no permitida');
    return apiJson_({ok:true,data:fn(q.data||{})});
  }catch(err){
    console.error(err);
    return apiJson_({ok:false,error:String((err&&err.message)||err)});
  }
}
function apiJson_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}

const API_={
  // Lista de falleros para el buscador
  catalogo:function(){
    const m=repMapa_();
    return cargarFormulario('').personas.map(p=>m.has(p.id)?Object.assign({},p,{rep:repTexto_(m.get(p.id))}):p);
  },

  // Datos de una inscripción a partir del enlace de edición
  editar:function(d){
    const r=cargarFormulario(str_(d.token));
    if(!r.edicion)throw Error('Enlace no válido');
    return r.edicion;
  },

  // Guardar inscripción (envía el correo con las tarjetas)
  inscribir:function(d){
    const r=enviarInscripcion({email:d.email,personas:d.personas,token:d.token||''});
    return {mensaje:'Respuesta guardada',aviso:r.aviso||''};
  },

  // Lector: consultar un código
  consulta:function(d){
    const r=estadoQR(d.pin,d.codigo);
    if(!r||!r.nombre)throw Error('Código no encontrado');
    return {id:r.id,nombre:r.nombre,grupo:r.grupo,estado:r.estado,codigo:mostrarCodigo_(limpiarCodigo_(d.codigo)),entregado:r.entregado||'',rep:repTexto_(repMapa_().get(r.id))};
  },

  // Lector: registrar la entrega
  entregar:function(d){
    const antes=estadoQR(d.pin,d.codigo);
    if(!antes||!antes.nombre)throw Error('Código no encontrado');
    if(antes.estado!=='Pendiente')throw Error('No se puede entregar: '+antes.estado);
    const r=confirmarRamo(d.pin,d.codigo,str_(d.voluntario)||'Sin nombre');
    if(r.estado!=='Entregado')throw Error('No se pudo registrar: '+r.estado);
    return {nombre:r.nombre,estado:'Entregado'};
  },

  // Panel de la comisión
  estadisticas:function(d){
    const r=panelDatos(d.pin);
    return {
      total:r.total,respuestas:r.respondido,participan:r.participan,flores:r.flores,entregados:r.entregados,
      grupos:r.grupos.map(g=>({grupo:g.grupo,censo:g.censo,respondido:g.respondido,participa:g.participan,flores:g.flores})),
      pendientes:r.pendientes,
      representantes:repPanel_(),
      personas:apiPersonas_()
    };
  },

  // Panel: reenviar la tarjeta QR por correo (genera un código nuevo; el anterior deja de valer)
  reenviar:function(d){
    comprobarPIN_(d.pin);
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try{
      const id=str_(d.id),fila=valores_(hoja_(APP.sheets.censo),APP.hc.length).find(r=>str_(r[0])===id);
      if(!fila)throw Error('Fallero no encontrado');
      if(str_(fila[5])!=='Respondido'||str_(fila[6])!=='Sí'||str_(fila[7])!=='Sí')throw Error('Solo se puede reenviar a quien participa y lleva flor');
      const email=str_(d.email||fila[8]).toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Correo no válido');
      const token=actualizarVoucher_(id,true);
      if(!token)throw Error('Este ramo ya se ha entregado');
      const web=(configurar_('WEBAPP_URL','')||ScriptApp.getService().getUrl()||'').replace(/\/$/,'');
      correo_(email,[{nombre:str_(fila[1])+' '+str_(fila[2]),participa:true,flor:true,qr:token}],web);
      try{hoja_('AUDITORIA_RAMOS').appendRow([new Date(),id,'Reenvío QR a '+email,'Panel web']);}catch(e){}
      return {email:email};
    }finally{lock.releaseLock();}
  },

  // Tarjeta QR pública
  tarjeta:function(d){
    const r=cargarTarjetaQR(d.codigo);
    return {nombre:r.nombre,grupo:r.grupo,codigo:r.codigo,qrUrl:r.qrUrl,fecha:r.fecha,logo:r.logo};
  }
};

/** Lista completa de falleros activos para el panel */
function apiPersonas_(){
  const m=repMapa_(),qr=new Map(qrDatos_().map(r=>[str_(r[0]),str_(r[2])]));
  return valores_(hoja_(APP.sheets.censo),APP.hc.length).filter(r=>str_(r[0])&&str_(r[4])==='Sí').map(r=>{
    const id=str_(r[0]),resp=str_(r[5])==='Respondido',f=r[9];
    return {id,nombre:str_(r[1])+' '+str_(r[2]),grupo:str_(r[3]),rep:repTexto_(m.get(id)),
      estado:!resp?'Sin responder':(str_(r[6])==='Sí'?'Asiste':'No asiste'),
      flor:str_(r[6])==='Sí'&&str_(r[7])==='Sí',ramo:qr.get(id)||'',email:str_(r[8]),
      fecha:f instanceof Date?Utilities.formatDate(f,'Europe/Madrid','dd/MM HH:mm'):''};
  }).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
}
