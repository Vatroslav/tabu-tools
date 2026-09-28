# Kalkulator plaće

Gross to net, net to gross and employer cost for Croatia, Serbia and Bosnia and Herzegovina
(Federation of BiH, Republika Srpska, Brčko District). Static page, no build step.

- `engine/` - calculation per jurisdiction, integer minor units, per-item rounding
- `engine/params-*.js` - parameters with the period they apply to and their legal source
- `engine/data-hr-local-units.js` - Croatian local income tax rates, generated
- `test/` - reference cases from published examples: `node --test "test/*.test.js"`

## Yearly update

1. Add a parameter set with the new `validFrom` in the matching `engine/params-*.js`.
2. Croatia: download the Tax Administration's local rate table for the new year and run
   `python tools/build_hr_local_units.py <table.xlsx> <YYYY-MM>`.
3. Add the new published examples to `test/` and run the tests.

## Monthly update

- Croatia: `HR_DZS_NON_TAXABLE` in `engine/params-hr.js` holds the average non-taxable receipts
  from the latest DZS release on average wages (table 4); the July 2026 figures were
  published on 22 September 2026.
