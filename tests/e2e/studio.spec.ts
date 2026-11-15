import {test,expect} from '@playwright/test';

test('studio keeps package selection and services connected to the project brief',async({page})=>{
  await page.goto('/services');
  for(const price of ['₹5,999','₹18,999','₹44,999+']) await expect(page.getByText(price,{exact:false}).first()).toBeVisible();
  await page.getByRole('link',{name:'Discuss Growth Web & App Suite'}).click();
  await expect(page.getByLabel('Package of interest')).toHaveValue('business');
  await page.getByLabel('Service type').selectOption('Unity 3D / AR');
  await expect(page.getByLabel('Service type')).toHaveValue('Unity 3D / AR');
});
test('reduced motion keeps the composition and content without fetching the WebGL scene',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  const scenes:string[]=[];page.on('request',r=>{if(r.url().includes('StudioScene'))scenes.push(r.url());});
  await page.goto('/');
  await expect(page.getByTestId('studio-journey')).toHaveAttribute('data-mode','still');
  await expect(page.getByTestId('studio-journey').locator('canvas')).toHaveCount(0);
  await page.getByRole('button',{name:'View 3D anyway'}).focus();await expect(page.getByRole('button',{name:'View 3D anyway'})).toBeFocused();
  expect(scenes).toEqual([]);
  await page.locator('#project').scrollIntoViewIfNeeded();
  await page.getByRole('link',{name:'Open project enquiry'}).click();await expect(page).toHaveURL('/contact');
});
test('3D camera advances through the sections, pauses and recovers context loss',async({page})=>{
  test.setTimeout(60000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');const visual=page.getByTestId('studio-journey');
  if(await page.getByRole('button',{name:'Enable 3D journey'}).count())await page.getByRole('button',{name:'Enable 3D journey'}).click();
  await expect(visual).toHaveAttribute('data-mode','webgl',{timeout:20000});
  for(const [id,stage] of [['blueprint','0'],['services','1'],['security','2'],['project','3']]){
    await page.locator('#'+id).evaluate(el=>window.scrollTo(0,(el as HTMLElement).offsetTop-110));
    await expect(visual).toHaveAttribute('data-stage',stage);
    await page.screenshot({path:`outputs/screenshots/studio-stage-${stage}.png`});
  }
  await page.getByRole('button',{name:'Pause 3D journey'}).click();await expect(visual).toHaveAttribute('data-mode','still');await expect(visual.locator('canvas')).toHaveCount(0);
  await page.getByRole('button',{name:'Enable 3D journey'}).click();await expect(visual).toHaveAttribute('data-mode','webgl');
  await visual.locator('canvas').dispatchEvent('webglcontextlost');await expect(visual).toHaveAttribute('data-mode','fallback');
  await page.getByRole('button',{name:'Enable 3D journey'}).click();await expect(visual).toHaveAttribute('data-mode','webgl');
  expect(errors).toEqual([]);
});
