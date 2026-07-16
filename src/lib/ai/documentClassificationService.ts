import { getChatCompletion } from './chatCompletion';

export interface DocumentClassificationResult {
  documentType: string;
  confidence: 'High' | 'Medium' | 'Low';
  description: string;
  requiredActions: string[];
  riskFlags: string[];
}

const DOCUMENT_TYPES = [
  'Title Deed',
  'Mortgage Agreement',
  'Valuation Report',
  'Insurance Certificate',
  'Land Survey',
  'Corporate Resolution',
  'Loan Agreement',
  'Guarantee Letter',
  'Power of Attorney',
  'Registration Certificate',
  'Financial Statement',
  'Identity Document',
  'Other Legal Document',
];

export async function classifyCollateralDocument(
  collateralId: string,
  collateralType: string,
  obligor: string,
  registry: string,
  additionalContext?: string
): Promise<DocumentClassificationResult> {
  const systemPrompt = `You are an expert collateral document classifier for a bank's collateral management system in Tanzania. 
Your task is to classify collateral documents and identify required actions and risk flags.
Always respond with valid JSON only, no markdown, no extra text.`;

  const userPrompt = `Classify the collateral document for the following record and return a JSON object:

Collateral ID: ${collateralId}
Collateral Type: ${collateralType}
Obligor: ${obligor}
Registry: ${registry}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Based on the collateral type and registry, determine the most likely primary document type from this list:
${DOCUMENT_TYPES.join(', ')}

Return ONLY a JSON object with this exact structure (no markdown, no code blocks):
{
  "documentType": "<one of the document types listed above>",
  "confidence": "<High|Medium|Low>",
  "description": "<one sentence describing why this document type was assigned>",
  "requiredActions": ["<action 1>", "<action 2>"],
  "riskFlags": ["<flag 1>"] 
}

requiredActions should list 1-3 specific verification steps for this document type.
riskFlags should list 0-2 potential risks or missing items to check. Use empty array [] if none.`;

  const response = await getChatCompletion(
    'OPEN_AI',
    'gpt-4o-mini',
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      max_completion_tokens: 400,
      temperature: 0.2,
    }
  );

  const content = response?.choices?.[0]?.message?.content ?? '';

  // Strip markdown code blocks if present
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as DocumentClassificationResult;
  return parsed;
}
