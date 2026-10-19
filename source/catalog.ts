export type Book={id:string;name:string;timelines:string[]};
export type Catalog={timelines:string[];books:Book[]};
export type Chapter={id:string;title:string;timeline:string;bookId:string;volume:string;content:string;html?:string;status:'draft'|'published';position:number;createdAt:string;updatedAt:string};
export const CATALOG_KEY='longxin-catalog-v2';
const DEFAULT_TIMELINES=['元年','一千','两千'];
const validName=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.trim().length<=60;
export const uniqueNames=(value:unknown):string[]=>Array.isArray(value)?[...new Set(value.filter(validName).map(v=>v.trim()))]:[];
/** Old volume values were timeline entrances. Preserve IDs, text, notes and reading progress. */
export function normalizeChapter<T extends {volume:string;timeline?:string;bookId?:string}>(chapter:T):T&{timeline:string;bookId:string;volume:string}{
 if(validName(chapter.timeline))return {...chapter,timeline:chapter.timeline.trim(),volume:chapter.volume.trim(),bookId:chapter.bookId||'book:'+encodeURIComponent(chapter.volume.trim())};
 const timeline=chapter.volume?.trim()||'元年';
 return {...chapter,timeline,bookId:'legacy:'+encodeURIComponent(timeline),volume:('待分卷 · '+timeline).slice(0,60)};
}
export function normalizeCatalog(value:unknown):Catalog{
 const raw=value&&typeof value==='object'?value as Partial<Catalog>:{};
 const books:Book[]=[];
 for(const b of Array.isArray(raw.books)?raw.books:[]){if(!b||typeof b.id!=='string'||!b.id||!validName(b.name)||books.some(row=>row.id===b.id))continue;books.push({id:b.id,name:b.name.trim(),timelines:uniqueNames(b.timelines)});}
 return {timelines:uniqueNames([...(Array.isArray(raw.timelines)?raw.timelines:[]),...books.flatMap(b=>b.timelines)]),books};
}
export function readCatalog(chapters:Chapter[]=[]):Catalog{
 let catalog:Catalog;
 try{const saved=localStorage.getItem(CATALOG_KEY);catalog=saved?normalizeCatalog(JSON.parse(saved)):{timelines:uniqueNames(JSON.parse(localStorage.getItem('longxin-volume-names-v1')||JSON.stringify(DEFAULT_TIMELINES))),books:[]};}
 catch{catalog={timelines:[...DEFAULT_TIMELINES],books:[]};}
 for(const chapter of chapters){const c=normalizeChapter(chapter);if(!catalog.timelines.includes(c.timeline))catalog.timelines.push(c.timeline);let book=catalog.books.find(b=>b.id===c.bookId);if(!book){book={id:c.bookId,name:c.volume,timelines:[]};catalog.books.push(book);}if(!book.timelines.includes(c.timeline))book.timelines.push(c.timeline);}
 return catalog;
}
export function writeCatalog(catalog:Catalog){localStorage.setItem(CATALOG_KEY,JSON.stringify(normalizeCatalog(catalog)));}
export function sameBook<T extends {bookId:string}>(rows:T[],bookId:string){return rows.filter(c=>c.bookId===bookId);}
