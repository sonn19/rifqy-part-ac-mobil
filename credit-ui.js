// Workshop credit UI extension. Loaded after app.js.
(function(){
const oldSales=sales,oldChange=updateChange,oldRender=render;
window.sales=function(){
 let html=oldSales();
 html=html.replace('<select id="payment">','<select id="payment" onchange="creditPaymentChanged()">');
 html=html.replace('<option>QRIS</option></select>','<option>QRIS</option><option value="Bon">Bon / DP Bengkel</option></select>');
 html=html.replace('<p id="change" class="hint">','<div id="credit-due" class="field" style="display:none"><label>Jatuh tempo (opsional)</label><input type="date" id="due-date"></div><p id="change" class="hint">');
 return html;
};
window.creditPaymentChanged=function(){
 const bon=$('#payment')?.value==='Bon', c=db.customers.find(x=>x.id===buyer);
 if(bon&&c?.type!=='Bengkel'){toast('Pilih pelanggan Bengkel terlebih dahulu.');$('#payment').value='Tunai';}
 $('#credit-due').style.display=$('#payment').value==='Bon'?'block':'none';
 updateChange();
};
window.updateChange=function(){
 if($('#payment')?.value==='Bon'){
  let paid=Number($('#paid').value||0),balance=cartTotal()-paid;
  $('#change').textContent=balance>0?'Sisa piutang: '+money(balance):'DP harus lebih kecil dari total nota.';
 }else oldChange();
};
const oldCloudCheckout=cloudCheckout;
window.cloudCheckout=async function(){
 if($('#payment')?.value!=='Bon')return oldCloudCheckout();
 if(!cart.length||cloudBusy)return;
 const raw=$('#paid').value,paid=Number(raw),total=cartTotal(),customer=db.customers.find(x=>x.id===buyer);
 if(!customer||customer.type!=='Bengkel')return toast('Pilih pelanggan bengkel.');
 if(discountAmount!==0)return toast('Diskon belum tersedia untuk bon online.');
 if(raw===''||!Number.isSafeInteger(paid)||paid<0||paid>=total)return toast('DP harus Rp0 sampai kurang dari total.');
 const due=$('#due-date').value||null;
 const signature=JSON.stringify({cart,buyer,paid,total,shippingAmount,due});
 if(!pendingCheckout||pendingCheckout.signature!==signature)pendingCheckout={signature,id:'RP-'+newId()};
 cloudBusy=true;
 try{
  const {error}=await sb.rpc('rifqy_credit_checkout',{p_data:{id:pendingCheckout.id,customer_id:buyer,items:cart.map(x=>({id:x.id,qty:x.qty})),paid,shipping:shippingAmount,expected_total:total,due_date:due}});
  if(error)throw error;
  const id=pendingCheckout.id;pendingCheckout=null;cart=[];shippingAmount=0;discountAmount=0;
  await loadCloud(cloudSession);receipt(id);toast('Bon tersimpan dan stok dikurangi.');
 }catch(e){toast(authError(e))}finally{cloudBusy=false}
};

const baseRender=render;
const creditNav='<a href="#receivables" class="credit-nav">'+icon('customers')+'Piutang bengkel</a>';
const baseLoadCloud=loadCloud;
window.loadCloud=async function(session){await baseLoadCloud(session);if(demoMode||!cloudState)return;try{const {data,error}=await sb.rpc('rifqy_credit_state');if(error)throw error;window.creditData=data||{orders:[],payments:[]};render();}catch(e){console.warn('Status piutang belum termuat',e);}};
window.render=function(){
 if(location.hash==='#receivables'&&!demoMode&&cloudState){
  route='receivables';baseRender();route='receivables';
  $('#crumb').textContent='Piutang bengkel';
  $('#nav').insertAdjacentHTML('beforeend',creditNav.replace('credit-nav','credit-nav active'));
  $('#app').innerHTML='<section class="panel" style="padding:24px"><h2>Piutang Bengkel</h2><p>Memuat daftar tagihan...</p></section>';
  loadReceivables();
 }else{
  baseRender();
  if(!demoMode&&cloudState&&!$('#nav a[href="#receivables"]'))$('#nav').insertAdjacentHTML('beforeend',creditNav);
 }
};
window.loadReceivables=async function(){
 const el=$('#app');if(!el)return;
 const {data,error}=await sb.rpc('rifqy_credit_state');
 if(location.hash!=='#receivables')return;
 if(error){el.innerHTML='<section class="panel" style="padding:24px"><h2>Piutang Bengkel</h2><p>Data piutang belum dapat dibaca. Pastikan RPC rifqy_credit_state sudah dipasang.</p></section>';return;}
 window.creditData=data||{orders:[],payments:[]};
 const orders=creditData.orders||[], payments=creditData.payments||[];
 const customers=db.customers.filter(c=>c.type==='Bengkel');
 const sum=orders.reduce((n,o)=>n+Number(o.balance||0),0);
 el.innerHTML='<section class="panel" style="padding:24px"><h2>Piutang Bengkel</h2><p>Total sisa tagihan: <strong>'+money(sum)+'</strong></p><div class="field"><label>Pilih bengkel untuk pembayaran</label><select id="credit-customer"><option value="">Pilih bengkel</option>'+customers.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></div><div class="field"><label>Jumlah pembayaran (Rp)</label><input type="number" id="credit-amount" min="1" step="1"></div><div class="field"><label>Metode</label><select id="credit-method"><option>Tunai</option><option>Transfer bank</option><option>QRIS</option></select></div><div class="field"><label>Catatan (opsional)</label><input id="credit-note" maxlength="200"></div><button class="btn" onclick="submitCreditPayment()">Catat pembayaran</button><h3>Daftar nota bon</h3><div class="table-wrap"><table><thead><tr><th>Nota</th><th>Bengkel</th><th>Total</th><th>DP + Pelunasan</th><th>Sisa</th><th>Jatuh tempo</th><th>Status</th></tr></thead><tbody>'+orders.map(o=>'<tr><td><button class="action-sm mono" onclick="receipt(\''+esc(o.id)+'\')">'+esc(o.id)+'</button></td><td>'+esc(o.customer)+'</td><td>'+money(o.total)+'</td><td>'+money(Number(o.total)-Number(o.balance))+'</td><td>'+money(o.balance)+'</td><td>'+esc(o.due_date||'-')+'</td><td>'+ (Number(o.balance)<=0?'Lunas':'Belum Lunas')+'</td></tr>').join('')+'</tbody></table></div><h3>Riwayat pembayaran</h3><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Bengkel</th><th>Nominal</th><th>Metode</th><th>Catatan</th></tr></thead><tbody>'+payments.map(p=>'<tr><td>'+esc(p.paid_at||'')+'</td><td>'+esc(p.customer||'')+'</td><td>'+money(p.amount)+'</td><td>'+esc(p.method)+'</td><td>'+esc(p.note||'')+'</td></tr>').join('')+'</tbody></table></div></section>';
};
window.submitCreditPayment=async function(){
 const customer=$('#credit-customer').value,amount=Number($('#credit-amount').value),method=$('#credit-method').value,note=$('#credit-note').value;
 if(!customer||!Number.isSafeInteger(amount)||amount<=0)return toast('Pilih bengkel dan masukkan jumlah pembayaran yang valid.');
 if(!confirm('Catat pembayaran piutang sebesar '+money(amount)+'?'))return;
 if(cloudBusy)return;const outstanding=(window.creditData?.orders||[]).filter(o=>o.customer_id===customer).reduce((n,o)=>n+Number(o.balance||0),0);if(amount>outstanding)return toast('Pembayaran melebihi sisa piutang '+money(outstanding));const id='CP-'+newId();cloudBusy=true;
 try{const {error}=await sb.rpc('rifqy_credit_payment',{p_id:id,p_customer:customer,p_amount:amount,p_method:method,p_note:note});if(error)throw error;toast('Pembayaran piutang berhasil dicatat.');await loadReceivables();await loadCloud(cloudSession);}
 catch(e){toast(authError(e));}finally{cloudBusy=false;}
};

})();