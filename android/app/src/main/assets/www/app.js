'use strict';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value || 0);
const readLocalJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const config = window.RONDA_CONFIG;
const supabaseClient = window.supabase?.createClient(config.supabaseUrl, config.supabaseKey, {auth:{persistSession:false,autoRefreshToken:false}});
let currentUser = null;
let currentScreenId = 'screenLogin';
let houseData = [];
let pendingVerifList = [];
let sessionToken = window.AndroidBridge?.readSession?.() || localStorage.getItem('ronda_session') || '';
let lastAccount = readLocalJson('ronda_last_account', null);
let deviceId = window.AndroidBridge?.deviceId?.() || localStorage.getItem('ronda_device');
if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('ronda_device', deviceId); }
for (const key of ['ronda_current_user','ronda_house_data','ronda_verif_list']) localStorage.removeItem(key);
const messages = {
  UNREGISTERED:'Nomor belum terdaftar. Silakan lakukan registrasi terlebih dahulu.',
  PENDING:'Akun Anda belum diverifikasi oleh Admin RT.', PIN:'PIN salah.',
  LOCKED:'Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit.',
  EXISTS:'Nomor WhatsApp sudah terdaftar.', INPUT:'Periksa kembali data yang diisi.',
  SESSION:'Sesi Anda berakhir. Silakan masuk kembali.', FORBIDDEN:'Anda tidak memiliki akses ke fitur ini.',
  DEVICE:'Perangkat belum dapat dikenali. Silakan buka ulang aplikasi.',
  DISTANCE:'Anda belum berada dalam radius titik jimpitan.', ACCURACY:'Lokasi belum cukup akurat. Coba lagi di tempat terbuka.',
  DUPLICATE:'Titik ini sudah dicatat pada tanggal tersebut.', MAP_POINT:'Titik belum memiliki lokasi. Hubungi pengurus RT.'
};
const isAdmin = () => currentUser && ['master','admin','pengurus'].includes(currentUser.role);
function storeSession(token) {
  sessionToken = token || '';
  if (window.AndroidBridge?.writeSession) { window.AndroidBridge.writeSession(sessionToken); localStorage.removeItem('ronda_session'); }
  else if (sessionToken) localStorage.setItem('ronda_session',sessionToken);
  else localStorage.removeItem('ronda_session');
}
async function api(action, data = {}, auth = false) {
  if (!supabaseClient) throw new Error('Terjadi kendala menghubungkan aplikasi. Silakan coba lagi.');
  const {data:result,error} = await supabaseClient.rpc(auth?'ronda_auth':'ronda_data', {
    p_action:action,p_data:{...data,device:deviceId},p_token:sessionToken
  });
  if (error) { console.error('[Ronda]',action,error); throw new Error('Terjadi kendala memuat data. Silakan coba lagi.'); }
  if (result?.error) {
    if (result.error==='SESSION' && currentUser) clearActiveSession();
    const e = new Error(messages[result.error] || 'Terjadi kendala memuat data. Silakan coba lagi.');
    e.code=result.error; throw e;
  }
  return result;
}
let toastTimer;
function showToast(message, success=true) {
  $('globalToastMessage').textContent=message;
  $('globalToastIcon').textContent=success?'check':'priority_high';
  $('globalToast').classList.remove('opacity-0','-translate-y-12','pointer-events-none');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('globalToast').classList.add('opacity-0','-translate-y-12','pointer-events-none'),5000);
}
async function runAction(button, work) {
  if (button?.disabled) return;
  if (button) button.disabled=true;
  try { return await work(); } catch(e) { console.error('[Ronda]',e); showToast(e.message,false); }
  finally { if (button) button.disabled=false; }
}
function navigateToScreen(id) {
  if (id==='screenDashboard' && !currentUser) id='screenLogin';
  document.querySelectorAll('.app-screen').forEach(el=>el.classList.toggle('hidden',el.id!==id));
  currentScreenId=id; window.scrollTo(0,0);
}
function openModalById(id) { const el=$(id); if(el) { el.classList.remove('hidden'); el.classList.add('flex'); } }
function closeModalById(id) { const el=$(id); if(el) { el.classList.add('hidden'); el.classList.remove('flex'); } }
function handleBackdropClick(event,id) { if(event.target===event.currentTarget) closeModalById(id); }
function updateHistory() {
  lastAccount={id:currentUser.id,name:currentUser.name,phone:currentUser.phone,avatar:currentUser.avatar,
    biometric:lastAccount?.id===currentUser.id && !!lastAccount.biometric,
    biometricAsked:lastAccount?.id===currentUser.id && !!lastAccount.biometricAsked};
  localStorage.setItem('ronda_last_account',JSON.stringify(lastAccount));
}
function renderPersonalLogin(standard=false) {
  const account=standard?null:lastAccount;
  $('loginAvatar').src=account?.avatar || 'icons/icon-192.png';
  $('loginHeading').textContent=account?'Selamat Datang':'Masuk Akun';
  $('loginSubheading').textContent=account?.name || 'Ronda & Jimpitan RT 01 / RW 02';
  $('input-whatsapp').value=account?.phone || '';
  $('input-whatsapp').readOnly=!!account;
  $('input-pin').value='';
  $('biometricLogin').classList.toggle('hidden',!account?.biometric || !window.AndroidBridge?.unlockBiometric);
  $('switchAccount').classList.toggle('hidden',!account);
}
function clearActiveSession() {
  storeSession(''); currentUser=null; houseData=[]; pendingVerifList=[];
  document.querySelectorAll('.fixed.inset-0.flex').forEach(el=>closeModalById(el.id));
  navigateToScreen('screenLogin'); renderPersonalLogin();
}
async function finishLogin(result) {
  storeSession(result.token); currentUser=result.account; updateHistory();
  $('input-pin').value=''; renderIdentity(); navigateToScreen('screenDashboard');
  await fetchSupabaseData();
  if (window.AndroidBridge?.enrollBiometric && !lastAccount.biometricAsked) openModalById('biometricSetup');
}
async function handleLoginSubmit(event) {
  event?.preventDefault();
  return runAction($('btnLoginSubmit'),async()=>{
    const data={phone:$('input-whatsapp').value,pin:$('input-pin').value};
    if (!/^\d{6}$/.test(data.pin)) throw new Error('PIN harus terdiri dari 6 angka.');
    let result;
    try { result=await api('login',data,true); }
    catch(e) {
      if(e.code!=='DEVICE_BOUND') throw e;
      if(!confirm('Akun ini sudah digunakan pada perangkat lain. Lepaskan perangkat lama?')) return;
      result=await api('login',{...data,replace_device:true},true);
    }
    await finishLogin(result);
  });
}
async function handleLogout() {
  return runAction(null,async()=>{
    await api('logout',{},true);
    clearActiveSession(); showToast('Anda telah keluar dari akun.');
  });
}
async function switchAccount() {
  if(currentUser) { try { await api('logout',{},true); } catch(e) { showToast(e.message,false); return; } }
  clearActiveSession(); renderPersonalLogin(true);
}
function togglePinVisibility() { const input=$('input-pin'); input.type=input.type==='password'?'text':'password'; $('pin-icon').textContent=input.type==='password'?'visibility':'visibility_off'; }
function openRegisterModal() {
  $('formRegistration').classList.remove('hidden'); $('regApprovalState').classList.add('hidden');
  $('registrationAvatar').src=lastAccount?.avatar || 'icons/icon-192.png';
  openModalById('modalRegister');
}
function closeRegisterModal() { closeModalById('modalRegister'); }
async function handleRegistrationSubmit(event) {
  event.preventDefault();
  return runAction(event.submitter,async()=>{
    if($('reg-pin').value!==$('reg-pin-confirm').value) throw new Error('PIN dan konfirmasi PIN harus sama.');
    await api('register',{name:$('reg-name').value,phone:$('reg-phone').value,pin:$('reg-pin').value},true);
    $('resSummaryName').textContent=$('reg-name').value; $('resSummaryPhone').textContent=$('reg-phone').value;
    $('reg-pin').value=''; $('reg-pin-confirm').value='';
    $('formRegistration').classList.add('hidden'); $('regApprovalState').classList.remove('hidden');
    showToast('Pendaftaran tersimpan. Silakan menunggu verifikasi Admin RT.');
  });
}
function handleCheckApprovalStatus() { showToast('Silakan masuk dengan PIN untuk memeriksa status verifikasi.'); closeRegisterModalAndFillLogin(); }
function closeRegisterModalAndFillLogin() { closeRegisterModal(); renderPersonalLogin(true); $('input-whatsapp').value=$('resSummaryPhone').textContent; }
function openLupaPinModal() { showToast('Hubungi pengurus RT untuk bantuan pemulihan akun.',false); }
function closeLupaPinModal() { closeModalById('modalLupaPin'); }
function applyRecoveredPin() { closeLupaPinModal(); openLupaPinModal(); }
function skipBiometric() { lastAccount.biometricAsked=true; localStorage.setItem('ronda_last_account',JSON.stringify(lastAccount)); closeModalById('biometricSetup'); }
async function enableBiometric() {
  await runAction($('enableBiometric'),async()=>{
    const {credential}=await api('biometric_enable',{},true);
    window._biometricStored=async success=>{
      if(success) { lastAccount.biometric=true; skipBiometric(); showToast('Login sidik jari aktif.'); }
      else { await api('biometric_disable',{},true).catch(console.error); showToast('Sidik jari belum aktif. Gunakan PIN.',false); }
    };
    window.AndroidBridge.enrollBiometric(credential);
  });
}
function handleBiometricLogin() {
  if(!lastAccount?.biometric || !window.AndroidBridge?.unlockBiometric) return;
  window._biometricCredential=credential=>runAction($('biometricLogin'),async()=>{
    if(!credential) throw new Error('Sidik jari belum berhasil. Silakan gunakan PIN.');
    const result=await api('biometric_login',{credential},true);
    if(result.account.id!==lastAccount.id) { await api('logout',{device:deviceId},true); throw new Error('Silakan masuk dengan PIN akun ini.'); }
    await finishLogin(result);
  });
  window.AndroidBridge.unlockBiometric();
}
function renderIdentity() {
  for(const id of ['headerProfileName','profileModalName']) $(id).textContent=currentUser.name;
  $('headerProfileRole').textContent=isAdmin()?'Pengurus RT':'Warga';
  $('profileModalRole').textContent='RT 01 / RW 02';
  for(const id of ['headerProfileAvatar','profileModalAvatar']) $(id).src=currentUser.avatar || 'icons/icon-192.png';
  document.querySelectorAll('[data-admin]').forEach(el=>el.classList.toggle('hidden',!isAdmin()));
}
function openProfileModal() { if(currentUser) openModalById('profileModal'); }
function closeProfileModal() { closeModalById('profileModal'); }
function triggerChangeAvatar() { $('avatarFileInput').click(); }
async function handleAvatarFileChange(event) {
  const file=event.target.files[0];
  if(!file) return;
  return runAction(null,async()=>{
    if(!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size>5*1024*1024) throw new Error('Pilih foto JPG, PNG, atau WebP maksimal 5 MB.');
    const bitmap=await createImageBitmap(file); const canvas=document.createElement('canvas');
    canvas.width=256; canvas.height=256; const size=Math.min(bitmap.width,bitmap.height);
    canvas.getContext('2d').drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256); bitmap.close();
    const result=await api('avatar',{avatar:canvas.toDataURL('image/jpeg',.8)},true);
    currentUser=result.account; updateHistory(); renderIdentity();
  });
}
async function openVerifAkunModal() {
  if(!isAdmin()) return;
  openModalById('verifAkunModal');
  await runAction(null,async()=>{ const result=await api('accounts',{},true); pendingVerifList=result.accounts; renderVerifPendingList(); });
}
function closeVerifAkunModal() { closeModalById('verifAkunModal'); }
function renderVerifPendingList() {
  $('pendingVerifBadge').textContent=pendingVerifList.filter(x=>x.status==='pending').length+' Menunggu';
  $('verifPendingListContainer').innerHTML=pendingVerifList.map(a=>`<div class="ronda-row"><strong>${escapeHtml(a.name)}</strong><p>${escapeHtml(a.phone)} / ${escapeHtml(a.status)}</p><div class="ronda-actions">${a.status==='pending'?`<button class="ronda-button" onclick="handleVerifDecision('${a.id}',true)">Setujui</button><button class="ronda-button ronda-danger" onclick="handleVerifDecision('${a.id}',false)">Tolak</button>`:''}${currentUser.role==='master' && a.status==='approved' && a.role!=='master'?`<label class="ronda-label">Hak akses<select class="ronda-field" onchange="changeRole('${a.id}',this.value)">${['warga','pengurus','admin'].map(role=>`<option ${a.role===role?'selected':''}>${role}</option>`).join('')}</select></label>`:''}</div></div>`).join('') || '<p class="ronda-empty">Belum ada pendaftaran.</p>';
}
async function handleVerifDecision(id,approved) { await runAction(null,async()=>{await api('verify',{id,status:approved?'approved':'rejected'},true); await openVerifAkunModal();}); }
async function changeRole(id,role) { await runAction(null,async()=>{await api('role',{id,role},true); await openVerifAkunModal();}); }
function openUtilitasModal() { openModalById('utilitasModal'); }
function closeUtilitasModal() { closeModalById('utilitasModal'); }
document.addEventListener('DOMContentLoaded',async()=>{
  renderPersonalLogin(); navigateToScreen('screenLogin');
  $('shiftScheduleTitle').textContent=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  if(sessionToken) {
    $('btnLoginSubmit').disabled=true;
    try { const result=await api('session',{},true); currentUser=result.account; updateHistory(); renderIdentity(); navigateToScreen('screenDashboard'); await fetchSupabaseData(); }
    catch(e) { console.warn('[Session]',e); if(e.code==='SESSION') storeSession(''); showToast(e.message,false); }
    finally { $('btnLoginSubmit').disabled=false; }
  }
  setInterval(()=>{ if(currentUser && !document.hidden) fetchSupabaseData(); },30000);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('[Offline shell]',e));
});
