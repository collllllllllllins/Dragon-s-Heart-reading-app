import {normalizeChapter,type Chapter} from './catalog';
import {bundledChapters} from './bundled-novels';
import {hasLargeStorage,readLibrary,writeLibrary} from './local-db';
const KEY='longxin-pages-test-chapters-v1';
async function readRows():Promise<Chapter[]>{
 let raw:unknown=hasLargeStorage()?await readLibrary('chapters'):undefined;
 if(raw===undefined){const legacy=localStorage.getItem(KEY);raw=legacy?JSON.parse(legacy):[];if(!Array.isArray(raw))throw Error('本机文稿格式无效，请先检查备份。');
  raw=[...raw,...bundledChapters.filter(b=>!(raw as Chapter[]).some(c=>c.id===b.id))];
  if(hasLargeStorage())await writeLibrary('chapters',raw);
 }
 if(!Array.isArray(raw))throw Error('本机文稿格式无效，请先检查备份。');return raw.map(normalizeChapter);
}
async function writeRows(rows:Chapter[]){if(hasLargeStorage())await writeLibrary('chapters',rows);else localStorage.setItem(KEY,JSON.stringify(rows));}
/** Serialized local writes prevent imports and catalog edits losing one another. */
let queue:Promise<unknown>=Promise.resolve();
export function localRequest(path:string,options:RequestInit={}):Promise<Response>{const task=queue.then(()=>request(path,options));queue=task.catch(()=>{});return task;}
async function request(path:string,options:RequestInit):Promise<Response>{
 try{
  const rows=await readRows(),method=options.method||'GET';
  if(method==='GET')return Response.json(rows);
  if(path==='/api/timelines'&&method==='PUT'){
   const {from,to}=JSON.parse(String(options.body));if(typeof from!=='string'||typeof to!=='string'||!to.trim()||to.length>60)return Response.json({error:'时间轴名称无效'},{status:400});
   await writeRows(rows.map(row=>({...row,...(row.timeline===from?{timeline:to,updatedAt:new Date().toISOString()}:{}),entryTimelines:row.entryTimelines?.map(t=>t===from?to:t)})));return Response.json({ok:true});
  }
  if(path==='/api/books'&&method==='PUT'){
   const {id,name}=JSON.parse(String(options.body));if(typeof id!=='string'||typeof name!=='string'||!name.trim()||name.length>60)return Response.json({error:'分卷名称无效'},{status:400});
   await writeRows(rows.map(row=>row.bookId===id?{...row,volume:name.trim(),updatedAt:new Date().toISOString()}:row));return Response.json({ok:true});
  }
  const id=path.split('/')[3];if(method==='DELETE'){await writeRows(rows.filter(r=>r.id!==id));return Response.json({ok:true});}
  const input=JSON.parse(String(options.body));if(!input||typeof input.volume!=='string')return Response.json({error:'请选择分卷'},{status:400});
  const data=normalizeChapter(input),novel=data.format==='visual-novel';
  if(typeof data.title!=='string'||!data.title.trim()||data.title.length>120||typeof data.timeline!=='string'||!data.timeline.trim()||data.timeline.length>60||typeof data.bookId!=='string'||!data.bookId||data.bookId.length>400||!data.volume.trim()||data.volume.length>60||typeof data.content!=='string'||(!novel&&!data.content.trim())||data.content.length>300000||!Number.isInteger(data.position)||data.position<1||data.position>999999||!['draft','published'].includes(data.status))return Response.json({error:'请填写标题、时间轴、分卷、序号与章节内容。'},{status:400});
  if(novel&&(!(typeof data.novelHtml==='string'&&data.novelHtml.trim()&&data.novelHtml.length<=25000000)&&data.novelPath!=='novels/white-shell.json'))return Response.json({error:'请导入完整 HTML 文件，每章最多 25 MB。'},{status:400});
  const previous=rows.find(r=>r.id===id);if(method==='PUT'&&!previous)return Response.json({error:'未找到文章，请刷新书房后重试。'},{status:404});
  const now=new Date().toISOString();
  const row:Chapter={id:method==='POST'?crypto.randomUUID():id,title:data.title.trim(),timeline:data.timeline.trim(),bookId:data.bookId,volume:data.volume.trim(),content:data.content.trim(),...(typeof data.html==='string'&&data.html.length<=2500000?{html:data.html}:{}),...(novel?{format:'visual-novel' as const,...(data.novelHtml?{novelHtml:data.novelHtml}:{}),...(data.novelPath==='novels/white-shell.json'?{novelPath:data.novelPath}:{}),novelFileName:typeof data.novelFileName==='string'?data.novelFileName.slice(0,180):'story.html'}:{}),entryTimelines:Array.isArray(data.entryTimelines)?data.entryTimelines.filter((v:unknown)=>typeof v==='string'&&v.length<=60):undefined,status:data.status,position:data.position,createdAt:previous?.createdAt||now,updatedAt:now};
  await writeRows([...rows.filter(r=>r.id!==row.id),row].sort((a,b)=>a.position-b.position||a.createdAt.localeCompare(b.createdAt)));return Response.json(row,{status:method==='POST'?201:200});
 }catch(e){return Response.json({error:(e as Error).name==='QuotaExceededError'?'本机空间不足，请导出备份后清理，或按章节拆分 HTML。':(e as Error).message?.startsWith('本机文稿格式')?(e as Error).message:'本机保存不可用，请检查浏览器是否允许网站存储。'},{status:500});}
}
