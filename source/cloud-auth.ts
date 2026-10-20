import {useCallback,useEffect,useRef,useState} from 'react';
import type {Session,SupabaseClient,User} from '@supabase/supabase-js';
import {loadCloudClient} from './cloud-client';
export type CloudState={connection:'checking'|'connected'|'error';checkingAccount:boolean;user:Pick<User,'id'|'email'>|null;isAuthor:boolean;error:string};
const initial:CloudState={connection:'checking',checkingAccount:false,user:null,isAuthor:false,error:''};
function message(error:unknown){const code=(error as {code?:string})?.code;if(code==='invalid_credentials'||code==='invalid_login_credentials')return '邮箱或密码不正确，请检查后重试。';if(code==='email_not_confirmed')return '请先确认这个站点账号的邮箱。';if(code==='over_request_rate_limit')return '登录尝试较多，请稍后再试。';return '连接暂未完成，请检查网络后重试。';}
export function useCloudAuth(){
 const [state,setState]=useState<CloudState>(initial),[attempt,setAttempt]=useState(0),[pending,setPending]=useState(false);
 const client=useRef<SupabaseClient|null>(null),epoch=useRef(0),alive=useRef(false);
 const checkAccount=useCallback(async(session:Session|null)=>{
  const id=++epoch.current;
  if(!session){if(alive.current)setState(s=>({...s,checkingAccount:false,user:null,isAuthor:false}));return;}
  setState(s=>({...s,checkingAccount:true,isAuthor:false,error:''}));
  try{
   const current=client.current;if(!current)return;
   // Validate with Auth first; stored session/user metadata never confers author rights.
   const {data,error}=await current.auth.getUser();if(error||!data.user)throw error||Error('登录信息无效');
   const access=await current.from('longxin_authors').select('user_id').eq('user_id',data.user.id).maybeSingle();
   if(access.error)throw access.error;
   if(alive.current&&epoch.current===id)setState(s=>({...s,checkingAccount:false,user:{id:data.user.id,email:data.user.email},isAuthor:access.data?.user_id===data.user.id,error:''}));
  }catch(error){if(alive.current&&epoch.current===id)setState(s=>({...s,checkingAccount:false,user:null,isAuthor:false,error:message(error)}));}
 },[]);
 useEffect(()=>{
  alive.current=true;let cancelled=false,unsubscribe=()=>{},timer:ReturnType<typeof setTimeout>|undefined;
  setState(initial);
  (async()=>{
   try{const current=await loadCloudClient();if(cancelled)return;client.current=current;
    const probe=await current.rpc('longxin_cloud_version');if(probe.error||probe.data!==1)throw probe.error||Error('云端版本未就绪');
    if(cancelled)return;setState(s=>({...s,connection:'connected',error:''}));
    const {data}=current.auth.onAuthStateChange((event,session)=>{
     if(cancelled||event==='INITIAL_SESSION')return;
     // Supabase Auth callbacks stay synchronous; defer any SDK calls to avoid its lock.
     if(timer)clearTimeout(timer);++epoch.current;
     if(!session){setState(s=>({...s,user:null,isAuthor:false,checkingAccount:false,error:''}));return;}
     setState(s=>({...s,isAuthor:false,checkingAccount:true}));timer=setTimeout(()=>{if(!cancelled)void checkAccount(session);},0);
    });unsubscribe=()=>data.subscription.unsubscribe();
    const saved=await current.auth.getSession();if(saved.error)throw saved.error;if(!cancelled)await checkAccount(saved.data.session);
   }catch(error){if(!cancelled)setState({...initial,connection:'error',error:message(error)});}
  })();
  return()=>{cancelled=true;alive.current=false;++epoch.current;if(timer)clearTimeout(timer);unsubscribe();client.current=null;};
 },[attempt,checkAccount]);
 const signIn=async(email:string,password:string)=>{
  if(!client.current||pending)return;setPending(true);setState(s=>({...s,error:''}));
  try{const {data,error}=await client.current.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;await checkAccount(data.session);}
  catch(error){if(alive.current)setState(s=>({...s,isAuthor:false,error:message(error)}));}
  finally{if(alive.current)setPending(false);}
 };
 const signOut=async()=>{
  if(!client.current||pending)return;setPending(true);++epoch.current;setState(s=>({...s,isAuthor:false,checkingAccount:false,error:''}));
  try{const {error}=await client.current.auth.signOut({scope:'local'});if(error)throw error;if(alive.current)setState(s=>({...s,user:null,isAuthor:false}));}
  catch(error){if(alive.current)setState(s=>({...s,error:'退出尚未完成，请重试。'}));}
  finally{if(alive.current)setPending(false);}
 };
 const refresh=async()=>{if(!client.current||pending)return;setPending(true);try{const saved=await client.current.auth.getSession();if(saved.error)throw saved.error;await checkAccount(saved.data.session);}catch(error){if(alive.current)setState(s=>({...s,isAuthor:false,error:message(error)}));}finally{if(alive.current)setPending(false);}};
 return {...state,pending,signIn,signOut,refresh,retry:()=>setAttempt(n=>n+1)};
}
export type CloudAuth=ReturnType<typeof useCloudAuth>;
