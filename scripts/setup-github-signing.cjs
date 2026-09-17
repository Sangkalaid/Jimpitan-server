// Creates a private release key once and uploads it only to the named repository's encrypted secrets.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const sodium=require('libsodium-wrappers');
const repo='Sangkalaid/Jimpitan-server';
async function main() {
 const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,GCM_INTERACTIVE:'never'}});
 const token=raw.split('\n').find(s=>s.startsWith('password='))?.slice(9);
 if(!token) throw new Error('GitHub credential unavailable');
 async function api(endpoint,options={}) {
  const r=await fetch('https://api.github.com/repos/'+repo+endpoint,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'}});
  if(!r.ok) throw new Error('GitHub request failed: '+r.status);
  return r.status===204?null:r.json();
 }
 const existing=await api('/actions/secrets');
 if(existing.secrets.some(s=>s.name==='ANDROID_KEYSTORE_BASE64')) { console.log('Signing key already configured; unchanged.'); return; }
 const dir=path.join(os.homedir(),'.ronda-signing'); fs.mkdirSync(dir,{recursive:true,mode:0o700});
 if(process.platform==='win32') execFileSync('icacls',[dir,'/inheritance:r','/grant:r',`${os.userInfo().username}:(OI)(CI)F`],{stdio:'ignore'});
 const store=path.join(dir,'ronda-release.p12'); const passwordFile=path.join(dir,'password.txt');
 const alias='ronda-release';
 if(!fs.existsSync(store)) {
  const password=crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(passwordFile,password,{mode:0o600,flag:'wx'});
  const openssl=process.platform==='win32'?'C:\\Program Files\\Git\\usr\\bin\\openssl.exe':'openssl';
  const env={...process.env,RONDA_SIGN_PASS:password};
  const key=path.join(dir,'private-key.pem'), cert=path.join(dir,'certificate.pem');
  execFileSync(openssl,['req','-new','-x509','-newkey','rsa:3072','-keyout',key,'-out',cert,'-days','10000','-subj','/CN=Ronda Jimpitan/O=RT 01 RW 02','-passout','env:RONDA_SIGN_PASS'],{env,stdio:'ignore'});
  execFileSync(openssl,['pkcs12','-export','-inkey',key,'-in',cert,'-out',store,'-name',alias,'-passin','env:RONDA_SIGN_PASS','-passout','env:RONDA_SIGN_PASS'],{env,stdio:'ignore'});
 }
 const password=fs.readFileSync(passwordFile,'utf8');
 const publicKey=await api('/actions/secrets/public-key'); await sodium.ready;
 const secrets={ANDROID_KEYSTORE_BASE64:fs.readFileSync(store).toString('base64'),ANDROID_STORE_PASSWORD:password,ANDROID_KEY_PASSWORD:password,ANDROID_KEY_ALIAS:alias};
 for(const [name,value] of Object.entries(secrets)) {
  const encrypted=sodium.crypto_box_seal(sodium.from_string(value),sodium.from_base64(publicKey.key,sodium.base64_variants.ORIGINAL));
  await api('/actions/secrets/'+name,{method:'PUT',body:JSON.stringify({encrypted_value:sodium.to_base64(encrypted,sodium.base64_variants.ORIGINAL),key_id:publicKey.key_id})});
 }
 console.log('Release signing configured. Private backup: '+dir);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
