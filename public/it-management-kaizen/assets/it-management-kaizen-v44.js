'use strict';
(function(){
 const header=document.querySelector('.header');
 const bar=document.getElementById('mobile-sticky-cta');
 const hero=document.querySelector('.hero');
 const final=document.querySelector('.final');
 if(!header||!bar||!hero||!final)return;
 function update(){
   header.classList.toggle('is-scrolled',window.scrollY>32);
   const mobile=window.matchMedia('(max-width:650px)').matches;
   const heroBottom=hero.getBoundingClientRect().bottom;
   const finalTop=final.getBoundingClientRect().top;
   bar.hidden=!(mobile&&heroBottom<80&&finalTop>window.innerHeight*0.8);
 }
 window.addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update,{passive:true});
 bar.querySelector('a').addEventListener('click',function(){bar.hidden=true});
 update();
})();

(function(){
  'use strict';
  var allowed=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','acquisition_source_type','acquisition_source_name'];
  var incoming=new URLSearchParams(window.location.search);
  document.querySelectorAll('a[data-it-diagnosis-link]').forEach(function(link){
    var u=new URL(link.href);
    if(u.origin!=='https://sales.atlib.jp'||u.pathname!=='/it-management-kaizen/free-diagnosis/')return;
    allowed.forEach(function(key){
      var val=incoming.get(key);
      if(val&&val.length<=200)u.searchParams.set(key,val);
    });
    link.href=u.toString();
  });
})();
