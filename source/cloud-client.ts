import {createClient,type SupabaseClient} from '@supabase/supabase-js';
export type CloudConfig={url:string;publishableKey:string};
export function parseCloudConfig(value:unknown):CloudConfig{
 const raw=value as Partial<CloudConfig>|null;
 if(!raw||typeof raw.url!=='string'||typeof raw.publishableKey!=='string'||!raw.publishableKey.startsWith('sb_publishable_'))throw Error('云端公开配置无效');
 const url=new URL(raw.url);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('云端项目地址无效');
 return {url:url.origin,publishableKey:raw.publishableKey};
}
export async function timeoutFetch(input:RequestInfo|URL,init:RequestInit={}):Promise<Response>{
 const controller=new AbortController(),abort=()=>controller.abort();
 const signal=init.signal;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(abort,12000);
 try{return await fetch(input,{...init,signal:controller.signal});}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
let clientPromise:Promise<SupabaseClient>|undefined;
export function loadCloudClient():Promise<SupabaseClient>{
 if(!clientPromise)clientPromise=(async()=>{
  const response=await timeoutFetch(new URL('./cloud-config.json',window.location.href),{cache:'no-store'});
  if(!response.ok)throw Error('暂时无法读取云端配置');
  const config=parseCloudConfig(await response.json());
  return createClient(config.url,config.publishableKey,{global:{fetch:timeoutFetch},auth:{storageKey:'longxin-cloud-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 })().catch(error=>{clientPromise=undefined;throw error;});
 return clientPromise;
}
