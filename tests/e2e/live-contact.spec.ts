import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('live form requires consent, retries with same reference and confirms only actual receipt',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // Provider boundary is simulated here; deployment smoke testing uses real Turnstile.
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',route=>route.fulfill({contentType:'application/javascript',body:'window.turnstile={render:(node,options)=>{node.textContent="Security check simulated for test";options.callback("test-token");return "test-widget";},remove:()=>{}};'}));
  const bodies:Record<string,unknown>[]=[];await page.route('**/api/contact',route=>{bodies.push(route.request().postDataJSON());return route.fulfill({status:bodies.length===1?502:200,contentType:'application/json',body:JSON.stringify(bodies.length===1?{ok:false,error:'Delivery could not be confirmed. Please retry.'}:{ok:true,reference:'lf_0123456789abcdef'})});});
  await page.goto('/contact');await page.getByRole('button',{name:'Send my enquiry'}).click();await expect(page.getByRole('alert')).toBeVisible();expect(bodies).toHaveLength(0);
  await page.getByLabel('Your name').fill('Test Owner');await page.getByLabel('Email address').fill('owner@example.com');await page.getByLabel('Business / service').fill('Sample Studio');await page.getByLabel('What would you like to improve?').fill('We need a website and structured enquiry workflow with owner approvals.');await page.getByLabel('Indicative setup budget').selectOption('₹30,000–₹60,000');await page.getByLabel('I agree to receive email').check();
  await page.getByRole('button',{name:'Send my enquiry'}).click();await expect(page.getByRole('alert')).toContainText('Delivery could not be confirmed');await expect(page.getByRole('heading',{name:'Your enquiry is received.'})).not.toBeVisible();
  await page.getByRole('button',{name:'Send my enquiry'}).click();await expect(page.getByRole('heading',{name:'Your enquiry is received.'})).toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[0].submission_id).toBe(bodies[1].submission_id);expect(bodies[1].consent).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);expect(errors).toEqual([]);await page.screenshot({path:`outputs/screenshots/contact-live-${testInfo.project.name}.png`,fullPage:true});
});
