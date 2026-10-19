"use client";
import Reading from "./reading";
import RichEditor from "./rich-editor";
import VolumeShelf from "./volume-shelf";
import {readVolumeNames,writeVolumeNames} from "./volumes";
import {readAnnotations,writeAnnotations} from "./format";
import {localRequest} from "./storage";
import {useEffect,useRef,useState,useCallback} from "react";
import {ArrowLeft,ArrowRight,BookOpen,Check,Download,Feather,FileText,LoaderCircle,Plus,Search,Upload,X} from "lucide-react";

type Chapter={id:string;title:string;volume:string;content:string;html?:string;status:"draft"|"published";position:number;createdAt:string;updatedAt:string};
type Form={id?:string;title:string;volume:string;content:string;html?:string;position:number;status:"draft"|"published"};
const demo:Chapter={id:"sample",title:"从这里，翻开龙心",volume:"阅读示例",status:"published",position:0,createdAt:"",updatedAt:"",content:`欢迎来到《龙心》掌上书房的独立阅读测试版。

这是一篇功能说明，并非《龙心》原作。它用来测试手机访问、横向分页、字号调整、纸色与进度记忆。测试页不依赖 ChatGPT 登录，也不连接原书房的数据库。

一 · 先翻开一页

在手机上，向左轻扫进入下一页，向右轻扫回到上一页。你也可以点按页面两侧，或点击下方的翻页按钮。电脑上则可以使用左右方向键。

页面会根据设备屏幕和字号自动排版。请特别留意每一页的末尾和下一页的开头，看看句子是否连续，是否出现漏字、截断或重叠。

二 · 调整阅读习惯

点击右上角的设置图标，选择你喜欢的字号、行距与纸色。纸本色适合明亮环境；夜读色降低画面亮度；青灰色给页面一点草木的气息。

改变字号或旋转手机后，页数会重新计算，并尽量保留相对阅读位置。偏好和阅读进度只保存在当前浏览器。

三 · 试读自己的 TXT

回到书房，点击“发布文章”，填入标题、分卷与章节序号。你可以粘贴一段文字，也可以导入 UTF-8 编码的 TXT 文件。选择“保存草稿”会把文章放在文稿管理中；选择“发布文章”会把它放进这台设备的阅读目录。

测试版的文章仅保存在当前浏览器，不上传到 GitHub，不会自动公开给其他访客。更换设备、清除网站数据或使用其他浏览器，都可能看不到这些本机文章。请始终保留原始文稿，重要内容可以通过“文稿”里的“导出备份”保存。

四 · 分卷与目录

你可以为不同章节填写同一个分卷名，并用章节序号安排阅读顺序。首页按卷展示独立入口，也能通过关键词寻找分卷和文章。

阅读时点击右上角的目录图标，可以打开本卷已发布章节列表。上下章都只在同一卷内切换，读完本卷就会停下。章节的修改与删除都在“文稿”中完成。

五 · 怎样判断测试成功

首先，手机浏览器能够打开这个地址，而不是停在拦截页。其次，这篇说明能够自然翻页，正文连续且可读。最后，调整字号与纸色、关闭阅读页再打开，页面仍能工作，阅读位置也能在同一浏览器里恢复。

这一步只测试独立地址与手机阅读体验。云端跨设备同步、作者发布权限和面向读者的更新，需要后续单独接入。

六 · 添加到主屏幕

你可以在手机浏览器菜单中查找“添加到主屏幕”。入口名称会因浏览器而异。本版没有离线缓存，首次打开与加载页面仍需要网络。

试着把这本书翻到最后一页，然后回到目录。希望下一次，这里展开的就是你亲手写下的世界。

七 · 背景与批注

阅读设置中可以一次添加多张背景图，并调整纸色遮罩和模糊程度。背景按分卷记忆，只保存到本机图库。

选中一段正文，点击“批注这段”，就能写下自己的想法。也可以从阅读页上方的批注图标添加本章随记。批注会在引用处高亮，点击引用可以定位回原文。导出文稿备份时，富文本格式与各章批注都会被保留；背景原图需另外保存。

让故事在这里，一页一页地生长。`};
const blank=(position:number):Form=>({title:"",volume:"正文",content:"",position,status:"draft"});
const count=(s:string)=>s.replace(/\s/g,"").length;
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function readLocal(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function saveLocal(key:string,value:string){try{localStorage.setItem(key,value);}catch{}}
function removeLocal(key:string){try{localStorage.removeItem(key);}catch{}}

export default function ReaderApp(){
 const [chapters,setChapters]=useState<Chapter[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const [tab,setTab]=useState("书房"),[filter,setFilter]=useState(""),[query,setQuery]=useState("");
 const [active,setActive]=useState<Chapter|null>(null),[editor,setEditor]=useState<Form|null>(null),[saving,setSaving]=useState(false),[toast,setToast]=useState("");
 const [recovery,setRecovery]=useState<Form|null>(null),[lastRead,setLastRead]=useState(""),[help,setHelp]=useState(false),[importing,setImporting]=useState(false);
 const [volumeNames,setVolumeNames]=useState<string[]>([]);
 const fileRef=useRef<HTMLInputElement>(null),backupRef=useRef<HTMLInputElement>(null);
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await localRequest("/api/chapters",{cache:"no-store"});const data=await r.json() as Chapter[] & {error?:string};if(!r.ok)throw Error(data.error||"暂时无法读取书房。");setChapters(data);setVolumeNames([...new Set([...readVolumeNames(),...data.map(c=>c.volume)])]);}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
 useEffect(()=>{load();try{const d=readLocal("longxin-writing");if(d)setRecovery(JSON.parse(d));setLastRead(readLocal("longxin-last")||"");}catch{}},[load]);
 useEffect(()=>{if(editor)saveLocal("longxin-writing",JSON.stringify(editor));},[editor]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),3600);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{document.body.style.overflow=active||editor||help?"hidden":"";return()=>{document.body.style.overflow="";};},[active,editor,help]);
 useEffect(()=>{if(!active&&!editor&&!help)return;const previous=document.activeElement as HTMLElement;const scope=()=>document.querySelector<HTMLElement>(".modal-backdrop .modal")||document.querySelector<HTMLElement>(".reader-panel")||document.querySelector<HTMLElement>(".reader");const list=()=>Array.from(scope()?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([hidden]):not([type="file"]):not([disabled]),textarea,[contenteditable="true"]')||[]).filter(el=>el.getClientRects().length>0);const timer=setTimeout(()=>list()[0]?.focus(),30);const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&(editor||help)){event.preventDefault();if(saving)return;if(editor){setRecovery(editor);setEditor(null);}else setHelp(false);}if(event.key!=="Tab")return;const elements=list(),first=elements[0],last=elements[elements.length-1];if(event.shiftKey&&(document.activeElement===first||!scope()?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!scope()?.contains(document.activeElement))){event.preventDefault();first?.focus();}};document.addEventListener("keydown",key);return()=>{clearTimeout(timer);document.removeEventListener("keydown",key);previous?.focus();};},[!!active,!!editor,help,saving]);
 const published=chapters.filter(c=>c.status==="published"),volumes=volumeNames;
 const shown=(tab==="书房"?published:chapters).filter(c=>(!!filter&&c.volume===filter)&&(!query||`${c.title} ${c.volume} ${c.content}`.includes(query)));
 const nextPosition=Math.max(0,...chapters.filter(c=>c.volume===(filter||volumeNames[0]||"正文")).map(c=>c.position))+1;
 function open(c:Chapter){setActive(c);if(c.id!=="sample")setFilter(c.volume);if(c.id!=="sample"){setLastRead(c.id);saveLocal("longxin-last",c.id);}}
 function startEdit(c?:Chapter){setEditor(c?{id:c.id,title:c.title,volume:c.volume,content:c.content,html:c.html,position:c.position,status:c.status}:{...blank(nextPosition),volume:filter||volumeNames[0]||"正文"});}
 async function save(status:"draft"|"published"){
  if(!editor||saving)return;setSaving(true);try{const r=await localRequest(editor.id?`/api/chapters/${editor.id}`:"/api/chapters",{method:editor.id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...editor,status})});const data=await r.json() as Chapter & {error?:string};if(!r.ok)throw Error(data.error||"保存未成功。");setChapters(old=>[...old.filter(c=>c.id!==data.id),data].sort((a,b)=>a.position-b.position||a.createdAt.localeCompare(b.createdAt)));removeLocal("longxin-writing");setRecovery(null);setEditor(null);const names=[...new Set([...volumeNames,data.volume])];writeVolumeNames(names);setVolumeNames(names);setToast(status==="draft"?"草稿已保存到本机":"文章已放入阅读目录");}catch(e){setToast((e as Error).message);}finally{setSaving(false);}
 }
 async function remove(c:Chapter){if(!confirm(`删除《${c.title}》？建议先导出备份。此操作无法撤销。`))return;try{const r=await localRequest(`/api/chapters/${c.id}`,{method:"DELETE"});if(!r.ok)throw Error("删除未成功，请重试。");setChapters(old=>old.filter(x=>x.id!==c.id));setToast("文章已删除");}catch(e){setToast((e as Error).message);}}
 async function importTxt(file?:File){if(!file)return;if(file.size>1500000){setToast("文件过大，请分章导入。");return;}const content=await file.text();if(content.includes("\uFFFD")){setToast("文件编码无法识别，请另存为 UTF-8 编码的 TXT。");return;}setEditor(old=>({...old||blank(nextPosition),content,html:undefined,title:old?.title||file.name.replace(/\.txt$/i,"")}));}
 async function importBackup(file?:File){if(!file)return;let done=0;setImporting(true);try{if(file.size>20000000)throw Error("备份过大，请拆分后导入。");const data=JSON.parse(await file.text());if(data.format!=="longxin-backup-v1"||!Array.isArray(data.chapters)||data.chapters.length>1000)throw Error("请选择从书房导出的 JSON 备份（最多 1000 章）。");if(!confirm(`将创建 ${data.chapters.length} 篇文章，不会覆盖已有文章。继续导入？`))return;for(const chapter of data.chapters){const r=await localRequest("/api/chapters",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(chapter)});if(!r.ok)throw Error(`已导入 ${done} 篇；后续导入失败。请检查文章内容后重试，避免重复导入。`);const imported=await r.json() as Chapter;if(Array.isArray(chapter.annotations)){const notes=chapter.annotations.filter((n:any)=>n&&typeof n.body==="string"&&typeof n.quote==="string").map((n:any)=>({...n,id:crypto.randomUUID(),chapterId:imported.id}));writeAnnotations(imported.id,notes);}done++;}const names=[...new Set([...readVolumeNames(),...(Array.isArray(data.volumes)?data.volumes.filter((v:any)=>typeof v==="string"&&v.trim()&&v.length<=60):[])])];writeVolumeNames(names);setToast(`已导入 ${done} 篇文章（含已有批注）`);}catch(e){setToast((e as Error).message);}finally{await load();setImporting(false);}}
 function createVolume(){const name=prompt("新卷名称（最多 60 字）")?.trim();if(!name)return;if(name.length>60){setToast("卷名请控制在 60 字以内。");return;}if(volumeNames.includes(name)){setToast("这一卷已经在书架上了。");return;}try{const names=[...volumeNames,name];writeVolumeNames(names);setVolumeNames(names);setToast("新卷已建立");}catch{setToast("分卷保存失败，请检查浏览器存储。");}}
 async function renameVolume(from:string){const to=prompt("修改卷名",from)?.trim();if(!to||to===from)return;if(to.length>60||volumeNames.includes(to)){setToast("卷名过长或已经存在。");return;}try{const r=await localRequest("/api/volumes",{method:"PUT",body:JSON.stringify({from,to})});if(!r.ok)throw Error("重命名未成功。");const names=volumeNames.map(n=>n===from?to:n);writeVolumeNames(names);setVolumeNames(names);setChapters(old=>old.map(c=>c.volume===from?{...c,volume:to}:c));if(filter===from)setFilter(to);const bg=readLocal("longxin-background-"+from);if(bg)saveLocal("longxin-background-"+to,bg);setToast("卷名已更新，原有章节已归入新卷名");}catch{setToast("重命名失败，请重试。");}}
 function removeVolume(name:string){if(chapters.some(c=>c.volume===name)){setToast("请先移动或删除卷内文稿。");return;}if(!confirm(`移除空卷“${name}”？`))return;try{const names=volumeNames.filter(n=>n!==name);writeVolumeNames(names);setVolumeNames(names);}catch{setToast("移除失败，请重试。");}}
 const resumed=chapters.find(c=>c.id===lastRead&&c.status==="published");
 return <div className="app-shell">
  <header className="site-header"><a className="brand" href="./" aria-label="龙心书房首页"><span className="brand-seal">龙</span><span>龙心<span className="brand-sub">掌上书房</span></span></a><nav><button className={tab==="书房"?"selected":""} onClick={()=>{setTab("书房");setFilter("");}}>书房</button><button className={tab==="文稿"?"selected":""} onClick={()=>{setTab("文稿");setFilter("");}}>文稿</button></nav><button className="write-btn" onClick={()=>startEdit()}><Feather size={16}/><span>发布文章</span></button></header>
  <main>
   <section className="hero"><div className="hero-copy"><span className="eyebrow"><i/>梅百城 · 长篇作品</span><h1>漫长的故事，<br/>读进<span>掌心。</span></h1><p>在一页与下一页之间，<br className="mobile-br"/>重返那个仍在生长的世界。</p><button className="hero-read" onClick={()=>open(resumed||published[0]||demo)}>{resumed?"继续上次阅读":published.length?"从第一章开始":"体验翻页阅读"}<ArrowRight size={17}/></button><div className="hero-stat"><span>{published.length.toString().padStart(2,"0")} <small>已发布章节</small></span><b>·</b><span>{volumes.length.toString().padStart(2,"0")} <small>分卷</small></span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="moon"/><div className="art-lines"/><span className="art-title">龙<br/>心</span><span className="art-vertical">千年流转　故事长明</span><span className="art-foot">THE HEART OF THE DRAGON</span></div></section>
   <section className="library"><div className="section-heading"><div><span className="eyebrow dark">{tab==="书房"?"THE VOLUMES":"THE WRITING DESK"}</span><h2>{filter|| (tab==="书房"?"分卷书架":"文稿管理")}<span>{tab==="书房"?"故事，从这里展开":"每一章，都值得妥善安放"}</span></h2></div><button className="quiet-btn" onClick={()=>setHelp(true)}><BookOpen size={15}/><span>使用指南</span></button></div>
    {recovery&&!editor&&<div className="recovery"><span>还有一份未保存的文稿：{recovery.title||"无标题"}</span><button onClick={()=>setEditor(recovery)}>继续编辑</button><button aria-label="丢弃未保存的副本" onClick={()=>{if(confirm("丢弃这份未保存的本机副本？")){removeLocal("longxin-writing");setRecovery(null);}}}><X size={16}/></button></div>}
    <div className="filter-row"><div className="filters">{filter?<><button className="active" onClick={()=>{setFilter("");setQuery("");}}>← 分卷书架</button><span className="selected-volume-name">{filter} · 独立目录</span></>:<span className="shelf-caption">每一卷，各自展开</span>}</div><label className="search"><Search size={16}/><input aria-label="搜索文章" placeholder={filter?"寻找本卷章节…":"寻找分卷或章节…"} value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    {tab==="文稿"&&<div className="backup-tools"><span>{chapters.length} 篇文章 · {count(chapters.map(c=>c.content).join("")).toLocaleString()} 字</span><div><button onClick={()=>download(`龙心备份-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({format:"longxin-backup-v1",exportedAt:new Date().toISOString(),volumes:volumeNames,chapters:chapters.map(c=>({...c,annotations:readAnnotations(c.id)}))},null,2),"application/json")} disabled={loading||!!error||!chapters.length}><Download size={14}/>导出备份</button><button onClick={()=>backupRef.current?.click()} disabled={importing||loading||!!error}><Upload size={14}/>{importing?"正在导入…":"导入备份"}</button></div><input type="file" ref={backupRef} accept=".json,application/json" hidden onChange={e=>{importBackup(e.target.files?.[0]);e.target.value="";}}/></div>}
    {loading?<div className="state-box"><LoaderCircle className="spin"/>正在打开书房…</div>:error?<div className="state-box"><p>{error}</p><button className="solid-btn" onClick={load}>重新加载</button><span>本版需要浏览器允许本机存储。</span></div>:!filter?<VolumeShelf names={volumeNames} chapters={chapters} query={query} onOpen={name=>{setFilter(name);setQuery("");}} onCreate={createVolume} onRename={renameVolume} onDelete={removeVolume}/>:shown.length?<div className="chapter-list">{shown.map((c,i)=><div className="chapter-row" key={c.id}><button className="chapter-main" onClick={()=>open(c)}><span className="chapter-num">{(i+1).toString().padStart(2,"0")}</span><span className="chapter-info"><span className="chapter-meta">{c.volume}{c.status==="draft"&&<em>草稿</em>}</span><strong>{c.title}</strong><span className="chapter-preview">{c.content.replace(/\n/g," ").slice(0,62)}</span><span className="chapter-details">{count(c.content).toLocaleString()} 字 <i/> 约 {Math.max(1,Math.ceil(count(c.content)/500))} 分钟</span></span><ArrowRight className="row-arrow" size={19}/></button>{tab==="文稿"&&<div className="row-actions"><button onClick={()=>startEdit(c)}>编辑</button><button onClick={()=>download(`${c.title.replace(/[\\/:*?"<>|]/g,"-")}.txt`,`${c.title}\n\n${c.content}`,"text/plain;charset=utf-8")}>TXT</button><button className="delete-btn" onClick={()=>remove(c)}>删除</button></div>}</div>)}</div>:<div className="empty-library"><div className="empty-book"><BookOpen size={35} strokeWidth={1}/></div><h3>{query?"还没有找到这一章":tab==="书房"?"故事，等待第一章":"写下故事的起点"}</h3><p>{query?"换一个关键词或分卷试试。":"测试版 · TXT 仅保存在当前浏览器。"}<br/>{!query&&"放进这一卷的第一章，目录就会在这里展开。"}</p><button className="solid-btn" onClick={()=>startEdit()}><Plus size={16}/>放入第一篇文章</button></div>}
    {tab==="书房"&&<button className="sample-card" onClick={()=>open(demo)}><span className="sample-icon"><BookOpen size={23} strokeWidth={1.3}/></span><span><small>先翻开看看</small><strong>一份关于阅读的邀请</strong><span>体验翻页、纸色与字号设置 · 功能示例，非原作</span></span><ArrowRight size={19}/></button>}
   </section>
   <section className="closing"><span>「</span><p>让故事在这里，<br/>一页一页地生长。</p><span className="closing-seal">百城</span></section>
  </main><footer className="site-footer"><span>龙心 · 梅百城</span><span>本机测试书房 <i/> 为长久的阅读而作</span><button onClick={()=>setHelp(true)}>关于书房 <ArrowRight size={12}/></button></footer>
  <div className="mobile-nav"><button className={tab==="书房"?"active":""} onClick={()=>{setTab("书房");setFilter("");}}><BookOpen size={20}/>书房</button><button className="mobile-add" onClick={()=>startEdit()} aria-label="发布文章"><Plus size={22}/></button><button className={tab==="文稿"?"active":""} onClick={()=>{setTab("文稿");setFilter("");}}><FileText size={20}/>文稿</button></div>
  {active&&<Reading chapter={active} chapters={chapters.filter(c=>c.status==="published"||c.id===active.id)} onClose={()=>setActive(null)} onOpen={open} onEdit={()=>{startEdit(active);setActive(null);}}/>}
  {editor&&<div className="modal-backdrop"><section className="editor modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><header><div><small>THE WRITING DESK</small><h2 id="editor-title">{editor.id?"编辑文章":"一篇新的故事"}</h2></div><button className="icon-btn" aria-label="关闭编辑器" onClick={()=>{setRecovery(editor);setEditor(null);}} disabled={saving}><X/></button></header><div className="editor-body"><div className="editor-note"><span className="small-dot"/>测试版 · 文章仅保存在当前浏览器，请保留原稿与备份</div><label>章节标题<input autoFocus placeholder="给这一章一个名字" value={editor.title} maxLength={120} onChange={e=>setEditor({...editor,title:e.target.value})}/></label><div className="form-pair"><label>所属分卷<input list="volume-options" maxLength={60} value={editor.volume} onChange={e=>setEditor({...editor,volume:e.target.value})}/><datalist id="volume-options">{volumeNames.map(v=><option key={v} value={v}/>)}</datalist></label><label>章节序号<input type="number" min="1" max="999999" value={editor.position||""} onChange={e=>setEditor({...editor,position:Number(e.target.value)})}/></label></div><div className="text-label"><span>正文</span><button onClick={()=>fileRef.current?.click()}><Upload size={14}/>导入 TXT</button></div><input hidden ref={fileRef} type="file" accept=".txt,text/plain" onChange={e=>{importTxt(e.target.files?.[0]);e.target.value="";}}/><RichEditor html={editor.html} text={editor.content} onChange={(html,content)=>setEditor(current=>current?{...current,html,content}:null)}/><div className="text-count">{count(editor.content).toLocaleString()} 字 · 富文本排版</div></div><footer><button className="outline-btn" disabled={saving||!editor.title.trim()||!editor.content.trim()} onClick={()=>save("draft")}>保存草稿</button><button className="solid-btn" disabled={saving||!editor.title.trim()||!editor.content.trim()} onClick={()=>save("published")}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}发布文章</button></footer></section></div>}
  {help&&<div className="modal-backdrop"><section className="help modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><h2 id="help-title">欢迎来到掌上书房</h2><button className="icon-btn" onClick={()=>setHelp(false)} aria-label="关闭指南"><X/></button></header><div className="help-body"><span className="help-mark">龙心</span><h3>从第一章开始。</h3><ol><li><strong>放入正文</strong><p>先从书架选择分卷。发布文章时，可直接粘贴 Word 正文，或导入 UTF-8 TXT；填写本卷章节序号。</p></li><li><strong>保存或发布</strong><p>草稿留在文稿中；发布后进入书房目录。“发布文章”不会将正文上传到网络。</p></li><li><strong>翻页阅读</strong><p>目录和上下章只在本卷内切换。阅读设置里可选择多张本机背景；选中正文后可添加批注，也可以写本章随记。</p></li></ol><p className="help-note">测试页可公开访问；导入的文章仅保存在当前浏览器，不上传。手机浏览器的分享或菜单中可查找“添加到主屏幕”。本版需联网使用。</p><button className="solid-btn" onClick={()=>{setHelp(false);open(demo);}}>体验阅读 <ArrowRight size={16}/></button></div></section></div>}
  {toast&&<div className="toast" role="status">{toast}</div>}
 </div>;
}

