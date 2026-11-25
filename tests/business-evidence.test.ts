import { describe, expect, it } from "vitest";
import { evaluateBusiness, websiteGuesses } from "../scripts/business-evidence";
import { publicAddress, publicWebsite, robotsAllows } from "../scripts/business-web";

const row={name:"North Lane Dental",city:"Pune",title:"dental clinic",website:"https://northlane-dental.com/",email:null,phone:null};
const base="<title>North Lane Dental</title><h1>North Lane Dental, Pune</h1>";
const evaluate=(html:string)=>evaluateBusiness(row,async url=>({url,html}));

describe("public evidence safety",()=>{
  it("blocks non-public literal and DNS address classes",()=>{
    for(const url of ["http://2130706433","http://[::1]","file:///x","http://router.local","https://user@valid.com","https://valid.com:555"])
      expect(()=>publicWebsite(url)).toThrow();
    for(const value of ["127.0.0.1","169.254.169.254","100.100.100.200","192.168.0.1","::ffff:8.8.8.8","::1","fe80::1","2002:7f00::1"])
      expect(publicAddress(value)).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
    expect(publicAddress("2606:4700::1111")).toBe(true);
  });
  it("honors matching groups, exceptions and encoded paths",()=>{
    const rules="User-agent: *\nDisallow: /private\nAllow: /private/about$";
    expect(robotsAllows(rules,new URL("https://any.com/%70rivate"))).toBe(false);
    expect(robotsAllows(rules,new URL("https://any.com/private/about"))).toBe(true);
    expect(robotsAllows("User-agent: *\nCrawl-delay: 30",new URL("https://any.com/"))).toBe(false);
  });
});

describe("business evidence gates",()=>{
  it("uses public ownership and booking evidence, retaining quotes and source URLs",async()=>{
    const result=await evaluate(base+"<p>Independently owned dental practice.</p><p>Call our team to book an appointment.</p><a href='mailto:office@northlane-dental.com'>Email</a>");
    expect(result).toMatchObject({status:"qualified",evidence:{contactKind:"email",websiteStatus:"official_site"}});
    expect(result.observations.map(f=>f.field)).toEqual(["identity","location","ownership","contact","digital"]);
  });
  it("holds wrong identity, hidden claims, unknown ownership and empty digital proof",async()=>{
    expect((await evaluate("<title>Other Dentist</title><p>North Lane Dental, Pune</p>")).status).toBe("review");
    expect((await evaluate(base+"<script>independently owned</script><p>Call for an appointment.</p>")).status).toBe("review");
    expect((await evaluate(base+"<p>Family-owned practice</p>")).status).toBe("review");
  });
  it("separates corporate evidence, missing domains and source failures",async()=>{
    expect((await evaluate(base+"<p>Contact us for franchise opportunities.</p>")).status).toBe("excluded");
    expect(websiteGuesses({...row,website:"https://facebook.com/x",email:"test@gmail.com"})).toEqual([]);
    expect((await evaluateBusiness(row,async()=>{throw new Error("PUBLIC_HTTP_503");})).status).toBe("retry");
  });
  it("separates centrally managed multi-city groups from same-city independent outlets", async () => {
    const independent = "<p>Family-run practice. Call us to book an appointment.</p>";
    const footprint = "Our group's portfolio spans clinics across Mumbai, Pune, and Bengaluru.";
    const group = await evaluate(base + independent + `<p>${footprint}</p>`);
    expect(group).toMatchObject({ status: "excluded", observations: expect.arrayContaining([
      expect.objectContaining({ field: "corporate", value: footprint, url: row.website }),
    ]) });
    expect(await evaluate(base + independent + "<p>Our company's locations are in Kothrud and Baner, Pune.</p>"))
      .toMatchObject({ status: "qualified" });
    expect(await evaluate(base + independent + "<p>Our group's portfolio contains staff training projects across India.</p>"))
      .toMatchObject({ status: "qualified" });
  });
  it("keeps a matching branch with a declared parent in review",async()=>{
    const schema='<script type="application/ld+json">{"name":"North Lane Dental","branchOf":{"name":"Parent operator"}}</script>';
    expect((await evaluate(base+schema+"<p>Family-run dental practice.</p><p>Call our team to book an appointment.</p>"))).toMatchObject({status:"review"});
  });
  it("uses structured identity, a postal match and a named founder without accepting unrelated testimonials",async()=>{
    const html=`<script type="application/ld+json">{"@graph":[{"name":"North Lane Dental","address":{"postalCode":"411009"},"founder":{"name":"Dr Nirmala Patel"}}]}</script>
      <blockquote>My own practice is located across Pune.</blockquote>
      <p>Call to book your appointment.</p>`;
    const result=await evaluateBusiness({...row,address:"44 Lane Road, 411009"},async url=>({url,html}));
    expect(result).toMatchObject({status:"qualified",websiteObservation:"official_site"});
    expect(result.observations.find(item=>item.field==="location")?.value).toContain("postal code");
  });
  it("checks contact independently and holds an already available digital booking flow",async()=>{
    const contact="<a href='mailto:office@northlane-dental.com'>Email</a>";
    const review=await evaluate(base+contact);
    expect(review.status).toBe("review");
    expect(review.observations.some(item=>item.field==="contact")).toBe(true);
    const result=await evaluate(base+"<p>Family-run practice. Call us to book your appointment.</p><a href='https://practo.com/clinic'>Book appointment</a>"+contact);
    expect(result).toMatchObject({status:"review",reason:"Existing online booking or enquiry flow observed"});
  });
  it("holds first-party booking links and explicit online forms without discarding a phone-only lead",async()=>{
    const opener=base+"<p>Founded in 2003 by Meera Shah. Call us to book an appointment.</p>";
    expect(await evaluate(opener)).toMatchObject({status:"qualified"});
    for(const evidence of ["<p>Fill out the online appointment form to request an appointment.</p>","<a href='/request-an-appointment'>Request an appointment</a>",
      "<h3>Schedule appointment</h3><form><input name='phone'><button>Submit</button></form>"]){
      expect(await evaluate(opener+evidence)).toMatchObject({status:"review",reason:"Existing online booking or enquiry flow observed"});
    }
    expect(await evaluate(base+"<p>North Lane Dental builds relationships founded on trust. Call us to book an appointment.</p>"))
      .toMatchObject({status:"review",reason:"Official domain matched; local ownership is not documented"});
  });
});
