import { VerificationRequirement } from '../types';

/** UK-specific pre-construction / due-diligence recommendations.
 * Kept separate from the Poland checklist so national terminology and authorities
 * cannot leak between country reports.
 */
export function getUKVerificationChecklist(municipality?: string, state?: string): VerificationRequirement[] {
  const place = municipality || state || 'the local authority';
  const isEngland = !state || /england/i.test(state);
  const planningAuthority = isEngland
    ? `${place} Local Planning Authority / Planning Department`
    : `${place} Local Planning Authority / Planning Department`;

  return [
    {
      topic: 'Official Planning Position / Local Plan & Planning Permission',
      reason: 'Confirm the site allocation, permitted use, development parameters, access requirements, heritage constraints and any planning conditions before architectural design or acquisition. For a proposed development, obtain the relevant planning documents and a formal planning review rather than relying on a desktop summary.',
      recommendedAuthorityOrExpert: `${planningAuthority}; Planning Portal / qualified UK planning consultant`,
      priority: 'High'
    },
    {
      topic: 'Geotechnical Site Investigation & Ground Stability Assessment',
      reason: 'BGS geology, GeoSure and borehole screening can identify potential shrink–swell, compressible ground, landslide, running-sand, soluble-rock and collapsible-ground hazards, but they do not establish foundation design parameters. Confirm strata, groundwater, bearing conditions and ground-movement risk through appropriate intrusive investigation and a site-specific geotechnical report.',
      recommendedAuthorityOrExpert: 'Chartered geotechnical engineer / engineering geologist',
      priority: 'High'
    },
    {
      topic: 'Mining, Underground Voids & Ground Stability Search',
      reason: 'Where the site is within or near an area of historic coal or non-coal extraction, verify mine entries, shafts, adits, quarries and other underground workings. A desktop BGS/Coal Authority screen is not proof that no voids exist beneath the site.',
      recommendedAuthorityOrExpert: 'Coal Authority Mining Report where applicable; BGS / qualified mining or geotechnical specialist',
      priority: 'High'
    },
    {
      topic: 'Phase 1 Land Contamination & Historical Land-Use Assessment',
      reason: 'Review historic mapping, former industrial uses, landfills, infilled ground and nearby potentially contaminative uses. A historic-landfill or other database hit is a risk indicator, not proof of contamination; where a plausible pollutant linkage exists, progress to appropriate intrusive investigation and remediation assessment.',
      recommendedAuthorityOrExpert: 'Qualified contaminated-land consultant / environmental consultant',
      priority: 'High'
    },
    {
      topic: 'Topographical & Boundary Survey for Design',
      reason: 'Confirm legal boundaries, site levels, structures, retaining features, drainage features, access and visible services before detailed design. The desktop boundary and DEM used in this report are not a substitute for a measured site survey.',
      recommendedAuthorityOrExpert: 'Chartered land surveyor / measured-building and topographical surveyor',
      priority: 'High'
    },
    {
      topic: 'Utility Capacity & Connection Enquiries',
      reason: 'Confirm electricity, water, sewerage, gas and telecommunications availability, connection points, capacity and lead times directly with the relevant statutory undertakers or network operators. Mapping a nearby utility does not establish connection capacity.',
      recommendedAuthorityOrExpert: 'Relevant UK utility/network operators and water company; utilities consultant where required',
      priority: 'Medium'
    },
    {
      topic: 'HM Land Registry Title, Rights & Restrictive Covenants',
      reason: 'Verify registered title, ownership, easements, covenants, rights of way, charges and other title matters before acquisition or development. The registered title plan should be reviewed together with the register and any referenced deeds.',
      recommendedAuthorityOrExpert: 'HM Land Registry records reviewed by a UK property solicitor / conveyancer',
      priority: 'High'
    },
    {
      topic: 'Archaeology & Heritage Screening',
      reason: 'Check nationally protected heritage assets and the relevant local historic-environment records. Absence from the National Heritage List does not rule out non-designated archaeology or local archaeological potential, which may affect planning requirements.',
      recommendedAuthorityOrExpert: 'Local planning authority / Historic Environment Record; heritage or archaeological consultant where indicated',
      priority: 'Medium'
    }
  ];
}
