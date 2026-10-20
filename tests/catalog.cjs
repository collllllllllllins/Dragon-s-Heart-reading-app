const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const project=require('node:path').resolve(__dirname,'..');
const {createRequire}=require('node:module'),localRequire=createRequire(project+'/package.json'),ts=localRequire('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const dom=new JSDOM('<div id="app"></div>',{url:'https://reader.test'});
for(const key of ['window','document','Node','NodeFilter','HTMLElement','DOMParser','localStorage','MouseEvent','Event'])global[key]=dom.window[key];
global.IS_REACT_ACT_ENVIRONMENT=true;global.confirm=()=>true;
global.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){this.fn();}disconnect(){}};
global.requestAnimationFrame=fn=>setTimeout(fn,0);global.cancelAnimationFrame=clearTimeout;
Object.defineProperty(document,'fonts',{value:{ready:Promise.resolve()}});
for(const [key,value] of [['clientWidth',320],['clientHeight',500],['scrollWidth',320]])Object.defineProperty(HTMLElement.prototype,key,{get(){return value;}});
HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:320,height:500,right:320,bottom:500};};
const React=localRequire('react'),{act}=React,{createRoot}=localRequire('react-dom/client');
require.cache[project+'/source/cloud-client.ts']={id:project+'/source/cloud-client.ts',filename:project+'/source/cloud-client.ts',loaded:true,exports:{loadCloudClient:async()=>{throw Error('offline test');}}};
const ReaderApp=require(project+'/source/reader-app.tsx').default;
const {normalizeChapter,readCatalog,writeCatalog,sameBook,CATALOG_KEY}=require(project+'/source/catalog.ts');
const {localRequest}=require(project+'/source/storage.ts');
const KEY='longxin-pages-test-chapters-v1';
const props=el=>el[Object.keys(el).find(k=>k.startsWith('__reactProps'))];
const find=(selector,text)=>Array.from(document.querySelectorAll(selector)).find(el=>el.textContent.includes(text));
const click=el=>{assert(el,'Expected button exists');el.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
const tick=()=>new Promise(r=>setTimeout(r,20));
const change=async(el,value)=>{assert(el);await act(async()=>{props(el).onChange({target:{value,checked:value}});});};
const rows=()=>JSON.parse(localStorage.getItem(KEY)||'[]');
let app;
async function mount(){app=createRoot(document.getElementById('app'));await act(async()=>{app.render(React.createElement(ReaderApp));await tick();});}
async function newChapter(title,timeline,volume){
 await act(async()=>{click(document.querySelector('.write-btn'));});
 await change(document.querySelector('.editor input[placeholder="给这一章一个名字"]'),title);
 if(volume)await change(document.querySelector('.editor input[list="book-options"]'),volume);
 await change(document.querySelector('.editor select'),timeline);
 await act(async()=>{const box=document.querySelector('.rich-editor');box.innerHTML='<p>'+title+'的正文。</p>';props(box).onInput();});
 await act(async()=>{click(document.querySelector('.editor>footer .solid-btn'));await tick();});
 assert(!document.querySelector('.editor'),'Chapter saves successfully');
}
async function importBackup(data){
 await act(async()=>{click(find('.site-header nav button','文稿'));});
 const input=document.querySelector('.backup-tools input');
 await act(async()=>{props(input).onChange({target:{files:[{size:100,text:async()=>JSON.stringify(data)}],value:'x'}});await tick();});
}
(async()=>{
 // Reading legacy data must not overwrite the only stored copy or orphan annotation IDs.
 const legacy={id:'original-id',title:'旧章节',volume:'元年',content:'不变的原文',html:'<p>不变的<strong>原文</strong></p>',position:1,status:'published',createdAt:'2026-10-18',updatedAt:'2026-10-18'};
 localStorage.setItem(KEY,JSON.stringify([legacy]));localStorage.setItem('longxin-notes-original-id','[{"id":"note","body":"旧批注","quote":"原文"}]');localStorage.setItem('longxin-progress-original-id','.5');
 let normalized=await(await localRequest('/api/chapters')).json();
 assert.equal(normalized[0].id,legacy.id);assert.equal(normalized[0].timeline,'元年');assert.equal(normalized[0].volume,'待分卷 · 元年');assert.equal(normalized[0].html,legacy.html);
 assert.deepEqual(JSON.parse(localStorage.getItem(KEY)),[legacy]);assert(localStorage.getItem('longxin-notes-original-id').includes('旧批注'));assert.equal(localStorage.getItem('longxin-progress-original-id'),'.5');
 assert.equal(readCatalog(normalized).books.length,1);
 const otherLegacy=normalizeChapter({...legacy,id:'later',volume:'一千'});assert.notEqual(normalized[0].bookId,otherLegacy.bookId,'Legacy waiting folders stay separate');
 localStorage.clear();await mount();
 assert.equal(document.querySelectorAll('.volume-card').length,3,'Home shows timeline entrances');
 await act(async()=>{click(find('.volume-open','元年'));});
 await act(async()=>{click(document.querySelector('.volume-create'));});
 await change(document.querySelector('.book-editor input[maxlength="60"]'),'母与子');
 await change(find('.timeline-choice','一千').querySelector('input'),true);
 await act(async()=>{click(document.querySelector('.book-editor>footer .solid-btn'));});
 let catalog=JSON.parse(localStorage.getItem(CATALOG_KEY));assert.deepEqual(catalog.books[0].timelines,['元年','一千']);assert.equal(catalog.books.length,1);
 await act(async()=>{click(find('.volume-open','母与子'));});
 await newChapter('母亲的元年','元年');
 await newChapter('儿子的一千','一千');
 const sharedId=rows()[0].bookId;assert(rows().every(c=>c.bookId===sharedId));assert.deepEqual(rows().map(c=>c.position),[1,2]);
 const first=rows()[0];localStorage.setItem('longxin-notes-'+first.id,JSON.stringify([{id:'shared-note',chapterId:first.id,quote:'母亲',start:0,end:2,before:'',after:'的元年',body:'只保存一份批注',createdAt:'2026-10-19',updatedAt:'2026-10-19'}]));
 for(const timeline of ['元年','一千']){
  await act(async()=>{click(find('.site-header nav button','书房'));});
  await act(async()=>{click(find('.volume-open',timeline));});
  assert.equal(document.querySelectorAll('.volume-card').length,1);
  await act(async()=>{click(find('.volume-open','母与子'));});
  assert.deepEqual(Array.from(document.querySelectorAll('.chapter-main strong')).map(el=>el.textContent),['母亲的元年','儿子的一千'],'Both timeline entrances show the same complete book');
 }
 await newChapter('别卷章节','元年','另一卷');
 assert.equal(document.querySelectorAll('.chapter-main').length,1,'A different book has an independent directory');
 await act(async()=>{click(find('.site-header nav button','书房'));});
 await act(async()=>{click(find('.volume-open','元年'));});
 await act(async()=>{click(find('.volume-open','母与子'));});
 await act(async()=>{click(find('.chapter-main','母亲的元年'));await tick();});
 await act(async()=>{click(document.querySelector('[aria-label="打开目录"]'));});
 assert.equal(document.querySelectorAll('.toc button:not(.toc-edit)').length,2,'Reader excludes other books');
 assert(find('.toc button','一千'),'Reader shows the chapter timeline labels');
 await act(async()=>{click(document.querySelector('[aria-label="关闭面板"]'));click(document.querySelector('.page-controls button:last-child'));await tick();});
 assert.equal(document.querySelector('.chapter-start h1').textContent,'儿子的一千','Next chapter follows the original book across timelines');
 assert(document.querySelector('.page-controls button:last-child').disabled,'Reading stops at the end of this book');
 await act(async()=>{click(document.querySelector('.reader-back'));});
 // Renaming the shared book changes both entrances while preserving its ID and notes.
 await act(async()=>{click(find('.filters button','分卷'));});
 const card=Array.from(document.querySelectorAll('.volume-card')).find(el=>el.textContent.includes('母与子'));
 await act(async()=>{click(findIn(card,'button','编辑分卷'));});
 await change(document.querySelector('.book-editor input[maxlength="60"]'),'母与子 · 上卷');
 await act(async()=>{click(document.querySelector('.book-editor>footer .solid-btn'));await tick();});
 assert(rows().filter(c=>c.bookId===sharedId).every(c=>c.volume==='母与子 · 上卷'));
 assert(localStorage.getItem('longxin-notes-'+first.id).includes('只保存一份批注'));
 // Export and reimport both shared membership and exact annotations.
 let blob;const originalCreate=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return 'blob:backup-test';};dom.window.HTMLAnchorElement.prototype.click=function(){};
 await act(async()=>{click(find('.site-header nav button','文稿'));});
 await act(async()=>{click(find('.backup-tools button','导出备份'));});
 const backup=JSON.parse(await blob.text());URL.createObjectURL=originalCreate;
 assert.equal(backup.schemaVersion,2);assert.equal(backup.chapters.length,3);assert.equal(backup.catalog.books.length,2);assert.deepEqual(backup.catalog.books.find(b=>b.id===sharedId).timelines,['元年','一千']);
 await act(async()=>{app.unmount();});localStorage.clear();await mount();await importBackup(backup);
 assert.equal(rows().length,3);assert.equal(readCatalog(rows()).books.length,2);assert.equal(sameBook(rows(),sharedId).length,2);
 const imported=rows().find(c=>c.title===first.title);assert.notEqual(imported.id,first.id);assert(localStorage.getItem('longxin-notes-'+imported.id).includes('只保存一份批注'));
 await importBackup({format:'longxin-backup-v1',volumes:['元年','一千'],chapters:[legacy]});
 assert(rows().some(c=>c.title==='旧章节'&&c.volume==='待分卷 · 元年'&&c.timeline==='元年'));
 assert.equal(sameBook(rows(),sharedId).length,2,'Importing old backups does not mix legacy chapters into a shared book');
 await act(async()=>{app.unmount();});
 console.log('PASS: nondestructive legacy migration, independent waiting folders, shared-book creation, both timeline entrances, chapter sequencing, separate books, cross-timeline reading, shared rename, exact backup/annotation round trip, old-backup import.');
})().catch(error=>{console.error(error);process.exitCode=1;});
function findIn(root,selector,text){return Array.from(root.querySelectorAll(selector)).find(el=>el.textContent.includes(text));}
