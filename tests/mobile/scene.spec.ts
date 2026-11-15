import {test,expect} from '@playwright/test';

const sites=[
  {name:'studio',url:process.env.SCENE_LIVE === 'true' ? 'https://leadflow-agency.pages.dev' : 'http://127.0.0.1:5183',visual:'studio-journey',cta:'Start a conversation'},
  {name:'marketing',url:process.env.SCENE_LIVE === 'true' ? 'https://signal-and-slate.pages.dev' : 'http://127.0.0.1:5185',visual:'journey-visual',cta:'Find your growth opportunity'},
];
for(const site of sites){
  test(`${site.name}: touch phone loads 3D automatically, stays visible on scroll and recovers`,async({page},info)=>{
    // Reproduce the previous <=4-core/touch gate, without overriding WebGL itself.
    await page.addInitScript(()=>Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4}));
    const errors:string[]=[]; const failedAssets:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(/\.(js|woff2?)(\?|$)/.test(r.url())&&r.status()>=400)failedAssets.push(r.url());});
    await page.goto(site.url);
    const visual=page.getByTestId(site.visual),canvas=visual.locator('canvas');
    await expect(visual).toHaveAttribute('data-mode','webgl',{timeout:30000});
    await expect(visual).toHaveAttribute('data-quality','compact');
    await expect(canvas).toBeVisible();
    const assertFraming=async()=>{
      const frame=await canvas.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,screenWidth:innerWidth,screenHeight:innerHeight,bufferWidth:(el as HTMLCanvasElement).width,pixelRatio:devicePixelRatio};});
      expect(frame.width).toBeGreaterThan(200);expect(frame.height).toBeGreaterThan(120);
      expect(frame.left).toBeGreaterThanOrEqual(-1);expect(frame.right).toBeLessThanOrEqual(frame.screenWidth+1);
      expect(frame.top).toBeGreaterThanOrEqual(0);expect(frame.bottom).toBeLessThanOrEqual(frame.screenHeight);
      // High-density phones should render sharper than the old 1x drawing buffer.
      expect(frame.bufferWidth).toBeGreaterThanOrEqual(Math.floor(frame.width*Math.min(frame.pixelRatio,2))-2);
      expect(frame.bufferWidth).toBeLessThanOrEqual(Math.ceil(frame.width*2)+2);
    };
    await assertFraming();
    await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));
    await page.screenshot({path:`outputs/screenshots/mobile-${process.env.SCENE_LIVE === 'true' ? 'live-' : ''}${site.name}-${info.project.name}.png`});
    for(const progress of [0.32,0.66,0.99]){
      await page.evaluate(p=>scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*p),progress);
      await expect(visual).not.toHaveAttribute('data-stage','0');await assertFraming();
    }
    await expect(visual).toHaveAttribute('data-stage','3');
    await page.getByRole('button',{name:'Pause 3D journey'}).click();
    await expect(visual).toHaveAttribute('data-mode','still');await expect(canvas).toHaveCount(0);
    await page.getByRole('button',{name:'Enable 3D journey'}).click();
    await expect(visual).toHaveAttribute('data-mode','webgl',{timeout:15000});
    await expect(canvas).toBeVisible();
    await canvas.dispatchEvent('webglcontextlost');await expect(visual).toHaveAttribute('data-mode','fallback');
    await page.getByRole('button',{name:'Enable 3D journey'}).click();await expect(visual).toHaveAttribute('data-mode','webgl',{timeout:15000});
    await page.setViewportSize({width:844,height:390});
    await expect.poll(async()=>canvas.evaluate(el=>el.getBoundingClientRect().bottom-innerHeight)).toBeLessThanOrEqual(0);
    await assertFraming();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(failedAssets).toEqual([]);expect(errors).toEqual([]);
  });
  test(`${site.name}: motion and data-saving preferences keep an optional still view`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    const scenes:string[]=[];page.on('request',r=>{if(/(?:StudioScene|JourneyScene)/.test(r.url()))scenes.push(r.url());});
    await page.goto(site.url);await expect(page.getByTestId(site.visual)).toHaveAttribute('data-mode','still');
    await expect(page.locator('canvas')).toHaveCount(0);expect(scenes).toEqual([]);
    await expect(page.getByText('Reduce Motion is on in your device settings.')).toBeVisible();
    await expect(page.getByRole('button',{name:'View 3D anyway'})).toBeVisible();
    await expect(page.getByRole('link',{name:site.cta,exact:true})).toBeVisible();
    await page.screenshot({path:`outputs/screenshots/mobile-preference-${site.name}-${info.project.name}.png`});
    await page.getByRole('button',{name:'View 3D anyway'}).click();
    await expect(page.getByTestId(site.visual)).toHaveAttribute('data-mode','webgl',{timeout:30000});
    await page.getByRole('button',{name:'Pause 3D journey'}).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true},configurable:true}));
    await page.reload();await expect(page.getByTestId(site.visual)).toHaveAttribute('data-mode','still');
    await expect(page.getByText('Data Saver is on for this connection.')).toBeVisible();
    await expect(page.getByRole('button',{name:'View 3D anyway'})).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
  });
}
