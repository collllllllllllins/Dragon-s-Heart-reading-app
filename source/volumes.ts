const KEY='longxin-volume-names-v1';
export function readVolumeNames():string[]{try{const raw=localStorage.getItem(KEY);if(raw===null)return ['元年','一千','两千'];const rows=JSON.parse(raw);return Array.isArray(rows)?rows.filter((s:unknown)=>typeof s==='string'&&s.trim()&&s.length<=60):[];}catch{return [];}}
export function writeVolumeNames(names:string[]){localStorage.setItem(KEY,JSON.stringify([...new Set(names)]));}
