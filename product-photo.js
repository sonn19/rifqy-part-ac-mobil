// Rifqy product photo upload: owner only, compressed before uploading.
(function(){
function photoUrl(p){return p?.image_url||''}
window.openProductPhoto=function(id){const p=db.products.find(x=>x.id===id);if(!p||!photoUrl(p))return;modal('Foto '+esc(p.name),'<img src="'+esc(p.image_url)+'" alt="'+esc(p.name)+'" style="max-width:100%;max-height:70vh;object-fit:contain;border-radius:12px"><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Tutup</button></div>')};
window.editProductPhoto=function(id){
 if(!isOwner()||demoMode)return toast('Upload foto tersedia untuk akun owner online.');
 const p=db.products.find(x=>x.id===id);if(!p)return;
 modal('Foto produk · '+esc(p.name),'<p class="hint">Foto opsional. Pilih kamera atau galeri (maksimal 2 MB setelah kompresi).</p><div class="field"><label>Ambil foto atau pilih dari galeri</label><input id="rifqy-photo-file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></div><div id="rifqy-photo-preview">'+(p.image_url?'<img src="'+esc(p.image_url)+'" style="max-width:200px;max-height:180px;object-fit:contain">':'Belum ada foto')+'</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Batal</button><button class="btn" id="rifqy-photo-save">Upload foto</button></div>');
 document.getElementById('rifqy-photo-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const url=URL.createObjectURL(file);const el=document.getElementById('rifqy-photo-preview');el.innerHTML='';const img=document.createElement('img');img.src=url;img.style.cssText='max-width:200px;max-height:180px;object-fit:contain';img.onload=()=>URL.revokeObjectURL(url);el.append(img)});
 document.getElementById('rifqy-photo-save').onclick=async()=>{
 const file=document.getElementById('rifqy-photo-file').files?.[0];if(!file)return toast('Pilih foto dahulu.');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Gunakan foto JPG, PNG, atau WebP.');
 const button=document.getElementById('rifqy-photo-save');button.disabled=true;button.textContent='Mengunggah...';
 try{
  const blob=await compressPhoto(file);
  if(blob.size>2097152)throw Error('Foto masih terlalu besar, coba foto lain.');
  const path=encodeURIComponent(id)+'/'+Date.now()+'.jpg';
  const uploaded=await sb.storage.from('rifqy-products').upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(uploaded.error)throw uploaded.error;
  const url=sb.storage.from('rifqy-products').getPublicUrl(path).data.publicUrl;
  const saved=await mutate('product_photo',{id,image_url:url});
  if(!saved)throw Error('Foto sudah diunggah tetapi belum terhubung ke produk. Coba lagi.');
 }catch(e){toast(e.message||'Upload foto gagal.');button.disabled=false;button.textContent='Upload foto'}
 };
};
async function compressPhoto(file){
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Gagal mengompres foto.')),'image/jpeg',0.78));
}
})();