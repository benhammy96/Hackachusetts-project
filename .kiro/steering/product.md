# Atlas — product truth

Atlas lets anyone click a spot in Massachusetts, pick a data centre size, and see
whether it is a good or bad place to build — and why, with the evidence and the
gaps both visible.

## Who it is for

| Reader | Their question | What Atlas gives them |
| --- | --- | --- |
| Resident or select board | Should we fight this or welcome it? | Plain-language brief, factor breakdown, five questions to ask |
| Developer or utility planner | Where can we build without a long fight? | Fatal-flaw screening, EO 658 checklist, due-diligence list |
| State planner or journalist | Where should Massachusetts steer this? | Statewide suitability map, ranked cells |

## The product is the evidence, not the score

The score exists to order the evidence. Whenever a choice arises between a
cleaner number and a more honest one, take the honest one.

Three rules carry more weight than anything else in this repo:

1. **Missing data is never favourable and never unfavourable.** A factor with no
   data is dropped from both numerator and denominator, and the UI says so and
   reports the share of each lens that is actually measured.
2. **Environmental justice is a protection, never an advantage.** Cheap land in a
   burdened neighbourhood must always lower the score.
3. **Proximity is not permission.** Distance to a transmission line is not
   capacity. A vacant cell is not land for sale. A land-cover class is not
   zoning. Say which one you have.

## What Atlas is not

- Not parcel-level legal or engineering accuracy. Screening cells are 0.74 km²
  geographic units, not parcels.
- Not a source of interconnection queue or hosting capacity data.
- Not a prediction of public sentiment. A low band is a model label. Never write
  that a community "will oppose" something.
- Not legal advice. The EO 658 checklist is informational and cites its sections
  so a reader can check the primary text.

## Standing caveat

Every surface that shows a score ends with: *Scores are a planning aid, not a
permitting decision.*
