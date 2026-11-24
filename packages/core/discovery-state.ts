export type DiscoveryState = "QUALIFIED"|"REJECTED"|"REVIEW"|"RETRY_CLASSIFICATION"|"AWAITING_ENRICHMENT";
type Input = {provider?:string; decision?:string; reason?:string|null; source?:string; boundary?:string; warning?:string};
const conclusive = new Set(["FULL_TIME_ONLY","INTERNSHIP","SELLER_SELF_PROMOTION","UNPAID_OR_EQUITY_ONLY","STALE_OR_CLOSED","UNSAFE_CONTENT","IRRELEVANT_CATEGORY","SOURCE_NOT_ALLOWED","SOURCE_UNAVAILABLE"]);

export function discoveryState(input:Input):DiscoveryState {
  if(input.reason==="UNSAFE_CONTENT"||conclusive.has(input.reason??"")||input.boundary==="ONGOING_SEAT")return "REJECTED";
  if(input.provider==="uk_tender")return "REVIEW";
  if(input.decision==="ACCEPTED")return "QUALIFIED";
  if(input.reason==="SCOPE_MISSING"||input.reason==="INSUFFICIENT_CONTEXT"||!input.decision)return "AWAITING_ENRICHMENT";
  if(input.source==="MODEL")return "REVIEW";
  if(input.source==="NO_MODEL"||/no (?:validated )?AI verdict|no approved classifier|budget reached|unavailable/i.test(input.warning??""))return "RETRY_CLASSIFICATION";
  return "REVIEW";
}
