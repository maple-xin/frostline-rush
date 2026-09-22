/* Frostline Rush 3D — original game code. Three.js is bundled locally under the MIT license. */
(() => {
  'use strict';
  const T = THREE;
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['viewport','menu','pause-screen','end-screen','webgl-error','stars','points','speed','energy','progress','distance','combo','combo-detail','scorecard','score-note','toast','boost','jump','sound'].map(id=>[id,$(id)]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,t)=>a+(b-a)*Math.min(1,t);
  const rand=(a,b)=>a+Math.random()*(b-a);
  const TAU=Math.PI*2;
  const COURSE=2400;
  let renderer,scene,camera,clock,skier,skierParts,light,world=[],scenery=[],snowParticles=[],roadSegments=[],terrain=[],tracks=[],glowStars=[],trees=[],state='intro',runId=0;
  let player={},keys={},pointer=null,pointerStart=null,boostHeld=false,soundOn=true,audio,previous=0,now=0,comboTimer=0,toastTimer=0,shake=0,finishBurst=false;

  const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.79,metalness:0,flatShading:false,...extra});
  const m={
    snow:mat('#e1eff0'),road:mat('#f1f7f3'),bank:mat('#a9cbd1'),ice:mat('#a4ced6',{roughness:.39,metalness:.05}),
    darkIce:mat('#79afbd'),shadow:mat('#a2c9ce'),mountain:mat('#9fbdc4'),mountain2:mat('#b5cdd0'),mountainSnow:mat('#f5f9f2'),
    pine:mat('#176d71'),pineLight:mat('#2c8b86'),pineShade:mat('#155d68'),pineSnow:mat('#f2faf2'),trunk:mat('#8e674d'),
    wood:mat('#b7825b'),woodLight:mat('#d5a77b'),woodDark:mat('#66483f'),roof:mat('#724e49'),window:mat('#ffe5a6',{emissive:'#ffb758',emissiveIntensity:.52}),
    rock:mat('#7f9ca6'),rockLight:mat('#b0c8c9'),orange:mat('#ed8061'),orangeLight:mat('#ffae7b'),white:mat('#f5eee5'),
    helmet:mat('#377a91',{roughness:.43}),helmetLight:mat('#55a2b2',{roughness:.4}),visor:mat('#84d1d7',{metalness:.15,roughness:.24}),
    mitt:mat('#345c6f'),pink:mat('#e78188',{roughness:.5}),ski:mat('#ef7990',{roughness:.35}),skiTop:mat('#fff2db'),
    gold:mat('#ffca53',{metalness:.15,roughness:.32,emissive:'#c87c20',emissiveIntensity:.24}),goldEdge:mat('#fff4b9',{emissive:'#d8a632',emissiveIntensity:.12}),
    ramp:mat('#e6b772'),rampTop:mat('#ffdf98'),red:mat('#df7567'),cloud:new T.MeshBasicMaterial({color:'#fffdf1',transparent:true,opacity:.88}),
    glow:new T.MeshBasicMaterial({color:'#ffedb6',transparent:true,opacity:.6,depthWrite:false}),
  };
  const box=(w,h,d,material)=>new T.Mesh(new T.BoxGeometry(w,h,d),material);
  const sphere=(r,material,segments=18)=>new T.Mesh(new T.SphereGeometry(r,segments,12),material);
  const cyl=(rt,rb,h,material,sides=12)=>new T.Mesh(new T.CylinderGeometry(rt,rb,h,sides),material);
  const cone=(r,h,material,sides=8)=>new T.Mesh(new T.ConeGeometry(r,h,sides),material);
  const add=(parent,mesh,x=0,y=0,z=0,shadow=true)=>{mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=shadow;parent.add(mesh);return mesh};
  function snowTexture(base,seedOffset){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
    ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
    for(let i=0;i<1800;i++){let x=seed(i*5+seedOffset)*256,y=seed(i*11+seedOffset)*256,s=.3+seed(i*17+seedOffset)*2.4;
      ctx.fillStyle=i%3?'rgba(91,157,174,.035)':'rgba(255,255,255,.18)';ctx.fillRect(x,y,s,s*.6)}
    for(let i=0;i<26;i++){let x=seed(i*29+seedOffset)*256,y=seed(i*47+seedOffset)*256;
      ctx.strokeStyle=i%2?'rgba(98,162,179,.048)':'rgba(255,255,255,.2)';ctx.lineWidth=1+seed(i*3)*2;
      ctx.beginPath();ctx.ellipse(x,y,7+seed(i*7)*18,1.3+seed(i*13)*2,-.17,0,TAU);ctx.stroke()}
    const texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(2,18);
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  function seed(x){let n=Math.sin(x*127.1+74.7)*43758.5453;return n-Math.floor(n)}
  function roadHeight(z,d){return -Math.max(0,-z)*.012+.31*(Math.sin((d-z)*.044)-Math.sin(d*.044))}
  function roadCenter(z,d){return 1.35*(Math.sin((d-z)*.010)-Math.sin(d*.010))}
  function makeTerrain(width,near,far,across,along,material,offset=0,lateral=0){
    const verts=[],uv=[],indices=[];
    for(let i=0;i<=along;i++){let z=mix(near,far,i/along);for(let j=0;j<=across;j++){let x=(j/across-.5)*width+lateral;verts.push(x,roadHeight(z,0)+offset,z);uv.push(j/across,i/along)}}
    for(let i=0;i<along;i++)for(let j=0;j<across;j++){let a=i*(across+1)+j,b=a+across+1;indices.push(a,a+1,b,b,a+1,b+1)}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);terrain.push({mesh,near,far,across,along,offset,width,lateral});return mesh;
  }
  function updateTerrain(d){for(const o of terrain){const attr=o.mesh.geometry.attributes.position;for(let i=0;i<=o.along;i++){let z=mix(o.near,o.far,i/o.along),cx=o.width<50?roadCenter(z,d):0;for(let j=0;j<=o.across;j++){let x=(j/o.across-.5)*o.width+cx+o.lateral,k=i*(o.across+1)+j;attr.setXYZ(k,x,roadHeight(z,d)+o.offset,z)}}attr.needsUpdate=true;o.mesh.geometry.computeVertexNormals()}}

  function makeMountain(x,z,h,w,color){
    const g=new T.Group();
    const verts=[],colors=[];
    const c1=new T.Color(color),c2=new T.Color('#f3faf7');
    const N=9,base=[];
    for(let i=0;i<N;i++){let a=TAU*i/N, rr=w*(.78+seed(i*23+x)*.3);base.push([Math.cos(a)*rr,0,Math.sin(a)*rr*.62])}
    const peaks=[];for(let i=0;i<N;i++){let p=base[i],q=base[(i+1)%N];let cap=[p[0]*.24,h*(.53+seed(i*7+h)*.09),p[2]*.24];peaks.push(cap);
      verts.push(...p,...q,0,h,0);let shade=.76+seed(i*4+x)*.22,cc=c1.clone().multiplyScalar(shade);for(let j=0;j<3;j++)colors.push(cc.r,cc.g,cc.b);
      verts.push(...cap,...[q[0]*.23,h*(.53+seed((i+1)*7+h)*.09),q[2]*.23],0,h,0);for(let j=0;j<3;j++)colors.push(c2.r,c2.g,c2.b);
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    let mesh=new T.Mesh(geo,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,flatShading:true}));mesh.castShadow=false;mesh.receiveShadow=true;g.add(mesh);g.position.set(x,-1.5,z);scene.add(g);
  }
  function makeCloud(x,y,z,s){const g=new T.Group();for(let i=0;i<5;i++){let o=sphere(1,m.cloud,10);o.scale.set(1.3+seed(i*3+x)*.5,.42+seed(i*5+x)*.24,.57);add(g,o,(i-2)*.91*s,seed(i*7)*.38*s,(i%2)*-.32*s,false)}g.position.set(x,y,z);scene.add(g);return g}

  function makePine(scale=1){const g=new T.Group();let tr=cyl(.17,.25,1.15,m.trunk,7);add(g,tr,0,.53,0);let needles=[];
    for(let i=0;i<3;i++){let r=(1.45-i*.26)*scale, h=(2.25-i*.17)*scale,y=(1.3+i*.73)*scale;let green=cone(r,h,[m.pineShade,m.pine,m.pineLight][i],9);add(g,green,0,y,0);needles.push(green);
      const snow=cone(r*.72,h*.41,m.pineSnow,9);add(g,snow,0,y+h*.31,0);}
    let tip=cone(.45*scale,.38*scale,m.pineSnow,8);add(g,tip,0,3.45*scale,0);return g;}
  function makeChalet(scale=1,variant=0){
    const g=new T.Group(),w=3.5+variant*.35,h=3.4+variant*.3,d=3.7;
    add(g,box(w,h,d,m.wood),0,h/2,0);
    const roof=new T.Group();let left=box(w*.78,.22,d+1,m.roof),right=box(w*.78,.22,d+1,m.roof);add(roof,left,-w*.24,.65,0);left.rotation.z=Math.PI/4.5;add(roof,right,w*.24,.65,0);right.rotation.z=-Math.PI/4.5;add(g,roof,0,h,0);
    for(let side of [-1,1]){let slab=box(w*.8,.2,d+1.07,m.pineSnow);slab.position.set(side*w*.25,h+.86,0);slab.rotation.z=-side*Math.PI/4.5;g.add(slab)}
    add(g,box(w+.25,.23,d+.1,m.woodDark),0,.13,0);
    for(let iz of [-1,1]){let zz=iz*(d/2+.016);for(let ix of [-1,1])for(let floor of [1.1,2.5]){
      let win=box(.64,.75,.12,m.woodDark);add(g,win,ix*.95,floor,zz);add(g,box(.46,.56,.13,m.window),ix*.95,floor,zz+iz*.08,false);
      add(g,box(.08,.64,.15,m.woodDark),ix*.95,floor,zz+iz*.17,false);add(g,box(.55,.08,.15,m.woodDark),ix*.95,floor,zz+iz*.18,false);
    }}
    add(g,box(.87,1.3,.11,m.woodDark),0,.68,d/2+.07);add(g,box(.68,.97,.12,m.woodLight),0,.5,d/2+.14);
    const chimney=box(.57,1.5,.6,m.woodDark);add(g,chimney,w*.28,h+1.06,-.65);
    g.scale.setScalar(scale);return g;
  }
  function makeFenceSegment(){const g=new T.Group();for(let z of [-2.5,2.5]){add(g,box(.21,1.17,.21,m.woodDark),0,.58,z);add(g,box(.31,.17,.31,m.pineSnow),0,1.23,z)}for(let y of [.5,1.02])add(g,box(.13,.13,5.25,m.woodLight),0,y,0);return g}
  function makeLantern(){const g=new T.Group();
    add(g,cyl(.12,.17,3.6,m.woodDark,8),0,1.8,0);
    add(g,box(1.1,.12,.12,m.woodDark),.48,3.45,0);
    add(g,box(.46,.14,.46,m.woodDark),.95,3.0,0);
    add(g,box(.34,.48,.34,m.window),.95,2.7,0,false);
    add(g,cone(.36,.3,m.roof,4),.95,3.12,0);
    add(g,box(.47,.11,.47,m.pineSnow),.95,3.25,0);
    return g}
  function makeRock(){const g=new T.Group();let body=new T.Mesh(new T.IcosahedronGeometry(.65,0),m.rock);body.scale.set(1.2,.77,.9);add(g,body,0,.42,0);let cap=new T.Mesh(new T.IcosahedronGeometry(.51,0),m.rockLight);cap.scale.set(1.12,.17,.75);add(g,cap,-.05,.78,-.06,false);return g}
  function makeDrift(scale=1){const g=new T.Group();for(let i=0;i<3;i++){let puff=sphere(.52+i*.08,i%2?m.snow:m.bank,8);puff.scale.set(1.1+.2*i,.27+.04*i,.75);add(g,puff,(i-1)*.5,.15+i*.035,(i%2)*.34,false)}g.scale.setScalar(scale);return g}
  function makeRamp(){const g=new T.Group();let wedge=new T.Mesh(new T.BoxGeometry(2.2,.45,2.8),m.ramp);wedge.rotation.x=-.17;add(g,wedge,0,.26,0);let top=box(2.18,.08,2.8,m.rampTop);top.rotation.x=-.17;add(g,top,0,.52,-.04);for(let x of [-.85,.85])add(g,box(.14,.04,2.7,m.white),x,.57,-.05,false);return g}
  function starShape(r=1){let shape=new T.Shape();for(let i=0;i<10;i++){let a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.48:r,x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y)}shape.closePath();return shape}
  function makeStar(){const g=new T.Group(),geo=new T.ExtrudeGeometry(starShape(.58),{depth:.14,bevelEnabled:true,bevelSize:.07,bevelThickness:.05,bevelSegments:1,steps:1});geo.center();let star=new T.Mesh(geo,m.gold);add(g,star,0,0,0);let halo=sphere(.7,m.glow,10);halo.scale.set(1.15,1.15,.18);add(g,halo,0,0,-.16,false);return g}

  function makeSkier(){
    const root=new T.Group(),rig=new T.Group();root.add(rig);const p={root,rig};
    for(let x of [-.32,.32]){let ski=box(.19,.09,1.96,m.ski);add(rig,ski,x,.08,.18);add(rig,box(.14,.04,.78,m.skiTop),x,.145,-.2,false);let boot=box(.34,.26,.55,m.pink);add(rig,boot,x,.28,-.1);let shin=box(.29,.52,.35,m.white);add(rig,shin,x,.65,-.05);}
    let body=sphere(.69,m.orange);body.scale.set(.85,.97,.71);add(rig,body,0,1.52,0);p.body=body;
    let collar=cyl(.38,.39,.2,m.orangeLight);add(rig,collar,0,2.04,0);
    let pack=sphere(.48,m.helmet);pack.scale.set(.73,.88,.48);add(rig,pack,0,1.58,.55);
    let buckle=box(.33,.27,.08,m.gold);add(rig,buckle,0,1.58,.8,false);
    for(let x of [-1,1]){let arm=cyl(.16,.2,.72,m.orange,8);arm.rotation.z=x*.42;add(rig,arm,x*.7,1.52,-.02);p['arm'+x]=arm;add(rig,sphere(.23,m.mitt),x*.84,1.14,-.08);
      let pole=cyl(.018,.018,1.44,m.woodDark,6);pole.rotation.z=x*.16;add(rig,pole,x*.95,.45,-.13);}
    let head=sphere(.6,m.helmetLight);head.scale.set(1,.95,.94);add(rig,head,0,2.35,-.02);let helmet=sphere(.65,m.helmet);helmet.scale.set(1,.45,1);add(rig,helmet,0,2.67,-.02);let rim=box(1.2,.15,.25,m.helmet);add(rig,rim,0,2.51,-.56);
    let goggles=sphere(.5,m.visor);goggles.scale.set(1,.37,.22);add(rig,goggles,0,2.41,-.54);let face=sphere(.28,m.orangeLight);face.scale.set(1,.65,.27);add(rig,face,0,2.15,-.56,false);
    let pom=sphere(.17,m.gold);add(rig,pom,0,2.99,-.02);
    root.scale.setScalar(.70);scene.add(root);return p;
  }

  function initScene(){
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){ui['webgl-error'].classList.remove('hidden');return false}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));renderer.setSize(ui.viewport.clientWidth,ui.viewport.clientHeight);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#9bcbd6',1);
    ui.viewport.appendChild(renderer.domElement);
    scene=new T.Scene();scene.background=new T.Color('#9dcedc');scene.fog=new T.FogExp2('#b4d9df',.0044);
    camera=new T.PerspectiveCamera(65,ui.viewport.clientWidth/ui.viewport.clientHeight,.08,440);camera.position.set(0,5.2,10.4);camera.lookAt(0,1.4,-20);
    scene.add(new T.HemisphereLight('#eafaff','#7b9fac',1.15));light=new T.DirectionalLight('#fff0d5',2.45);light.position.set(-28,38,-36);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-30;light.shadow.camera.right=30;light.shadow.camera.top=35;light.shadow.camera.bottom=-35;light.shadow.camera.near=1;light.shadow.camera.far=120;light.shadow.bias=-.00015;light.shadow.normalBias=.02;scene.add(light);
    const fill=new T.DirectionalLight('#80d5e2',.42);fill.position.set(25,9,15);scene.add(fill);
    m.road.map=snowTexture('#f1f7f3',17);m.road.needsUpdate=true;
    m.snow.map=snowTexture('#e1eff0',43);m.snow.map.repeat.set(18,18);m.snow.needsUpdate=true;
    makeTerrain(360,28,-280,8,84,m.snow,-.10);
    makeTerrain(12.7,28,-280,6,84,m.road,-.025);
    for(let side of [-1,1]){
      makeTerrain(1.5,28,-280,1,84,m.bank,.015,side*6.7);
      makeTerrain(.12,28,-280,1,84,m.ice,.005,side*6.25);
    }
    for(let z=0;z<35;z++){let strip=new T.Group();for(let x of [-2.8,2.8]){let s=new T.Mesh(new T.PlaneGeometry(.065,3.5),m.ice);s.rotation.x=-Math.PI/2;add(strip,s,x,.008,0,false)}strip.position.z=-z*8;scene.add(strip);roadSegments.push({mesh:strip,z:-z*8})}
    for(let i=0;i<25;i++){let x=(i-12)*20,z=-175-seed(i*8)*80,h=26+seed(i*13)*44,w=16+seed(i*21)*14;makeMountain(x,z,h,w,i%2?'#819da8':'#8aa9b1')}
    for(let i=0;i<9;i++)makeCloud((i-4)*12+seed(i*7)*10,20+seed(i*4)*8,-80-i*17,1.8+seed(i*9)*.9);
    skierParts=makeSkier();skier=skierParts.root;
    for(let side of [-1,1]){let material=new T.MeshBasicMaterial({color:'#91c4cb',transparent:true,opacity:.35,depthWrite:false});let trail=new T.Mesh(new T.PlaneGeometry(.055,8.8),material);trail.rotation.x=-Math.PI/2;trail.position.set(side*.29,.038,6.6);scene.add(trail);tracks.push({mesh:trail,side})}
    for(let i=0;i<96;i++){let mesh=sphere(.035+(i%4)*.016,i%3?m.white:m.ice,5);mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);snowParticles.push({mesh,life:0,vx:0,vy:0,vz:0})}
    makeEnvironment();makeCourse();window.addEventListener('resize',resize);resize();return true;
  }
  function makeEnvironment(){
    for(let i=0;i<26;i++)for(let side of [-1,1]){let d=7+i*9.4+seed(i*3+side)*2.5;
      const f=makeFenceSegment();f.position.set(side*7.35,0,-d);scene.add(f);scenery.push({mesh:f,d,range:26*9.4,type:'fence',x:side*7.35});}
    for(let i=0;i<47;i++){let d=5+i*5.4+seed(i*19)*8,side=i%2?1:-1,x=side*(8.7+seed(i*7)*22),sc=1.1+seed(i*23)*.65;
      let g=makePine(sc);g.position.set(x,0,-d);scene.add(g);scenery.push({mesh:g,d,range:260,type:'pine',x});}
    for(let i=0;i<18;i++){let d=19+i*13.3+seed(i*5)*8,side=i%2?1:-1,x=side*(12.5+seed(i*12)*8),sc=.88+seed(i*4)*.35;
      let g=makeChalet(sc,i%3);g.rotation.y=side===1?-.18:.18;g.position.set(x,0,-d);scene.add(g);scenery.push({mesh:g,d,range:260,type:'chalet',x});}
    for(let i=0;i<12;i++){let d=25+i*21.2,side=i%2?1:-1,x=side*10.4,g=makeLantern();g.rotation.y=side===1?Math.PI:0;g.position.set(x,0,-d);scene.add(g);scenery.push({mesh:g,d,range:255,type:'lantern',x})}
    for(let i=0;i<40;i++){let d=8+i*6.4,x=(i%2?1:-1)*(15+seed(i*22)*42),s=.4+seed(i*8)*1.5;
      let g=makePine(s);g.position.set(x,-.12,-d);scene.add(g);scenery.push({mesh:g,d,range:270,type:'backpine',x});}
    for(let i=0;i<32;i++){let d=3+i*7.8+seed(i*14)*4,side=i%2?1:-1,x=side*(7.1+seed(i*11)*4),g=makeDrift(.6+seed(i*7)*1.2);g.position.set(x,0,-d);scene.add(g);scenery.push({mesh:g,d,range:260,type:'drift',x});}
  }
  function makeCourse(){
    for(let d=47,i=0;d<COURSE-30;d+=28+seed(i*11)*12,i++){
      let x=(seed(i*6+2)-.5)*7.8;const star=makeStar();star.position.set(x,1.5,-d);scene.add(star);world.push({mesh:star,d,x,type:'star',taken:false,phase:i*.4});
      if(i%3===0){let x2=(seed(i*12+3)-.5)*7;const s2=makeStar();s2.position.set(x2,1.55,-(d+6));scene.add(s2);world.push({mesh:s2,d:d+6,x:x2,type:'star',taken:false,phase:i*.9})}
      if(i>2&&i%5===0){let rx=(seed(i*15)-.5)*7.2;const r=makeRamp();r.position.set(rx,0,-(d+13));scene.add(r);world.push({mesh:r,d:d+13,x:rx,type:'ramp',taken:false})}
      if(i>3&&i%4===0){let rx=(seed(i*31)-.5)*8.8;const r=makeRock();r.position.set(rx,0,-(d+17));scene.add(r);world.push({mesh:r,d:d+17,x:rx,type:'rock',taken:false})}
    }
    let finish=new T.Group();for(let x of [-6.3,6.3])add(finish,cyl(.18,.22,5,m.woodDark,9),x,2.5,0);add(finish,box(12.9,.42,.6,m.woodDark),0,5,0);add(finish,box(12.2,.31,.64,m.gold),0,4.72,0);finish.position.z=-COURSE;scene.add(finish);world.push({mesh:finish,d:COURSE,x:0,type:'finish'});
  }

  function resize(){if(!renderer)return;let w=ui.viewport.clientWidth,h=ui.viewport.clientHeight;renderer.setSize(w,h,false);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));camera.aspect=w/h;camera.fov=h>w?67:61;camera.updateProjectionMatrix()}
  function sfx(type){if(!soundOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();let osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;osc.type=type==='hit'?'sawtooth':'sine';let f=type==='star'?660:type==='jump'?380:type==='boost'?250:type==='hit'?110:520;osc.frequency.setValueAtTime(f,t);osc.frequency.exponentialRampToValueAtTime(type==='hit'?55:f*1.5,t+.16);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(type==='hit'?.09:.055,t+.014);gain.gain.exponentialRampToValueAtTime(.0001,t+.24);osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+.25)}catch(_){}}
  function setState(v){state=v;ui.menu.classList.toggle('hidden',v!=='intro');ui['pause-screen'].classList.toggle('hidden',v!=='pause');ui['end-screen'].classList.toggle('hidden',v!=='end')}
  function reset(){runId++;player={x:0,dist:0,speed:83,energy:100,jump:0,vy:0,spin:0,spinVelocity:0,tilt:0,score:0,stars:0,hearts:3,combo:0,invuln:0,airtime:0,landing:false};keys={};pointer=null;boostHeld=false;finishBurst=false;world.forEach(o=>{o.taken=false;o.mesh.visible=true});scenery.forEach(o=>o.d=7+((o.d-7)%o.range+o.range)%o.range);ui.boost.classList.remove('active');ui.combo.classList.remove('show');ui.scorecard.style.opacity='1';hud();}
  function start(){reset();setState('run');sfx('start')}
  function pause(on){if(on&&state==='run'){setState('pause');boostHeld=false;ui.boost.classList.remove('active')}else if(!on&&state==='pause')setState('run')}
  function end(win){setState('end');$('end-kicker').textContent=win?'THE FINISH LINE':'ONE MORE TRY';$('end-title').textContent=win?'Brilliant run!':'Wipeout!';$('end-copy').textContent=win?'You conquered Pinecone Ridge. The mountain is yours.':'Dust off the snow and race again.';$('result-score').textContent=player.score.toLocaleString();$('result-stars').textContent=player.stars;$('result-distance').textContent=Math.floor(player.dist).toLocaleString()+' m';sfx(win?'star':'hit')}
  function jump(){if(state!=='run'||player.jump>.08)return;player.vy=7.8;player.airtime=0;player.landing=true;sfx('jump');burst(player.x,1.1,2,14,'snow')}
  function combo(label,score){player.score+=score;player.combo++;comboTimer=1.35;ui.combo.querySelector('span').textContent=player.combo>=3?'SUPER COMBO!':'COMBO!';ui['combo-detail'].textContent='+'+score+' · '+label;ui.combo.classList.add('show');ui['score-note'].textContent=label;ui.scorecard.style.transform='rotate(-2deg) scale(1.12)';setTimeout(()=>ui.scorecard.style.transform='rotate(-2deg)',250);hud();sfx('star')}
  function toast(str){ui.toast.textContent=str;ui.toast.classList.add('show');toastTimer=.9}
  function hud(){ui.stars.textContent=player.stars;ui.points.textContent=player.score.toLocaleString();ui.speed.textContent=Math.round(player.speed);ui.energy.style.width=clamp(player.energy,0,100)+'%';ui.progress.style.width=clamp(player.dist/COURSE*100,0,100)+'%';ui.distance.textContent=Math.floor(player.dist).toLocaleString()+' / 2,400 m'}
  function burst(x,y,z,count,type){for(let i=0;i<count;i++){let p=snowParticles.find(q=>q.life<=0);if(!p)break;p.life=.4+Math.random()*.5;p.mesh.visible=true;p.mesh.material=type==='gold'?m.gold:m.white;p.mesh.position.set(x+rand(-.4,.4),y+rand(-.15,.15),z+rand(-.35,.35));p.vx=rand(-2.3,2.3);p.vy=rand(.7,3);p.vz=rand(-3,2);p.mesh.scale.setScalar(.65+rand(0,1.3))}}
  function update(dt){
    now+=dt;if(state!=='run')return;
    let steer=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),desired=pointer===null?clamp(player.x+steer*5.5*dt,-3.2,3.2):pointer;
    let oldX=player.x;player.x=smooth(player.x,desired,dt*(pointer===null?9:7));player.tilt=smooth(player.tilt,clamp((player.x-oldX)/Math.max(dt,.001)*.13,-.6,.6),dt*5);
    let boosting=(boostHeld||keys.ShiftLeft||keys.ShiftRight)&&player.energy>2;
    let target=boosting?139:92;player.speed=smooth(player.speed,target,dt*(boosting?1.55:.62));player.energy=clamp(player.energy+(boosting?-24:10)*dt,0,100);if(player.energy<=0){boostHeld=false;ui.boost.classList.remove('active')}
    player.dist+=player.speed/3.6*dt;player.invuln=Math.max(0,player.invuln-dt);
    if(player.jump>0||player.vy>0){player.vy-=18.3*dt;player.jump=Math.max(0,player.jump+player.vy*dt);player.airtime+=dt;player.spin+=(player.spinVelocity+(keys.KeyQ?-3.1:0)+(keys.KeyE?3.1:0))*dt;player.spinVelocity*=Math.exp(-dt*1.25);
      if(player.jump===0&&player.landing){player.vy=0;player.landing=false;let rot=Math.abs(player.spin);if(rot>.8||player.airtime>.68){combo(rot>4?'FULL SPIN LANDING':'CLEAN LANDING',Math.round(160+Math.min(480,rot*55)+player.airtime*110));burst(player.x,1.0,2,20,'gold')}else burst(player.x,.3,2,11,'snow');player.spin=0;player.spinVelocity=0}
    }
    let playerGround=roadHeight(2.2,player.dist);skier.position.set(player.x,playerGround+player.jump,2.2);let rig=skierParts.rig;rig.rotation.z=smooth(rig.rotation.z,-player.tilt*.34,dt*7);rig.rotation.y=player.jump>.1?player.spin:Math.sin(now*1.7)*.015;rig.rotation.x=player.jump>.1?-.15:Math.sin(now*11)*.025;rig.position.y=player.jump>.1?0:Math.sin(now*12)*.025;
    updateTerrain(player.dist);
    for(let t of tracks){t.mesh.position.x=player.x+t.side*.29;t.mesh.position.y=roadHeight(6.6,player.dist)+.036;t.mesh.visible=player.jump<.28}
    for(let i=0;i<roadSegments.length;i++){let o=roadSegments[i];o.mesh.position.z=((player.dist*1.7+i*8+16)%280)-265;o.mesh.position.y=roadHeight(o.mesh.position.z,player.dist)+.03;o.mesh.position.x=roadCenter(o.mesh.position.z,player.dist)}
    for(let o of scenery){while(o.d<player.dist-22)o.d+=o.range;o.mesh.position.z=-(o.d-player.dist);o.mesh.position.x=o.x+roadCenter(o.mesh.position.z,player.dist);o.mesh.position.y=roadHeight(o.mesh.position.z,player.dist);o.mesh.visible=o.mesh.position.z>-155&&o.mesh.position.z<30}
    for(let o of world){let z=-(o.d-player.dist);o.mesh.position.z=z;o.mesh.position.x=o.x+roadCenter(z,player.dist);o.mesh.position.y=roadHeight(z,player.dist);if(o.type==='star'&&!o.taken){o.mesh.position.y+=1.6+Math.sin(now*3+o.phase)*.18;o.mesh.rotation.y=now*1.9+o.phase}o.mesh.visible=!o.taken&&z>-145&&z<22;
      if(!o.taken&&Math.abs(o.d-player.dist)<2.5&&Math.abs(o.x-player.x)<(o.type==='star'?1.08:o.type==='ramp'?1.2:1.02)){
        o.taken=true;if(o.type==='star'){player.stars++;player.score+=100;player.energy=clamp(player.energy+9,0,100);toast('+100 STAR');burst(o.x,1.55,z,16,'gold');sfx('star')}
        else if(o.type==='ramp'){player.vy=9.3;player.jump=.1;player.airtime=0;player.landing=true;player.spinVelocity+=(keys.KeyQ?-4:keys.KeyE?4:2.4);toast('AIR TIME!');sfx('jump')}
        else if(o.type==='rock'&&player.jump<.5&&player.invuln<=0){player.hearts--;player.invuln=1.8;player.speed=47;player.combo=0;shake=.55;toast(player.hearts?'OUCH!':'WIPEOUT!');burst(player.x,.5,2,27,'snow');sfx('hit');if(player.hearts<=0){end(false);return}}
      }
    }
    if(player.dist>=COURSE){end(true);return}
    if(comboTimer>0){comboTimer-=dt;if(comboTimer<=0)ui.combo.classList.remove('show')}
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show')}
    shake=Math.max(0,shake-dt*1.6);
    for(let p of snowParticles){if(p.life<=0){p.mesh.visible=false;continue}p.life-=dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.vy-=7*dt;p.mesh.scale.multiplyScalar(1-dt*.6)}
    if(Math.random()<(boosting?.94:.48))burst(player.x,.2,3.15,boosting?3:1,'snow');
    let cx=player.x*.48+rand(-shake,shake)*.2,cy=5.05+playerGround+player.jump*.16+rand(-shake,shake)*.15;
    camera.position.x=smooth(camera.position.x,cx,dt*2.2);camera.position.y=smooth(camera.position.y,cy,dt*2.1);camera.position.z=smooth(camera.position.z,boosting?11.0:10.3,dt*2);camera.lookAt(player.x*.13+roadCenter(-35,player.dist)*.22,1.1+player.jump*.14+roadHeight(-18,player.dist),-18);
    light.position.x=-28+player.x*.2;light.target.position.set(player.x,0,-20);light.target.updateMatrixWorld();hud();
  }
  function frame(t){let dt=Math.min((t-previous)/1000||0,.035);previous=t;update(dt);if(renderer)renderer.render(scene,camera);requestAnimationFrame(frame)}
  function controls(){
    $('start').addEventListener('click',start);$('again').addEventListener('click',start);$('resume').addEventListener('click',()=>pause(false));$('restart-pause').addEventListener('click',start);$('pause').addEventListener('click',()=>pause(true));
    ui.sound.addEventListener('click',()=>{soundOn=!soundOn;ui.sound.textContent=soundOn?'♫':'×';ui.sound.setAttribute('aria-label',soundOn?'Mute sound':'Unmute sound')});
    ui.jump.addEventListener('pointerdown',e=>{e.preventDefault();jump()});ui.boost.addEventListener('pointerdown',e=>{e.preventDefault();boostHeld=true;ui.boost.classList.add('active');ui.boost.setPointerCapture(e.pointerId);sfx('boost')});for(let type of ['pointerup','pointercancel','lostpointercapture'])ui.boost.addEventListener(type,()=>{boostHeld=false;ui.boost.classList.remove('active')});
    const cv=renderer.domElement;cv.addEventListener('pointerdown',e=>{if(state!=='run')return;cv.setPointerCapture(e.pointerId);let r=cv.getBoundingClientRect();pointer=clamp(((e.clientX-r.left)/r.width-.5)*7.4,-3.2,3.2);pointerStart={x:e.clientX,y:e.clientY}});
    cv.addEventListener('pointermove',e=>{if(pointer===null||state!=='run')return;let r=cv.getBoundingClientRect();pointer=clamp(((e.clientX-r.left)/r.width-.5)*7.4,-3.2,3.2);if(player.jump>.1&&pointerStart&&Math.abs(e.clientX-pointerStart.x)>28){player.spinVelocity+=Math.sign(e.clientX-pointerStart.x)*.7;pointerStart.x=e.clientX}});for(let type of ['pointerup','pointercancel','lostpointercapture'])cv.addEventListener(type,()=>{pointer=null;pointerStart=null});
    window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Space'&&!e.repeat)jump();if(e.code==='Escape'){if(state==='run')pause(true);else if(state==='pause')pause(false)}});window.addEventListener('keyup',e=>keys[e.code]=false);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='run')pause(true)});
  }
  if(initScene()){reset();controls();requestAnimationFrame(frame)}
})();
