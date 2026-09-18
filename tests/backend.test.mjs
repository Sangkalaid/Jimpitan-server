import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('server authentication, authorization and operational integrity',async t=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try {
  await db.exec('create role anon; create role authenticated;');
  for(const file of ['202609170001_foundation.sql','202609170002_operations.sql'])
   await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const device='test-device-00000000000000000000000001';
  const other='test-device-00000000000000000000000002';
  const call=async(action,data={},token='',auth=false,dev=device)=>{
   const result=await db.query(`select public.${auth?'ronda_auth':'ronda_data'}($1,$2::jsonb,$3) result`,[action,JSON.stringify({...data,device:dev}),token]);
   return result.rows[0].result;
  };
  let admin,user,point;
  await t.test('unknown account and incorrect PIN cannot login',async()=>{
   assert.equal((await call('login',{phone:'081234567890',pin:'000000'},'',true)).error,'UNREGISTERED');
   assert.equal((await call('login',{phone:'085877672699',pin:'000000'},'',true)).error,'PIN');
   admin=await call('login',{phone:'085877672699',pin:'123456'},'',true);
   assert.equal(admin.account.role,'master'); assert.equal(admin.token.length,64);
  });
  await t.test('registration stays pending and cannot self-verify',async()=>{
   assert.equal((await call('register',{phone:'081234567890',pin:'654321',name:'Test Warga'},'',true)).status,'pending');
   assert.equal((await call('login',{phone:'081234567890',pin:'654321'},'',true)).error,'PENDING');
   assert.equal((await call('verify',{id:admin.account.id,status:'approved'},'',true)).error,'SESSION');
   const accounts=await call('accounts',{},admin.token,true); user=accounts.accounts.find(a=>a.phone==='6281234567890');
   assert(!JSON.stringify(accounts).includes('pin_hash'));
   assert.equal((await call('verify',{id:user.id,status:'approved'},admin.token,true)).ok,true);
   user=await call('login',{phone:'081234567890',pin:'654321'},'',true);
   assert.equal(user.account.role,'warga');
  });
  await t.test('resident cannot mutate admin modules',async()=>{
   for(const action of ['point_save','team_save','complaint_reply','route_save']) assert.equal((await call(action,{},user.token)).error,'FORBIDDEN');
   assert.equal((await call('role',{id:admin.account.id,role:'warga'},user.token,true)).error,'FORBIDDEN');
  });
  await t.test('device replacement revokes all old sessions',async()=>{
   assert.equal((await call('login',{phone:'081234567890',pin:'654321'},'',true,other)).error,'DEVICE_BOUND');
   const replacement=await call('login',{phone:'081234567890',pin:'654321',replace_device:true},'',true,other);
   assert.equal((await call('dashboard',{},user.token)).error,'SESSION');
   assert.equal((await call('session',{},replacement.token,true,other)).account.id,user.account.id);
   user=await call('login',{phone:'081234567890',pin:'654321',replace_device:true},'',true);
  });
  await t.test('GPS radius, accuracy and duplicate check-in enforced by server',async()=>{
   await call('point_save',{name:'Test Point',latitude:-7.78,longitude:110.36},admin.token);
   point=(await call('dashboard',{},admin.token)).points[0];
   const day=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
   const data={point_id:point.id,day,status:'pasang',latitude:-7.78,longitude:110.36,accuracy:3};
   assert.equal((await call('checkin',data,user.token)).error,'FORBIDDEN');
   assert.equal((await call('checkin',{...data,latitude:0},admin.token)).error,'DISTANCE');
   assert.equal((await call('checkin',{...data,accuracy:80},admin.token)).error,'ACCURACY');
   assert.equal((await call('checkin',data,admin.token)).ok,true);
   assert.equal((await call('checkin',data,admin.token)).error,'DUPLICATE');
   const dash=await call('dashboard',{day},admin.token); assert.equal(dash.points[0].paid,true); assert.equal(dash.points[0].occupied,true); assert.equal(dash.total,500);
   const report=await call('report',{day,period:'hari'},admin.token); assert.equal(report.amount,500); assert.equal(report.transactions,1);
  });
  await t.test('complaints are private, responses persist',async()=>{
   await call('complaint_create',{body:'Test complaint'},user.token);
   const list=await call('complaints',{},admin.token); assert.equal(list.complaints.length,1);
   await call('complaint_reply',{id:list.complaints[0].id,body:'Test response',status:'Diproses'},admin.token);
   assert.equal((await call('complaints',{},user.token)).complaints[0].replies[0].body,'Test response');
  });
  await t.test('logout revokes session, biometric credential is separate and device-bound',async()=>{
   const {credential}=await call('biometric_enable',{},user.token,true);
   await call('logout',{},user.token,true);
   assert.equal((await call('session',{},user.token,true)).error,'SESSION');
   assert.equal((await call('biometric_login',{credential},'',true,other)).error,'SESSION');
   assert.equal((await call('biometric_login',{credential},'',true)).account.id,user.account.id);
  });
  await t.test('admin can delete registered accounts without deleting history',async()=>{
   user=await call('login',{phone:'081234567890',pin:'654321'},'',true);
   assert.equal((await call('account_delete',{id:admin.account.id},user.token,true)).error,'FORBIDDEN');
   assert.equal((await call('account_delete',{id:admin.account.id},admin.token,true)).error,'FORBIDDEN');
   assert.equal((await call('account_delete',{id:user.account.id},admin.token,true)).ok,true);
   assert.equal((await call('login',{phone:'081234567890',pin:'654321'},'',true)).error,'UNREGISTERED');
   assert.equal((await call('register',{phone:'081234567890',pin:'111111',name:'Warga Baru'},'',true)).status,'pending');
   const accounts=await call('accounts',{},admin.token,true);
   assert.equal(accounts.accounts.some(a=>a.id===user.account.id),false);
  });
  await t.test('anonymous role cannot read private tables',async()=>{
   await db.exec('set role anon');
   await assert.rejects(db.query('select * from ronda.accounts'),/permission denied/);
   assert.equal((await call('dashboard')).error,'SESSION');
   await db.exec('reset role');
  });
 } finally {await db.close();}
});
