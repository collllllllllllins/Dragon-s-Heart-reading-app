// Clipboard HTML is rebuilt from an explicit allowlist. No scripts, images,
// links, handlers, Word XML or arbitrary CSS survive this conversion.
const blockTags = new Set(['P','DIV','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE']);
const discard = new Set(['SCRIPT','STYLE','META','LINK','OBJECT','EMBED','IFRAME','SVG','MATH','IMG','VIDEO','AUDIO','INPUT','BUTTON','FORM','TEMPLATE','NOSCRIPT']);
export function escapeHTML(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function textToHTML(s:string){return s.split(/\r?\n/).map(p=>`<p>${p?escapeHTML(p):'<br>'}</p>`).join('');}
function safeColor(value:string){const s=value.trim();return /^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|black|white|red|blue|green|purple|orange|gray|grey|yellow)$/i.test(s)?s:'';}
export function sanitizeHTML(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html');
 function walk(node:Node):string{
  if(node.nodeType===Node.TEXT_NODE)return escapeHTML(node.textContent||'');
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const el=node as HTMLElement,tag=el.tagName;if(discard.has(tag)||tag.includes(':'))return '';
  const children=Array.from(el.childNodes).map(walk).join('');
  if(tag==='BR')return '<br>';
  if(tag==='HR')return '<hr>';
  let inner=children;
  const style=el.style;
  if(tag==='B'||tag==='STRONG'||/^(bold|[6-9]00)$/.test(style.fontWeight))inner=`<strong>${inner}</strong>`;
  if(tag==='I'||tag==='EM'||style.fontStyle==='italic')inner=`<em>${inner}</em>`;
  if(tag==='U'||style.textDecoration.includes('underline')||style.textDecorationLine.includes('underline'))inner=`<u>${inner}</u>`;
  if(tag==='S'||tag==='DEL'||tag==='STRIKE'||style.textDecoration.includes('line-through'))inner=`<s>${inner}</s>`;
  if(tag==='SUP'||tag==='SUB')inner=`<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
  const color=safeColor(style.color);if(color)inner=`<span style="color:${color}">${inner}</span>`;
  if(tag==='UL'||tag==='OL')return `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
  if(blockTags.has(tag)){
   const out=/^H[1-6]$/.test(tag)?'h'+Math.min(Number(tag[1]),3):tag==='LI'?'li':tag==='BLOCKQUOTE'?'blockquote':'p';
   const align=['left','center','right','justify'].includes(style.textAlign)?` style="text-align:${style.textAlign}"`:'';
   // Word may nest DIV containers around paragraphs; retain the container's
   // children rather than generating invalid nested P elements.
   if((tag==='DIV'||tag==='P')&&/<(?:p|h[1-3]|ul|ol|blockquote)[ >]/.test(inner))return inner;
   return `<${out}${align}>${inner||'<br>'}</${out}>`;
  }
  return inner;
 }
 return Array.from(doc.body.childNodes).map(walk).join('').trim();
}
export function htmlToText(html:string){const doc=new DOMParser().parseFromString(html,'text/html');function walk(n:Node):string{if(n.nodeType===3)return n.textContent||'';const tag=(n as HTMLElement).tagName;return Array.from(n.childNodes).map(walk).join('')+(tag==='BR'||blockTags.has(tag)||tag==='UL'||tag==='OL'?'\n':'');}return walk(doc.body).replace(/\n{3,}/g,'\n\n').trim();}
export type Annotation={id:string;chapterId:string;quote:string;start:number;end:number;before:string;after:string;body:string;createdAt:string;updatedAt:string};
export function locateNote(text:string,n:Annotation):{start:number;end:number}|null{
 if(!n.quote)return null;
 if(text.slice(n.start,n.end)===n.quote)return {start:n.start,end:n.end};
 let best=-1,score=-Infinity,at=text.indexOf(n.quote);
 while(at>=0){const value=(n.before&&text.slice(Math.max(0,at-n.before.length),at)===n.before?1000:0)+(n.after&&text.slice(at+n.quote.length,at+n.quote.length+n.after.length)===n.after?1000:0)-Math.abs(at-n.start);if(value>score){score=value;best=at;}at=text.indexOf(n.quote,at+1);}
 return best>=0?{start:best,end:best+n.quote.length}:null;
}
export function highlightedHTML(html:string,notes:Annotation[]){
 const doc=new DOMParser().parseFromString(html,'text/html'),text=doc.body.textContent||'';
 const spans=notes.map(n=>({...locateNote(text,n),id:n.id})).filter(s=>s.start!==undefined&&s.end!==undefined) as {start:number;end:number;id:string}[];
 const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);
 let offset=0;for(const node of nodes){const value=node.data,start=offset,end=start+value.length;offset=end;const hits=spans.filter(s=>s.start<end&&s.end>start);if(!hits.length)continue;const cuts=[...new Set([0,value.length,...hits.flatMap(s=>[Math.max(0,s.start-start),Math.min(value.length,s.end-start)])])].sort((a,b)=>a-b);const frag=doc.createDocumentFragment();for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1],ids=hits.filter(s=>s.start<start+b&&s.end>start+a).map(s=>s.id);if(ids.length){const mark=doc.createElement('mark');mark.dataset.notes=ids.join(',');mark.textContent=value.slice(a,b);mark.title='查看批注';frag.append(mark);}else frag.append(doc.createTextNode(value.slice(a,b)));}node.replaceWith(frag);}
 return doc.body.innerHTML;
}
export function readAnnotations(id:string):Annotation[]{try{const data=JSON.parse(localStorage.getItem('longxin-notes-'+id)||'[]');return Array.isArray(data)?data.filter(n=>n&&typeof n.body==='string'&&typeof n.quote==='string'&&typeof n.id==='string'):[];}catch{return [];}}
export function writeAnnotations(id:string,notes:Annotation[]){localStorage.setItem('longxin-notes-'+id,JSON.stringify(notes));}
