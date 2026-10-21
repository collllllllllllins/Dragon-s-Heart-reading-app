import {loadCloudClient} from './cloud-client';
export const CLOUD_BACKUP_MAX_BYTES=45000000;
export function validateBackup(payload:unknown):asserts payload is {format:string;chapters:unknown[]}{
 const p=payload as {format?:unknown;chapters?:unknown};
 if(!p||p.format!=='longxin-backup-v1'||!Array.isArray(p.chapters)||p.chapters.length>1000)throw Error('云备份格式无效。');
 if(new Blob([JSON.stringify(payload)]).size>CLOUD_BACKUP_MAX_BYTES)throw Error('本轮云备份最多 45 MB，请先使用本机 JSON 备份。');
}
async function authorClient(){
 const client=await loadCloudClient();const {data,error}=await client.auth.getUser();
 if(error||!data.user)throw Error('请先登录作者账号。');
 const access=await client.from('longxin_authors').select('user_id').eq('user_id',data.user.id).maybeSingle();
 if(access.error||!access.data)throw Error('作者权限尚未核验，请重新登录。');
 return {client,userId:data.user.id};
}
export async function saveCloudBackup(payload:unknown){
 validateBackup(payload);const {client,userId}=await authorClient();
 const {data,error}=await client.from('longxin_backups').insert({user_id:userId,chapter_count:payload.chapters.length,payload}).select('id,created_at').single();
 if(error)throw Error('云端保存未确认，请先刷新云备份列表检查，再决定是否重试。本机文稿仍保留。');
 return data;
}
export async function listCloudBackups(){
 const {client,userId}=await authorClient();
 const {data,error}=await client.from('longxin_backups').select('id,created_at,chapter_count').eq('user_id',userId).order('created_at',{ascending:false}).limit(5);
 if(error)throw Error('云备份列表读取失败，请稍后重试。');return data||[];
}
export async function readCloudBackup(id:string){
 const {client,userId}=await authorClient();
 const {data,error}=await client.from('longxin_backups').select('payload').eq('user_id',userId).eq('id',id).single();
 if(error||!data)throw Error('云备份读取失败，本机文稿未改变。');validateBackup(data.payload);return data.payload;
}
