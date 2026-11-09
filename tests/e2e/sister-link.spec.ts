import {test,expect} from '@playwright/test';
test('home links to PROD KEEPER without overflowing on phones',async({page},info)=>{
 await page.goto('/');const link=page.getByRole('link',{name:'姉妹作 PROD KEEPER を開く（守る側へ）'});
 await expect(link).toHaveAttribute('href','https://prod-keeper.vercel.app/');await expect(link).toHaveAttribute('target','_blank');
 for(const size of info.project.name==='mobile'?[{width:320,height:480},{width:393,height:851},{width:851,height:393}]:[{width:1366,height:768}]){
 await page.setViewportSize(size);if(info.project.name==='desktop')await link.scrollIntoViewIfNeeded();await expect(link).toBeVisible();const bounds=(await link.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(size.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height);if(info.project.name==='mobile')expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }
});
