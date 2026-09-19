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
let waitingBiometricSetup = false;
let sessionToken = window.AndroidBridge?.readSession?.() || localStorage.getItem('ronda_session') || '';
let lastAccount = readLocalJson('ronda_last_account', null);
let deviceId = window.AndroidBridge?.deviceId?.() || localStorage.getItem('ronda_device');
let markerColor = localStorage.getItem('ronda_marker_color') || '#2563eb';
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
const normalizeRole = role => String(role || '').toLowerCase().replace(/[-\s]+/g,'_');
const isMaster = user => ['master','master_admin'].includes(normalizeRole(user?.role));
const isAdmin = () => currentUser && ['master','master_admin','admin','pengurus'].includes(normalizeRole(currentUser.role));
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
  $('input-whatsapp').readOnly=false;
  $('input-pin').value='';
  $('biometricLogin').classList.toggle('hidden',!account?.biometric || !window.AndroidBridge?.unlockBiometric);
  $('switchAccount').classList.toggle('hidden',!account);
}
function clearActiveSession() {
  storeSession(''); currentUser=null; houseData=[]; pendingVerifList=[];
  document.querySelectorAll('.fixed.inset-0.flex').forEach(el=>closeModalById(el.id));
  navigateToScreen('screenLogin'); renderPersonalLogin();
}
function enterDashboard() {
  if(!currentUser) return;
  renderIdentity(); navigateToScreen('screenDashboard');
  fetchSupabaseData();
}
async function finishLogin(result) {
  storeSession(result.token); currentUser=result.account; updateHistory();
  $('input-pin').value='';
  if (window.AndroidBridge?.enrollBiometric && !lastAccount.biometricAsked) {
    waitingBiometricSetup=true;
    openModalById('biometricSetup');
    return;
  }
  enterDashboard();
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
    if (typeof stopRouteRecording === 'function') stopRouteRecording(false);
    await api('logout',{},true);
    clearActiveSession(); showToast('Anda telah keluar dari akun.');
  });
}
async function switchAccount() {
  if (typeof stopRouteRecording === 'function') stopRouteRecording(false);
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
function openLupaPinModal() { $('forgotPinStart').classList.remove('hidden'); $('forgotPinRequest').classList.add('hidden'); $('forgotPinNew').classList.add('hidden'); openModalById('modalLupaPin'); }
function closeLupaPinModal() { closeModalById('modalLupaPin'); }
function applyRecoveredPin() { closeLupaPinModal(); }
function showForgotRequest() { $('forgotPinStart').classList.add('hidden'); $('forgotPinNew').classList.add('hidden'); $('forgotPinRequest').classList.remove('hidden'); $('forgotPhone').value=$('input-whatsapp').value; setTimeout(()=>$('forgotPhone').focus(),60); }
function showForgotNewPin(phone='') { $('forgotPinStart').classList.add('hidden'); $('forgotPinRequest').classList.add('hidden'); $('forgotPinNew').classList.remove('hidden'); if(phone) $('resetPhone').value=phone; }
function resetPinWithBiometric() {
  if(!lastAccount?.biometric || !window.AndroidBridge?.unlockBiometric) return showToast('Biometrik belum aktif di perangkat ini.',false);
  window._biometricCredential=credential=>runAction(null,async()=>{
    if(!credential) throw new Error('Verifikasi biometrik gagal. Silakan coba lagi atau ajukan reset ke Pengurus.');
    const result=await api('biometric_login',{credential},true);
    if(result.account.id!==lastAccount.id) throw new Error('Biometrik tidak cocok dengan akun terakhir di perangkat ini.');
    storeSession(result.token); currentUser=result.account; updateHistory();
    closeLupaPinModal(); openModalById('modalLupaPin'); showForgotNewPin(lastAccount.phone); $('resetViaBiometric').value=credential;
  });
  window.AndroidBridge.unlockBiometric();
}
async function requestPinReset(event) {
  event.preventDefault();
  await runAction(event.submitter,async()=>{
    await api('pin_reset_request',{phone:$('forgotPhone').value},true);
    showToast('Permintaan reset dikirim ke Pengurus RT.');
    closeLupaPinModal();
  });
}
async function saveNewPin(event) {
  event.preventDefault();
  await runAction(event.submitter,async()=>{
    const pin=$('newPin').value, confirmPin=$('newPinConfirm').value;
    if(pin!==confirmPin) throw new Error('PIN baru dan konfirmasi harus sama.');
    if(!/^\d{6}$/.test(pin)) throw new Error('PIN harus 6 angka.');
    const credential=$('resetViaBiometric').value;
    if(credential) await api('pin_change_biometric',{credential,pin},true);
    else await api('pin_reset_complete',{phone:$('resetPhone').value,pin},true);
    showToast('PIN berhasil diperbarui. Silakan login kembali.');
    storeSession(''); closeLupaPinModal(); renderPersonalLogin(true);
  });
}
function skipBiometric() {
  lastAccount.biometricAsked=true; localStorage.setItem('ronda_last_account',JSON.stringify(lastAccount));
  closeModalById('biometricSetup');
  if(waitingBiometricSetup) { waitingBiometricSetup=false; enterDashboard(); }
}
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
  document.querySelectorAll('.marker-color-swatch').forEach(el=>el.classList.toggle('selected',rgbToHex(getComputedStyle(el).backgroundColor)===markerColor.toLowerCase()));
}
function rgbToHex(rgb) {
  const m=rgb.match(/\d+/g); if(!m) return rgb;
  return '#'+m.slice(0,3).map(x=>Number(x).toString(16).padStart(2,'0')).join('');
}
function setMarkerColor(color) { markerColor=color; localStorage.setItem('ronda_marker_color',color); renderIdentity(); showToast('Warna marker disimpan.'); }
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
  await runAction(null,async()=>{ const result=await api('accounts',{},true); pendingVerifList=result.accounts; await renderVerifPendingList(); });
}
function closeVerifAkunModal() { closeModalById('verifAkunModal'); }
async function renderVerifPendingList() {
  $('pendingVerifBadge').textContent=pendingVerifList.filter(x=>x.status==='pending').length+' Menunggu';
  const resets=await api('pin_reset_list',{},true).catch(()=>({requests:[]}));
  const resetHtml=(resets.requests||[]).map(r=>`<div class="ronda-row reset-row"><strong>Reset PIN: ${escapeHtml(r.name)}</strong><p>${escapeHtml(r.phone)} / ${escapeHtml(r.status)}</p>${r.status==='pending'?`<div class="ronda-actions"><button class="ronda-button compact" onclick="reviewPinReset('${r.id}','approved')">Setujui</button><button class="ronda-button ronda-danger compact" onclick="reviewPinReset('${r.id}','rejected')">Tolak</button></div>`:'<p class="text-xs text-emerald-700 font-bold">Disetujui, menunggu warga membuat PIN baru.</p>'}</div>`).join('');
  const accountHtml=pendingVerifList.map(a=>{
    const canDelete=a.id!==currentUser.id && !isMaster(a);
    return `<div class="ronda-row"><strong>${escapeHtml(a.name)}</strong><p>${escapeHtml(a.phone)} / ${escapeHtml(a.status)}</p><div class="ronda-actions">${a.status==='pending'?`<button class="ronda-button compact" onclick="handleVerifDecision('${a.id}',true)">Setujui</button><button class="ronda-button ronda-danger compact" onclick="handleVerifDecision('${a.id}',false)">Tolak</button>`:''}${isMaster(currentUser) && a.status==='approved' && !isMaster(a)?`<label class="ronda-label">Akses<select class="ronda-field" onchange="changeRole('${a.id}',this.value)">${['warga','pengurus','admin'].map(role=>`<option ${a.role===role?'selected':''}>${role}</option>`).join('')}</select></label>`:''}${canDelete?`<button class="ronda-button ronda-danger compact" onclick="deleteAccount('${a.id}','${escapeHtml(a.name)}')">Hapus</button>`:''}</div></div>`;
  }).join('');
  $('verifPendingListContainer').innerHTML=resetHtml+accountHtml || '<p class="ronda-empty">Belum ada pendaftaran atau reset PIN.</p>';
}
async function handleVerifDecision(id,approved) { await runAction(null,async()=>{await api('verify',{id,status:approved?'approved':'rejected'},true); await openVerifAkunModal();}); }
async function changeRole(id,role) { await runAction(null,async()=>{await api('role',{id,role},true); await openVerifAkunModal();}); }
async function deleteAccount(id,name) {
  if(!confirm(`Hapus akun ${name}? Akun akan keluar dari semua perangkat dan tidak muncul lagi di daftar.`)) return;
  await runAction(null,async()=>{await api('account_delete',{id},true); showToast('Akun berhasil dihapus.'); await openVerifAkunModal();});
}
async function reviewPinReset(id,status) { await runAction(null,async()=>{await api('pin_reset_review',{id,status},true); showToast(status==='approved'?'Reset PIN disetujui.':'Reset PIN ditolak.'); await openVerifAkunModal();}); }
function showExitDialog() { openModalById('exitAppModal'); return true; }
function closeExitDialog() { closeModalById('exitAppModal'); }
function confirmExitApp() { if(window.AndroidBridge?.exitApp) window.AndroidBridge.exitApp(); else closeExitDialog(); }
function handleNativeBack() {
  const openModal=document.querySelector('.fixed.inset-0.flex');
  if(openModal) { closeModalById(openModal.id); return true; }
  if(currentScreenId==='screenDashboard') return showExitDialog();
  return false;
}
function openUtilitasModal() { openModalById('utilitasModal'); }
function closeUtilitasModal() { closeModalById('utilitasModal'); }
document.addEventListener('DOMContentLoaded',async()=>{
  renderPersonalLogin(); navigateToScreen('screenLogin');
  $('shiftScheduleTitle').textContent=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  if(sessionToken) {
    if(lastAccount?.biometric && window.AndroidBridge?.unlockBiometric) {
      handleBiometricLogin();
    } else {
      $('btnLoginSubmit').disabled=false;
      showToast('Silakan masuk kembali dengan PIN.');
    }
  }
  setInterval(()=>{ if(currentUser && !document.hidden) fetchSupabaseData(); },30000);
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('[Offline shell]',e));
});
