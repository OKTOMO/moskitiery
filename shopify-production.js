(function(root){
  'use strict';
  const stores=Object.freeze({
    arlis:{label:'ARLIS',domain:'ryzndf-kr.myshopify.com',admin:'ryzndf-kr',firma:'AR'},
    albama:{label:'ALBAMA',domain:'jsxh4r-00.myshopify.com',admin:'jsxh4r-00',firma:'AL'},
    oktomo:{label:'OKTOMO',domain:'3vbipt-6t.myshopify.com',admin:'3vbipt-6t',firma:'F'},
    everis:{label:'EVERIS',domain:'ut0xgk-5n.myshopify.com',admin:'ut0xgk-5n',firma:'E'}
  });
  const colors=['Biały','Czarny','Antracyt','Brąz','Złoty Dąb','Winchester','Orzech','Ciemny Dąb','Mahoń','Turner Oak'];
  const folded=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase();
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
})(typeof window==='object'?window:globalThis);
