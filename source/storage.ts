const KEY="longxin-pages-test-chapters-v1";
/** Local test adapter: no credentials, network API, or manuscript uploads. */
export async function localRequest(path:string,options:RequestInit={}):Promise<Response>{
 try {
  const rows=JSON.parse(localStorage.getItem(KEY)||"[]");
  if(!Array.isArray(rows))throw Error("本机文稿格式无效，请先检查备份。");
  const method=options.method||"GET";
  if(method==="GET")return Response.json(rows);
  const id=path.split("/")[3];
  if(method==="DELETE"){
   localStorage.setItem(KEY,JSON.stringify(rows.filter((r:any)=>r.id!==id)));
   return Response.json({ok:true});
  }
  const data=JSON.parse(String(options.body));
  if(!data.title?.trim()||!data.volume?.trim()||!data.content?.trim()||data.content.length>300000||!Number.isInteger(data.position)||data.position<1||data.position>999999||!["draft","published"].includes(data.status))return Response.json({error:"请填写标题、分卷、序号与正文，每章最多 30 万字符。"},{status:400});
  const previous=rows.find((r:any)=>r.id===id);
  if(method==="PUT"&&!previous)return Response.json({error:"未找到文章，请刷新书房后重试。"},{status:404});
  const now=new Date().toISOString();
  const row={id:method==="POST"?crypto.randomUUID():id,title:data.title.trim(),volume:data.volume.trim(),content:data.content.trim(),status:data.status,position:data.position,createdAt:previous?.createdAt||now,updatedAt:now};
  const next=[...rows.filter((r:any)=>r.id!==row.id),row].sort((a,b)=>a.position-b.position||a.createdAt.localeCompare(b.createdAt));
  localStorage.setItem(KEY,JSON.stringify(next));
  return Response.json(row,{status:method==="POST"?201:200});
 }catch(e){return Response.json({error:(e as Error).name==="QuotaExceededError"?"本机存储空间不足，请先导出备份，再清理不需要的测试文章。":"本机保存不可用，请检查浏览器是否允许网站存储。"},{status:500});}
}
