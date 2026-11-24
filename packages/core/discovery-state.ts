export type DiscoveryState = "QUALIFIED"|"REJECTED"|"REVIEW"|"RETRY_CLASSIFICATION"|"AWAITING_ENRICHMENT";
type Input = {provider?:string; decision?:string; reason?:string|null; source?:string; boundary?:string; warning?:string; incomplete?:boolean};
const conclusive = new Set(["FULL_TIME_ONLY","INTERNSHIP","SELLER_SELF_PROMOTION","UNPAID_OR_EQUITY_ONLY","STALE_OR_CLOSED","UNSAFE_CONTENT","IRRELEVANT_CATEGORY","OUT_OF_SERVICE_SCOPE","SOURCE_NOT_ALLOWED","SOURCE_UNAVAILABLE"]);

export function discoveryState(input:Input):DiscoveryState {
  if(input.reason==="UNSAFE_CONTENT"||conclusive.has(input.reason??"")||input.boundary==="ONGOING_SEAT")return "REJECTED";
  if(input.provider==="uk_tender")return "REVIEW";
  if(input.decision==="ACCEPTED")return "QUALIFIED";
  if(input.incomplete)return "AWAITING_ENRICHMENT";
  if(input.source!=="MODEL"&&/no (?:validated )?AI verdict|no approved classifier|budget reached|unavailable|timeout|HTTP (?:429|503)/i.test(input.warning??""))return "RETRY_CLASSIFICATION";
  if(input.reason==="SCOPE_MISSING"||input.reason==="INSUFFICIENT_CONTEXT"||!input.decision)return "AWAITING_ENRICHMENT";
  if(input.source==="MODEL")return "REVIEW";
  if(input.source==="NO_MODEL")return "RETRY_CLASSIFICATION";
  return "REVIEW";
}
