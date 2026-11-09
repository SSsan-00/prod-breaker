import {test,expect} from '@playwright/test';
test('home sister link is visible and fits compact and landscape viewports',async({page},info)=>{
 await page.goto('/');const link=page.getByRole('link',{name:'姉妹作 PROD BREAKER を開く（壊す側へ）'});
 await expect(link).toHaveAttribute('href','https://prod-breaker.vercel.app/');await expect(link).toHaveAttribute('target','_blank');
 for(const size of info.project.name==='mobile'?[{width:320,height:480},{width:393,height:851},{width:851,height:393}]:[{width:1366,height:768}]){
 await page.setViewportSize(size);await expect(link).toBeVisible();const bounds=(await link.boundingBox())!;expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(size.width);expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height);expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 }
});
