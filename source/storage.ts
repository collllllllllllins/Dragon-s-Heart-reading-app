import {normalizeChapter} from './catalog';
const KEY="longxin-pages-test-chapters-v1";
/** Local test adapter: no credentials, network API, or manuscript uploads. */
export async function localRequest(path:string,options:RequestInit={}):Promise<Response>{
 try {
  const raw=JSON.parse(localStorage.getItem(KEY)||"[]");
  const rows=Array.isArray(raw)?raw.map(normalizeChapter):raw;
  if(!Array.isArray(rows))throw Error("本机文稿格式无效，请先检查备份。");
  const method=options.method||"GET";
  if(method==="GET")return Response.json(rows);
  if(path==="/api/timelines"&&method==="PUT"){
   const {from,to}=JSON.parse(String(options.body));
   if(typeof from!=="string"||typeof to!=="string"||!to.trim()||to.length>60)return Response.json({error:"时间轴名称无效"},{status:400});
   const updated=rows.map((row:any)=>row.timeline===from?{...row,timeline:to,updatedAt:new Date().toISOString()}:row);
   localStorage.setItem(KEY,JSON.stringify(updated));return Response.json({ok:true});
  }
  if(path==="/api/books"&&method==="PUT"){
   const {id,name}=JSON.parse(String(options.body));
   if(typeof id!=="string"||typeof name!=="string"||!name.trim()||name.length>60)return Response.json({error:"分卷名称无效"},{status:400});
   localStorage.setItem(KEY,JSON.stringify(rows.map((row:any)=>row.bookId===id?{...row,volume:name.trim(),updatedAt:new Date().toISOString()}:row)));return Response.json({ok:true});
  }
  const id=path.split("/")[3];
  if(method==="DELETE"){
   localStorage.setItem(KEY,JSON.stringify(rows.filter((r:any)=>r.id!==id)));
   return Response.json({ok:true});
  }
  const input=JSON.parse(String(options.body));
  if(!input||typeof input.volume!=="string")return Response.json({error:"请选择分卷"},{status:400});
  const data=normalizeChapter(input);
  if(!data||typeof data.title!=="string"||typeof data.volume!=="string"||typeof data.timeline!=="string"||!data.timeline.trim()||data.timeline.length>60||typeof data.bookId!=="string"||!data.bookId||data.bookId.length>400||typeof data.content!=="string"||!data.title.trim()||!data.volume.trim()||!data.content.trim()||data.title.length>120||data.volume.length>60||data.content.length>300000||!Number.isInteger(data.position)||data.position<1||data.position>999999||!["draft","published"].includes(data.status))return Response.json({error:"请填写标题、时间轴、分卷、序号与正文，每章最多 30 万字符。"},{status:400});
  const previous=rows.find((r:any)=>r.id===id);
  if(method==="PUT"&&!previous)return Response.json({error:"未找到文章，请刷新书房后重试。"},{status:404});
  const now=new Date().toISOString();
  const row={id:method==="POST"?crypto.randomUUID():id,title:data.title.trim(),timeline:data.timeline.trim(),bookId:data.bookId,volume:data.volume.trim(),content:data.content.trim(),...(typeof data.html==='string'&&data.html.length<=2500000?{html:data.html}:{}),status:data.status,position:data.position,createdAt:previous?.createdAt||now,updatedAt:now};
  const next=[...rows.filter((r:any)=>r.id!==row.id),row].sort((a,b)=>a.position-b.position||a.createdAt.localeCompare(b.createdAt));
  localStorage.setItem(KEY,JSON.stringify(next));
  return Response.json(row,{status:method==="POST"?201:200});
 }catch(e){return Response.json({error:(e as Error).name==="QuotaExceededError"?"本机存储空间不足，请先导出备份，再清理不需要的测试文章。":"本机保存不可用，请检查浏览器是否允许网站存储。"},{status:500});}
}
