(async function(){
  // Charge la lib si absente (CDN)
  if(!window.tsParticles){
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tsparticles@3/tsparticles.bundle.min.js';
    s.defer=true;
    await new Promise(res=>{s.onload=res;document.head.appendChild(s);});
  }
  // Conteneur plein écran derrière la page
  let container=document.getElementById('bg-particles');
  if(!container){
    container=document.createElement('div');
    container.id='bg-particles';
    document.body.prepend(container);
  }
  // Config simple et légère
  tsParticles.load('bg-particles',{
    fullScreen:false,
    background:{color:'transparent'},
    particles:{
      number:{value:60,density:{enable:true,area:800}},
      links:{enable:true,distance:120,opacity:0.4},
      move:{enable:true,speed:1},
      size:{value:{min:1,max:3}},
      opacity:{value:0.6}
    }
  });
})();

