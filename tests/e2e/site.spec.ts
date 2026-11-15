import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test('guided demo completes six steps and remains keyboard accessible',async({page},testInfo)=>{
  await page.goto('/demo');await page.getByRole('button',{name:'Start guided demo'}).click();
  const tour=page.getByRole('region',{name:'Guided product tour'});
  await expect(tour).toContainText('STEP 1 OF 6');await expect(tour.getByRole('heading')).toBeFocused();
  for(let step=2;step<=6;step++){await tour.getByRole('button',{name:'Next step'}).click();await expect(tour).toContainText(`STEP ${step} OF 6`);await expect(tour.getByRole('heading')).toBeFocused();}
  await expect(page.locator('.draft-preview')).toContainText('Baner, Pune');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(a11y.violations).toEqual([]);
  await page.screenshot({path:`outputs/screenshots/tour-${testInfo.project.name}.png`,fullPage:true});
  await tour.getByRole('button',{name:'Previous step'}).click();await expect(tour).toContainText('STEP 5 OF 6');await page.keyboard.press('Escape');await expect(tour).not.toBeVisible();await expect(page.getByRole('button',{name:'Start guided demo'})).toBeFocused();
  await page.getByRole('button',{name:'Start guided demo'}).click();for(let i=0;i<5;i++)await tour.getByRole('button',{name:'Next step'}).click();await tour.getByRole('link',{name:'Discuss your workflow'}).click();await expect(page).toHaveURL('/contact');
});
test("site renders, navigates, and fits the viewport", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /From your idea/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `outputs/screenshots/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({path:`outputs/screenshots/home-${testInfo.project.name}-viewport.png`});
  await page.getByRole("link", { name: "Explore sample experience" }).click();
  await expect(
    page.getByRole("heading", { name: "The visitor’s enquiry" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  if (testInfo.project.name === 'iphone') await page.getByRole('button', {name:'Open navigation'}).click();
  await page.getByRole('link', {name:'Our work',exact:true}).click();
  await expect(page).toHaveURL('/#work');
  expect(await page.locator('#work').evaluate(e => Math.abs(e.getBoundingClientRect().top - parseFloat(getComputedStyle(e).scrollMarginTop)))).toBeLessThan(5);
  if (testInfo.project.name === 'iphone') await expect(page.getByRole('button', {name:'Open navigation'})).toHaveAttribute('aria-expanded','false');
});
test("sample enquiry changes score, approval creates a local draft, reset clears state", async ({
  page,
}, testInfo) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Run the enquiry" }).click();
  await expect(page.locator(".big-score")).toContainText("95");
  await page.getByRole("button", { name: "Approve draft" }).click();
  await expect(page.locator(".draft-preview")).toContainText("Baner, Pune");
  await expect(page.locator(".draft-preview")).toContainText(
    "No message has been sent",
  );
  await page.screenshot({
    path: `outputs/screenshots/demo-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Sell a property", exact: true })
    .click();
  await page.getByRole("button", { name: "Run the enquiry" }).click();
  await expect(page.locator(".permission")).toContainText("Follow-up blocked");
  await page.getByRole("button", { name: "Approve draft" }).click();
  await expect(page.locator(".draft-preview")).toContainText(
    "Obtain permission",
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".demo-empty")).toBeVisible();
  expect(external).toEqual([]);
});
test("contact validates and truthfully prepares without submitting", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Prepare my brief" }).click();
  await expect(page.getByText("Tell us a little more (at least 20 characters).")).toBeVisible();
  await page.getByLabel("Your name").fill("Sample Owner");
  await page.getByLabel("Email address").fill("sample@example.com");
  await page.getByLabel("Business / service").fill("Sample Practice");
  await page
    .getByLabel("What would you like to improve?")
    .fill("I need a website with a structured enquiry form and owner alerts.");
  await page
    .getByLabel("Indicative setup budget")
    .selectOption("₹15,000–₹30,000");
  await page.getByLabel("Include permission").check();
  await page.getByRole("button", { name: "Prepare my brief" }).click();
  await expect(
    page.getByRole("heading", { name: "Your brief is ready." }),
  ).toBeVisible();
  await expect(
    page.getByText("Prepared locally. Not sent to the agency."),
  ).toBeVisible();
});
test("key routes pass automated accessibility checks", async ({ page }) => {
  test.setTimeout(60000);
  // The decorative canvas is aria-hidden and has its own lifecycle test.
  // Audit the accessible content in reduced-motion mode without GPU contention.
  await page.emulateMedia({reducedMotion:'reduce'});
  const issues: unknown[] = [];
  for (const route of [
    "/",
    "/demo",
    "/contact",
    "/services",
    "/privacy",
    "/terms",
  ]) {
    await page.goto(route);
    if (route === "/demo") {
      await page.getByRole("button", { name: "Run the enquiry" }).click();
      await page.getByRole("button", { name: "Approve draft" }).click();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    issues.push(
      ...results.violations.map((v) => ({
        route,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  expect(issues).toEqual([]);
});
