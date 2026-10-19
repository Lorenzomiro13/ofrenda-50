export default async (request) => {
 const headers={ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff' };
 const respond=(code,data)=>new Response(JSON.stringify(data),{status:code,headers});
 if(request.method!=='POST')return respond(405,{ok:false,error:'Método no permitido'});
 if(!process.env.APPS_SCRIPT_URL||!process.env.OFRENDA_API_KEY)return respond(503,{ok:false,error:'Configura APPS_SCRIPT_URL y OFRENDA_API_KEY en Netlify'});
 try{
  const x=await request.json(),allowed=['catalogo','inscribir','editar','consulta','entregar','estadisticas','tarjeta'];
  if(!allowed.includes(x.action))return respond(400,{ok:false,error:'Acción inválida'});
  const restricted=['consulta','entregar','estadisticas'];
  if(restricted.includes(x.action)&&(!x.data?.pin||String(x.data.pin).length<8))return respond(403,{ok:false,error:'Se requiere PIN administrativo'});
  const ctl=new AbortController(),id=setTimeout(()=>ctl.abort(),26000);
  try{
   const url=process.env.APPS_SCRIPT_URL.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url))return respond(503,{ok:false,error:'URL de Apps Script inválida'});
   const result=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({apiKey:process.env.OFRENDA_API_KEY,action:x.action,data:x.data||{}}),redirect:'follow',signal:ctl.signal});
   const txt=await result.text();let payload;try{payload=JSON.parse(txt)}catch{throw Error('Respuesta no válida de Apps Script. Verifica la implementación /exec y los permisos.');}
   return respond(payload.ok?200:400,payload);
  }finally{clearTimeout(id)}
 }catch(e){return respond(502,{ok:false,error:String(e.message||e)})}
};
export const config={path:'/api'};
