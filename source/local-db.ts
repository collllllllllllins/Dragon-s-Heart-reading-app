const DB='longxin-library-v3';
let opening:Promise<IDBDatabase>|undefined;
function openDB(){
 if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('library');request.onerror=()=>{opening=undefined;reject(request.error);};request.onblocked=()=>{opening=undefined;reject(Error('请关闭其他书房标签页后重试。'));};request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=undefined;};resolve(db);};});
 return opening;
}
export async function readLibrary<T>(key:string):Promise<T|undefined>{const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('library','readonly'),r=tx.objectStore('library').get(key);tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
export async function writeLibrary(key:string,value:unknown):Promise<void>{const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('library','readwrite');if(value===undefined)tx.objectStore('library').delete(key);else tx.objectStore('library').put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}
export const hasLargeStorage=()=>typeof indexedDB!=='undefined';
export async function readWriting(){if(hasLargeStorage()){const draft=await readLibrary<unknown>('writing');if(draft!==undefined)return draft;}return JSON.parse(localStorage.getItem('longxin-writing')||'null');}
let writingQueue:Promise<void>=Promise.resolve();
export function writeWriting(value:unknown){const next=writingQueue.catch(()=>{}).then(()=>saveWriting(value));writingQueue=next;return next;}
async function saveWriting(value:unknown){if(hasLargeStorage())await writeLibrary('writing',value);else if(value===undefined)localStorage.removeItem('longxin-writing');else localStorage.setItem('longxin-writing',JSON.stringify(value));}
