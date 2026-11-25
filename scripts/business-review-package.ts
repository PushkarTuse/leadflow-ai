import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { makeBusinessDraft, readBusinessScan } from "./local-business";

const stamp = new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date()).replace(/[^0-9]/g, "");
const folder = join("outputs", "cofounder-review", stamp);
const scans = await Promise.all([readBusinessScan(true), readBusinessScan()]);
const rows = new Map(scans.flatMap(scan=>scan?.cities.flatMap(city=>city.rows.filter(row=>row.outreach?.draftReady).map(row=>[row.id,row] as const))??[]));
if (!rows.size) throw new Error("No businesses have a draft-ready evidence record");
await mkdir(join("outputs", "cofounder-review"),{recursive:true});
await mkdir(folder);
const results: Array<{name:string;slug:string;subject:string;alternatives:string[];body:string;fingerprint:string;reused:boolean}> = [];
const skipped: Array<{id:number;reason:string}> = [];
const escape = (text:string) => text.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]!);
const heading = (name:string) => name.replace(/\r?\n|\r/g," ");

for (const business of rows.values()) {
  let draft: Awaited<ReturnType<typeof makeBusinessDraft>>;
  try { draft=await makeBusinessDraft(business.id,business.source,business.source_id,business.country??"",false); }
  catch(error) {
    skipped.push({id:business.id,reason:error instanceof Error ? error.message.slice(0,160) : "Draft generation failed"});
    continue;
  }
  if (!/^X-Unsent: 1\r?$/m.test(draft.eml) || /^(?:To|CC|BCC):/im.test(draft.eml)) throw new Error("Draft contains a recipient or lacks the unsent header");
  const name=heading(business.name);
  const slug=`${name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"business"}-${business.id}`;
  await Promise.all([
    writeFile(join(folder,`${slug}.eml`),draft.eml),
    writeFile(join(folder,`${slug}.html`),draft.html),
    writeFile(join(folder,`${slug}.txt`),`Subject: ${draft.subject}\n\n${draft.body}\n`),
  ]);
  results.push({name,slug,subject:draft.subject,alternatives:draft.alternatives,body:draft.body,fingerprint:draft.fingerprint,reused:draft.reused});
}
if(!results.length)throw new Error("Eligibility checks prevented all draft exports");
const markdown=results.map(item=>`# ${item.name}\n\n**Subject:** ${item.subject}\n\n**Alternatives for review:**\n\n${item.alternatives.map(subject=>`- ${subject}`).join("\n")}\n\n${item.body}`);
await writeFile(join(folder,"cofounder-email-review.md"),markdown.join("\n\n---\n\n")+"\n");
await writeFile(join(folder,"review.json"),JSON.stringify({drafts:results,skipped},null,2)+"\n");
const logo=(await readFile("apps/web/public/email/leadflow-signature.png")).toString("base64");
const sections=results.map((item,index)=>`<section><header><img alt="LeadFlow AI" src="data:image/png;base64,${logo}"><span>UNSENT DRAFT · ${index+1} / ${results.length}</span></header><h1>${escape(item.name)}</h1><p><strong>Subject</strong><br>${escape(item.subject)}</p><aside><strong>Alternative subjects for review</strong><ul>${item.alternatives.map(subject=>`<li>${escape(subject)}</li>`).join("")}</ul></aside><article>${item.body.split("\n\n").map(block=>`<p>${escape(block).replaceAll("\n","<br>")}</p>`).join("")}</article></section>`).join("");
const browser=await chromium.launch();
try {
  const page=await browser.newPage({reducedMotion:"reduce"});
  // Verify every exported standalone preview before packaging the consolidated PDF.
  for (const item of results) {
    await page.setContent(await readFile(join(folder,`${item.slug}.html`),"utf8"));
    const image=page.locator(".signature-still");
    if(!await image.isVisible()||!await image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0))
      throw new Error(`The static email logo did not load for ${item.slug}`);
    if(!(await page.locator("body").innerText()).includes("short call to explore your requirements"))
      throw new Error(`The approved call invitation is missing in ${item.slug}`);
  }
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><title>LeadFlow AI draft review</title><style>@page{size:A4;margin:17mm 19mm}body{font:14px/1.5 system-ui,sans-serif;color:#14201b;margin:0}section{break-after:page}section:last-child{break-after:auto}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #bfcbc2;padding-bottom:14px;color:#476154;font:600 12px system-ui;letter-spacing:.09em}img{width:140px;height:auto}h1{font-size:28px;line-height:1.2;margin:24px 0 14px}aside{background:#edf4ef;border:1px solid #d6e2d9;border-radius:5px;padding:10px 15px}ul{margin:5px 0 0;padding-left:18px}article{margin-top:18px}article p{margin:0 0 12px}</style><body>${sections}</body></html>`);
  await page.pdf({path:join(folder,"cofounder-email-review.pdf"),preferCSSPageSize:true,printBackground:true,tagged:true});
} finally {await browser.close();}
const files=await readdir(folder);
const archive=resolve(folder,"cofounder-review.zip");
if(process.platform==="win32")execFileSync("tar.exe",["-a","-cf",archive,"-C",resolve(folder),...files]);
else execFileSync("zip",["-q",archive,...files],{cwd:folder});
console.log(JSON.stringify({folder,eligible:rows.size,exported:results.length,reused:results.filter(item=>item.reused).length,archived:files.length,skipped}));
if(skipped.length)process.exitCode=1;
