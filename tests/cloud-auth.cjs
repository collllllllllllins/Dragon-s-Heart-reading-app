const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{createRequire}=require('node:module');
const project=path.resolve(__dirname,'..'),localRequire=createRequire(project+'/package.json'),ts=localRequire('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const dom=new JSDOM('<div id="app"></div>',{url:'https://reader.test'});
for(const name of ['window','document','Node','HTMLElement','localStorage','MouseEvent','Event'])global[name]=dom.window[name];
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=localRequire('react'),{act}=React,{createRoot}=localRequire('react-dom/client');
const realClient=require(project+'/source/cloud-client.ts');
assert.throws(()=>realClient.parseCloudConfig({url:'https://example.supabase.co',publishableKey:'sb_secret_never_ship'}));
assert.throws(()=>realClient.parseCloudConfig({url:'http://example.supabase.co',publishableKey:'sb_publishable_test'}));
assert.throws(()=>realClient.parseCloudConfig({url:'https://attacker.test',publishableKey:'sb_publishable_test'}));
let session=null,listener=()=>{},author=false,resolveMembership=null,delayMembership=false;
const user={id:'10000000-0000-4000-8000-000000000001',email:'author@example.test',user_metadata:{role:'author'}};
const fake={
 rpc:async()=>({data:1,error:null}),
 from(name){assert.equal(name,'longxin_authors');return {select(columns){assert.equal(columns,'user_id');return {eq(column,id){assert.equal(column,'user_id');assert.equal(id,user.id);return {maybeSingle:()=>delayMembership?new Promise(resolve=>{resolveMembership=resolve;}):Promise.resolve({data:author?{user_id:user.id}:null,error:null})};}};}};},
 auth:{
  onAuthStateChange(fn){listener=fn;return {data:{subscription:{unsubscribe(){listener=()=>{};}}}};},
  getSession:async()=>({data:{session},error:null}),
  getUser:async()=>({data:{user:session?user:null},error:null}),
  signInWithPassword:async({email,password})=>{if(password!=='test-only-password')return {data:{session:null},error:{code:'invalid_credentials'}};session={user,access_token:'test-only-token'};listener('SIGNED_IN',session);return {data:{session},error:null};},
  signOut:async({scope})=>{assert.equal(scope,'local');session=null;listener('SIGNED_OUT',null);return {error:null};}
 }
};
require.cache[require.resolve(project+'/source/cloud-client.ts')].exports.loadCloudClient=async()=>fake;
const {useCloudAuth}=require(project+'/source/cloud-auth.ts'),CloudAccount=require(project+'/source/cloud-account.tsx').default;
let auth;
function Harness(){auth=useCloudAuth();return React.createElement(CloudAccount,{auth,onClose(){}});}
const wait=()=>new Promise(r=>setTimeout(r,10));
const props=el=>el[Object.keys(el).find(k=>k.startsWith('__reactProps'))];
const click=el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
const app=createRoot(document.getElementById('app'));
(async()=>{
 localStorage.setItem('longxin-notes-existing','keep this note');
 await act(async()=>{app.render(React.createElement(Harness));await wait();});
 assert.equal(auth.connection,'connected');assert.equal(auth.user,null);assert(document.querySelector('form'));
 await act(async()=>{props(document.querySelector('[type=email]')).onChange({target:{value:user.email}});props(document.querySelector('[type=password]')).onChange({target:{value:'incorrect'}});});
 await act(async()=>{await props(document.querySelector('form')).onSubmit({preventDefault(){}});});
 assert.equal(document.querySelector('[type=password]').value,'','Password is cleared after a failed login');
 assert(document.querySelector('[role=alert]').textContent.includes('邮箱或密码'));assert.equal(auth.isAuthor,false);
 await act(async()=>{await auth.signIn(user.email,'test-only-password');await wait();});
 assert.equal(auth.user.id,user.id);assert.equal(auth.isAuthor,false,'User-editable author metadata never grants rights');
 author=true;
 await act(async()=>{await auth.refresh();});assert.equal(auth.isAuthor,true,'An actual allowlist membership grants UI access');
 await act(async()=>{await auth.signOut();});assert.equal(auth.user,null);assert.equal(auth.isAuthor,false);assert.equal(localStorage.getItem('longxin-notes-existing'),'keep this note','Signing out leaves manuscripts and notes intact');
 await act(async()=>{await auth.signIn(user.email,'test-only-password');await wait();});
 assert.equal(auth.isAuthor,true);
 delayMembership=true;
 let pendingCheck;
 await act(async()=>{pendingCheck=auth.refresh();await wait();});assert(resolveMembership);
 await act(async()=>{session=null;listener('SIGNED_OUT',null);resolveMembership({data:{user_id:user.id},error:null});await pendingCheck;});
 assert.equal(auth.user,null);assert.equal(auth.isAuthor,false,'A stale response cannot restore author privileges after signout');
 await act(async()=>{app.unmount();});
 console.log('PASS: public-key validation, login errors, password clearing, metadata cannot self-authorize, membership checks, safe signout, stale authorization response suppression.');
})().catch(error=>{console.error(error);process.exitCode=1;});
