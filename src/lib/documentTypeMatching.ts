import { DocumentType } from '@/lib/supabase/documentService';

// Every known DocumentType value, used to resolve a free-text required-document
// name (from collateral_type_required_documents) to the closest DocumentType enum.
const VALID_DOC_TYPES: DocumentType[] = [
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Deed',
  'Appraisal',
  'Insurance Policy',
  'Other',
  // Motor Vehicle
  'Vehicle Registration Certificate (Original)',
  'Logbook (Original)',
  'TRA Encumbrance Search Certificate',
  'Comprehensive Insurance Policy',
  'Hire Purchase / Charge Agreement',
  // Mortgage
  'Title Deed (Original)',
  'Valuation Report (Certified)',
  'Land Rent Clearance Certificate',
  'Mortgage Deed / Charge Instrument',
  'Lands Registry Search Certificate',
  'Survey Plan / Plot Map',
  'Building Permit (if applicable)',
  // Debenture
  'Debenture Deed (Executed)',
  'Certificate of Incorporation',
  'Board Resolution (Authorising Charge)',
  'BRELA Registration Certificate',
  'Memorandum & Articles of Association',
  'Audited Financial Statements (Latest)',
  'Asset Schedule / Inventory List',
  // Shares (DSE)
  'Share Certificate(s) (Original)',
  'DSE Pledge Confirmation Letter',
  'CDS Account Statement',
  'Board Resolution (Authorising Pledge)',
  'Share Transfer Form (Blank, Signed)',
  'DSE Registry Search',
  // FDR
  'Fixed Deposit Receipt (Original)',
  'Bank Lien Letter / Pledge Confirmation',
  'Account Statement',
  'Deed of Assignment',
  // Guarantee
  'Guarantee Deed (Executed)',
  'Guarantor Financial Statements',
  'Board Resolution (if Corporate Guarantor)',
  'Certificate of Incorporation (if Corporate)',
  'Guarantor ID / KYC Documents',
  // Ship/Vessel
  'Ship Registration Certificate (TASAC)',
  'Mortgage of Ship Deed',
  'TASAC Encumbrance Search',
  'Hull & Machinery Insurance Policy',
  'Valuation / Survey Report',
  'Classification Society Certificate',
  'Crew & Manning Certificate',
];

// Map a free-text required-doc name to the closest DocumentType enum value.
// Priority: 1) exact match (case-insensitive), 2) keyword heuristics, 3) 'Other'
export function resolveDocType(name: string): DocumentType {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  const exactMatch = VALID_DOC_TYPES.find((t) => t.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  if (lower.includes('title') || lower.includes('deed')) return 'Title Deed';
  if (lower.includes('charge')) return 'Charge Certificate';
  if (lower.includes('valuation') || lower.includes('appraisal')) return 'Valuation Report';
  if (lower.includes('brela')) return 'BRELA Confirmation';
  if (lower.includes('insurance')) return 'Insurance Certificate';
  if (lower.includes('board') || lower.includes('resolution')) return 'Board Resolution';

  return 'Other';
}

/**
 * Check whether a stored document_type value matches a required document name.
 * Uses three strategies:
 *   1. Direct case-insensitive match between stored type and required name
 *   2. Stored type matches the resolved DocumentType of the required name
 *   3. Required name matches the resolved DocumentType of the stored type
 */
export function docTypeMatchesRequired(storedDocType: string, requiredDocName: string): boolean {
  const storedLower = storedDocType.toLowerCase().trim();
  const requiredLower = requiredDocName.toLowerCase().trim();

  if (storedLower === requiredLower) return true;

  const resolvedRequired = resolveDocType(requiredDocName).toLowerCase().trim();
  if (storedLower === resolvedRequired) return true;

  const resolvedStored = resolveDocType(storedDocType).toLowerCase().trim();
  if (resolvedStored === resolvedRequired) return true;

  return false;
}
