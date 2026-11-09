import {test,expect} from "@playwright/test";
test("shared scoreboard: fixed size, compact name editor, no automatic keyboard, persistent name",async({page},info)=>{
  await page.route("**/api/leaderboard?*",async route=>{
    const d=new URL(route.request().url()).searchParams.get("duration");
    await route.fulfill({json:{scores:d==="90"?Array.from({length:30},(_,i)=>({player_name:`本番の守り人${i}`,score:30000-i,created_at:String(i)})):[]}});
  });
  await page.addInitScript(()=>{if(!localStorage.getItem("pk-player-name"))localStorage.setItem("pk-player-name",JSON.stringify("ファイアウォール係"));});
  await page.goto("/");await page.getByRole("button",{name:"スコアボードを開く"}).click();
  const dialog=page.getByRole("dialog",{name:"スコアボード"});
  await expect(page.getByRole("button",{name:"閉じる"})).toBeFocused();
  const field=page.getByLabel("プレイヤー名",{exact:true});
  const first=await field.inputValue();
  await page.getByRole("button",{name:"名前をランダムに変更"}).click();await expect(field).not.toHaveValue(first);
  await field.fill("定時退勤の守護神");await page.getByRole("button",{name:"名前を保存",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("名前を保存しました");
  const sizes=info.project.name==="mobile"?[{width:320,height:480},{width:393,height:851},{width:851,height:393}]:[{width:1366,height:768}];
  for(const size of sizes){
    await page.setViewportSize(size);let height=0;
    await field.fill("ファイアウォール係");
    expect(await field.evaluate((e: HTMLInputElement)=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
    for(const label of ["QUICK","STANDARD","OVERTIME"]){
      await dialog.getByRole("button",{name:new RegExp(label)}).click();
      const box=(await dialog.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
      if(height)expect(box.height).toBeCloseTo(height,0);height=box.height;
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.screenshot({path:info.outputPath("scoreboard.png")});
  await page.getByRole("button",{name:"閉じる"}).click();await page.reload();await page.getByRole("button",{name:"スコアボードを開く"}).click();await expect(field).toHaveValue("定時退勤の守護神");
});
