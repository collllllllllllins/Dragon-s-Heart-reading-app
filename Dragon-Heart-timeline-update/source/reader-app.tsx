"use client";
import Reading from './reading';
import RichEditor from './rich-editor';
import VolumeShelf from './volume-shelf';
import {normalizeChapter,normalizeCatalog,readCatalog,writeCatalog,uniqueNames,type Book,type Catalog,type Chapter} from './catalog';
import {readAnnotations,writeAnnotations} from './format';
import {localRequest} from './storage';
import {useEffect,useRef,useState,useCallback} from 'react';
import {ArrowLeft,ArrowRight,BookOpen,Check,Download,Feather,FileText,LoaderCircle,Plus,Search,Upload,X} from 'lucide-react';
type Form=Omit<Chapter,'id'|'createdAt'|'updatedAt'>&{id?:string};
type BookForm={id?:string;name:string;timelines:string[]};
const demo:Chapter={id:"sample",title:"从这里，翻开龙心",timeline:"阅读示例",bookId:"sample",volume:"阅读指南",status:"published",position:0,createdAt:"",updatedAt:"",content:`欢迎来到《龙心》掌上书房的独立阅读测试版。

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

发布章节时填写所属分卷及本章时间轴，用全书章节序号安排阅读顺序。首页先按元年、一千、两千等时间轴展示入口，其下再按书名或分卷进入目录。同一分卷可以收录在多个时间轴下，共用一套章节与批注，不必重复上传。

阅读时点击右上角的目录图标，可以打开本卷已发布章节列表。上下章只在同一分卷内按序切换，可以跨越章节自身的时间轴；读完本卷就会停下。章节的修改与删除都在“文稿”中完成。

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

const blank=(timeline:string,book:Book|undefined,position:number):Form=>({title:'',timeline,bookId:book?.id||'',volume:book?.name||'',content:'',position,status:'draft'});
const count=(s:string)=>s.replace(/\s/g,'').length;
function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
function readLocal(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function saveLocal(key:string,value:string){try{localStorage.setItem(key,value);}catch{}}
function removeLocal(key:string){try{localStorage.removeItem(key);}catch{}}
export default function ReaderApp(){
 const [chapters,setChapters]=useState<Chapter[]>([]),[catalog,setCatalog]=useState<Catalog>({timelines:[],books:[]}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [tab,setTab]=useState('书房'),[filter,setFilter]=useState(''),[bookFilter,setBookFilter]=useState(''),[query,setQuery]=useState('');
 const [active,setActive]=useState<Chapter|null>(null),[editor,setEditor]=useState<Form|null>(null),[bookEditor,setBookEditor]=useState<BookForm|null>(null),[saving,setSaving]=useState(false),[toast,setToast]=useState('');
 const [recovery,setRecovery]=useState<Form|null>(null),[lastRead,setLastRead]=useState(''),[help,setHelp]=useState(false),[importing,setImporting]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null),backupRef=useRef<HTMLInputElement>(null);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await localRequest('/api/chapters',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'暂时无法读取书房。');setChapters(data);setCatalog(readCatalog(data));}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
 useEffect(()=>{load();try{const d=readLocal('longxin-writing');if(d)setRecovery(normalizeChapter(JSON.parse(d)));setLastRead(readLocal('longxin-last')||'');}catch{}},[load]);
 useEffect(()=>{if(editor)saveLocal('longxin-writing',JSON.stringify(editor));},[editor]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{document.body.style.overflow=active||editor||help||bookEditor?'hidden':'';return()=>{document.body.style.overflow='';};},[active,editor,help,bookEditor]);
 useEffect(()=>{if(!active&&!editor&&!help&&!bookEditor)return;const previous=document.activeElement as HTMLElement;const scope=()=>document.querySelector<HTMLElement>('.modal-backdrop .modal')||document.querySelector<HTMLElement>('.reader-panel')||document.querySelector<HTMLElement>('.reader');const list=()=>Array.from(scope()?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([hidden]):not([type="file"]):not([disabled]),select,textarea,[contenteditable="true"]')||[]).filter(el=>el.getClientRects().length>0);const timer=setTimeout(()=>list()[0]?.focus(),30);const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&(editor||help||bookEditor)){event.preventDefault();if(saving)return;if(editor){setRecovery(editor);setEditor(null);}else if(bookEditor)setBookEditor(null);else setHelp(false);}if(event.key!=='Tab')return;const elements=list(),first=elements[0],last=elements[elements.length-1];if(event.shiftKey&&(document.activeElement===first||!scope()?.contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&(document.activeElement===last||!scope()?.contains(document.activeElement))){event.preventDefault();first?.focus();}};document.addEventListener('keydown',key);return()=>{clearTimeout(timer);document.removeEventListener('keydown',key);previous?.focus();};},[!!active,!!editor,help,!!bookEditor,saving]);
 const currentBook=catalog.books.find(b=>b.id===bookFilter),published=chapters.filter(c=>c.status==='published'),source=tab==='书房'?published:chapters;
 const matches=(text:string)=>!query||text.includes(query);
 const shown=source.filter(c=>c.bookId===bookFilter&&matches(`${c.title} ${c.timeline} ${c.content}`)).sort((a,b)=>a.position-b.position||a.createdAt.localeCompare(b.createdAt));
 const timelineItems=catalog.timelines.filter(t=>matches(t)||catalog.books.some(b=>b.timelines.includes(t)&&matches(b.name))||source.some(c=>c.timeline===t&&matches(`${c.title} ${c.content}`))).map(t=>({id:t,name:t,meta:`${catalog.books.filter(b=>b.timelines.includes(t)).length} 个分卷 · ${source.filter(c=>c.timeline===t).length} 章`,detail:'时间轴 · 进入后选择分卷',empty:!catalog.books.some(b=>b.timelines.includes(t))&&!chapters.some(c=>c.timeline===t)}));
 const bookItems=catalog.books.filter(b=>b.timelines.includes(filter)&&(matches(b.name)||source.some(c=>c.bookId===b.id&&matches(`${c.title} ${c.timeline} ${c.content}`)))).map(b=>({id:b.id,name:b.name,meta:`全卷 ${source.filter(c=>c.bookId===b.id).length} 章${tab==='文稿'?` · ${chapters.filter(c=>c.bookId===b.id&&c.status==='draft').length} 篇草稿`:''}`,detail:b.timelines.length>1?'横跨 '+b.timelines.join(' / '):b.timelines[0],empty:!chapters.some(c=>c.bookId===b.id)}));
 function home(nextTab=tab){setTab(nextTab);setFilter('');setBookFilter('');setQuery('');}
 function enterTimeline(t:string){setFilter(t);setBookFilter('');setQuery('');}
 function enterBook(id:string){setBookFilter(id);setQuery('');}
 function open(c:Chapter){setActive(c);if(c.id==='sample')return;const book=catalog.books.find(b=>b.id===c.bookId);setBookFilter(c.bookId);if(!book?.timelines.includes(filter))setFilter(c.timeline);setLastRead(c.id);saveLocal('longxin-last',c.id);}
 function startEdit(c?:Chapter){const book=currentBook||catalog.books.find(b=>b.timelines.includes(filter));const timeline=filter||book?.timelines[0]||catalog.timelines[0]||'元年';setEditor(c?{...c}:blank(timeline,book,Math.max(0,...chapters.filter(row=>row.bookId===book?.id).map(row=>row.position))+1));}
 async function save(status:'draft'|'published'){
  if(!editor||saving)return;setSaving(true);
  try{const name=editor.volume.trim(),timeline=editor.timeline.trim();if(!name||!timeline||name.length>60||timeline.length>60)throw Error('请填写时间轴与分卷名（最多 60 字）。');
   const existing=catalog.books.find(b=>b.id===editor.bookId&&b.name===name)||catalog.books.find(b=>b.name===name);
   const book:Book=existing?{...existing,timelines:uniqueNames([...existing.timelines,timeline])}:{id:crypto.randomUUID(),name,timelines:[timeline]};
   const r=await localRequest(editor.id?`/api/chapters/${editor.id}`:'/api/chapters',{method:editor.id?'PUT':'POST',body:JSON.stringify({...editor,bookId:book.id,volume:book.name,timeline,status})});const data=await r.json();if(!r.ok)throw Error(data.error||'保存未成功。');
   const next={timelines:uniqueNames([...catalog.timelines,timeline]),books:[...catalog.books.filter(b=>b.id!==book.id),book]};setChapters(old=>[...old.filter(c=>c.id!==data.id),data].sort((a,b)=>a.position-b.position||a.createdAt.localeCompare(b.createdAt)));setCatalog(next);removeLocal('longxin-writing');setRecovery(null);setEditor(null);setFilter(timeline);setBookFilter(book.id);setQuery('');
   try{writeCatalog(next);setToast(status==='draft'?'草稿已保存到本机':'文章已放入分卷目录');}catch{setToast('文章已保存，书架设置暂未保存；重新打开时会按文章恢复分类。');}
  }catch(e){setToast((e as Error).message);}finally{setSaving(false);}
 }
 async function remove(c:Chapter){if(!confirm(`删除《${c.title}》？建议先导出备份。此操作无法撤销。`))return;try{const r=await localRequest(`/api/chapters/${c.id}`,{method:'DELETE'});if(!r.ok)throw Error('删除未成功，请重试。');setChapters(old=>old.filter(x=>x.id!==c.id));setToast('文章已删除');}catch(e){setToast((e as Error).message);}}
 async function importTxt(file?:File){if(!file)return;if(file.size>1500000){setToast('文件过大，请分章导入。');return;}const content=await file.text();if(content.includes('\uFFFD')){setToast('文件编码无法识别，请另存为 UTF-8 编码的 TXT。');return;}setEditor(old=>({...old||blank(filter||catalog.timelines[0]||'元年',currentBook,1),content,html:undefined,title:old?.title||file.name.replace(/\.txt$/i,'')}));}
 async function importBackup(file?:File){if(!file)return;let done=0;setImporting(true);try{
  if(file.size>20000000)throw Error('备份过大，请拆分后导入。');const data=JSON.parse(await file.text());if(data.format!=='longxin-backup-v1'||!Array.isArray(data.chapters)||data.chapters.length>1000)throw Error('请选择书房导出的 JSON 备份（最多 1000 章）。');
  if(!confirm(`将创建 ${data.chapters.length} 篇文章，不会覆盖已有文章。继续导入？`))return;
  const importedRows=data.chapters.map((row:any)=>normalizeChapter(row));const incoming=normalizeCatalog(data.catalog||{timelines:data.volumes});
  for(const c of importedRows){if(!incoming.books.some(b=>b.id===c.bookId))incoming.books.push({id:c.bookId,name:c.volume,timelines:[c.timeline]});}
  const next:Catalog={timelines:uniqueNames([...catalog.timelines,...incoming.timelines,...importedRows.map((c:Chapter)=>c.timeline)]),books:catalog.books.map(b=>({...b,timelines:[...b.timelines]}))};const ids=new Map<string,string>();
  for(const book of incoming.books){let target=next.books.find(b=>b.id===book.id)||next.books.find(b=>b.name===book.name);if(target)target.timelines=uniqueNames([...target.timelines,...book.timelines]);else{target={...book,timelines:[...book.timelines]};next.books.push(target);}ids.set(book.id,target.id);}
  writeCatalog(next);setCatalog(next);
  for(const chapter of importedRows){const book=next.books.find(b=>b.id===ids.get(chapter.bookId));const r=await localRequest('/api/chapters',{method:'POST',body:JSON.stringify({...chapter,bookId:book?.id||chapter.bookId,volume:book?.name||chapter.volume})});if(!r.ok)throw Error(`已导入 ${done} 篇；后续失败，请检查备份后重试，避免重复导入。`);const imported=await r.json();if(Array.isArray(chapter.annotations)){const notes=chapter.annotations.filter((n:any)=>n&&typeof n.body==='string'&&typeof n.quote==='string').map((n:any)=>({...n,id:crypto.randomUUID(),chapterId:imported.id}));writeAnnotations(imported.id,notes);}done++;}
  setToast(`已导入 ${done} 篇文章（含分卷、时间轴与批注）`);
 }catch(e){setToast((e as Error).message);}finally{await load();setImporting(false);}}
 function commitCatalog(next:Catalog){writeCatalog(next);setCatalog(next);}
 function createTimeline(){const name=prompt('新时间轴名称（如“元年”，最多 60 字）')?.trim();if(!name)return;if(name.length>60||catalog.timelines.includes(name)){setToast('名称过长或时间轴已存在。');return;}try{commitCatalog({...catalog,timelines:[...catalog.timelines,name]});}catch{setToast('时间轴保存失败。');}}
 async function renameTimeline(from:string){const to=prompt('修改时间轴名称',from)?.trim();if(!to||to===from)return;if(to.length>60||catalog.timelines.includes(to)){setToast('名称过长或已经存在。');return;}try{const r=await localRequest('/api/timelines',{method:'PUT',body:JSON.stringify({from,to})});if(!r.ok)throw Error();const next={timelines:catalog.timelines.map(t=>t===from?to:t),books:catalog.books.map(b=>({...b,timelines:b.timelines.map(t=>t===from?to:t)}))};commitCatalog(next);setChapters(old=>old.map(c=>c.timeline===from?{...c,timeline:to}:c));if(filter===from)setFilter(to);setToast('时间轴名称已更新');}catch{setToast('重命名未完成，请重新打开书房检查。');}}
 function removeTimeline(name:string){if(catalog.books.some(b=>b.timelines.includes(name))||chapters.some(c=>c.timeline===name)){setToast('请先移走时间轴中的分卷与章节。');return;}if(!confirm(`移除空时间轴“${name}”？`))return;try{commitCatalog({...catalog,timelines:catalog.timelines.filter(t=>t!==name)});}catch{setToast('移除失败，请重试。');}}
 async function saveBook(){if(!bookEditor||saving)return;const name=bookEditor.name.trim(),timelines=uniqueNames(bookEditor.timelines);if(!name||name.length>60||!timelines.length){setToast('请填写分卷名，并选择至少一个时间轴。');return;}setSaving(true);try{
  const duplicate=catalog.books.find(b=>b.name===name&&b.id!==bookEditor.id);if(bookEditor.id&&duplicate)throw Error('这个分卷名已存在，请使用不同的名称。');
  const id=bookEditor.id||duplicate?.id||crypto.randomUUID();const target:Book={id,name,timelines:bookEditor.id?timelines:uniqueNames([...(duplicate?.timelines||[]),...timelines])};
  if(chapters.some(c=>c.bookId===id&&!target.timelines.includes(c.timeline)))throw Error('仍有章节属于被取消的时间轴，请先调整章节。');
  if(bookEditor.id){const r=await localRequest('/api/books',{method:'PUT',body:JSON.stringify({id,name})});if(!r.ok)throw Error('分卷更新失败。');}
  commitCatalog({...catalog,books:[...catalog.books.filter(b=>b.id!==id),target]});setChapters(old=>old.map(c=>c.bookId===id?{...c,volume:name}:c));setBookEditor(null);setToast('分卷已保存，所选时间轴入口共用同一套章节');
 }catch(e){setToast((e as Error).message);}finally{setSaving(false);}}
 function removeBook(id:string){if(chapters.some(c=>c.bookId===id))return;const book=catalog.books.find(b=>b.id===id);if(!confirm(`移除空卷《${book?.name}》及其所有时间轴入口？`))return;try{commitCatalog({...catalog,books:catalog.books.filter(b=>b.id!==id)});}catch{setToast('移除失败，请重试。');}}
 const resumed=published.find(c=>c.id===lastRead);
 return <div className="app-shell">
  <header className="site-header"><a className="brand" href="./" aria-label="龙心书房首页"><span className="brand-seal">龙</span><span>龙心<span className="brand-sub">掌上书房</span></span></a><nav><button className={tab==='书房'?'selected':''} onClick={()=>home('书房')}>书房</button><button className={tab==='文稿'?'selected':''} onClick={()=>home('文稿')}>文稿</button></nav><button className="write-btn" onClick={()=>startEdit()}><Feather size={16}/><span>发布文章</span></button></header>
  <main>
   <section className="hero"><div className="hero-copy"><span className="eyebrow"><i/>梅百城 · 长篇作品</span><h1>漫长的故事，<br/>读进<span>掌心。</span></h1><p>在一页与下一页之间，<br className="mobile-br"/>重返那个仍在生长的世界。</p><button className="hero-read" onClick={()=>open(resumed||published[0]||demo)}>{resumed?'继续上次阅读':published.length?'从第一章开始':'体验翻页阅读'}<ArrowRight size={17}/></button><div className="hero-stat"><span>{published.length.toString().padStart(2,'0')} <small>已发布章节</small></span><b>·</b><span>{catalog.books.length.toString().padStart(2,'0')} <small>分卷</small></span><b>·</b><span>{catalog.timelines.length} <small>时间轴</small></span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit o1"/><div className="orbit o2"/><div className="moon"/><div className="art-lines"/><span className="art-title">龙<br/>心</span><span className="art-vertical">千年流转　故事长明</span><span className="art-foot">THE HEART OF THE DRAGON</span></div></section>
   <section className="library"><div className="section-heading"><div><span className="eyebrow dark">{tab==='书房'?'THE DRAGON CHRONICLE':'THE WRITING DESK'}</span><h2>{currentBook?.name||(filter?filter+' · 分卷':tab==='书房'?'时间轴书架':'文稿管理')}<span>{currentBook?'完整目录 · 按原书章节顺序阅读':filter?'选择一本书，让故事展开':'沿着时间，找到你的故事'}</span></h2></div><button className="quiet-btn" onClick={()=>setHelp(true)}><BookOpen size={15}/><span>使用指南</span></button></div>
    {recovery&&!editor&&<div className="recovery"><span>还有一份未保存的文稿：{recovery.title||'无标题'}</span><button onClick={()=>setEditor(recovery)}>继续编辑</button><button aria-label="丢弃未保存的副本" onClick={()=>{if(confirm('丢弃这份未保存的本机副本？')){removeLocal('longxin-writing');setRecovery(null);}}}><X size={16}/></button></div>}
    <div className="filter-row"><div className="filters">{bookFilter?<><button onClick={()=>enterTimeline(filter)}>← {filter}分卷</button><button onClick={()=>home()}>全部时间轴</button></>:filter?<button className="active" onClick={()=>home()}>← 时间轴书架</button>:<span className="shelf-caption">时间轴 → 分卷 → 章节</span>}</div><label className="search"><Search size={16}/><input aria-label="搜索文章" placeholder={bookFilter?'寻找本卷章节…':filter?'寻找分卷或章节…':'寻找时间轴、分卷或章节…'} value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    {currentBook&&<div className="book-context"><span>收录时间轴</span>{currentBook.timelines.map(t=><button key={t} className={filter===t?'current':''} onClick={()=>{setFilter(t);setQuery('');}}>{t}</button>)}<p>各入口共用本卷完整目录；章节标注自身时间轴，阅读顺序不会被切断。</p></div>}
    {tab==='文稿'&&<div className="backup-tools"><span>{chapters.length} 篇文章 · {count(chapters.map(c=>c.content).join('')).toLocaleString()} 字</span><div><button onClick={()=>download(`龙心备份-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({format:'longxin-backup-v1',schemaVersion:2,exportedAt:new Date().toISOString(),catalog,volumes:catalog.timelines,chapters:chapters.map(c=>({...c,annotations:readAnnotations(c.id)}))},null,2),'application/json')} disabled={loading||!!error}><Download size={14}/>导出备份</button><button onClick={()=>backupRef.current?.click()} disabled={importing||loading||!!error}><Upload size={14}/>{importing?'正在导入…':'导入备份'}</button></div><input type="file" ref={backupRef} accept=".json,application/json" hidden onChange={e=>{importBackup(e.target.files?.[0]);e.target.value='';}}/></div>}
    {loading?<div className="state-box"><LoaderCircle className="spin"/>正在打开书房…</div>:error?<div className="state-box"><p>{error}</p><button className="solid-btn" onClick={load}>重新加载</button><span>本版需要浏览器允许本机存储。</span></div>:!filter?<VolumeShelf items={timelineItems} kind="timeline" onOpen={enterTimeline} onCreate={createTimeline} onEdit={renameTimeline} onDelete={removeTimeline}/>:!bookFilter?<VolumeShelf items={bookItems} kind="book" onOpen={enterBook} onCreate={()=>setBookEditor({name:'',timelines:[filter]})} onEdit={id=>{const b=catalog.books.find(b=>b.id===id);if(b)setBookEditor({...b,timelines:[...b.timelines]});}} onDelete={removeBook}/>:shown.length?<div className="chapter-list">{shown.map(c=><div className="chapter-row" key={c.id}><button className="chapter-main" onClick={()=>open(c)}><span className="chapter-num">{String(c.position).padStart(2,'0')}</span><span className="chapter-info"><span className="chapter-meta">{c.timeline} · {c.volume}{c.status==='draft'&&<em>草稿</em>}</span><strong>{c.title}</strong><span className="chapter-preview">{c.content.replace(/\n/g,' ').slice(0,62)}</span><span className="chapter-details">{count(c.content).toLocaleString()} 字 <i/> 约 {Math.max(1,Math.ceil(count(c.content)/500))} 分钟</span></span><ArrowRight className="row-arrow" size={19}/></button>{tab==='文稿'&&<div className="row-actions"><button onClick={()=>startEdit(c)}>编辑</button><button onClick={()=>download(`${c.title.replace(/[\\/:*?"<>|]/g,'-')}.txt`,`${c.title}\n\n${c.content}`,'text/plain;charset=utf-8')}>TXT</button><button className="delete-btn" onClick={()=>remove(c)}>删除</button></div>}</div>)}</div>:<div className="empty-library"><div className="empty-book"><BookOpen size={35} strokeWidth={1}/></div><h3>{query?'还没有找到这一章':'故事，等待第一章'}</h3><p>{query?'换一个关键词试试。':'把第一章放进这一卷；它会在所有关联时间轴入口中显示。'}</p><button className="solid-btn" onClick={()=>startEdit()}><Plus size={16}/>放入第一篇文章</button></div>}
    {tab==='书房'&&<button className="sample-card" onClick={()=>open(demo)}><span className="sample-icon"><BookOpen size={23} strokeWidth={1.3}/></span><span><small>先翻开看看</small><strong>一份关于阅读的邀请</strong><span>体验翻页、纸色与字号设置 · 功能示例，非原作</span></span><ArrowRight size={19}/></button>}
   </section>
   <section className="closing"><span>「</span><p>让故事在这里，<br/>一页一页地生长。</p><span className="closing-seal">百城</span></section>
  </main><footer className="site-footer"><span>龙心 · 梅百城</span><span>本机测试书房 <i/> 为长久的阅读而作</span><button onClick={()=>setHelp(true)}>关于书房 <ArrowRight size={12}/></button></footer>
  <div className="mobile-nav"><button className={tab==='书房'?'active':''} onClick={()=>home('书房')}><BookOpen size={20}/>书房</button><button className="mobile-add" onClick={()=>startEdit()} aria-label="发布文章"><Plus size={22}/></button><button className={tab==='文稿'?'active':''} onClick={()=>home('文稿')}><FileText size={20}/>文稿</button></div>
  {active&&<Reading chapter={active} chapters={chapters.filter(c=>c.status==='published'||c.id===active.id)} onClose={()=>setActive(null)} onOpen={open} onEdit={()=>{startEdit(active);setActive(null);}}/>}
  {editor&&<div className="modal-backdrop"><section className="editor modal" role="dialog" aria-modal="true" aria-labelledby="editor-title"><header><div><small>THE WRITING DESK</small><h2 id="editor-title">{editor.id?'编辑文章':'一篇新的故事'}</h2></div><button className="icon-btn" aria-label="关闭编辑器" onClick={()=>{setRecovery(editor);setEditor(null);}} disabled={saving}><X/></button></header><div className="editor-body"><div className="editor-note"><span className="small-dot"/>文章仅保存在当前浏览器，请保留原稿与备份</div><label>章节标题<input autoFocus placeholder="给这一章一个名字" value={editor.title} maxLength={120} onChange={e=>setEditor({...editor,title:e.target.value})}/></label><div className="classification-fields"><label>本章时间轴<select value={editor.timeline} onChange={e=>setEditor({...editor,timeline:e.target.value})}>{uniqueNames([...catalog.timelines,editor.timeline]).map(t=><option key={t}>{t}</option>)}</select></label><label>所属书名／分卷<input list="book-options" placeholder="例如：母与子" maxLength={60} value={editor.volume} onChange={e=>{const b=catalog.books.find(b=>b.name===e.target.value);setEditor({...editor,volume:e.target.value,bookId:b?.id||'',position:editor.id?editor.position:Math.max(0,...chapters.filter(c=>c.bookId===b?.id).map(c=>c.position))+1});}}/><datalist id="book-options">{catalog.books.map(b=><option key={b.id} value={b.name}/>)}</datalist></label><label>全卷章节序号<input type="number" min="1" max="999999" value={editor.position||''} onChange={e=>setEditor({...editor,position:Number(e.target.value)})}/></label></div><p className="classification-hint">同名分卷共用一套章节；本章时间轴会自动加入分卷入口。序号按全卷阅读顺序填写。</p><div className="text-label"><span>正文</span><button onClick={()=>fileRef.current?.click()}><Upload size={14}/>导入 TXT</button></div><input hidden ref={fileRef} type="file" accept=".txt,text/plain" onChange={e=>{importTxt(e.target.files?.[0]);e.target.value='';}}/><RichEditor html={editor.html} text={editor.content} onChange={(html,content)=>setEditor(current=>current?{...current,html,content}:null)}/><div className="text-count">{count(editor.content).toLocaleString()} 字 · 富文本排版</div></div><footer><button className="outline-btn" disabled={saving||!editor.title.trim()||!editor.content.trim()||!editor.volume.trim()} onClick={()=>save('draft')}>保存草稿</button><button className="solid-btn" disabled={saving||!editor.title.trim()||!editor.content.trim()||!editor.volume.trim()} onClick={()=>save('published')}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}发布文章</button></footer></section></div>}
  {bookEditor&&<div className="modal-backdrop"><section className="modal book-editor" role="dialog" aria-modal="true" aria-labelledby="book-editor-title"><header><h2 id="book-editor-title">{bookEditor.id?'编辑分卷':'建立或关联分卷'}</h2><button className="icon-btn" aria-label="关闭分卷设置" disabled={saving} onClick={()=>setBookEditor(null)}><X/></button></header><div className="book-editor-body"><label>书名／分卷名<input autoFocus maxLength={60} placeholder="例如：母与子" value={bookEditor.name} onChange={e=>setBookEditor({...bookEditor,name:e.target.value})}/></label><fieldset><legend>在哪些时间轴中展示</legend>{catalog.timelines.map(t=><label className="timeline-choice" key={t}><input type="checkbox" checked={bookEditor.timelines.includes(t)} onChange={e=>setBookEditor({...bookEditor,timelines:e.target.checked?[...bookEditor.timelines,t]:bookEditor.timelines.filter(v=>v!==t)})}/><span>{t}</span></label>)}</fieldset><p>可同时勾选“元年”和“一千”。各入口共用同一本书、同一套章节与批注，无需重复上传。</p><p>已有该时间轴章节时，请先调整章节，再取消其时间轴入口。</p></div><footer><button className="outline-btn" disabled={saving} onClick={()=>setBookEditor(null)}>取消</button><button className="solid-btn" disabled={saving||!bookEditor.name.trim()||!bookEditor.timelines.length} onClick={saveBook}>保存分卷</button></footer></section></div>}
  {help&&<div className="modal-backdrop"><section className="help modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><header><h2 id="help-title">欢迎来到掌上书房</h2><button className="icon-btn" onClick={()=>setHelp(false)} aria-label="关闭指南"><X/></button></header><div className="help-body"><span className="help-mark">龙心</span><h3>沿着时间，翻开故事。</h3><ol><li><strong>时间轴与分卷</strong><p>元年、一千、两千是时间轴；每个入口下再选书名或分卷。同一本书可归入多个时间轴，各入口共用完整目录。</p></li><li><strong>放入正文</strong><p>发布时填写本章时间轴、书名／分卷与全卷章节序号。可以直接粘贴 Word 正文或导入 UTF-8 TXT。旧文章会保留在原时间轴的“待分卷”中，编辑即可重新归卷。</p></li><li><strong>翻页与批注</strong><p>上下章只在同一分卷内按序阅读，保留故事里的时间线切换；不同分卷不会串联。底部“选句批注”可点选整句，阅读设置里可选择本机背景。</p></li></ol><p className="help-note">测试页可公开访问；文章和批注仅保存在当前浏览器，不会上传。请定期导出含时间轴、分卷及批注的 JSON 备份；背景原图另行保留。</p><button className="solid-btn" onClick={()=>{setHelp(false);open(demo);}}>体验阅读 <ArrowRight size={16}/></button></div></section></div>}
  {toast&&<div className="toast" role="status">{toast}</div>}
 </div>;
}
