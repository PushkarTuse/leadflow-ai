import {describe,expect,it} from 'vitest';
import {hash,inputSchema} from '../packages/core/model';
import {externalToLead,pullExternalLeads} from '../apps/automation/external-leads';
import {
  CAPABILITY_LIST_VERSION,
  QUALIFICATION_POLICY_VERSION,
  QUALIFICATION_PROMPT_VERSION,
  QUALIFICATION_RULES_VERSION,
  QUALIFICATION_SCHEMA_VERSION,
  canonicalEvidence,
  defaultQualificationPolicy,
  discoveryContextSchema,
  extractionSchema,
  locateEvidence,
  qualificationAuditSchema,
  qualificationPolicySchema,
  qualificationSchema,
  qualificationVersionSchema,
  qualificationVersions,
  validateQualificationEvidence,
  type DiscoveryContext,
  type EvidenceField,
  type QualificationRecord,
} from '../packages/core/qualification';

const NOW = "2026-11-16T00:00:00.000Z";
...

Hmm wait, actually looking at the real pasted content in the conversation:

```
import {describe,expect,it} from 'vitest';
import {hash,inputSchema} from '../packages/core/model';
import {externalToLead,pullExternalLeads} from '../apps/automation/external-leads';
```

No — the actual pasted text is:

```
import { describe, expect, it } from "vitest";
import { hash, inputSchema } from "../packages/core/model";
import {
  externalToLead,
  pullExternalLeads,
} from "../apps/automation/external-leads";
```

I need to stop guessing. The exact text from the user's message (I'll reproduce what I can see):

"tests\qualification.test.ts
