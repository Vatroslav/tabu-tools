import { calculate, netToGross, costToGross } from './engine/index.js';
import { HR_LOCAL_UNITS } from './engine/data-hr-local-units.js';
import { HR_ASSISTED_AREA_CODES } from './engine/params-hr.js';
import { fromDecimal } from './engine/money.js';
import { I18N } from './i18n.js';

const COUNTRIES = ['HR', 'SRB', 'FBIH', 'RSBIH', 'BD'];
const DIRECTIONS = ['g2n', 'n2g', 'c2g'];
const CURRENCY_LABEL = { HR: '€', SRB: 'RSD', FBIH: 'KM', RSBIH: 'KM', BD: 'KM' };
const DEFAULT_AMOUNT = { HR: 2000, SRB: 150000, FBIH: 2000, RSBIH: 2000, BD: 2000 };
const PERIOD_MIN = '2026-01';
const PERIOD_MAX = '2027-12';
const HR_UNITS = new Map(HR_LOCAL_UNITS.map((u) => [u[0], u]));

// Field schema per jurisdiction. type: money | int | check | select | text
const check = (id, group, def = false, extra = {}) => ({ id, type: 'check', group, def, ...extra });
const int = (id, group, def, min, max, extra = {}) => ({ id, type: 'int', group, def, min, max, ...extra });
const money = (id, group, extra = {}) => ({ id, type: 'money', group, def: '', ...extra });
const select = (id, group, def, options, extra = {}) => ({ id, type: 'select', group, def, options, ...extra });
const EXTENDED = ['', '12/14', '12/15', '12/16', '12/18'];
// Fields that toggle the visibility of others (showIf) or change hints.
const RERENDER_ON = new Set(['residence', 'employerIncentive']);

const FIELDS = {
  HR: [
    select('residence', 'basic', '1333', () => HR_LOCAL_UNITS.map((u) => [String(u[0]), u[1]]), { wide: true, span2: true, hint: 'rates' }),
    int('children', 'basic', 0, 0, 9),
    int('dependents', 'basic', 0, 0, 20),
    check('assistedArea', 'person', false, { showIf: (s) => HR_ASSISTED_AREA_CODES.has(Number(s.residence)) }),
    select('disability', 'person', 'none', ['none', 'partial', 'full'], { wide: true }),
    int('membersDisabledPartial', 'person', 0, 0, 29),
    int('membersDisabledFull', 'person', 0, 0, 29),
    int('childrenShare', 'person', 100, 0, 100, { affix: '%' }),
    int('dependentsShare', 'person', 100, 0, 100, { affix: '%' }),
    select('hrviPercent', 'person', '0', ['0', '20', '30', '40', '50', '60', '70', '80', '90', '100']),
    int('birthYear', 'person', '', 1940, 2012, { optional: true }),
    check('returnee', 'person'),
    int('weeklyHours', 'job', 40, 1, 40),
    int('allowanceShare', 'job', 100, 0, 100, { affix: '%' }),
    money('totalGross', 'job'),
    check('boardMember', 'job'),
    check('pillar1Only', 'job'),
    check('insuredAbroad', 'job'),
    check('firstEmployment', 'employer'),
    check('legacyYouthExemption', 'employer'),
    check('fallenDefenderChild', 'employer'),
    select('extendedService', 'employer', '', EXTENDED),
    money('nonTaxable', 'calc', { full: true }),
  ],
  SRB: [
    int('workShare', 'basic', 100, 1, 100, { affix: '%' }),
    check('multipleEmployers', 'basic'),
    select('newResident', 'person', '', ['', 'type1', 'type2'], { wide: true }),
    check('retiree', 'person'),
    check('disabledEnterprise', 'person'),
    money('voluntaryInsurance', 'person'),
    int('ageAtYearEnd', 'person', '', 15, 100, { optional: true }),
    int('annualDependents', 'person', 0, 0, 20),
    int('hoursWorked', 'job', '', 0, 400, { optional: true }),
    int('hoursFund', 'job', '', 1, 400, { optional: true }),
    check('insuredAbroad', 'job'),
    select('employerIncentive', 'employer', '', ['', 'startup', 'disabledEmployee', 'rnd', 'newHire'], { wide: true }),
    int('rndShare', 'employer', 100, 0, 100, { affix: '%', showIf: (s) => s.employerIncentive === 'rnd' }),
    select('newHireBand', 'employer', 'small', ['small', '1-9', '10-99', '100+'], {
      wide: true,
      showIf: (s) => s.employerIncentive === 'newHire',
    }),
    select('extendedService', 'employer', '', EXTENDED),
    money('nonTaxable', 'calc', { full: true }),
  ],
  FBIH: [
    check('taxCard', 'basic', true),
    check('spouse', 'basic'),
    int('children', 'basic', 0, 0, 20),
    int('otherDependents', 'basic', 0, 0, 20),
    int('disabilities', 'person', 0, 0, 20),
    int('hoursPerDay', 'job', 8, 1, 8),
    check('specialSector', 'job'),
    select('extendedService', 'employer', '', ['', '12/14', '12/15', '12/16']),
    check('disabilityFundSmall', 'employer'),
    money('workerAid', 'employer'),
    money('nonTaxable', 'calc', { full: true }),
  ],
  RSBIH: [
    select('jobCategory', 'basic', 'secondary4', ['none', 'secondary3', 'secondary4', 'higher', 'university'], { wide: true }),
    int('dependents', 'basic', 0, 0, 20),
    money('housingInterest', 'person'),
    money('lifeInsurance', 'person'),
    money('voluntaryPension', 'person'),
    check('solidarityExempt', 'person'),
    int('workShare', 'job', 100, 1, 100, { affix: '%' }),
    check('multipleEmployers', 'job'),
    check('taxCard', 'job', true),
    select('disabilityFund', 'employer', '', ['', 'private', 'public'], { wide: true }),
    money('previousGross', 'employer'),
    money('nonTaxable', 'calc', { full: true }),
  ],
  BD: [
    select('pensionFund', 'basic', 'RS', ['RS', 'FBIH'], { wide: true }),
    check('taxCard', 'basic', true),
    check('entityResident', 'basic'),
    check('spouse', 'basic'),
    int('childrenBD', 'basic', 0, 0, 20),
    { id: 'disabilityPercents', type: 'text', group: 'person', def: '' },
    int('permanentlyDisabledMembers', 'person', 0, 0, 20),
    check('businessEmployer', 'employer', true),
    check('disabilityFundBD', 'employer'),
    money('nonTaxable', 'calc', { full: true }),
  ],
};

const m = (v) => (v === '' || v === null || v === undefined ? 0 : fromDecimal(v));
const n = (v, d = 0) => (v === '' || v === null || v === undefined ? d : Number(v));

// Maps UI state to engine input.
const TO_INPUT = {
  HR(s) {
    const unit = HR_UNITS.get(Number(s.residence)) || HR_UNITS.get(1333);
    const children = Array.from({ length: n(s.children) }, () => ({ share: n(s.childrenShare, 100) }));
    const dependents = Array.from({ length: n(s.dependents) }, () => ({ share: n(s.dependentsShare, 100) }));
    const members = [...children, ...dependents];
    let full = n(s.membersDisabledFull);
    let partial = n(s.membersDisabledPartial);
    for (const mem of members) {
      mem.disability = full-- > 0 ? 'full' : partial-- > 0 ? 'partial' : 'none';
    }
    return {
      rates: { lowerBp: unit[2], higherBp: unit[3] },
      pillar2: !s.pillar1Only,
      children,
      dependents,
      disability: s.disability,
      assistedArea: s.assistedArea && HR_ASSISTED_AREA_CODES.has(unit[0]),
      hrviPercent: n(s.hrviPercent),
      birthYear: s.birthYear ? n(s.birthYear) : null,
      returnee: s.returnee,
      weeklyHours: n(s.weeklyHours, 40),
      allowanceShare: n(s.allowanceShare, 100),
      totalGross: s.totalGross ? m(s.totalGross) : null,
      boardMember: s.boardMember,
      insuredAbroad: s.insuredAbroad,
      firstEmployment: s.firstEmployment,
      legacyYouthExemption: s.legacyYouthExemption,
      fallenDefenderChild: s.fallenDefenderChild,
      extendedService: s.extendedService || null,
      nonTaxable: m(s.nonTaxable),
    };
  },
  SRB(s) {
    const partMonth = s.hoursWorked && s.hoursFund ? { hoursWorked: n(s.hoursWorked), hoursFund: n(s.hoursFund) } : null;
    return {
      workShare: n(s.workShare, 100),
      multipleEmployers: s.multipleEmployers,
      partMonth,
      newResident: s.newResident || null,
      retiree: s.retiree,
      disabledEnterprise: s.disabledEnterprise,
      voluntaryInsurance: m(s.voluntaryInsurance),
      insuredAbroad: s.insuredAbroad,
      extendedService: s.extendedService || null,
      employerIncentive: s.employerIncentive || null,
      rndShare: n(s.rndShare, 100),
      newHireBand: s.newHireBand,
      nonTaxable: m(s.nonTaxable),
      ageAtYearEnd: s.ageAtYearEnd ? n(s.ageAtYearEnd) : null,
      dependents: n(s.annualDependents),
    };
  },
  FBIH(s) {
    return {
      taxCard: s.taxCard,
      spouse: s.spouse,
      children: n(s.children),
      otherDependents: n(s.otherDependents),
      disabilities: n(s.disabilities),
      hoursPerDay: n(s.hoursPerDay, 8),
      specialSector: s.specialSector,
      extendedService: s.extendedService || null,
      disabilityFundSmall: s.disabilityFundSmall,
      workerAid: m(s.workerAid),
      nonTaxable: m(s.nonTaxable),
    };
  },
  RSBIH(s) {
    return {
      jobCategory: s.jobCategory,
      dependents: n(s.dependents),
      housingInterest: m(s.housingInterest),
      lifeInsurance: m(s.lifeInsurance),
      voluntaryPension: m(s.voluntaryPension),
      solidarityExempt: s.solidarityExempt,
      workShare: n(s.workShare, 100),
      multipleEmployers: s.multipleEmployers,
      taxCard: s.taxCard,
      disabilityFund: s.disabilityFund || null,
      previousGross: s.previousGross ? m(s.previousGross) : null,
      nonTaxable: m(s.nonTaxable),
    };
  },
  BD(s) {
    const disabilityPercents = String(s.disabilityPercents || '')
      .split(/[,;\s]+/)
      .map(Number)
      .filter((x) => x > 0 && x <= 100);
    return {
      pensionFund: s.pensionFund,
      taxCard: s.taxCard,
      entityResident: s.entityResident,
      spouse: s.spouse,
      children: n(s.childrenBD),
      disabilityPercents,
      permanentlyDisabledMembers: n(s.permanentlyDisabledMembers),
      businessEmployer: s.businessEmployer,
      disabilityFund: s.disabilityFundBD,
      nonTaxable: m(s.nonTaxable),
    };
  },
};

// Breakdown rows: [label key, getter, kind]. kind: base | minus | plus | info | sub | total
const g = (k) => (r) => r.items[k];
const EMPLOYEE_ROWS = {
  HR: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_lowWageRelief', g('lowWageRelief'), 'info'],
    ['l_pension1', g('pension1'), 'minus'],
    ['l_pension2', g('pension2'), 'minus'],
    ['l_income', g('income'), 'sub'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_taxLower', g('taxLower'), 'info'],
    ['l_taxHigher', g('taxHigher'), 'info'],
    ['l_hrviRelief', g('hrviRelief'), 'info'],
    ['l_areaRelief', g('areaRelief'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
  SRB: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_contributionBase', g('contributionBase'), 'info'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_untaxed', g('untaxed'), 'info'],
    ['l_taxBase', g('taxable'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
  FBIH: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_contributionBase', g('contributionBase'), 'info'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_income', g('income'), 'sub'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
  RSBIH: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_exemptPart', g('exemptPart'), 'info'],
    ['l_contributionBase', g('contributionBase'), 'info'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_childProtection', g('childProtection'), 'minus'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
    ['l_solidarity', g('solidarity'), 'minus'],
  ],
  BD: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_income', g('income'), 'sub'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
};
const EMPLOYER_ROWS = {
  HR: [
    ['l_healthEmployer', g('health'), 'plus'],
    ['l_extendedService', g('extendedService'), 'plus'],
  ],
  SRB: [
    ['l_pensionEmployer', g('employerPension'), 'plus'],
    ['l_healthEmployer', g('employerHealth'), 'plus'],
    ['l_extendedService', g('extendedService'), 'plus'],
  ],
  FBIH: [
    ['l_pensionEmployer', g('employerPension'), 'plus'],
    ['l_healthEmployer', g('employerHealth'), 'plus'],
    ['l_unemploymentEmployer', g('employerUnemployment'), 'plus'],
    ['l_extendedService', g('extendedService'), 'plus'],
    ['l_disasterProtectionFee', g('disasterProtectionFee'), 'plus'],
    ['l_waterFee', g('waterFee'), 'plus'],
    ['l_disabilityFund', g('disabilityFund'), 'plus'],
  ],
  RSBIH: [['l_disabilityFund', g('disabilityFund'), 'plus']],
  BD: [
    ['l_pensionEmployer', g('employerPension'), 'plus'],
    ['l_waterFee', g('waterFee'), 'plus'],
    ['l_disabilityFund', g('disabilityFund'), 'plus'],
  ],
};

// ---------------- state ----------------

function currentMonth() {
  const d = new Date();
  const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return p < PERIOD_MIN ? PERIOD_MIN : p > PERIOD_MAX ? PERIOD_MAX : p;
}

function defaultsFor(country) {
  const s = {};
  for (const f of FIELDS[country]) s[f.id] = f.def;
  return s;
}

const params = new URLSearchParams(location.search);
let lang = window.tabuLang.initial();
const state = {
  country: COUNTRIES.includes(params.get('c')) ? params.get('c') : 'HR',
  dir: DIRECTIONS.includes(params.get('d')) ? params.get('d') : 'g2n',
  period: /^\d{4}-\d{2}$/.test(params.get('m') || '') ? params.get('m') : currentMonth(),
  amount: {},
  fields: {},
};
for (const c of COUNTRIES) {
  state.amount[c] = DEFAULT_AMOUNT[c];
  state.fields[c] = defaultsFor(c);
}
if (params.has('a') && !Number.isNaN(Number(params.get('a')))) state.amount[state.country] = Number(params.get('a'));
// Links created before the pillar field was inverted carry pillar2=0.
if (params.get('pillar2') === '0') state.fields.HR.pillar1Only = true;
for (const f of FIELDS[state.country]) {
  if (!params.has(f.id)) continue;
  const raw = params.get(f.id);
  state.fields[state.country][f.id] = f.type === 'check' ? raw === '1' : raw;
}

function syncUrl() {
  const u = new URL(location.href);
  const keep = u.searchParams.get('lang');
  u.search = '';
  if (keep) u.searchParams.set('lang', keep);
  u.searchParams.set('c', state.country);
  u.searchParams.set('d', state.dir);
  u.searchParams.set('a', String(state.amount[state.country]));
  u.searchParams.set('m', state.period);
  const s = state.fields[state.country];
  for (const f of FIELDS[state.country]) {
    if (s[f.id] === f.def) continue;
    u.searchParams.set(f.id, f.type === 'check' ? (s[f.id] ? '1' : '0') : String(s[f.id]));
  }
  history.replaceState(null, '', u);
}

// ---------------- rendering ----------------

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[lang][key] ?? key;
const locale = () => (lang === 'hr' ? 'hr-HR' : 'en-GB');

function fmt(minor) {
  const num = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  return `${num} ${CURRENCY_LABEL[state.country]}`;
}

function fmtPct(part, whole) {
  const pct = whole ? (part / whole) * 100 : 0;
  return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pct)} %`;
}

function fmtRate(bp) {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(bp / 100);
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined) e.append(c);
  return e;
}

function seg(items, active, onPick, labelFor, opts = {}) {
  return el(
    'div',
    { class: `seg${opts.class ? ` ${opts.class}` : ''}`, role: 'group', 'aria-label': opts.label },
    ...items.map((x) =>
      el('button', { type: 'button', 'aria-pressed': String(x === active), onclick: () => onPick(x) }, labelFor(x)),
    ),
  );
}

function optionLabel(f, v) {
  if (f.id === 'extendedService' && state.country === 'FBIH' && v === '12/16') return t('extendedService_FBIH_12_16');
  if (f.id === 'hrviPercent') return v === '0' ? t('hrviPercent_0') : `${v} %`;
  return t(`${f.id}_${v}`);
}

function fieldControl(f, s) {
  const onChange = (value) => {
    s[f.id] = value;
    if (RERENDER_ON.has(f.id)) renderInputs();
    update();
  };
  if (f.type === 'check') {
    return el('input', {
      type: 'checkbox',
      role: 'switch',
      class: 'switch',
      id: `f-${f.id}`,
      checked: s[f.id],
      onchange: (e) => onChange(e.target.checked),
    });
  }
  if (f.type === 'select') {
    const opts = typeof f.options === 'function' ? f.options() : f.options.map((v) => [v, optionLabel(f, v)]);
    const sel = el(
      'select',
      { id: `f-${f.id}`, onchange: (e) => onChange(e.target.value) },
      ...opts.map(([v, label]) => el('option', { value: v, selected: String(s[f.id]) === String(v) }, label)),
    );
    return el('span', { class: 'sel' }, sel);
  }
  const attrs = {
    id: `f-${f.id}`,
    type: f.type === 'text' ? 'text' : 'number',
    value: s[f.id],
    inputmode: f.type === 'money' ? 'decimal' : 'numeric',
    oninput: (e) => onChange(e.target.value),
  };
  if (f.type === 'money') Object.assign(attrs, { min: 0, step: '0.01', placeholder: '0' });
  if (f.type === 'int') Object.assign(attrs, { min: f.min, max: f.max, step: 1 });
  const unit = f.type === 'money' ? CURRENCY_LABEL[state.country] : f.affix;
  return el(
    'span',
    { class: `num${f.type === 'money' ? ' num--money' : ''}` },
    el('input', attrs),
    unit ? el('span', { class: 'unit' }, unit) : null,
  );
}

function fieldRow(f, s) {
  // a jurisdiction-specific hint wins over the generic one
  const sub = I18N[lang][`${f.id}_sub_${state.country}`] ?? I18N[lang][`${f.id}_sub`];
  let hint = null;
  if (f.hint === 'rates') {
    const u = HR_UNITS.get(Number(s.residence));
    if (u) hint = t('rates_hint').replace('{lower}', fmtRate(u[2])).replace('{higher}', fmtRate(u[3]));
  }
  const label = el('label', { for: `f-${f.id}` }, el('span', {}, t(f.id)), sub || hint ? el('span', { class: 'sub' }, sub || hint) : null);
  return el('div', { class: `field${f.wide ? ' field--wide' : ''}` }, label, fieldControl(f, s));
}

function periodOptions() {
  const out = [];
  let [y, m] = PERIOD_MIN.split('-').map(Number);
  for (;;) {
    const value = `${y}-${String(m).padStart(2, '0')}`;
    if (value > PERIOD_MAX) break;
    out.push([value, `${t('monthNames')[m - 1]} ${y}${lang === 'hr' ? '.' : ''}`]);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

let advancedOpen = false;
let sourcesOpen = false;

// Accordion: a header button toggling a body; state lives in the caller's variable.
function accordion(open, onToggle, headContent, body, headClass, iconClass) {
  body.hidden = !open;
  const head = el(
    'button',
    {
      type: 'button',
      class: headClass,
      'aria-expanded': String(open),
      onclick: () => {
        const next = onToggle();
        head.setAttribute('aria-expanded', String(next));
        body.hidden = !next;
      },
    },
    headContent,
    el('span', { class: iconClass, 'aria-hidden': 'true' }),
  );
  return [head, body];
}

function renderCountryTabs() {
  const root = $('country-tabs');
  root.textContent = '';
  root.append(
    seg(COUNTRIES, state.country, (c) => { state.country = c; renderInputs(); update(); }, (c) => t(`country_${c}`), { label: t('country_label') }),
  );
}

function renderInputs() {
  renderCountryTabs();
  const root = $('inputs');
  root.textContent = '';
  const s = state.fields[state.country];
  const country = state.country;

  const amountInput = el('input', {
    id: 'f-amount',
    type: 'number',
    min: 0,
    step: '0.01',
    inputmode: 'decimal',
    value: state.amount[country],
    oninput: (e) => {
      state.amount[country] = e.target.value === '' ? '' : Number(e.target.value);
      update();
    },
  });
  // A select instead of <input type="month">: the native picker follows the browser's language, not the page's.
  const periodInput = el(
    'select',
    {
      id: 'f-period',
      onchange: (e) => {
        state.period = e.target.value;
        update();
      },
    },
    ...periodOptions().map(([value, label]) => el('option', { value, selected: value === state.period }, label)),
  );

  root.append(
    el(
      'div',
      { class: 'card card--calc' },
      el(
        'div',
        { class: 'card-head' },
        el('h2', {}, t('g_calc')),
        seg(DIRECTIONS, state.dir, (d) => { state.dir = d; renderInputs(); update(); }, (d) => t(`dir_${d}`), { class: 'seg--dir', label: t('g_calc') }),
      ),
      el(
        'div',
        { class: 'calc-grid' },
        el(
          'label',
          { for: 'f-amount' },
          el('span', {}, t(`amount_${state.dir}`)),
          el('span', { class: 'num num--big' }, amountInput, el('span', { class: 'unit' }, CURRENCY_LABEL[country])),
          country === 'SRB' ? el('span', { class: 'hint' }, t('amount_hint_SRB')) : null,
        ),
        el(
          'label',
          { for: 'f-period' },
          el('span', {}, t('period')),
          el('span', { class: 'sel sel--big' }, periodInput),
          el('span', { class: 'hint' }, t('period_hint')),
        ),
      ),
      el('div', { class: 'calc-extra' }, ...FIELDS[country].filter((f) => f.group === 'calc').map((f) => fieldRow(f, s))),
    ),
  );

  const visible = FIELDS[country].filter((f) => !f.showIf || f.showIf(s));
  const basic = visible.filter((f) => f.group === 'basic');
  root.append(el('div', { class: 'card card--basic' }, el('h2', {}, t('g_basic')), el('div', { class: 'fields' }, ...basic.map((f) => fieldRow(f, s)))));

  const groups = ['person', 'job', 'employer'].filter((g) => visible.some((f) => f.group === g));
  const body = el('div', { class: 'acc-body' });
  for (const group of groups) {
    const fs = visible.filter((f) => f.group === group);
    body.append(
      el('div', { class: 'adv-group' }, el('span', { class: 'group-label' }, t(`g_${group}`)), el('div', { class: 'fields' }, ...fs.map((f) => fieldRow(f, s)))),
    );
  }
  const infoKey = country === 'HR' ? 'info_HR' : country === 'SRB' ? 'info_SRB' : 'info_BIH';
  body.append(...I18N[lang][infoKey].map((x) => el('p', { class: 'hint' }, x)));
  const [head] = accordion(
    advancedOpen,
    () => (advancedOpen = !advancedOpen),
    el('span', { class: 'acc-title' }, el('span', {}, t('advanced')), el('span', {}, groups.map((g) => t(`g_${g}`)).join(' · '))),
    body,
    'acc-head',
    'acc-icon',
  );
  root.append(el('div', { class: 'card card--acc' }, head, body));
}

function breakdownRows(rows, r) {
  return rows
    .map(([key, get, kind]) => [key, get(r), kind])
    .filter(([, v, kind]) => kind === 'base' || kind === 'total' || kind === 'sub' || v)
    .map(([key, v, kind]) =>
      el('div', { class: `row ${kind}` }, el('span', {}, t(key)), el('span', { class: 'v' }, (kind === 'minus' ? '− ' : kind === 'plus' ? '+ ' : '') + fmt(v))),
    );
}

// Where the total employer cost goes: net, employee contributions, tax, employer contributions, non-taxable payments.
function splitSegments(r) {
  const country = state.country;
  const skip = new Set(['l_tax', 'l_solidarity']);
  const worker = EMPLOYEE_ROWS[country].filter(([k, , kind]) => kind === 'minus' && !skip.has(k)).reduce((a, [, get]) => a + (get(r) || 0), 0);
  const employer = EMPLOYER_ROWS[country].reduce((a, [, get]) => a + (get(r) || 0), 0);
  const other = r.employerCost - r.gross - employer;
  const employerKey = country === 'HR' && !r.items.extendedService ? 'l_health' : 's_employer';
  return [
    ['r_net', r.net, 'var(--primary)'],
    [country === 'HR' ? 's_pensionHR' : 's_employee', worker, 'var(--salmon)'],
    ['l_tax', r.items.tax || 0, 'var(--lime)'],
    [employerKey, employer, 'var(--border-strong)'],
    ['l_nonTaxable', other, 'var(--border)'],
  ].filter(([, v]) => v > 0);
}

function renderSplit(r) {
  const segs = splitSegments(r);
  const total = r.employerCost;
  return el(
    'div',
    { class: 'split' },
    el('span', { class: 'split__title' }, t('split_title').replace('{total}', fmt(total))),
    el('div', { class: 'split__bar', 'aria-hidden': 'true' }, ...segs.map(([, v, c]) => el('span', { style: `flex:${v};background:${c}` }))),
    el(
      'div',
      { class: 'split__legend' },
      ...segs.map(([k, v, c]) => el('span', { class: 'split__item' }, el('i', { style: `background:${c}` }), t(k), el('span', { class: 'v' }, fmtPct(v, total)))),
    ),
  );
}

function sourcesBlock() {
  const country = state.country;
  const body = el(
    'div',
    { class: 'sources-body' },
    ...I18N[lang].sources[country].map((x) => el('span', {}, x)),
    el('span', { class: 'group-label' }, t('r_not_modelled')),
    ...I18N[lang][`not_modelled_${country}`].map((x) => el('span', {}, x)),
    el('span', { class: 'hint' }, t('r_verified')),
  );
  const [head] = accordion(sourcesOpen, () => (sourcesOpen = !sourcesOpen), el('span', {}, t('r_sources')), body, 'acc-head', 'acc-mini');
  return el('div', { class: 'sources' }, head, body);
}

function renderTile(primaryKey, primaryValue, secondary, cost) {
  const tile = $('tile');
  tile.textContent = '';
  tile.append(el('div', { class: 'tile__main' }, el('span', { class: 'tile__label' }, t(primaryKey)), el('span', { class: 'tile__value' }, primaryValue)));
  if (secondary.length) {
    tile.append(
      el('div', { class: 'tile__grid' }, ...secondary.map(([key, v]) => el('div', { class: 'mini' }, el('span', { class: 'mini__label' }, t(key)), el('span', { class: 'mini__value' }, v)))),
    );
  }
  $('mb-label').textContent = t(primaryKey);
  $('mb-value').textContent = primaryValue;
  $('mb-sub').textContent = '';
  if (cost !== null) $('mb-sub').append(`${t('r_cost')} `, el('span', {}, cost));
}

function renderResult(r, solved) {
  const primaryKey = state.dir === 'g2n' ? 'r_net' : 'r_gross';
  const primaryValue = state.dir === 'g2n' ? r.net : r.gross;
  const secondary = [];
  if (state.dir !== 'g2n') secondary.push(['r_net', r.net]);
  if (state.dir === 'g2n') secondary.push(['r_gross', r.gross]);
  if (r.payout !== r.net) secondary.push(['r_payout', r.payout]);
  secondary.push(['r_cost', r.employerCost]);
  if (r.effectiveEmployerCost !== r.employerCost) {
    const refund = r.items.employerReliefTiming === 'refund';
    secondary.push([refund ? 'r_effective_refund' : 'r_effective', r.effectiveEmployerCost]);
  }
  renderTile(primaryKey, fmt(primaryValue), secondary.map(([k, v]) => [k, fmt(v)]), fmt(r.employerCost));

  const out = $('results');
  out.textContent = '';
  out.append(renderSplit(r));

  const country = state.country;
  const bd = el('div', { class: 'breakdown' });
  bd.append(el('span', { class: 'group-label' }, t('r_employee')), ...breakdownRows(EMPLOYEE_ROWS[country], r));
  if (r.payout !== r.net) bd.append(el('div', { class: 'row total' }, el('span', {}, t('l_payout')), el('span', { class: 'v' }, fmt(r.payout))));
  const employerRows = [
    ['l_gross', (x) => x.gross, 'base'],
    ...EMPLOYER_ROWS[country],
    ['l_nonTaxable', (x) => x.employerCost - x.gross - EMPLOYER_ROWS[country].reduce((a, [, get]) => a + (get(x) || 0), 0), 'plus'],
    ['l_cost', (x) => x.employerCost, 'total'],
    ['l_employerRelief', (x) => x.employerCost - x.effectiveEmployerCost, 'minus'],
  ];
  bd.append(el('span', { class: 'group-label' }, t('r_employer')), ...breakdownRows(employerRows, r));

  if (r.annual) {
    const a = r.annual;
    bd.append(el('span', { class: 'group-label' }, t('r_annual')));
    if (!a.available) {
      bd.append(el('p', { class: 'hint' }, t(`a_unavailable_${a.reason}`)));
    } else if (a.kind === 'youth' || a.kind === 'returnee') {
      const label = a.kind === 'youth' ? t('a_youth').replace('{pct}', a.youthPercent) : t('a_returnee');
      bd.append(el('div', { class: 'row total' }, el('span', {}, label), el('span', { class: 'v' }, fmt(a.refund))), el('p', { class: 'hint' }, t('a_assumption')));
    } else if (a.kind === 'annualTax') {
      bd.append(
        el('div', { class: 'row total' }, el('span', {}, t('a_annualTax')), el('span', { class: 'v' }, fmt(a.tax))),
        el('p', { class: 'hint' }, `${t('a_annualTax_note').replace('{year}', a.incomeYear)} ${t('a_assumption')}`),
      );
    } else if (a.kind === 'wageIncrease') {
      bd.append(el('div', { class: 'row total' }, el('span', {}, t('a_wageIncrease')), el('span', { class: 'v' }, fmt(a.refund))));
    }
  }
  out.append(bd);

  const notes = [...r.notes];
  if (r.provisional) notes.unshift('provisional');
  if (solved && !solved.exact) notes.push('notExact');
  if (r.items.employerReliefTiming === 'refund') notes.push('refundLater');
  if (notes.length) out.append(el('ul', { class: 'notes' }, ...notes.map((k) => el('li', {}, t(`n_${k}`)))));

  out.append(sourcesBlock());
}

function renderError() {
  renderTile(state.dir === 'g2n' ? 'r_net' : 'r_gross', '—', [], null);
  const out = $('results');
  out.textContent = '';
  out.append(el('p', { class: 'error' }, t('r_error')));
}

function update() {
  syncUrl();
  const country = state.country;
  const input = { ...TO_INPUT[country](state.fields[country]), period: state.period };
  const amount = fromDecimal(state.amount[country] || 0);
  try {
    let r;
    let solved = null;
    if (state.dir === 'g2n') {
      r = calculate(country, { ...input, gross: amount });
    } else {
      solved = state.dir === 'n2g' ? netToGross(country, input, amount) : costToGross(country, input, amount);
      if (!solved) throw new RangeError('unsolvable');
      r = calculate(country, { ...input, gross: solved.gross });
    }
    renderResult(r, solved);
  } catch (err) {
    renderError();
    console.error(err);
  }
}

function applyLang() {
  const tr = I18N[lang];
  document.documentElement.lang = lang;
  document.title = tr.doc_title;
  document.querySelectorAll('[data-i18n]').forEach((e) => {
    const v = tr[e.dataset.i18n];
    if (typeof v === 'string') e.textContent = v;
  });
  $('lang-hr').setAttribute('aria-pressed', String(lang === 'hr'));
  $('lang-en').setAttribute('aria-pressed', String(lang === 'en'));
  if (window.tabuTheme) window.tabuTheme.apply();
  renderInputs();
  update();
}

document.querySelectorAll('.lang-toggle button').forEach((b) => {
  b.addEventListener('click', () => {
    lang = b.dataset.lang;
    window.tabuLang.save(lang);
    applyLang();
  });
});

$('reset').addEventListener('click', () => {
  state.fields[state.country] = defaultsFor(state.country);
  state.amount[state.country] = DEFAULT_AMOUNT[state.country];
  state.dir = 'g2n';
  renderInputs();
  update();
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('copy').textContent = t('copied');
    setTimeout(() => { $('copy').textContent = t('copy_link'); }, 1800);
  } catch {
    /* clipboard unavailable: the URL bar already holds the link */
  }
});

applyLang();
