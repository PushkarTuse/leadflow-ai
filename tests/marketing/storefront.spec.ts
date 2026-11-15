import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.beforeEach(async ({ page }) => {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.turnstile={render:(node,options)=>{node.textContent="Security check simulated for test";options.callback("test-token");return "test-widget";},remove:()=>{}};',
      }),
  );
});
test("editorial storefront fits mobile, calculates scenarios and keeps pricing honest", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Less noise. More signal." }),
  ).toBeVisible();
  await expect(page.getByTestId("journey-visual")).toHaveAttribute(
    "data-mode",
    "still",
  );
  expect(await page.locator("canvas").count()).toBe(0);
  if (info.project.name === "iphone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("link", { name: "Our expertise", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  }
  await page.getByRole("slider", { name: /Monthly ad spend/ }).fill("30000");
  await expect(
    page.getByRole("button", { name: /Projected enquiries/ }),
  ).toContainText("50");
  await page.getByRole("button", { name: /Cost per enquiry/ }).click();
  await expect(
    page.getByRole("button", { name: /Cost per enquiry/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(
      "Campaign activity and performance results are not yet verified.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore Scale Accelerator" }).click();
  await expect(page.getByLabel("Package", { exact: true })).toHaveValue(
    "scale",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `outputs/screenshots/marketing-${info.project.name}-page.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("audit keeps brand tags and submission identity through a failed receipt and retry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'window.turnstile={render:(node,options)=>{node.textContent="Security check simulated for test";options.callback("test-token");return "test-widget";},remove:()=>{}};',
      }),
  );
  const payloads: Record<string, unknown>[] = [];
  await page.route("**/api/contact", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      status: payloads.length === 1 ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        payloads.length === 1
          ? { ok: false, error: "Receipt not confirmed; retry." }
          : { ok: true, reference: "lf_0123456789abcdef" },
      ),
    });
  });
  await page.goto("/#audit");
  await page.getByRole("button", { name: "Request my growth audit" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(payloads).toHaveLength(0);
  await page.getByLabel("Your name").fill("Synthetic Owner");
  await page.getByLabel("Work email").fill("owner@example.com");
  await page.getByLabel("Business / brand").fill("Synthetic Studio");
  await page
    .getByLabel("What would you like to change?")
    .fill("We need Meta Ads lead generation for a local photography business.");
  await page.getByLabel("I agree to email").check();
  await page.getByRole("button", { name: "Request my growth audit" }).click();
  await expect(page.getByRole("alert")).toContainText("Receipt not confirmed");
  await expect(
    page.getByRole("heading", { name: "We have your brief." }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Request my growth audit" }).click();
  await expect(
    page.getByRole("heading", { name: "We have your brief." }),
  ).toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[0].submission_id).toBe(payloads[1].submission_id);
  expect(payloads[1]).toMatchObject({
    vertical: "digital-marketing",
    brand: "Signal & Slate",
    consent: true,
  });
});
test("procedural WebGL traverses all four camera stages and can be paused", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "View 3D anyway" }).click();
  await expect(page.getByTestId("journey-visual")).toHaveAttribute(
    "data-mode",
    "webgl",
    { timeout: 30000 },
  );
  await expect(page.locator("canvas")).toBeVisible();
  for (const [progress, stage] of [
    [0, 0],
    [0.32, 1],
    [0.65, 2],
    [0.99, 3],
  ]) {
    await page.evaluate(
      (p) =>
        scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * p),
      progress,
    );
    await expect(page.getByTestId("journey-visual")).toHaveAttribute(
      "data-stage",
      String(stage),
    );
    await page.screenshot({
      path: `outputs/screenshots/marketing-webgl-stage-${stage}.png`,
    });
  }
  await page.getByRole("button", { name: "Pause 3D journey" }).click();
  await expect(page.getByTestId("journey-visual")).toHaveAttribute(
    "data-mode",
    "still",
  );
  expect(await page.locator("canvas").count()).toBe(0);
});

test("unconfigured marketing site prepares an explicitly local brief without any submission", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const submissions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/contact")) submissions.push(request.url());
  });
  await page.goto("http://127.0.0.1:5176/#audit");
  await expect(page.getByText(/Preview mode/, { exact: false })).toBeVisible();
  await page.getByLabel("Your name").fill("Synthetic Owner");
  await page.getByLabel("Work email").fill("owner@example.com");
  await page.getByLabel("Business / brand").fill("Synthetic Studio");
  await page
    .getByLabel("What would you like to change?")
    .fill("We need a focused Meta Ads test with weekly campaign reports.");
  await page.getByLabel("I agree to email").check();
  await page.getByRole("button", { name: "Prepare my audit brief" }).click();
  await expect(
    page.getByRole("heading", { name: "Your audit brief is ready." }),
  ).toBeVisible();
  await expect(page.locator("pre")).toContainText(
    "vertical: digital-marketing",
  );
  expect(submissions).toEqual([]);
});

test("a lost WebGL context leaves a usable still storefront", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "View 3D anyway" }).click();
  await expect(page.getByTestId("journey-visual")).toHaveAttribute(
    "data-mode",
    "webgl",
    { timeout: 30000 },
  );
  await page.locator("canvas").dispatchEvent("webglcontextlost");
  await expect(page.getByTestId("journey-visual")).toHaveAttribute(
    "data-mode",
    "fallback",
  );
  await expect(
    page.getByRole("heading", { name: "Less noise. More signal." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Find your growth opportunity" }),
  ).toBeVisible();
});
