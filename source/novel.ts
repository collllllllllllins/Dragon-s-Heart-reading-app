import {escapeHTML} from './format';
import type {Chapter} from './catalog';
export const NOVEL_MAX_BYTES=25000000;
const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function inspectNovel(source:string,fileName:string){
 if(!/<(?:!doctype\s+html|html)[\s>]/i.test(source))throw Error('请选择完整的 HTML 网页文件，图片应内嵌在文件中。');
 if(new TextEncoder().encode(source).length>NOVEL_MAX_BYTES)throw Error('每章最多 25 MB，请拆分为多个章节。');
 const doc=new DOMParser().parseFromString(source,'text/html');
 const external=Array.from(doc.querySelectorAll('[src],link[href]')).filter(el=>{const value=el.getAttribute('src')||el.getAttribute('href')||'';return value&&!value.startsWith('data:')&&!value.startsWith('#');});
 if(external.length)throw Error('文件仍引用外部图片或脚本。请先导出为内嵌图片、样式和脚本的独立 HTML。');
 let content='';
 const match=source.match(/(?:const|let|var)\s+STORY\s*=\s*(\[[\s\S]*?\]);/);
 if(match)try{const scenes=JSON.parse(match[1]);if(Array.isArray(scenes))content=scenes.flatMap(s=>Array.isArray(s.paragraphs)?[s.title||'',...s.paragraphs.filter((p:unknown)=>typeof p==='string')]:[]).join('\n\n').slice(0,300000);}catch{}
 if(!content){const body=doc.body.cloneNode(true) as HTMLElement;body.querySelectorAll('script,style,nav,button,dialog,select').forEach(el=>el.remove());content=(body.textContent||'').replace(/\s+/g,' ').trim().slice(0,300000);}
 return {title:(doc.title.replace(/^龙心\s*[·|｜—-]\s*/,'').trim()||fileName.replace(/\.html?$/i,'')).slice(0,120),content:content||'图像小说章节',fileName};
}
const cache=new Map<string,string>();
export async function loadNovel(chapter:Chapter,signal?:AbortSignal):Promise<string>{
 if(chapter.novelHtml)return chapter.novelHtml;
 if(chapter.novelPath){
  // Only author-bundled resources are fetched by the parent page. Imported code cannot supply URLs.
  if(chapter.novelPath!=='novels/white-shell.json')throw Error('未识别的章节资源，请重新导入原 HTML。');
  if(cache.has(chapter.novelPath))return cache.get(chapter.novelPath)!;
  const response=await fetch(new URL(chapter.novelPath,document.baseURI),{signal});if(!response.ok)throw Error('章节加载失败，请检查网络后重试。');const data=await response.json();let html:string;
  if(typeof data.html==='string')html=data.html;
  else if(Array.isArray(data.parts)&&data.parts.length>0&&data.parts.length<=64&&data.parts.every((p:unknown)=>typeof p==='string'&&/^white-shell\/part-\d{2}\.txt$/.test(p))){
   const chunks=await Promise.all(data.parts.map(async(path:string)=>{const part=await fetch(new URL(path,new URL(chapter.novelPath!,document.baseURI)),{signal});if(!part.ok)throw Error('章节图片尚未完整加载，请稍后重试。');return part.text();}));
   const body=chunks.join('');if(body.length>NOVEL_MAX_BYTES)throw Error('章节文件过大。');const complete=JSON.parse(body);if(typeof complete.html!=='string')throw Error('章节文件不完整。');html=complete.html;
  }else throw Error('章节文件不完整。');cache.set(chapter.novelPath,html);return html;
 }
 return legacyNovel(chapter);
}
export function sandboxNovel(source:string,token:string,seed:Record<string,string>){
 const doc=new DOMParser().parseFromString(source,'text/html');
 doc.querySelectorAll('base,meta[http-equiv]').forEach(el=>el.remove());
 const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 const bridge=doc.createElement('script');bridge.textContent=`(()=>{let data=${json(seed)};const token=${json(token)};function emit(){parent.postMessage({kind:'longxin-novel-storage',token,data},'*')}const storage={getItem:key=>Object.prototype.hasOwnProperty.call(data,String(key))?data[String(key)]:null,setItem(key,value){key=String(key);value=String(value);const next={...data,[key]:value};if(JSON.stringify(next).length>120000)throw new DOMException('存档过大','QuotaExceededError');data=next;emit()},removeItem(key){delete data[String(key)];emit()},clear(){data={};emit()},key:index=>Object.keys(data)[index]??null,get length(){return Object.keys(data).length}};try{Object.defineProperty(window,'localStorage',{value:storage,configurable:false})}catch(e){}document.addEventListener('click',e=>{const link=e.target.closest?.('a[href]');if(link&&!link.getAttribute('href').startsWith('#'))e.preventDefault()},true)})();`;
 if(doc.querySelector('#stage.stage #art.art')&&doc.getElementById('text')){const compact=doc.createElement('style');compact.textContent='@media(max-height:520px){#stage.stage{height:100dvh;overflow:hidden}#stage .art{min-height:0}#stage .reader{min-height:0;padding:12px 18px;max-height:65dvh}#stage .text{font-size:18px;min-height:0;max-height:28dvh;line-height:1.65}#stage .caption{margin-bottom:8px}#stage .bottom{margin-top:8px}#stage .nav button{padding:8px 12px}#stage .hint{display:none}#stage .top{padding:8px 14px}#stage .brand{font-size:16px}#stage .brand small{display:none}#stage .tools button{padding:6px 8px}#stage .era{bottom:10px;left:14px}}';doc.head.append(compact);}
 doc.head.prepend(bridge);doc.head.prepend(policy);
 return '<!doctype html>\n'+doc.documentElement.outerHTML;
}
export function legacyNovel(chapter:Chapter){
 const parts=chapter.content.split(/\n\s*\n|\n/).map(s=>s.trim()).filter(Boolean);
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(chapter.title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#171b20;color:#eee8db;font-family:serif}main{min-height:100dvh;display:flex;flex-direction:column;padding:24px;max-width:1000px;margin:auto}header{font:12px system-ui;color:#c2ab82}h1{font-weight:400;font-size:clamp(26px,5vw,46px);line-height:1.6}#art{flex:1;min-height:80px;background:radial-gradient(ellipse at 70% 40%,#9a75431f,transparent 60%)}article{padding:20px 0;border-top:1px solid #9c845944}p{font-size:22px;line-height:1.9;white-space:pre-wrap;max-height:45dvh;overflow:auto}nav{display:flex;gap:14px;justify-content:space-between;align-items:center;font:12px system-ui}button{background:#39352e;color:#eee1c5;border:1px solid #8a734c;padding:12px 18px;font:inherit;border-radius:4px}button:disabled{opacity:.4}small{font:12px system-ui;color:#b2aaa0}</style></head><body><main><header>${escapeHTML(chapter.timeline)} · ${escapeHTML(chapter.volume)}</header><h1>${escapeHTML(chapter.title)}</h1><div id="art" aria-label="尚未配图的旧文稿"></div><article><small>旧文稿 · 逐段试读</small><p id="text" aria-live="polite"></p><nav><button id="prev">上一段</button><span id="count"></span><button id="next">继续 ▷</button></nav></article></main><script>const pages=${json(parts.length?parts:['这一章暂时没有正文。'])},key='page';let at=Number(localStorage.getItem(key)||0);if(!Number.isInteger(at)||at<0||at>=pages.length)at=0;function render(){document.getElementById('text').textContent=pages[at];document.getElementById('count').textContent=(at+1)+' / '+pages.length;document.getElementById('prev').disabled=at===0;document.getElementById('next').disabled=at===pages.length-1;localStorage.setItem(key,String(at))}function next(){if(at<pages.length-1){at++;render()}}document.getElementById('next').onclick=next;document.getElementById('prev').onclick=()=>{if(at>0){at--;render()}};document.getElementById('art').onclick=next;document.getElementById('text').onclick=()=>{if(!getSelection().toString())next()};document.addEventListener('keydown',e=>{if(e.target.closest('button,input,textarea'))return;if(e.key==='ArrowRight'||e.code==='Space'){e.preventDefault();next()}if(e.key==='ArrowLeft'&&at>0){e.preventDefault();at--;render()}});render();</script></body></html>`;
}
