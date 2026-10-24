/**
 * Massachusetts Executive Order 658 screening checklist.
 *
 * INFORMATIONAL ONLY. This is a reading aid for a town meeting or a screening
 * conversation, not legal advice and not a permitting determination. Every item
 * cites the section of the order it comes from so a reader can check it against
 * the primary text.
 *
 * Primary source
 *   Executive Order No. 658, "Establishing Requirements for Responsible Data
 *   Center Development and Operations in Massachusetts to Protect and Support
 *   Ratepayers, Communities, and the Environment", signed 8 September 2026 by
 *   Governor Maura Healey, effective on signing.
 *   https://www.mass.gov/executive-orders/no-658-establishing-requirements-for-responsible-data-center-development-and-operations-in-massachusetts-to-protect-and-support-ratepayers-communities-and-the-environment
 *
 * Secondary reading used while writing this file
 *   https://natlawreview.com/article/governor-healey-issues-executive-order-establishing-new-requirements-data-centers
 *   https://www.mass.gov/news/governor-healey-no-data-centers-without-local-approval
 */

export const EO658 = {
  number: "658",
  title:
    "Establishing Requirements for Responsible Data Center Development and Operations in Massachusetts to Protect and Support Ratepayers, Communities, and the Environment",
  signed: "2026-09-08",
  issuer: "Governor Maura Healey",
  effective: "On signing",
  thresholdMw: 25,
  thresholdText:
    "Applies to data centers as defined in 400 CMR 9.00 that are built or expanded after the order was adopted and that exceed 25 MW of peak electric demand, or, for an expansion, add more than 25 MW.",
  primarySourceUrl:
    "https://www.mass.gov/executive-orders/no-658-establishing-requirements-for-responsible-data-center-development-and-operations-in-massachusetts-to-protect-and-support-ratepayers-communities-and-the-environment",
  disclaimer:
    "Informational summary, not legal advice. An executive order does not amend state or municipal law, and section 14 provides that nothing in it requires action inconsistent with applicable state or federal law. Confirm applicability with counsel and with the primary text.",
} as const;

export interface ChecklistItem {
  section: string;
  title: string;
  detail: string;
  /** What a resident or select board can actually ask about this item. */
  askAbout?: string;
}

const COVERED_ITEMS: ChecklistItem[] = [
  {
    section: "Section 1",
    title: "Community benefits agreement required before state permits",
    detail:
      "Permitting agencies are directed not to issue a permit or authorisation unless the applicant has shown conformance with the June 2026 Statement of Expectations and has submitted a community benefits agreement with key stakeholders, aligned with the standards set by the Office of Environmental Justice and Equity, as determined solely by that office.",
    askAbout:
      "Who did you sign a community benefits agreement with, and has the Office of Environmental Justice and Equity accepted it?",
  },
  {
    section: "Section 2",
    title: "Agency regulations aligned to the framework",
    detail:
      "State permitting agencies are directed, consistent with existing authorities, to amend their regulations to align with the administration's data centre framework.",
  },
  {
    section: "Section 5",
    title: "Match annual consumption with new clean electricity, or pay",
    detail:
      "MassDEP is directed to require covered projects to procure enough incremental new generation eligible under the Clean Energy Standard (310 CMR 7.75) to meet their annual electricity consumption. By 31 December 2026 MassDEP must establish an alternative compliance payment for projects that fall short; those payments go into a Ratepayer Protection Fund used to reduce supply costs for all ratepayers.",
    askAbout:
      "Which specific new clean generation will cover this load, and what happens to our bills if you pay into the Ratepayer Protection Fund instead?",
  },
  {
    section: "Section 6",
    title: "Greenhouse gas evaluation",
    detail:
      "EEA and MassDEP are directed to evaluate greenhouse gas emissions from covered projects under G.L. c. 21N, the Commonwealth's climate law.",
  },
  {
    section: "Section 7",
    title: "Water quality and quantity protections",
    detail:
      "MassDEP is directed to develop protocols requiring covered projects to protect water quality and quantity, including demonstrating compliance with applicable water, wastewater and stormwater requirements.",
    askAbout:
      "How much water will the cooling system draw and discharge, in a dry year, and from which supply?",
  },
  {
    section: "Section 8",
    title: "Annual operating reports and disclosure",
    detail:
      "EEA is directed to establish guidance for annual reporting and disclosures by operating data centres.",
    askAbout:
      "What will you publish every year about actual energy, water use and emissions once you are running?",
  },
  {
    section: "Section 11",
    title: "Responsible labour practices encouraged",
    detail:
      "State agencies are directed to encourage project labour agreements, local hiring, workforce training and registered apprenticeships. This is encouragement, not a permit condition.",
  },
];

const MUNICIPAL_SUPPORT: ChecklistItem[] = [
  {
    section: "Section 9",
    title: "Municipal guidance document",
    detail:
      "EEA, with EOED, is directed to publish a Municipal Guidance Document for Data Center Development by 31 December 2026 to help municipalities, community organisations and residents evaluate proposals.",
  },
  {
    section: "Section 10",
    title: "State help for towns reviewing a proposal",
    detail:
      "All state agencies are directed to support implementation, including by answering requests for information and guidance from municipalities that are actively evaluating a proposed data centre.",
    askAbout:
      "Has the town asked the state for help reviewing this proposal under section 10?",
  },
];

export interface Eo658Result {
  applies: boolean;
  thresholdMw: number;
  mw: number;
  summary: string;
  items: ChecklistItem[];
  /** Items that help a town regardless of project size. */
  alwaysAvailable: ChecklistItem[];
  disclaimer: string;
  primarySourceUrl: string;
}

/**
 * Which EO 658 requirements apply at a given size.
 * The threshold is "exceeds 25 MW", so a project at exactly 25 MW is not covered.
 */
export function eo658Checklist(mw: number): Eo658Result {
  const applies = mw > EO658.thresholdMw;
  return {
    applies,
    thresholdMw: EO658.thresholdMw,
    mw,
    summary: applies
      ? `At ${mw} MW peak demand this project exceeds the 25 MW threshold, so the Executive Order 658 requirements below are engaged.`
      : `At ${mw} MW peak demand this project does not exceed the 25 MW threshold, so Executive Order 658 does not engage its requirements. Local zoning, the Wetlands Protection Act, air and water permits and utility interconnection still apply.`,
    items: applies ? COVERED_ITEMS : [],
    alwaysAvailable: MUNICIPAL_SUPPORT,
    disclaimer: EO658.disclaimer,
    primarySourceUrl: EO658.primarySourceUrl,
  };
}
