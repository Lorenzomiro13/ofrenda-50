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
  catalogo:function(){return cargarFormulario('').personas;},

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
    return {id:r.id,nombre:r.nombre,grupo:r.grupo,estado:r.estado,codigo:mostrarCodigo_(limpiarCodigo_(d.codigo)),entregado:r.entregado||''};
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
      pendientes:r.pendientes
    };
  },

  // Tarjeta QR pública
  tarjeta:function(d){
    const r=cargarTarjetaQR(d.codigo);
    return {nombre:r.nombre,grupo:r.grupo,codigo:r.codigo,qrUrl:r.qrUrl,fecha:r.fecha,logo:r.logo};
  }
};
