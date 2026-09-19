'use strict';
const DAYS=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
let operationalSettings={radius_m:50,max_accuracy_m:30};
let dashboardTotal=0;
let refreshing=false;
let lastReport=null;
let map=null;
let mapMarkers=[];
let userMarker=null;
let routeWatch=null;
let recordedRoute=null;
let routeLine=null;
function localDay(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function moveQuickMenu(direction) {
  const slider=$('quickMenuSlider');
  slider.scrollBy({left:direction*Math.max(140,slider.clientWidth*.55),behavior:'smooth'});
  setTimeout(updateQuickMenuIndicator,260);
}
function updateQuickMenuIndicator() {
  const slider=$('quickMenuSlider'); if(!slider) return;
  const second=slider.scrollLeft > (slider.scrollWidth-slider.clientWidth)/2;
  $('quickDot1')?.classList.toggle('w-6',!second); $('quickDot1')?.classList.toggle('w-2',second);
  $('quickDot1')?.classList.toggle('bg-brand-500',!second); $('quickDot1')?.classList.toggle('bg-slate-300',second);
  $('quickDot2')?.classList.toggle('w-6',second); $('quickDot2')?.classList.toggle('w-2',!second);
  $('quickDot2')?.classList.toggle('bg-brand-500',second); $('quickDot2')?.classList.toggle('bg-slate-300',!second);
}
async function fetchSupabaseData() {
  if(!currentUser || refreshing) return;
  refreshing=true;
  try {
    const result=await api('dashboard',{day:localDay()});
    if(!currentUser) return;
    houseData=result.points; operationalSettings=result.settings; dashboardTotal=result.total;
    renderDashboard(); $('cloudStatusText').textContent='Data terbaru';
  } catch(e) { console.warn('[Sync]',e); $('cloudStatusText').textContent='Belum diperbarui'; }
  finally { refreshing=false; }
}
function getDashboardStats() {
  const unique=[...new Map(houseData.map(h=>[h.id,h])).values()];
  const checked=unique.filter(h=>h.checked_today || h.status_today==='pasang' || h.status_today==='kosong' || h.paid);
  const pasang=unique.filter(h=>h.status_today==='pasang' || h.paid), kosong=unique.filter(h=>h.status_today==='kosong');
  const lunas=pasang.filter(h=>h.paid), belum=unique.filter(h=>!checked.some(c=>c.id===h.id));
  return {total:unique.length,pasang:pasang.length,kosong:kosong.length,lunas:lunas.length,belum:belum.length,checked:checked.length,totalUang:dashboardTotal};
}
function renderDashboard() {
  const stats=getDashboardStats();
  $('cardValPasang').textContent=stats.pasang; $('cardValKosong').textContent=stats.kosong; $('cardValLunas').textContent=stats.lunas;
  $('cardSubKosong').textContent='Lihat daftar'; $('cardSubLunas').textContent='Lihat daftar';
  $('progressTitle').textContent=stats.total?'Jimpitan Hari Ini':'Belum Ada Titik';
  const done=stats.total>0 && stats.belum===0;
  $('statusProgressBadge').textContent=done?'Selesai':'Belum';
  $('subtextSummary').textContent=done?'Semua rumah sudah diambil':`${stats.checked}/${stats.total} rumah sudah diambil. Masih ada ${stats.belum} rumah yang belum diambil`;
  $('barFill').style.width=(stats.total?stats.checked/stats.total*100:0)+'%';
  $('sendReportWrap')?.classList.toggle('hidden',!done);
  $('pickupMeta')?.classList.toggle('hidden',true);
  updateDetectedBadge();
  $('shiftScheduleTitle').textContent=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  renderSelectOptions(); renderMapMarkers();
}
function renderSelectOptions() {
  for(const id of ['selectTargetRumah','selectGpsHouse']) {
    const select=$(id); const previous=select.value;
    select.innerHTML='<option value="">Pilih titik jimpitan</option>'+houseData.filter(h=>id==='selectGpsHouse'||h.occupied).map(h=>`<option value="${h.id}">${escapeHtml(h.name)}</option>`).join('');
    if(houseData.some(h=>h.id===previous)) select.value=previous;
  }
}
function openStatDetail(type) {
  const titles={pasang:'Pasang',kosong:'Kosong',lunas:'Lunas'};
  const list=houseData.filter(h=>type==='kosong'?h.status_today==='kosong':type==='lunas'?h.paid:(h.status_today==='pasang'||h.paid));
  const subtitles={pasang:`Total ${list.length} rumah terpasang`,kosong:`Total ${list.length} rumah kosong`,lunas:`Total ${list.length} rumah lunas`};
  openPanel(titles[type],renderPointList(list,type) || emptyPointState(type),subtitles[type]);
}
function updateDetectedBadge() {
  const count=getDashboardStats().belum;
  const badge=$('gpsDetectedBadge');
  if(!badge) return;
  badge.textContent=count>99?'99+':String(count);
  badge.classList.toggle('hidden',count===0);
}
function closeStatDetail() { closeModalById('operationalPanel'); }
function switchProgressState(state) {
  const list=houseData.filter(h=>h.occupied && (state==='complete'?h.paid:!h.paid));
  openPanel(state==='complete'?'Lunas':'Belum',list.map(h=>`<div class="ronda-row">${escapeHtml(h.name)}</div>`).join('') || '<p class="ronda-empty">Tidak ada rumah dalam kategori ini.</p>');
}
function renderPointList(list,type) {
  const palette=['soft-blue','soft-green','soft-cream','soft-slate'];
  return list.map((h,i)=>{
    const status=type==='lunas'?'Lunas':h.status_today==='kosong'?'Tidak Pasang':h.paid?'Lunas':h.status_today==='pasang'?'Pasang':'Belum Diambil';
    const cls=status==='Lunas'?'chip-green':status==='Tidak Pasang'?'chip-red':status==='Belum Diambil'?'chip-amber':'chip-blue';
    return `<div class="point-row ${palette[i%palette.length]}"><div><strong>${escapeHtml(cleanPointName(h.name))}</strong><p>Dukuh Bener RT 01 / RW 02</p></div><span class="status-chip ${cls}">${status}</span></div>`;
  }).join('');
}
function emptyPointState(type) {
  if(type==='kosong') return '<div class="ronda-empty"><strong>Belum ada rumah kosong</strong><p>Semua rumah sudah terpasang jimpitan pada wilayah RT 01 / RW 02.</p></div>';
  return '<p class="ronda-empty">Belum ada data.</p>';
}
function cleanPointName(name='') { return String(name).replace(/^HSE[-\w]*\s*/i,'').trim() || 'Rumah Warga'; }
function openPanel(title,body,subtitle='') {
  $('operationalTitle').textContent=title; $('operationalBody').innerHTML=(subtitle?`<p class="panel-subtitle">${escapeHtml(subtitle)}</p>`:'')+body; openModalById('operationalPanel');
}
function openJimpitanModal() { renderSelectOptions(); onSelectGpsHouseChange(); $('detectedPointHint').textContent=`${getDashboardStats().belum} titik belum diambil`; openModalById('jimpitanModal'); }
function closeJimpitanModal() { closeModalById('jimpitanModal'); }
function onSelectGpsHouseChange() {
  const p=houseData.find(h=>h.id===$('selectGpsHouse').value);
  $('gpsSelectedHouseMeta').textContent=p?`${p.name} / ${p.occupied?'Pasang':'Kosong'}`:'Pilih titik yang sedang dikunjungi.';
}
function getLocation() {
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error('Lokasi tidak tersedia pada perangkat ini.'));
    navigator.geolocation.getCurrentPosition(pos=>{
      if(pos.coords.accuracy>operationalSettings.max_accuracy_m) return reject(new Error(messages.ACCURACY));
      resolve({latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy});
    },error=>reject(new Error(error.code===1?'Izin lokasi ditolak. Izinkan lokasi melalui pengaturan perangkat.':error.code===3?'Lokasi belum ditemukan. Aktifkan GPS lalu coba lagi.':'Lokasi tidak tersedia. Pastikan GPS aktif.')),
    {enableHighAccuracy:true,timeout:20000,maximumAge:0});
  });
}
async function handleGpsRecordStatus(status) {
  const buttons=[...$('jimpitanModal').querySelectorAll('button')];
  if(buttons.some(b=>b.disabled)) return;
  buttons.forEach(b=>b.disabled=true);
  try {
    const point_id=$('selectGpsHouse').value;
    if(!point_id) throw new Error('Pilih titik jimpitan terlebih dahulu.');
    $('gpsStatusAccuracy').textContent='Mencari lokasi perangkat...';
    const location=await getLocation(); $('gpsStatusAccuracy').textContent=`Akurasi ${Math.round(location.accuracy)} m`;
    await api('checkin',{point_id,status,day:localDay(),...location});
    await fetchSupabaseData(); closeJimpitanModal(); showToast('Jimpitan tersimpan.');
  } catch(e) { showToast(e.message,false); }
  finally { buttons.forEach(b=>b.disabled=false); }
}
async function openPengajuanModal() {
  renderSelectOptions(); openModalById('pengajuanModal');
  await renderRequests();
}
function closePengajuanModal() { closeModalById('pengajuanModal'); }
async function submitPengajuan(event) {
  event.preventDefault();
  await runAction(event.submitter,async()=>{
    await api('request_create',{point_id:$('selectTargetRumah').value,amount:Number($('inputNominalLunas').value),day:localDay()});
    showToast('Pengajuan tersimpan dan menunggu pemeriksaan.'); await renderRequests();
  });
}
async function renderRequests() {
  await runAction(null,async()=>{
    const result=await api('requests');
    $('requestList').innerHTML=result.requests.map(r=>`<div class="ronda-row"><strong>${escapeHtml(r.point_name)}</strong><p>${escapeHtml(r.name)} / ${money(r.amount)}</p><p>${escapeHtml(r.status)}</p>${isAdmin()&&r.status==='pending'?`<div class="ronda-actions"><button class="ronda-button" onclick="reviewRequest('${r.id}','approved')">Setujui</button><button class="ronda-button ronda-danger" onclick="reviewRequest('${r.id}','rejected')">Tolak</button></div>`:''}</div>`).join('') || '<p class="ronda-empty">Belum ada pengajuan.</p>';
  });
}
async function reviewRequest(id,status) { if(!confirm('Simpan keputusan pengajuan ini?')) return; await runAction(null,async()=>{await api('request_review',{id,status}); await renderRequests(); await fetchSupabaseData();}); }
function openRekapModal() { openModalById('rekapModal'); switchRekapTab('hari'); }
function closeRekapModal() { closeModalById('rekapModal'); }
let reportRequest=0;
async function switchRekapTab(period) {
  const request=++reportRequest;
  $('rekapTotalUangVal').textContent='Memuat...'; lastReport=null;
  for(const [key,id] of Object.entries({hari:'tabRekapHari',minggu:'tabRekapMinggu',bulan:'tabRekapBulan'})) {
    $(id).classList.toggle('bg-white',key===period); $(id).setAttribute('aria-selected',String(key===period));
  }
  try {
    const report=await api('report',{day:localDay(),period});
    if(request!==reportRequest) return;
    lastReport=report;
    $('rekapTotalUangVal').textContent=money(report.amount);
    $('rekapPeriodBadge').textContent=formatReportPeriod(period,report);
    $('rekapRateSub').textContent=report.started?`${report.transactions} catatan`:'Belum ada catatan';
    $('rekapPasangRumah').textContent=report.pasang+' Rumah'; $('rekapKosongRumah').textContent=report.kosong+' Rumah';
  } catch(e) { if(request===reportRequest) { $('rekapTotalUangVal').textContent='Belum tersedia'; showToast(e.message,false); } }
}
async function openShareReportModal() { if(!lastReport) await switchRekapTab('hari'); if(lastReport) openModalById('shareReportModal'); }
function closeShareReportModal() { closeModalById('shareReportModal'); }
function generateReportMessage() {
  if(!lastReport) return '';
  const stats=getDashboardStats();
  return `Rekap Jimpitan Dukuh Bener RT 01 / RW 02\n${localDay()}\nTotal ${money(lastReport.amount)}\nPasang: ${stats.pasang}\nTidak Pasang: ${stats.kosong}\nLunas: ${stats.lunas}\nCatatan: ${lastReport.transactions}`;
}
function formatReportPeriod(period,report) {
  const d=new Date(`${report.through || localDay()}T00:00:00`);
  if(period==='hari') return d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  if(period==='bulan') return d.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const week=Math.ceil(d.getDate()/7);
  const start=new Date(`${report.start}T00:00:00`), end=new Date(`${report.end}T00:00:00`);
  return `Minggu ke-${week} • ${start.toLocaleDateString('id-ID',{day:'numeric',month:'short'})}-${end.toLocaleDateString('id-ID',{day:'numeric',month:'short'})}`;
}
async function copyReportText() { await runAction(null,async()=>{await navigator.clipboard.writeText(generateReportMessage()); showToast('Laporan disalin.');}); }
function shareReportToWhatsApp() { const text=generateReportMessage(); if(!text) return showToast('Buka rekap terlebih dahulu.',false); if(window.AndroidBridge?.shareReport) window.AndroidBridge.shareReport(text); else window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener'); }
async function openDataReguModal() {
  openModalById('dataReguModal'); $('teamList').textContent='Memuat...';
  await runAction(null,async()=>{
    const result=await api('teams');
    $('teamList').innerHTML=DAYS.map((day,i)=>{
      const members=result.teams.filter(t=>t.weekday===i+1);
      if(!isAdmin()&&!members.length) return '';
      return `<div class="team-card soft-${['blue','green','cream','slate'][i%4]}"><div class="team-card-head"><strong>${day}</strong><span>${members.length} anggota</span></div>${members.map(t=>`<div class="team-member"><span>${escapeHtml(t.name)}</span>${isAdmin()?`<button aria-label="Hapus anggota" title="Hapus anggota" class="ronda-button ronda-secondary compact" onclick="saveTeam('${t.id}',null)"><span class="material-symbols-outlined">person_remove</span></button>`:''}</div>`).join('') || '<p class="text-xs text-slate-500 font-bold">Belum ada anggota.</p>'}</div>`;
    }).join('') || '<p class="ronda-empty">Anda belum terdaftar dalam regu.</p>';
    $('teamEditor').classList.toggle('hidden',!isAdmin());
    if(isAdmin()) {
      const {accounts}=await api('accounts',{},true);
      $('teamAccount').innerHTML=accounts.filter(a=>a.status==='approved').map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
      $('teamDay').innerHTML=DAYS.map((d,i)=>`<option value="${i+1}">${d}</option>`).join('');
    }
  });
}
function closeDataReguModal() { closeModalById('dataReguModal'); }
async function saveTeam(id=$('teamAccount').value,weekday=Number($('teamDay').value)) {
  await runAction(null,async()=>{await api('team_save',{id,weekday}); await openDataReguModal();});
}
async function openComplaints() {
  openPanel('Komplain Warga','<p class="ronda-empty">Memuat...</p>');
  await runAction(null,async()=>{
    const {complaints}=await api('complaints');
    $('operationalBody').innerHTML=`<form onsubmit="sendComplaint(event)"><label class="ronda-label" for="complaintText">Komplain</label><textarea id="complaintText" class="ronda-field" rows="3" maxlength="3000" required></textarea><button class="ronda-button">Kirim</button></form><div class="ronda-list">${complaints.map(c=>`<div class="ronda-row"><strong>${escapeHtml(c.name)}</strong><p style="white-space:pre-wrap">${escapeHtml(c.body)}</p><p>${escapeHtml(c.status)}</p>${c.replies.map(r=>`<p style="white-space:pre-wrap"><strong>Pengurus:</strong> ${escapeHtml(r.body)}</p>`).join('')}${isAdmin()?`<form onsubmit="replyComplaint(event,'${c.id}')"><label class="ronda-label">Balasan<textarea name="body" class="ronda-field" maxlength="3000"></textarea></label><label class="ronda-label">Status<select name="status" class="ronda-field">${['Menunggu','Diproses','Selesai'].map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select></label><button class="ronda-button">Simpan Respons</button></form>`:''}</div>`).join('') || '<p class="ronda-empty">Belum ada komplain.</p>'}</div>`;
  });
}
async function sendComplaint(event) { event.preventDefault(); await runAction(event.submitter,async()=>{await api('complaint_create',{body:$('complaintText').value}); await openComplaints();}); }
async function replyComplaint(event,id) { event.preventDefault(); const form=new FormData(event.target); await runAction(event.submitter,async()=>{await api('complaint_reply',{id,body:form.get('body'),status:form.get('status')}); await openComplaints();}); }
async function openRouteMapModal() {
  openModalById('routeMapModal'); $('mapAdminTools').classList.toggle('hidden',!isAdmin()); $('mapStatus').textContent='Memuat peta...';
  try {
    if(!window.L) throw new Error('Peta belum dapat dimuat. Silakan buka ulang aplikasi.');
    let location;
    try { location=await getLocation(); } catch(e) { $('mapStatus').textContent=e.message; }
    const first=houseData.find(h=>h.latitude!==null&&h.longitude!==null);
    if(!location&&!first) throw new Error('Aktifkan lokasi untuk menampilkan peta di sekitar Anda.');
    const center=location?{lat:location.latitude,lng:location.longitude}:{lat:first.latitude,lng:first.longitude};
    if(!map) {
      map=L.map($('googleMap')).setView(center,18);
      L.tileLayer(config.tileUrl,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'})
        .on('tileerror',()=>{$('mapStatus').textContent='Gambar peta belum dimuat. Periksa koneksi internet.';}).addTo(map);
    } else { map.invalidateSize(); map.setView(center,18); }
    renderMapMarkers();
    if(location) { if(userMarker) userMarker.remove(); userMarker=L.circleMarker(center,{radius:7,fillColor:markerColor,fillOpacity:1,color:'white',weight:2}).bindTooltip('Sedang Mengambil').addTo(map); $('mapStatus').textContent=`Akurasi ${Math.round(location.accuracy)} m`; }
  } catch(e) { $('mapStatus').textContent=e.message; }
}
function stopRouteRecording(saveLabel=true) {
  if(routeWatch!==null) {
    navigator.geolocation.clearWatch(routeWatch);
    routeWatch=null;
  }
  if(saveLabel && recordedRoute && !recordedRoute.ended_at) recordedRoute.ended_at=new Date().toISOString();
  if($('routeRecord')) $('routeRecord').textContent=recordedRoute?.ended_at?'Simpan Rute':'Rekam Rute';
}
function closeRouteMapModal() { stopRouteRecording(); closeModalById('routeMapModal'); }
function renderMapMarkers() {
  if(!map) return;
  mapMarkers.forEach(m=>m.remove());
  mapMarkers=houseData.filter(p=>p.latitude!==null&&p.longitude!==null).map(p=>{
    const marker=L.marker([p.latitude,p.longitude],{title:p.name,icon:pointIcon(p)}).addTo(map);
    marker.bindPopup(markerPopup(p),{maxWidth:260});
    marker.on('click',()=>{});
    return marker;
  });
}
function pointStatus(p) { return p.paid?'lunas':p.status_today==='pasang'?'pasang':p.status_today==='kosong'?'kosong':'belum'; }
function pointIcon(p) {
  const status=pointStatus(p), photo=p.avatar?`<img src="${escapeHtml(p.avatar)}" alt="">`:'';
  return L.divIcon({className:`ronda-map-marker ${status}`,html:`<span class="sonar"></span><div>${photo || '<i></i>'}</div>`,iconSize:[34,34],iconAnchor:[17,17]});
}
function markerPopup(p) {
  const status=pointStatus(p), label={lunas:'Lunas',pasang:'Pasang',kosong:'Tidak Pasang',belum:'Belum Diambil'}[status];
  return `<div class="marker-popup"><strong>${escapeHtml(cleanPointName(p.name))}</strong><p>Dukuh Bener RT 01 / RW 02</p><span class="status-chip chip-${status==='kosong'?'red':status==='belum'?'amber':status==='lunas'?'green':'blue'}">${label}</span><div class="ronda-actions">${isAdmin()?`<button class="ronda-button compact" onclick="editPoint('${p.id}')">Edit</button>`:''}<button class="ronda-button compact ronda-secondary" onclick="showToast('Scan barcode dibuka dari marker peta.')">Scan Barcode</button><button class="ronda-button compact" onclick="prepareMapCheckin('${p.id}','pasang')">Pasang</button><button class="ronda-button compact ronda-danger" onclick="prepareMapCheckin('${p.id}','kosong')">Tidak Pasang</button></div></div>`;
}
function prepareMapCheckin(id,status) { closeRouteMapModal(); openJimpitanModal(); $('selectGpsHouse').value=id; onSelectGpsHouseChange(); if(status) showToast(status==='pasang'?'Pilih Pasang untuk menyimpan.':'Pilih Kosong untuk menyimpan.'); }
async function editPoint(id=null) {
  if(!isAdmin()) return;
  await runAction(null,async()=>{
    let point=id?houseData.find(p=>p.id===id):null;
    const location=point?.latitude!==null && point?.latitude!==undefined?{latitude:point.latitude,longitude:point.longitude}:await getLocation();
    openPanel(point?'Edit Titik Jimpitan':'Tambah Titik Jimpitan',`<form id="pointForm" onsubmit="savePoint(event)"><input type="hidden" name="id" value="${id||''}"><input type="hidden" name="latitude" value="${location.latitude}"><input type="hidden" name="longitude" value="${location.longitude}"><label class="ronda-label">Nama Titik<input class="ronda-field" name="name" maxlength="120" value="${escapeHtml(point?.name||'')}" required></label><label class="ronda-label">Keterangan<textarea class="ronda-field" name="description" maxlength="1000">${escapeHtml(point?.description||'')}</textarea></label><p id="pointPosition" class="text-xs">${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p><div class="ronda-actions"><button class="ronda-button ronda-secondary" type="button" onclick="relocatePoint(this)"><span class="material-symbols-outlined">my_location</span> Gunakan Posisi Saat Ini</button><button class="ronda-button">Simpan</button>${point?`<button class="ronda-button ronda-danger" type="button" onclick="deletePoint('${point.id}')">Hapus</button>`:''}</div></form>`);
  });
}
async function relocatePoint(button) { await runAction(button,async()=>{const p=await getLocation(); const f=$('pointForm'); f.elements.latitude.value=p.latitude; f.elements.longitude.value=p.longitude; $('pointPosition').textContent=`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;}); }
async function savePoint(event) {
  event.preventDefault(); const f=new FormData(event.target);
  await runAction(event.submitter,async()=>{await api('point_save',{id:f.get('id')||null,name:f.get('name'),description:f.get('description'),latitude:Number(f.get('latitude')),longitude:Number(f.get('longitude'))}); await fetchSupabaseData(); closeModalById('operationalPanel'); showToast('Titik tersimpan.');});
}
async function deletePoint(id) { if(!confirm('Hapus titik dari peta? Riwayat pencatatan tetap disimpan.')) return; await runAction(null,async()=>{await api('point_delete',{id}); await fetchSupabaseData(); closeModalById('operationalPanel');}); }
async function toggleRoute() {
  if(!isAdmin()) return;
  if(routeWatch!==null) { stopRouteRecording(); }
  if(recordedRoute?.ended_at) {
    await runAction($('routeRecord'),async()=>{
      if(recordedRoute.path.length<2) { recordedRoute=null; $('routeRecord').textContent='Rekam Rute'; throw new Error('Rute belum cukup panjang untuk disimpan.'); }
      await api('route_save',recordedRoute); recordedRoute=null; $('routeRecord').textContent='Rekam Rute'; showToast('Rute tersimpan.');
    }); return;
  }
  await runAction($('routeRecord'),async()=>{
    await getLocation();
    recordedRoute={id:crypto.randomUUID(),started_at:new Date().toISOString(),path:[]};
    $('routeRecord').textContent='Selesai & Simpan';
    routeWatch=navigator.geolocation.watchPosition(pos=>{
      if(pos.coords.accuracy>operationalSettings.max_accuracy_m || recordedRoute.path.length>=10000) return;
      const p={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy,time:new Date(pos.timestamp).toISOString()};
      recordedRoute.path.push(p);
      if(map) { if(routeLine) routeLine.remove(); routeLine=L.polyline(recordedRoute.path.map(p=>[p.lat,p.lng]),{color:markerColor,weight:4}).addTo(map); }
      $('mapStatus').textContent=`Merekam ${recordedRoute.path.length} lokasi`;
    },()=>{$('mapStatus').textContent='Lokasi terputus. Periksa GPS perangkat.';},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  });
}
async function showRoutes() {
  await runAction(null,async()=>{
    const {routes}=await api('routes');
    openPanel('Riwayat Rute',routes.map(r=>`<div class="ronda-row"><p>${escapeHtml(new Date(r.started_at).toLocaleString('id-ID'))}</p><p>${r.path.length} lokasi</p><button class="ronda-button" data-route="${r.id}">Lihat Rute</button></div>`).join('') || '<p class="ronda-empty">Belum ada rute tersimpan.</p>');
    document.querySelectorAll('[data-route]').forEach(button=>button.onclick=async()=>{const r=routes.find(x=>x.id===button.dataset.route); closeModalById('operationalPanel'); await openRouteMapModal(); if(map) { if(routeLine) routeLine.remove(); routeLine=L.polyline(r.path.map(p=>[p.lat,p.lng]),{color:'#1872b9',weight:4}).addTo(map); map.fitBounds(routeLine.getBounds()); }});
  });
}
window.addEventListener('pagehide',()=>stopRouteRecording(false));
