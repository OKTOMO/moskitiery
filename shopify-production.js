(function(root){
  'use strict';
  const stores=Object.freeze({
    arlis:{label:'ARLIS',domain:'ryzndf-kr.myshopify.com',admin:'ryzndf-kr',firma:'AR'},
    albama:{label:'ALBAMA',domain:'jsxh4r-00.myshopify.com',admin:'jsxh4r-00',firma:'AL'},
    oktomo:{label:'OKTOMO',domain:'3vbipt-6t.myshopify.com',admin:'3vbipt-6t',firma:'F'},
    everis:{label:'EVERIS',domain:'ut0xgk-5n.myshopify.com',admin:'ut0xgk-5n',firma:'E'}
  });
  const colors=['Biały','Czarny','Antracyt','Brąz','Złoty Dąb','Winchester','Orzech','Ciemny Dąb','Mahoń','Turner Oak'];
  const folded=v=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l');
  function numeric(v){const s=String(v??'').trim().replace(',','.');return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)&&Number(s)>0?String(Number(s)):'';}
  const matchColor=(v,list)=>list.find(c=>folded(c)===folded(v))||'';
  // Only complete mosquito screens are candidates; loose mesh, repair kits and PC mats are excluded.
  function isMosquito(item){const name=folded(item.title);return /moskitier/.test(name)&&!/(?:siatka do|siatka na|napraw|zestaw napraw|uszczelk|naroznik|profil do)/.test(name);}
  function buildForm(store,o){
    const cfg=stores[store];
    if(!cfg||o?.source!=='shopify'||o.shop!==cfg.domain||!/^\d+$/.test(String(o.id)))throw new Error('Nieprawidłowy sklep lub zamówienie.');
    if(o.cancelled)throw new Error('Zamówienie jest anulowane.');
    const items=(o.items||[]).filter(isMosquito);
    if(!items.length)throw new Error('To zamówienie nie zawiera moskitiery do produkcji.');
    const warnings=[];
    const pozycje=items.map((item,index)=>{
      const p=item.properties||{},isDrzwi=/drzwi/.test(folded(item.title));
      const note=Object.entries(p).map(([k,v])=>k+': '+v).join('; ');
      if(isDrzwi)warnings.push('Pozycja '+(index+1)+': sprawdź stronę zawiasów i wyposażenie drzwi.');
      return {szerokosc:numeric(p['Szerokość światła (cm)']),wysokosc:numeric(p['Wysokość światła (cm)']),
        glebokosc:isDrzwi?'':numeric(p['Felc C (mm)']),kolorRamki:matchColor(p['Kolor ramki'],colors),
        kolorSiatki:matchColor(p['Kolor siatki'],['Czarna','Szara']),ilosc:Number(item.quantity),isDrzwi,
        poprzeczka:/^(tak|yes|true|1)$/.test(folded(p['Poprzeczka'])),
        sourceSkokBlaszki:numeric(p['Skok blaszki (mm)']),shopifyItemId:String(item.id||''),
        ...(isDrzwi?{szer2:'',wys2:'',zawias:'',samodomykajacyL:0,samodomykajacyP:0}:{}),uwagi:note};
    });
    const s=o.shipping||{},source={store,id:String(o.id),number:String(o.number||o.id),itemIds:items.map(i=>String(i.id||''))};
    return {firma:cfg.firma,data:String(o.createdAt||new Date().toISOString()).slice(0,10),
      klientImie:s.name||'',klientUlica:[s.address1,s.address2].filter(Boolean).join(', '),klientKod:s.postcode||'',
      klientMiasto:s.city||'',telefon:s.phone||'',email:o.email||'',shopifySource:source,pozycje,
      uwagi:['Sklep '+cfg.label+' · '+source.number,'Status przy imporcie: '+o.financialStatus,
        ...items.map(i=>i.title+' — '+Object.entries(i.properties||{}).map(([k,v])=>k+': '+v).join('; ')),...warnings].join('\n')};
  }
  function validate(form){
    if(!form.shopifySource)return [];
    const errors=[];
    if(!form.klientImie?.trim())errors.push('Dane klienta');
    (form.pozycje||[]).forEach((p,i)=>{
      const missing=[];
      if(!numeric(p.szerokosc))missing.push('szerokość w cm');
      if(!numeric(p.wysokosc))missing.push('wysokość w cm');
      if(!p.isDrzwi&&!numeric(p.glebokosc))missing.push('felc C w mm');
      if(!colors.includes(p.kolorRamki))missing.push('kolor ramki');
      if(!['Czarna','Szara'].includes(p.kolorSiatki))missing.push('kolor siatki');
      if(!Number.isInteger(Number(p.ilosc))||Number(p.ilosc)<1)missing.push('liczba sztuk');
      if(p.isDrzwi&&!['L','P'].includes(p.zawias))missing.push('strona zawiasów');
      if(missing.length)errors.push('Pozycja '+(i+1)+': '+missing.join(', '));
    });
    if(!form.pozycje?.length)errors.push('Pozycje moskitier');
    return errors;
  }
  function linked(orders,source){return (orders||[]).filter(o=>o.shopifySource?.store===source.store&&String(o.shopifySource?.id)===String(source.id));}
  root.MosquitoShopify={stores,isMosquito,numeric,buildForm,validate,linked};
  // Shared PC mat accounting and parcel suggestions use actual units, not purchased set count.
  function matUnits(item){
    const title=folded(item.title||item.nazwa||item.name||item.offer?.name||'');
    const variant=folded(item.properties?.Zestaw||item.variantTitle||item.variant_title||'');
    const selected=variant||title;
    if(!/\bmat(?:a|y|e|)\b|podkladk/.test(title))return {small:0,large:0,unknown:0,isMat:false};
    const pc=/poliwegl|polycarb|policarbon|\bpc\b/.test(title);
    const knownDimensions=/(?:125\s*[x×*]\s*(?:102|100|205)|(?:102|100|205)\s*[x×*]\s*125)/.test(title);
    if(!pc&&(/wanny|wanna|prysznic|lazienk|piankow|masaz|silikon|gumow|filcow/.test(title)||!knownDimensions&&!/ochronn.*(?:fotel|krzesl|podlog)|(?:fotel|krzesl|podlog).*ochronn/.test(title)))return {small:0,large:0,unknown:0,isMat:false};
    const qty=Number(item.quantity??item.ilosc??1);
    if(!Number.isInteger(qty)||qty<=0)return {small:0,large:0,unknown:1,isMat:true};
    const parse=n=>{
      const countText=n.replace(/(?<!\d)(?:125\s*[x×*]\s*(?:102|100|205)|(?:102|100|205)\s*[x×*]\s*125)(?!\d)/g,' ').replace(/\bcm\b/g,' ');
      const count=word=>{const a=countText.match(new RegExp('(\\d+)\\s*(?:x\\s*)?(?:szt\\.?\\s*)?'+word)),b=countText.match(new RegExp(word+'\\s*(?:x\\s*)?(\\d+)\\s*(?:szt|mat)'));return a?Number(a[1]):b?Number(b[1]):0};
      const small=count('mal(?:e|a|ych)'),large=count('duz(?:e|a|ych)');
      if(small||large)return {small,large};
      if(/\bmix\b|mala\s*(?:i|\+)\s*duza|duza\s*(?:i|\+)\s*mala/.test(n))return {small:1,large:1};
      const dims=n.replace(/[×*]/g,'x').replace(/\s/g,'');
      const hasSmall=/(?:125x102|102x125|125x100|100x125)/.test(dims)||/\bmal(?:a|e|ych)\b/.test(n);
      const hasLarge=/(?:205x125|125x205)/.test(dims)||/\bduz(?:a|e|ych)\b/.test(n);
      if(hasSmall&&hasLarge)return null;
      const bundle=countText.match(/\b(\d+)\s*(?:szt\.?|mat(?:y|a)?\b)|\b(\d+)\s*x(?!\d)/),units=bundle?Number(bundle[1]||bundle[2]):1;
      return hasSmall?{small:units,large:0}:hasLarge?{small:0,large:units}:null;
    };
    const parsed=parse(selected)||(!variant?null:parse(title));
    if(!parsed||parsed.small+parsed.large<1||parsed.small+parsed.large>100)return {small:0,large:0,unknown:qty,isMat:true};
    return {small:parsed.small*qty,large:parsed.large*qty,unknown:0,isMat:true};
  }
  function moneyCents(value){
    if(value===null||value===undefined||value==='')return null;
    const match=String(value).trim().replace(',','.').match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if(!match)return null;
    const cents=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
    return Number.isSafeInteger(cents)?cents:null;
  }
  function lineRevenue(item){
    const total=moneyCents(item.lineGross??item.wartoscBrutto);
    if(total!==null)return total;
    const unit=moneyCents(item.unitPrice??item.cenaBrutto??item.price?.amount),qty=Number(item.quantity??item.ilosc??1);
    return unit!==null&&Number.isInteger(qty)&&qty>0?unit*qty:null;
  }
  function matStatistics(allegro,shopify,year,month,manual=[]){
    const groups=Object.fromEntries(['favour','arlis','albama','everis','shared'].map(k=>[k,{small:0,large:0,orders:0,unknown:0,allegro:0,shopify:0,manual:0,revenue:{},unpricedLines:0,unknownDetails:[]}])) ;
    const account={favo5:'favour',staroleska_pl:'favour',sinlook_pl:'favour',arlis_pl:'arlis',arlis:'arlis',albama_eu:'albama',pedroshop_pl_365:'albama',everis_pl:'everis'};
    const byStore={arlis:'arlis',oktomo:'favour',albama:'albama',everis:'everis'},seen=new Set();
    function add(key,group,date,items,cancelled,channel,currency,goodsTotal,number){
      if(!group||seen.has(key)||cancelled)return;seen.add(key);
      const d=new Date(date);if(d.getFullYear()!==year||d.getMonth()+1!==month)return;
      const counts=items.map(matUnits),g=groups[group];if(!counts.some(x=>x.isMat))return;
      g.orders++;g[channel]++;
      for(let i=0;i<counts.length;i++){const c=counts[i];g.small+=c.small;g.large+=c.large;g.unknown+=c.unknown;if(c.unknown)g.unknownDetails.push({number,title:items[i].title||items[i].nazwa||items[i].name||'',quantity:c.unknown});}
      const matItems=items.filter((_,i)=>counts[i].isMat),totals=matItems.map(lineRevenue);
      // Allegro totalAmount is the sum of goods only in our importer; never use a Shopify order total (it can include delivery).
      const fallback=channel==='allegro'&&counts.every(c=>c.isMat)&&totals.some(n=>n===null)?moneyCents(goodsTotal):null;
      if(fallback!==null){g.revenue[currency]=(g.revenue[currency]||0)+fallback;return;}
      for(let i=0;i<totals.length;i++){
        if(totals[i]===null){g.unpricedLines++;continue;}
        const cur=matItems[i].currency||matItems[i].waluta||currency;
        if(!cur){g.unpricedLines++;continue;}
        g.revenue[cur]=(g.revenue[cur]||0)+totals[i];
      }
    }
    for(const imp of allegro||[]){if(imp._isManual||String(imp.allegroOrderId||'').startsWith('manual_'))continue;
      const items=imp.pozycje?.length?imp.pozycje.map(p=>({...p,title:p.nazwa||p.name||p.title||(imp.pozycje.length===1?imp.offerNames:'')})):[{title:imp.offerNames||'',quantity:1}];
      add('allegro:'+imp.kontoId+':'+imp.allegroOrderId,account[imp.kontoId],imp.boughtAt,items,/CANCEL|ANUL/i.test(imp.fulfillmentStatus||'')||imp.status==='CANCELLED','allegro',imp.kwotaWaluta||'PLN',imp.kwotaBrutto??imp.totalAmount,imp.allegroOrderId);
    }
    for(const r of shopify||[]){const o=r.order,store=Object.keys(stores).find(k=>stores[k].domain===o?.shop);if(!store)continue;
      add('shopify:'+store+':'+o.id,byStore[store],o.createdAt,o.items||[],o.cancelled||o.financialStatus==='refunded','shopify',o.currency,null,o.number);
    }
    const manualGroups={F:'favour',AR:'arlis',AL:'albama',E:'everis',F_AR:'shared'};
    for(const e of manual){
      const group=manualGroups[e.firma],key='manual:'+e.id;
      if(!group||e.cancelled||seen.has(key)||e.period!==year+'-'+String(month).padStart(2,'0'))continue;
      seen.add(key);const g=groups[group];g.small+=Number(e.small)||0;g.large+=Number(e.large)||0;g.manual++;if(!e.legacy)g.orders++;
      const cents=moneyCents(e.gross);if(cents===null)g.unpricedLines++;else g.revenue[e.currency||'PLN']=(g.revenue[e.currency||'PLN']||0)+cents;
    }
    return groups;
  }
  function MatSalesPanel(props){
    const h=root.React.createElement,g=props.groups,amounts=totals=>Object.entries(totals).map(([currency,cents])=>(cents/100).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+currency).join(' + ')||'—';
    const cardStyle={background:'#0a1a12',border:'1px solid #28583e',borderRadius:8,padding:'14px 16px',marginBottom:12};
    function card(label,rows,extras=false){
      const small=rows.reduce((n,r)=>n+r.small,0),large=rows.reduce((n,r)=>n+r.large,0),unknown=rows.reduce((n,r)=>n+r.unknown,0),missing=rows.reduce((n,r)=>n+r.unpricedLines,0),revenue={};
      rows.forEach(r=>Object.entries(r.revenue).forEach(([cur,cents])=>revenue[cur]=(revenue[cur]||0)+cents));
      return h('section',{style:cardStyle,key:label},h('h3',{style:{margin:'0 0 12px',fontSize:16,color:'#9ce0b4'}},label),
        h('div',null,'Małe: ',h('strong',null,small),' szt. · Duże: ',h('strong',null,large),' szt.'),
        h('div',{style:{marginTop:9,fontSize:17,color:'#d3f3db'}},'Wartość mat: ',h('strong',null,amounts(revenue))),
        h('div',{style:{fontSize:11,color:'#7fa58d',marginTop:5}},'Faktyczna wartość pozycji po rabatach, bez dostawy. ',rows.reduce((n,r)=>n+r.orders,0),' zamówień.'),
        missing>0&&h('p',{style:{color:'#ffd189',fontSize:12}},'Brak ceny dla '+missing+' pozycji. Powyższa wartość jest niepełna — uzupełnij ręczny wpis lub odśwież dane źródłowe.'),
        unknown>0&&h('details',null,h('summary',{style:{color:'#ffd189'}},'Do sprawdzenia rozmiar/zestaw: '+unknown+' kupionych pozycji'),...rows.flatMap(r=>r.unknownDetails).map((d,i)=>h('div',{key:i,style:{fontSize:12,marginTop:6}},d.number+' · '+d.quantity+' × '+d.title))),
        rows.length>1&&h('div',{style:{fontSize:12,color:'#8cb69c',marginTop:12}},'Favour / OKTOMO: '+g.favour.small+' małe, '+g.favour.large+' duże · '+amounts(g.favour.revenue),h('br'),'ARLIS: '+g.arlis.small+' małe, '+g.arlis.large+' duże · '+amounts(g.arlis.revenue)),
        rows.some(r=>r.manual)&&h('p',{style:{color:'#b8d8c3',fontSize:12}},'W sumie uwzględniono wpisy ręczne.'+(rows.includes(g.shared)&&g.shared.manual?' Starsza wspólna korekta Favour + ARLIS: '+g.shared.small+' małych / '+g.shared.large+' dużych.':''))
      );
    }
    return h('div',null,h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}},h('strong',null,'Maty PC — rozliczenia firm'),h('button',{className:'btn',onClick:props.onRefresh,disabled:props.loading},props.loading?'Pobieram…':'Odśwież ceny i sztuki')),
      props.error&&h('p',{style:{color:'#ffd189',fontSize:12}},props.error),
      card('Favour + ARLIS',[g.favour,g.arlis,g.shared]),
      card('ALBAMA — osobne rozliczenie',[g.albama]),card('EVERIS — osobne rozliczenie',[g.everis]),
      h(root.MosquitoShopify.ManualMatSales,{...props,groups:undefined}));
  }
  function parcelPlan(order){
    const mats=(order.items||[]).map(matUnits),mosquito=(order.items||[]).filter(isMosquito),nonMats=(order.items||[]).filter((item,i)=>!mats[i].isMat&&!isMosquito(item));
    if(nonMats.length||mosquito.length&&mats.some(m=>m.isMat))return {parcels:[],note:'Zamówienie mieszane — dobierz kartony ręcznie.'};
    if(mats.some(m=>m.isMat)){
      if(mats.some(m=>m.unknown))return {parcels:[],note:'Nie rozpoznano jednoznacznie rozmiaru lub zestawu mat.'};
      const small=mats.reduce((a,c)=>a+c.small,0),large=mats.reduce((a,c)=>a+c.large,0),width=10*(large+Math.ceil(small/2));
      return {parcels:[{waga:small*2+large*3,sizeX:large?130:105,sizeY:width,sizeZ:10}],note:'Propozycja: dwie małe maty na jeden przekrój 10×10 cm. Sprawdź rzeczywiste pakowanie i wagę.'};
    }
    if(!mosquito.length)return {parcels:[],note:'Dobierz kartony i wagę ręcznie.'};
    const quantities=mosquito.reduce((a,i)=>a+Number(i.quantity||0),0);
    let longest=0;for(const item of mosquito){const p=item.properties||{},w=Number(numeric(p['Szerokość światła (cm)'])),h=Number(numeric(p['Wysokość światła (cm)']));if(!w||!h)return {parcels:[],note:'Uzupełnij wymiary moskitier przed doborem kartonu.'};longest=Math.max(longest,w+4,h+4);}
    const length=[100,130,150,180,200].find(v=>v>=longest);
    if(!length)return {parcels:[],note:'Potrzebny karton ponad 200 cm — sprawdź warunki DPD i nadaj ręcznie.'};
    const parcels=[];for(let left=quantities;left>0;left-=6)parcels.push({waga:Math.min(left,6)*2,sizeX:length,sizeY:15,sizeZ:10});
    return {parcels,note:'Propozycja do sprawdzenia: do 6 moskitier w kartonie, 2 kg/szt., przekrój 10×15 cm. Długość zakłada +4 cm do wymiaru światła; sprawdź długość spakowanych profili.'};
  }
  Object.assign(root.MosquitoShopify,{matUnits,matStatistics,parcelPlan,moneyCents,lineRevenue,MatSalesPanel});

})(typeof window==='object'?window:globalThis);

(function(root){
 const api=root.MosquitoShopify;
 function manualWithLegacy(entries,year,month,small,large){
  const id='legacy_'+year+'_'+month;
  return entries.some(e=>e.id===id)||!(small||large)?entries:[...entries,{id,period:year+'-'+String(month).padStart(2,'0'),firma:'F_AR',small,large,gross:null,currency:'PLN',legacy:true,note:'Dotychczasowe ręczne wpisy'}];
 }
 function ManualMatSales(p){
  const R=root.React,h=R.createElement,[entries,setEntries]=R.useState([]),[revision,setRevision]=R.useState(null),[ready,setReady]=R.useState(false),[error,setError]=R.useState(''),[busy,setBusy]=R.useState(false),[form,setForm]=R.useState(null);
  const period=p.year+'-'+String(p.month).padStart(2,'0'),effective=manualWithLegacy(entries,p.year,p.month,p.smallExtra,p.largeExtra),labels={F:'Favour / OKTOMO',AR:'ARLIS',AL:'ALBAMA',E:'EVERIS',F_AR:'Favour + ARLIS — stare wpisy'};
  const headers={'x-api-key':p.apiKey,'Content-Type':'application/json'},url=p.apiUrl+'/stats/mats/manual';
  async function load(){setReady(false);setError('');try{const r=await fetch(url,{headers,cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Nie udało się odczytać wpisów ręcznych.');setEntries(d.entries);setRevision(d.revision);p.onManualChange(d.entries);setReady(true);}catch(e){setError(e.message);}}
  R.useEffect(()=>{load();},[period]);
  async function save(entry){
   setBusy(true);setError('');try{
    const r=await fetch(url,{method:'POST',headers,body:JSON.stringify({entry,revision})}),d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Nie udało się zapisać wpisu.');
    setEntries(d.entries);setRevision(d.revision);p.onManualChange(d.entries);setForm(null);
   }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function field(label,name,type='text',optional=false){return h('label',{style:{display:'grid',gap:4}},label,h('input',{type,value:form[name]??'',min:type==='number'?0:undefined,step:name==='gross'?'0.01':1,required:!optional,onChange:e=>setForm({...form,[name]:e.target.value}),style:{width:'100%',boxSizing:'border-box'}}));}
  const rows=effective.filter(e=>e.period===period);
  return h('section',{style:{border:'1px solid #3b6750',borderRadius:8,padding:14,marginTop:16}},h('strong',null,'Zamówienia mat spoza Allegro i sklepów'),
   h('p',{style:{fontSize:12,color:'#a9c4b3'}},'Wpisy są zapisywane na Twoim serwerze i doliczane do wybranej firmy. Podaj faktyczną wartość samych mat, bez wysyłki. Puste pole ceny oznacza brak danych.'),
   h('button',{className:'btn',disabled:!ready||busy,onClick:()=>setForm({id:crypto.randomUUID(),firma:'F',date:period===new Date().toLocaleDateString('en-CA').slice(0,7)?new Date().toLocaleDateString('en-CA'):period+'-01',period,small:0,large:0,gross:'',currency:'PLN',note:''})},'➕ Dodaj zamówienie ręczne'),
   h('button',{className:'btn',disabled:busy,onClick:load,style:{marginLeft:8}},'Odśwież ręczne wpisy'),
   error&&h('p',{role:'alert',style:{color:'#ffd189'}},error),!ready&&!error&&h('p',null,'Wczytuję ręczne wpisy…'),
   form&&h('form',{onSubmit:e=>{e.preventDefault();save({...form,period:form.legacy?period:form.date.slice(0,7)});},style:{display:'grid',gap:10,marginTop:14}},
    h('strong',null,form.legacy?'Uzupełnij stare wpisy':'Ręczne zamówienie'),
    !form.legacy&&field('Data sprzedaży','date','date'),
    h('label',null,'Firma ',h('select',{value:form.firma,disabled:form.legacy,onChange:e=>setForm({...form,firma:e.target.value})},...Object.entries(labels).filter(([k])=>form.legacy||k!=='F_AR').map(([k,v])=>h('option',{key:k,value:k},v)))),
    field('Małe maty — sztuki','small','number'),field('Duże maty — sztuki','large','number'),field('Wartość mat bez dostawy (opcjonalnie)','gross','number',true),
    h('label',null,'Waluta ',h('select',{value:form.currency,onChange:e=>setForm({...form,currency:e.target.value})},...['PLN','EUR','CZK','HUF'].map(v=>h('option',{key:v,value:v},v)))),
    field('Notatka lub numer zamówienia (opcjonalnie)','note','text',true),h('div',null,h('button',{type:'submit',className:'btn',disabled:busy},busy?'Zapisuję…':'Zapisz wpis'),h('button',{type:'button',className:'btn',disabled:busy,onClick:()=>setForm(null),style:{marginLeft:8}},'Anuluj'))),
   ...rows.map(e=>h('div',{key:e.id,style:{padding:'10px 0',borderBottom:'1px solid #284535',opacity:e.cancelled ? 0.6 : 1}},
    h('div',null,(e.legacy?'Stara korekta — '+period:e.date)+' · '+labels[e.firma]+(e.cancelled?' · WYŁĄCZONY':'')),
    h('div',null,e.small+' małych + '+e.large+' dużych · '+(e.gross===null?'brak ceny':e.gross+' '+e.currency)+(e.note?' · '+e.note:'')),
    h('button',{className:'btn',disabled:!ready||busy,onClick:()=>setForm({...e,gross:e.gross??''})},'Edytuj'),
    h('button',{className:'btn',disabled:!ready||busy,onClick:()=>save({...e,cancelled:!e.cancelled}),style:{marginLeft:8}},e.cancelled?'Przywróć do statystyk':'Wyłącz ze statystyk'))));
 }
 Object.assign(api,{manualWithLegacy,ManualMatSales});
})(typeof window==='object'?window:globalThis);

(function(root){
 const api=root.MosquitoShopify;
 const keys=['purchaseNet','saleNet','quantity','shippingCostNet','shippingPaidNet','packagingNet','commission','goodsVat','feeVat'];
 function smartDpdGross(gross,mode,parcels=1){
  gross=Math.round((gross+Number.EPSILON)*100)/100;
  if(gross<30||!Number.isInteger(parcels)||parcels<1||!['smartStandard','smartDelivery'].includes(mode))return null;
  const rates=mode==='smartDelivery'?[1.79,3.69,5.59,8.99,11.29]:[1.99,3.99,6.09,9.49,11.89];
  const i=gross<45?0:gross<65?1:gross<100?2:gross<150?3:4;
  return rates[i]+(parcels-1)*rates[i===4?3:i];
 }
 function marginResult(f){
  const automatic=/^smart/.test(f.shippingMode||'');
  const n={};for(const k of keys){if(automatic&&k==='shippingCostNet'){n[k]=0;continue;}const s=String(f[k]??'').trim().replace(',','.');if(!/^\d+(?:\.\d{1,4})?$/.test(s))return {valid:false};n[k]=Number(s);}
  if(!Number.isInteger(n.quantity)||n.quantity<1||n.goodsVat>100||n.feeVat>100||!['net','gross','percent'].includes(f.commissionMode)||f.commissionMode==='percent'&&n.commission>100)return {valid:false};
  const goodsNet=n.saleNet*n.quantity,revenueNet=goodsNet+n.shippingPaidNet,gross=revenueNet*(1+n.goodsVat/100);
  const feeNet=f.commissionMode==='net'?n.commission:f.commissionMode==='gross'?n.commission/(1+n.feeVat/100):gross*n.commission/100;
  const shippingGross=automatic?smartDpdGross(goodsNet*(1+n.goodsVat/100),f.shippingMode,Number(f.parcels||1)):null;
  if(automatic&&(shippingGross===null||!Number.isFinite(Number(f.shippingVat))||Number(f.shippingVat)<0||Number(f.shippingVat)>100||n.shippingPaidNet!==0))return {valid:false};
  const shippingNet=automatic?shippingGross/(1+Number(f.shippingVat)/100):n.shippingCostNet;
  const costs=n.purchaseNet*n.quantity+shippingNet+n.packagingNet+feeNet,result=revenueNet-costs;
  return {valid:true,goodsNet,revenueNet,gross,feeNet,costs,result,shippingNet,shippingGross,margin:revenueNet?result/revenueNet*100:null,beforeAds:Math.max(0,result)};
 }
 function MarginCalculator(){
  const R=root.React,h=R.createElement,blank=()=>({id:'',name:'',firma:'AR',purchaseNet:'',saleNet:'',quantity:'1',shippingMode:'manual',parcels:'1',shippingVat:'23',shippingCostNet:'',shippingPaidNet:'0',packagingNet:'0',commissionMode:'net',commission:'',goodsVat:'23',feeVat:'23'});
  const [profiles,setProfiles]=R.useState(()=>{try{return JSON.parse(localStorage.getItem('mat_margin_profiles_v1')||'[]')}catch{return []}}),[f,setF]=R.useState(blank),[message,setMessage]=R.useState('');
  const result=marginResult(f),money=n=>n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})+' zł';
  function field(label,key,help){return h('label',{style:{display:'grid',gap:5}},label,h('input',{type:'number',min:0,step:key==='quantity'?1:0.0001,value:f[key],onChange:e=>{setMessage('');setF({...f,[key]:e.target.value})},style:{width:'100%',boxSizing:'border-box'}}),help&&h('small',{style:{color:'#a4b8ad'}},help));}
  function save(){if(!f.name.trim()){setMessage('Podaj nazwę produktu lub zestawu.');return;}const record={...f,id:f.id||crypto.randomUUID(),updatedAt:new Date().toISOString()},next=[record,...profiles.filter(p=>p.id!==record.id)];localStorage.setItem('mat_margin_profiles_v1',JSON.stringify(next));setProfiles(next);setF(record);setMessage('Kalkulacja zapisana w tej przeglądarce.'+(!result.valid?' Uzupełnij brakujące dane, aby otrzymać wynik.':''));}
  return h('section',{style:{maxWidth:1000,margin:'20px auto',padding:20,border:'1px solid #385c46',borderRadius:12,background:'#0d1d15'}},h('h2',null,'Marża netto — przed reklamą'),
   h('p',{style:{color:'#abc5b5'}},'Zakup i sprzedaż podaj netto za jedną sztukę. Koszty dostawy, kartonu i prowizji dotyczą całego zamówienia. Dla zestawu wpisz łączny zakup i sprzedaż jednego zestawu.'),
   h('div',{style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}},h('button',{className:'btn',onClick:()=>{setF(blank());setMessage('')}},'Nowa kalkulacja'),...profiles.map(p=>h('button',{key:p.id,className:'btn',onClick:()=>{setF({...blank(),...p});setMessage('')}},p.name+' · '+p.firma))),
   h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}},
    h('label',null,'Nazwa produktu / zestawu',h('input',{value:f.name,onChange:e=>setF({...f,name:e.target.value}),placeholder:'np. Mata PC mała — 1 szt.',style:{display:'block',width:'100%',boxSizing:'border-box'}})),
    h('label',null,'Firma',h('select',{value:f.firma,onChange:e=>setF({...f,firma:e.target.value}),style:{display:'block'}},...Object.entries({F:'Favour / OKTOMO',AR:'ARLIS',AL:'ALBAMA',E:'EVERIS'}).map(([k,v])=>h('option',{key:k,value:k},v)))),
    field('Cena zakupu netto / szt.','purchaseNet'),field('Cena sprzedaży netto / szt.','saleNet'),field('Liczba sztuk lub zestawów','quantity'),
    h('label',null,'Wysyłka — sposób liczenia',h('select',{value:f.shippingMode,onChange:e=>setF({...f,shippingMode:e.target.value,shippingPaidNet:e.target.value==='manual'?f.shippingPaidNet:'0'}),style:{display:'block',width:'100%'}},h('option',{value:'manual'},'Rzeczywisty koszt — wpisz netto'),h('option',{value:'smartStandard'},'Smart! Kurier DPD poza Allegro Delivery'),h('option',{value:'smartDelivery'},'Smart! Kurier DPD w Allegro Delivery'))),
    f.shippingMode==='manual'?field('Koszt kuriera netto / zamówienie','shippingCostNet'):h('label',null,'Liczba paczek Smart!',h('input',{type:'number',min:1,step:1,value:f.parcels,onChange:e=>setF({...f,parcels:e.target.value})})),
    field('Dostawa pobrana od klienta netto','shippingPaidNet','Dla Smart! pozostaw 0.'),field('Karton i pakowanie netto','packagingNet'),
    h('label',null,'Prowizja Allegro — sposób podania',h('select',{value:f.commissionMode,onChange:e=>setF({...f,commissionMode:e.target.value}),style:{display:'block',width:'100%'}},h('option',{value:'net'},'Kwota netto za zamówienie (zł)'),h('option',{value:'gross'},'Kwota brutto za zamówienie (zł)'),h('option',{value:'percent'},'Stawka netto (%) od towaru i dostawy brutto'))),
    field(f.commissionMode==='percent'?'Prowizja Allegro (%) netto':'Prowizja Allegro (zł)','commission','Podaj faktyczną opłatę lub własną stawkę. Wpisz 0 dla sprzedaży bez prowizji.'),field('VAT towaru i dostawy (%)','goodsVat'),field('VAT prowizji (%)','feeVat','Używany przy kwocie prowizji brutto.'),f.shippingMode!=='manual'&&field('VAT kosztu Smart! (%)','shippingVat')),
   h('p',{style:{fontSize:12,color:'#a4b8ad'}},'Kwoty netto. Stawka prowizji netto jest naliczana od sprzedaży brutto razem z dostawą. Zmień VAT zgodnie z transakcją. Wynik nie obejmuje reklam, podatku dochodowego ani kosztów stałych firmy.'),
   f.shippingMode!=='manual'&&h('p',{style:{fontSize:12,color:'#ffd18b'}},'Smart!: szacunek opłaty podstawowej dla kwalifikującego się zamówienia; bez pobrania, dopłat gabarytowych i usług dodatkowych. Tabela sprawdzona 21.11.2026. ',h('a',{href:'https://help.allegro.com/pl/sell/c/metody-dostawy-dpd',target:'_blank',rel:'noopener'},'Cennik DPD'), ' · ',h('a',{href:'https://help.allegro.com/pl/sell/c/allegro-smart',target:'_blank',rel:'noopener'},'Allegro Smart!')),
   result.valid?h('div',{style:{padding:18,marginTop:16,border:'1px solid #457657',borderRadius:10}},
    ...[['Przychód netto z towarem i dostawą',money(result.revenueNet)],['Sprzedaż towaru brutto',money(result.goodsNet*(1+Number(f.goodsVat)/100))],['Prowizja netto',money(result.feeNet)],['Koszt wysyłki netto',money(result.shippingNet)],['Wszystkie wpisane koszty netto',money(result.costs)],['Wynik przed reklamą i kosztami stałymi',money(result.result)],['Marża od przychodu netto',result.margin===null?'—':result.margin.toFixed(2)+'%'],['Pozostaje przed reklamą / zamówienie',money(result.beforeAds)]].map(([label,value])=>h('div',{key:label,style:{display:'flex',justifyContent:'space-between',gap:15,padding:'6px 0'}},h('span',null,label),h('strong',{style:{color:result.result<0?'#ffaaa2':'#a6e7b4'}},value)))):
    h('p',{role:'status',style:{color:'#ffd18b'}},'Uzupełnij ceny zakupu i sprzedaży, koszt wysyłki oraz prowizję. Brakujące dane nie są traktowane jako zerowy koszt.'),
   h('button',{className:'btn',onClick:save,style:{marginTop:16}},'Zapisz kalkulację'),h('p',{role:'status'},message),h('p',{style:{fontSize:12,color:'#8ca795'}},'Zapisane kalkulacje są dostępne w tej przeglądarce. Nie zmieniają cen w Allegro ani sklepach.'));
 }
 Object.assign(api,{marginResult,smartDpdGross,MarginCalculator});
})(typeof window==='object'?window:globalThis);
