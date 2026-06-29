/**
 * Perfection Authorities Configuration
 *
 * Maps each perfection authority to its full name, website, collateral types,
 * and deadline field key used in compliance rules.
 */

export interface PerfectionAuthority {
  /** Short code used in the registry field */
  code: string;
  /** Full official name */
  fullName: string;
  /** Official website URL */
  website: string;
  /** Collateral types typically registered with this authority */
  collateralTypes: string[];
  /** Field key used in compliance rule conditions */
  deadlineField: string;
  /** Short description for UI tooltips */
  description: string;
  /** Badge colour class (Tailwind) */
  badgeColor: string;
}

export const PERFECTION_AUTHORITIES: PerfectionAuthority[] = [
  {
    code: 'BRELA',
    fullName: 'Business Registrations and Licensing Agency',
    website: 'https://ors.brela.go.tz',
    collateralTypes: ['Shares', 'Debenture', 'Business Assets', 'Intellectual Property', 'Floating Charge'],
    deadlineField: 'days_to_brela_deadline',
    description: 'Registers charges over company shares, debentures, and business assets',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    code: 'Lands Registry',
    fullName: 'Ministry of Lands, Housing and Human Settlements Development',
    website: 'https://ardhi.go.tz',
    collateralTypes: ['Land', 'Real Estate', 'Title Deed', 'Mortgage', 'Leasehold'],
    deadlineField: 'days_to_lands_deadline',
    description: 'Registers mortgages, charges, and caveats over land and real property',
    badgeColor: 'bg-green-100 text-green-700 border-green-200',
  },
  {
    code: 'TRA',
    fullName: 'Tanzania Revenue Authority',
    website: 'https://www.tra.go.tz',
    collateralTypes: ['Tax Clearance', 'Customs Bond', 'Revenue Security'],
    deadlineField: 'days_to_tra_deadline',
    description: 'Handles tax clearance certificates and revenue-related security interests',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    code: 'DSE',
    fullName: 'Dar es Salaam Stock Exchange',
    website: 'https://www.dse.co.tz',
    collateralTypes: ['Listed Shares', 'Bonds', 'Securities'],
    deadlineField: 'days_to_dse_deadline',
    description: 'Registers pledges and charges over listed securities and bonds',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    code: 'TASAC',
    fullName: 'Tanzania Shipping Agencies Corporation',
    website: 'https://www.tasac.go.tz',
    collateralTypes: ['Vessel', 'Marine Cargo', 'Ship Mortgage'],
    deadlineField: 'days_to_tasac_deadline',
    description: 'Registers mortgages and charges over vessels and marine assets',
    badgeColor: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  {
    code: 'N/A',
    fullName: 'Not Applicable',
    website: '',
    collateralTypes: ['Cash Deposit', 'Government Bond', 'Treasury Bill'],
    deadlineField: '',
    description: 'No external registry required — self-perfecting or held in custody',
    badgeColor: 'bg-gray-100 text-gray-600 border-gray-200',
  },
];

/** Lookup map: code → authority */
export const AUTHORITY_MAP: Record<string, PerfectionAuthority> = Object.fromEntries(
  PERFECTION_AUTHORITIES.map((a) => [a.code, a])
);

/** All registry codes (for dropdowns) */
export const REGISTRY_CODES = PERFECTION_AUTHORITIES.map((a) => a.code);

/** Registries that require active perfection tracking (excludes N/A) */
export const ACTIVE_REGISTRIES = PERFECTION_AUTHORITIES.filter((a) => a.code !== 'N/A').map((a) => a.code);

/**
 * Get the badge colour class for a registry code.
 * Falls back to a neutral style for unknown codes.
 */
export function getAuthorityBadge(code: string): string {
  return AUTHORITY_MAP[code]?.badgeColor ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

/**
 * Get the full name for a registry code.
 */
export function getAuthorityFullName(code: string): string {
  return AUTHORITY_MAP[code]?.fullName ?? code;
}

/**
 * Build a deadline SMS message that is authority-aware.
 */
export function buildDeadlineMessage(
  collateralId: string,
  registry: string,
  daysLeft: number,
  appUrl: string
): string {
  const authority = AUTHORITY_MAP[registry];
  const authorityLabel = authority ? authority.code : registry;
  const urgency = daysLeft <= 0 ? 'OVERDUE' : daysLeft <= 3 ? 'CRITICAL' : 'WARNING';
  const daysText = daysLeft <= 0
    ? `${Math.abs(daysLeft)} days overdue`
    : `${daysLeft} days remaining`;
  return `[CollateralMS ${urgency}] ${authorityLabel} deadline for ${collateralId}: ${daysText}. Take action: ${appUrl}/compliance-audit`;
}
