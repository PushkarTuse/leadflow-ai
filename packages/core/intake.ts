import { z } from 'zod';
import { contactSchema } from './enquiry';
import { inputSchema, type LeadInput } from './model';

export const inboundSchema = contactSchema.extend({
  submission_id: z.string().uuid(),
  budget: z.enum(['₹15,000–₹30,000','₹30,000–₹60,000','₹60,000+','I’d like guidance']),
  consent_version: z.literal('enquiry-email-v1'),
}).strict();
export type InboundEnquiry = z.infer<typeof inboundSchema>;
export const publicRequestSchema = inboundSchema.extend({
  turnstile_token: z.string().min(1).max(2048),
  website: z.string().max(200).default(''),
}).strict();
export const envelopeSchema=z.object({timestamp:z.number().int().positive(),nonce:z.string().uuid(),payload:z.string().min(10).max(12000),signature:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export function signatureMessage(timestamp:number,nonce:string,payload:string){return `${timestamp}.${nonce}.${payload}`;}
export function constantTimeEqual(a:string,b:string){let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0;}
export function verifyEnvelope(raw:unknown,secret:string,sign:(text:string,key:string)=>string,now=Date.now()):InboundEnquiry {
  if(secret.length<32)throw new Error('Webhook is not configured');
  const env=envelopeSchema.parse(raw);
  if(Math.abs(now-env.timestamp)>300000)throw new Error('Expired webhook request');
  if(!constantTimeEqual(env.signature,sign(signatureMessage(env.timestamp,env.nonce,env.payload),secret)))throw new Error('Invalid webhook signature');
  return inboundSchema.parse(JSON.parse(env.payload));
}
export function inboundToLead(enquiry:InboundEnquiry,siteUrl:string,now:string):LeadInput {
  const budgets:Record<InboundEnquiry['budget'],[number|null,number|null]>={ '₹15,000–₹30,000':[15000,30000], '₹30,000–₹60,000':[30000,60000], '₹60,000+':[60000,null], 'I’d like guidance':[null,null] };
  const [min,max]=budgets[enquiry.budget];
  return inputSchema.parse({source:'inbound',source_external_id:enquiry.submission_id,source_url:siteUrl.replace(/\/$/,'')+'/contact',title:`Website enquiry: ${enquiry.business}`.slice(0,200),raw_description:enquiry.goal,client_name_if_public:enquiry.name,stated_budget_min:min,stated_budget_max:max,currency:min===null?'UNKNOWN':'INR',contact_channel:'Consented website email enquiry',contact_permission_state:'EXPLICIT_OPT_IN',contact_email:enquiry.email,consent_at:now,consent_version:enquiry.consent_version,discovered_at:now,posted_at:now});
}
