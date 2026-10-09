'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../adventure.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');

function harness(blockPopup=false, reducedMotion=false) {
  let now=0, prevented=false;
  const timers=[], openings=[];
  const make=tag=>{
    const classes=new Set();
    const e={tag,children:[],dataset:{},href:'',parentElement:null,removed:false,
      listeners:{},textContent:'',alt:''};
    e.classList={
      add:(...names)=>names.forEach(n=>classes.add(n)),
      remove:(...names)=>names.forEach(n=>classes.delete(n)),
      contains:n=>classes.has(n)
    };
    Object.defineProperty(e,'className',{get:()=>[...classes].join(' '),
      set:v=>{classes.clear();v.split(/\s+/).filter(Boolean).forEach(n=>classes.add(n))}});
    e.setAttribute=(name,value)=>e[name]=value;
    e.append=(...items)=>items.forEach(item=>{
      e.children.push(item);
      if(item&&typeof item==='object')item.parentElement=e;
    });
    e.appendChild=e.append;
    e.replaceChildren=(...items)=>{e.children=[];e.textContent='';e.append(...items)};
    e.cloneNode=()=>make(tag);
    e.addEventListener=(kind,fn)=>e.listeners[kind]=fn;
    e.querySelector=selector=>{
      if(selector==='.boot-blocked-note')return e.children.find(x=>x?.className==='boot-blocked-note')||null;
      return null;
    };
    e.closest=()=>null;
    e.remove=()=>{e.removed=true;if(e.parentElement)e.parentElement.children=e.parentElement.children.filter(x=>x!==e)};
    e.after=item=>{e.afterItem=item};
    return e;
  };
  const host=make('article');host.classList.add('library-card');
  const link=make('a');
  link.href='https://www.youtube.com/watch?v=sT20SAAtGvo&list=PLAL-C7T4V304&index=1&autoplay=1';
  link.closest=()=>host;
  link.querySelector=()=>make('span');
  const window={
    matchMedia:()=>({matches:reducedMotion}),
    setTimeout:(fn,ms)=>timers.push({time:now+ms,fn,done:false}),
    open:(href,target)=>{
      openings.push({time:now,href,target});
      return blockPopup?null:{closed:false,opener:{}};
    }
  };
  const document={
    createElement:make,
    getElementById:()=>null,
    querySelectorAll:()=>[link],
    hidden:false
  };
  vm.runInNewContext(js,{window,document,Image:class{},URL}, {timeout:1000});
  const advance=time=>{
    while(true){
      const todo=timers.filter(x=>!x.done&&x.time<=time).sort((a,b)=>a.time-b.time)[0];
      if(!todo)break;
      now=todo.time;todo.done=true;todo.fn();
    }
    now=time;
  };
  const click=()=>{
    link.listeners.click({defaultPrevented:false,button:0,
      metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,
      preventDefault:()=>{prevented=true;}});
    return prevented;
  };
  const findClass=(parent,name)=>{
    if(parent.classList?.contains(name))return parent;
    for(const child of parent.children){
      if(typeof child==='object'){
        const found=findClass(child,name);
        if(found)return found;
      }
    }
    return null;
  };
  return {host,link,openings,advance,click,find:name=>findClass(host,name)};
}

test('No early tab; a successful window opening starts reverse automatically',()=>{
  const h=harness(false);
  assert.equal(h.click(),true);
  h.advance(610);
  assert.equal(h.find('boot-scene').classList.contains('boot-slot-open'),true);
  h.advance(1200);
  assert.equal(h.find('boot-scene').classList.contains('boot-powered'),true);
  assert.equal(h.openings.length,0);
  h.advance(1699);
  assert.equal(h.openings.length,0);
  h.advance(1700);
  assert.equal(h.openings.length,1);
  assert.equal(h.openings[0].time,1700);
  h.advance(2130);
  assert.equal(h.find('boot-scene').classList.contains('boot-powered-off'),true);
  h.advance(2240);
  assert.equal(h.find('boot-scene').classList.contains('boot-eject'),true);
  h.advance(3560);
  assert.equal(h.host.classList.contains('is-booting'),false);
  assert.equal(h.find('cartridge-boot-overlay'),null);
});
test('Blocked popup leaves N64 powered ON until user activates Open YouTube',()=>{
  const h=harness(true);
  h.click();
  h.advance(1700);
  const scene=h.find('boot-scene');
  const caption=h.find('boot-caption');
  assert.equal(scene.classList.contains('boot-powered'),true);
  assert.equal(scene.classList.contains('boot-slot-open'),true);
  assert.equal(caption.children.length,1);
  const fallback=caption.children[0];
  assert.equal(fallback.textContent,'Open YouTube');
  assert.equal(fallback.target,'_blank');
  assert.equal(fallback.rel,'noopener noreferrer');
  h.advance(6000);
  assert.equal(scene.classList.contains('boot-powered'),true);
  assert.equal(h.host.classList.contains('is-booting'),true);
  fallback.listeners.click();
  h.advance(6120);
  assert.equal(scene.classList.contains('boot-powered-off'),true);
  h.advance(6230);
  assert.equal(scene.classList.contains('boot-eject'),true);
  h.advance(6890);
  assert.equal(scene.classList.contains('boot-slot-open'),false);
  h.advance(7550);
  assert.equal(h.host.classList.contains('is-booting'),false);
});
test('Reduced motion uses the normal link without animation or scripted popup',()=>{
  const h=harness(false,true);
  assert.equal(h.click(),false);
  h.advance(7000);
  assert.equal(h.openings.length,0);
  assert.equal(h.find('cartridge-boot-overlay'),null);
});
test('Original N64 art is stacked around the centered cartridge and dust flap',()=>{
  assert.match(js,/consoleElement\.append\(rear, cavity, cartridge, front, flap, switchEl, led\)/);
  assert.match(css,/\.boot-console-back\s*\{z-index:1;/);
  assert.match(css,/\.boot-cartridge\s*\{[^}]*z-index:3;left:50%/s);
  assert.match(css,/\.boot-console-front\s*\{z-index:4;clip-path:inset\(29\.7%/);
  assert.match(css,/\.boot-slot-flap\s*\{[^}]*background:url\("assets\/n64-console-front\.webp"\)/s);
  assert.match(css,/\.boot-scene\.boot-slot-open \.boot-slot-flap\s*\{[^}]*rotateX\(-78deg\)/s);
});
test('Cartridge enters and ejects vertically with no tilt or diagonal drift',()=>{
  const frame=css.slice(css.indexOf('@keyframes boot-seat'),css.indexOf('@media(max-width:1050px)'));
  assert.doesNotMatch(frame,/rotate\s*\(/);
  assert.match(frame,/100% \{top:15%;transform:translateX\(-50%\);clip-path:inset\(0 0 60% 0\)/);
  assert.match(frame,/100% \{top:-32%;transform:translateX\(-50%\);clip-path:inset\(0 0 0 0\)/);
});
