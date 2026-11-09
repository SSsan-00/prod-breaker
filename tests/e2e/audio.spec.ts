import {test,expect} from '@playwright/test';
test('music continues across upgrade selection and mute disconnects the music bus',async({page},info)=>{
 test.skip(info.project.name!=='desktop');
 await page.addInitScript(()=>{
  let starts=0,stops=0;const buses=new WeakSet<AudioNode>();const connect=AudioNode.prototype.connect,disconnect=AudioNode.prototype.disconnect;
  Object.defineProperty(window,'musicProbe',{get:()=>({starts,stops})});
  Object.defineProperty(AudioNode.prototype,'connect',{value:function(this:AudioNode,...args:unknown[]){if(this instanceof GainNode&&this.gain.value>0&&this.gain.value<.1&&args[0] instanceof AudioDestinationNode){buses.add(this);starts++;}return Reflect.apply(connect,this,args);}});
  Object.defineProperty(AudioNode.prototype,'disconnect',{value:function(this:AudioNode,...args:unknown[]){if(buses.has(this))stops++;return Reflect.apply(disconnect,this,args);}});
 });
 await page.clock.install({time:new Date('2026-11-09T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-09T00:00:01Z'));await page.goto('/?seed=42');await page.clock.runFor(100);await page.getByRole('button',{name:'ミュート切替'}).click();await page.getByRole('button',{name:/START DEFENDING/}).click();await page.clock.runFor(100);await page.locator('.panic').click();await page.clock.runFor(25000);
 const dialog=page.getByRole('dialog',{name:'レベルアップ'});if(!await dialog.isVisible()){await page.locator('.panic').click();await page.clock.runFor(200);}await expect(dialog).toBeVisible();const probe=()=>page.evaluate(()=>Reflect.get(window,'musicProbe') as {starts:number;stops:number});expect(await probe()).toEqual({starts:1,stops:0});await dialog.locator('.skill-card').first().click();expect(await probe()).toEqual({starts:1,stops:0});await page.getByRole('button',{name:'ミュート切替'}).evaluate((button:HTMLButtonElement)=>button.click());expect(await probe()).toEqual({starts:1,stops:1});
});
