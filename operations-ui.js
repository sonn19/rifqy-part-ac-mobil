// Operations extension: supplier purchasing, expenses, stock counts, profitability, labels.
(function(){
const previousRender=render,previousLoad=loadCloud;
let operations={suppliers:[],purchases:[],expenses:[],stock_counts:[],supplier_payments:[]};
const operationsRoutes=['purchasing','cashbook','inventory-count','profit','labels'];
const navEntries=[['purchasing','Pembelian supplier','package'],['cashbook','Buku kas','wallet'],['inventory-count','Stok opname','clipboard'],['profit','Laba rugi','chart'],['labels','Label barcode','tag']];
const validNum=x=>Number.isSafeInteger(Number(x))&&Number(x)>=0&&String(x).trim()!=='';
async function refreshOperations(){if(demoMode||!cloudState)return;const {data,error}=await sb.rpc('rifqy_operations_state');if(error)throw error;operations=data||operations;}
window.refreshRifqyOperations=refreshOperations;
let operationsLoading=false;
async function ensureOperations(){if(operationsLoading)return;operationsLoading=true;try{await refreshOperations();if(operationsRoutes.includes(location.hash.slice(1)))render()}catch(e){console.warn('Gagal memuat data supplier',e);toast('Data supplier gagal dimuat. Coba buka tab kembali.')}finally{operationsLoading=false}}
window.loadCloud=async function(session){await previousLoad(session)};
function navHtml(){return navEntries.map(([id,label])=>'<a href="#'+id+'" class="'+(location.hash==='#'+id?'active':'')+'">'+icon('products')+label+'</a>').join('')}
window.render=function(){
 const target=location.hash.slice(1);
 if(!operationsRoutes.includes(target)||demoMode||!cloudState){previousRender();if(!demoMode&&cloudState&&isOwner())$('#nav').insertAdjacentHTML('beforeend',navHtml());return}
 history.replaceState(null,'','#dashboard');previousRender();history.replaceState(null,'','#'+target);route=target;
 $('#nav').insertAdjacentHTML('beforeend',navHtml());$('#crumb').textContent=navEntries.find(x=>x[0]===target)[1];
 if(!isOwner()){$('#app').innerHTML='<section class="panel">Hanya owner dapat mengakses fitur ini.</section>';return}
 if(target==='purchasing'&&operations.suppliers.length===0&&operations.purchases.length===0){$('#app').innerHTML='<section class="panel" style="padding:24px">Memuat riwayat pembelian supplier…</section>';ensureOperations();return}
 $('#app').innerHTML=operationsPage(target);
};
const input=(id,label,type='text')=>'<div class="field"><label>'+label+'</label><input id="op-'+id+'" type="'+type+'"></div>';
const productSelect=()=>'<select id="op-product">'+db.products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' ('+esc(p.sku)+') · Stok '+p.stock+'</option>').join('')+'</select>';
function operationsPage(r){
 const start='<section class="panel" style="padding:24px"><h2>'+navEntries.find(x=>x[0]===r)[1]+'</h2>';
 if(r==='purchasing'){
 const paidFor=id=>(operations.supplier_payments||[]).filter(x=>x.purchase_id===id).reduce((n,x)=>n+Number(x.amount),0);
 const debt=operations.purchases.reduce((n,p)=>n+Math.max(0,Number(p.total)-Number(p.paid)-paidFor(p.id)),0);
 const history=operations.purchases.map(p=>{const remaining=Math.max(0,Number(p.total)-Number(p.paid)-paidFor(p.id));return [date(p.created_at),operations.suppliers.find(s=>s.id===p.supplier_id)?.name||'-',money(p.total),money(Number(p.paid)+paidFor(p.id)),money(remaining),remaining?'<button class="action-sm" onclick="selectSupplierInvoice(&quot;'+esc(p.id)+'&quot;)">Bayar / Lunasi</button>':'Lunas']});
 const outstanding=operations.purchases.filter(p=>Number(p.total)-Number(p.paid)-paidFor(p.id)>0);
 return start+'<p>Total utang supplier: <strong>'+money(debt)+'</strong></p><h3>Tambah supplier</h3>'+input('supplier-name','Nama supplier')+input('supplier-phone','Telepon')+'<button class="btn" onclick="saveOperation(\'supplier\')">Simpan supplier</button><h3>Pembelian barang</h3><div class="field"><label>Supplier</label><select id="op-supplier">'+operations.suppliers.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')+'</select></div><div class="field"><label>Barang</label>'+productSelect()+'</div>'+input('qty','Jumlah barang','number')+input('cost','Harga modal per unit','number')+input('paid','Jumlah dibayar ke supplier','number')+input('note','Catatan')+'<button class="btn" onclick="saveOperation(\'purchase\')">Simpan pembelian & tambah stok</button><h3>Bayar cicilan utang supplier</h3><div class="field"><label>Nota pembelian belum lunas</label><select id="op-debt-purchase">'+outstanding.map(p=>'<option value="'+esc(p.id)+'">'+esc(operations.suppliers.find(s=>s.id===p.supplier_id)?.name||'-')+' · '+esc(p.id)+' · Sisa '+money(Number(p.total)-Number(p.paid)-paidFor(p.id))+'</option>').join('')+'</select></div>'+input('debt-amount','Jumlah cicilan (Rp)','number')+'<button type="button" class="btn secondary" onclick="fillSupplierDebt()">Lunasi Semua</button>'+'<div class="field"><label>Metode pembayaran</label><select id="op-debt-method"><option>Tunai</option><option>Transfer bank</option><option>QRIS</option></select></div>'+input('debt-note','Catatan pembayaran')+'<button class="btn" onclick="paySupplierDebt()">Catat pembayaran supplier</button><h3>Riwayat pembelian</h3>'+simpleTable(['Tanggal','Supplier','Total','Sudah dibayar','Sisa utang','Status'],history)+'<h3>Riwayat cicilan supplier</h3>'+simpleTable(['Tanggal','Nota pembelian','Nominal','Metode','Catatan'],(operations.supplier_payments||[]).map(p=>[date(p.paid_at),p.purchase_id,money(p.amount),p.method,p.note]))+'</section>';
 }
 if(r==='cashbook')return start+'<h3>Catat pengeluaran</h3>'+input('category','Kategori')+input('description','Keterangan')+input('amount','Nominal (Rp)','number')+'<button class="btn" onclick="saveOperation(\'expense\')">Simpan pengeluaran</button><h3>Riwayat pengeluaran</h3>'+simpleTable(['Tanggal','Kategori','Keterangan','Nominal'],operations.expenses.map(e=>[date(e.created_at),e.category,e.description,money(e.amount)]))+'</section>';
 if(r==='inventory-count')return start+'<p>Masukkan jumlah fisik. Perbedaan dengan stok sistem akan tercatat sebagai koreksi.</p><div class="field"><label>Produk</label>'+productSelect()+'</div>'+input('actual','Jumlah fisik','number')+input('note','Catatan')+'<button class="btn" onclick="saveOperation(\'stock_count\')">Simpan hasil opname</button><h3>Riwayat opname</h3>'+simpleTable(['Tanggal','Produk','Sistem','Fisik','Selisih'],operations.stock_counts.map(x=>[date(x.created_at),db.products.find(p=>p.id===x.product_id)?.name||x.product_id,x.system_qty,x.actual_qty,x.actual_qty-x.system_qty]))+'</section>';
 if(r==='profit'){const revenue=db.orders.reduce((n,o)=>n+Number(o.total||0),0),cost=db.orders.reduce((n,o)=>n+(o.items||[]).reduce((m,x)=>m+Number(x.cost||0)*Number(x.qty||0),0),0),expenses=operations.expenses.reduce((n,e)=>n+Number(e.amount),0);return start+'<p>Ringkasan seluruh data yang dimuat (bukan laporan per periode). Penjualan Bon dihitung sebagai pendapatan penjualan, bukan penerimaan kas.</p>'+simpleTable(['Komponen','Nilai'],[['Omzet',money(revenue)],['HPP barang terjual',money(cost)],['Laba kotor',money(revenue-cost)],['Pengeluaran tercatat',money(expenses)],['Estimasi laba setelah pengeluaran',money(revenue-cost-expenses)]])+'<p class="hint">Belum termasuk penyesuaian retur, pajak, depresiasi, dan biaya lain yang belum dicatat.</p></section>'}
 return start+'<p>Pilih barang lalu cetak label SKU dan barcode.</p><div class="field"><label>Produk</label>'+productSelect()+'</div><button class="btn" onclick="printOperationLabel()">Cetak label</button><div id="op-label-preview"></div></section>';
}
function simpleTable(headers,rows){return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
window.saveOperation=async function(action){
 if(cloudBusy)return;const val=id=>$('#op-'+id)?.value||'',id='OP-'+newId();let data={id};
 if(action==='supplier'){data.name=val('supplier-name').trim();data.phone=val('supplier-phone');if(!data.name)return toast('Isi nama supplier')}
 if(action==='expense'){data.category=val('category')||'Lainnya';data.description=val('description').trim();data.amount=val('amount');if(!data.description||!validNum(data.amount)||Number(data.amount)===0)return toast('Periksa keterangan dan nominal')}
 if(action==='stock_count'){data.product_id=val('product');data.actual_qty=val('actual');data.note=val('note');if(!validNum(data.actual_qty))return toast('Jumlah fisik tidak valid')}
 if(action==='purchase'){data.supplier_id=val('supplier');data.items=[{product_id:val('product'),qty:val('qty'),cost:val('cost')}];data.paid=val('paid');data.note=val('note');if(!data.supplier_id||!validNum(val('qty'))||Number(val('qty'))===0||!validNum(val('cost'))||!validNum(data.paid))return toast('Periksa supplier, jumlah, harga modal, dan pembayaran');if(Number(data.paid)>Number(val('qty'))*Number(val('cost')))return toast('Pembayaran melebihi total pembelian')}
 if(!confirm('Simpan '+action+'? Perubahan stok dan pembukuan akan dicatat.'))return;
 cloudBusy=true;
 try{const {error}=await sb.rpc('rifqy_operations_write',{p_action:action,p_data:data});if(error)throw error;await previousLoad(cloudSession);await refreshOperations();render();toast('Data berhasil disimpan.')}catch(e){toast(authError(e))}finally{cloudBusy=false}
};
window.selectSupplierInvoice=function(id){
 const select=$('#op-debt-purchase');
 if(!select)return toast('Form pembayaran belum tersedia.');
 select.value=id;
 if(select.value!==id)return toast('Nota tidak ada dalam daftar utang aktif.');
 fillSupplierDebt();
 select.scrollIntoView({behavior:'smooth',block:'center'});
};
window.fillSupplierDebt=function(){
 const id=$('#op-debt-purchase')?.value;
 const p=operations.purchases.find(x=>x.id===id);
 if(!p)return toast('Pilih nota pembelian yang belum lunas.');
 const installments=(operations.supplier_payments||[]).filter(x=>x.purchase_id===id).reduce((n,x)=>n+Number(x.amount),0);
 const remaining=Math.max(0,Number(p.total)-Number(p.paid)-installments);
 if(!remaining)return toast('Nota sudah lunas.');
 $('#op-debt-amount').value=String(remaining);
 toast('Nominal pelunasan terisi. Klik Catat pembayaran supplier untuk konfirmasi.');
};
window.paySupplierDebt=async function(){
 if(cloudBusy)return;
 const purchaseId=$('#op-debt-purchase')?.value,amountText=$('#op-debt-amount')?.value,method=$('#op-debt-method')?.value,note=$('#op-debt-note')?.value||'';
 const purchase=operations.purchases.find(p=>p.id===purchaseId);
 if(!purchase||!validNum(amountText)||Number(amountText)<=0)return toast('Pilih nota dan isi nominal cicilan yang valid.');
 const previous=(operations.supplier_payments||[]).filter(x=>x.purchase_id===purchaseId).reduce((n,x)=>n+Number(x.amount),0);
 const remaining=Number(purchase.total)-Number(purchase.paid)-previous;
 if(Number(amountText)>remaining)return toast('Pembayaran melebihi sisa utang '+money(remaining));
 if(!confirm('Catat pembayaran supplier '+money(Number(amountText))+'?'))return;
 cloudBusy=true;
 try{
  const {error}=await sb.rpc('rifqy_supplier_payment',{p_data:{id:'SP-'+newId(),purchase_id:purchaseId,amount:amountText,method,note}});
  if(error)throw error;
  await refreshOperations();render();toast('Cicilan supplier berhasil dicatat.');
 }catch(e){toast(authError(e))}finally{cloudBusy=false}
};
window.printOperationLabel=function(){
 const p=db.products.find(x=>x.id===$('#op-product')?.value);if(!p)return;
 const win=window.open('','_blank');if(!win)return toast('Izinkan pop-up untuk cetak label');
 win.document.write('<!doctype html><html><head><title>Label barang</title><style>body{font:14px Arial;padding:20px}.label{width:270px;border:1px solid #aaa;padding:14px;text-align:center}svg{max-width:100%}@media print{.label{border:0}}</style></head><body><div class="label"><strong>'+esc(p.name)+'</strong><p>'+esc(p.sku)+'</p><svg id="barcode"></svg><p>'+money(p.retail)+'</p></div><script src="https://partacmobil.my.id/vendor/jsbarcode-3.12.3.all.min.js"><\/script><script>try{JsBarcode("#barcode",'+JSON.stringify(p.sku)+',{format:"CODE128",width:1.5,height:55})}catch(e){};setTimeout(()=>print(),350)<\/script></body></html>');win.document.close();
};
})();
