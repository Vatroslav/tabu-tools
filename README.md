# tabu-tools

Besplatni alati Tabua za privatne i poslovne korisnike.

- Kalkulator troška odlaska zaposlenika (Employee Turnover Cost Calculator) - https://kalkulator.tabu.hr/turnover/
- Kalkulator plaće bruto-neto (Hrvatska, Srbija, BiH) - https://kalkulator.tabu.hr/placa/

Each page exists in Croatian (`/placa/`) and English (`/en/placa/`). The Croatian page is the
source: after editing it or its strings, run `python tools/build_en.py`, which rewrites the
English pages, the hreflang links and `sitemap.xml`.
