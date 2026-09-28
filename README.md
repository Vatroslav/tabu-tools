# tabu-tools

Javni HR mini-alati Tabua, statički HTML bez builda.

| Alat | URL | File |
|---|---|---|
| Kalkulator troška odlaska zaposlenika (Employee Turnover Cost Calculator) | https://kalkulator.tabu.hr | `index.html` |

## Deploy

GitHub Pages iz `main` grane, root foldera. Svaki push na `main` je live za ~1 min.
Custom domena je u `CNAME` fileu; DNS zapis (`kalkulator` CNAME -> `vatroslav.github.io`, DNS only) živi u Cloudflare zoni tabu.hr.

## Analitika

Plausible, isti site kao tabu.hr (cookieless). Kalkulator se u dashboardu filtrira po hostnameu `kalkulator.tabu.hr`.
CTA vodi na tabu.hr/poslovni s `utm_source=kalkulator`.
