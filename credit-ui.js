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
})();