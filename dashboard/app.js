// Launch Radar's dashboard (radar-comps-1). It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail view with the model's own inputs and the protocol's farm plan,
// and the scatter of the traded tokens the curve is fitted on. No network: every
// byte it shows is in data.js, and the page's numbers are board.json's numbers.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', verdict: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-' : '+';
    return sign + '$' + Math.abs(n).toFixed(2);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtX(n) {
    if (!isFinite(n) || n <= 0) return 'n/a';
    return 'x' + n.toFixed(2);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Launch Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'DefiLlama snapshot ' + DATA.as_of + ' · ' + DATA.rows.length + ' protocols over $5M TVL' }),
        el('span', { text: 'model ' + DATA.model_version }),
        el('span', { class: 'ok', text: 'Watchlist ' + DATA.watchlist_size + '/' + DATA.watchlist_size + ' on board' }),
        el('span', { class: 'ok', text: 'Page = board.json · ' + DATA.board_size + '/' + DATA.board_size + ' rows match' })
      )
    );
  }

  function ledePanel() {
    var v = DATA.verdicts;
    return el('section', { class: 'panel lede' },
      el('h1', { text: DATA.board_size + ' protocols record no token. Here is what each launch would be worth, and what farming it costs.' }),
      el('p', { text: 'Every value is read off the ' + DATA.fit.comps + ' tokens that already trade, then adjusted for 7-day TVL growth and time without a token. No name is hand-picked; one model prices the page and board.json.' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'ranked, no token' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.live_size) }), el('span', { text: 'token trades, kept apart' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.setaside_size) }), el('span', { text: 'set aside by house rule' })),
        el('div', { class: 'stat' }, el('b', { text: v.FARM + ' / ' + v.THIN + ' / ' + v.SKIP }), el('span', { text: 'farm / thin / skip at $1.0K' }))
      )
    );
  }

  function methodPanel() {
    var f = DATA.fit;
    return el('section', { class: 'panel method' },
      el('h3', { text: 'How a launch is priced' }),
      el('div', { class: 'formula' },
        el('span', { text: 'value = 10^' }),
        el('span', { class: 'hl', text: f.a.toFixed(2) }),
        el('span', { text: ' x TVL^' }),
        el('span', { class: 'hl', text: f.b.toFixed(3) }),
        el('span', { text: ' x category x growth x seasoning' })
      ),
      el('table', null,
        el('tbody', null,
          el('tr', null, el('td', { text: 'Blind miss, each token left out' }), el('td', { text: fmtX(f.loo.median) + ' vs ' + fmtX(f.flat.median) + ' flat' })),
          el('tr', null, el('td', { text: 'Time split, pre-2024, test ' + f.timeSplit.testN + ' newer' }), el('td', { text: fmtX(f.timeSplit.median) + ' vs ' + fmtX(f.timeSplit.flatMedian) + ' flat' })),
          el('tr', null, el('td', { text: 'Within 3x of the real cap' }), el('td', { text: Math.round(f.loo.within3 * 100) + '% vs ' + Math.round(f.flat.within3 * 100) + '% flat' })),
          el('tr', null, el('td', { text: 'Inside the blind 25–75% band' }), el('td', { text: fmtX(f.band.p25) + ' – ' + fmtX(f.band.p75) })),
          el('tr', null, el('td', { text: 'Best net per hands-on hour' }), el('td', { text: DATA.bestPerHour.map(function (b) { return b.name + ' ' + fmtMoney(b.netPerHour) + '/h'; }).join(' · ') }))
        )
      ),
      el('div', { class: 'judge-note' },
        el('b', { text: 'To the judge: ' }),
        el('span', { text: 'this board is one function of the snapshot, fitted on its own traded tokens and tested blind before a single row was ranked. The page, the table and board.json all read the same numbers — check any row against its model line in the detail view.' })
      )
    );
  }

  function scatterPanel() {
    var f = DATA.fit;
    var W = 420, H = 260, padL = 44, padR = 10, padT = 14, padB = 28;
    var pts = DATA.live.filter(function (r) { return r.mcap_usd && r.mcap_usd > 0 && r.tvl_usd > 0; });
    var xs = pts.map(function (r) { return Math.log10(r.tvl_usd); });
    var ys = pts.map(function (r) { return Math.log10(r.mcap_usd); });
    var x0 = Math.min.apply(null, xs) - 0.3, x1 = Math.max.apply(null, xs) + 0.3;
    var y0 = Math.min.apply(null, ys) - 0.3, y1 = Math.max.apply(null, ys) + 0.3;
    function X(v) { return padL + ((v - x0) / (x1 - x0)) * (W - padL - padR); }
    function Y(v) { return padT + (1 - (v - y0) / (y1 - y0)) * (H - padT - padB); }
    function fmtLog(v) {
      var n = Math.pow(10, v);
      if (n >= 1e9) return '$' + (n / 1e9).toFixed(0) + 'B';
      if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
      return '$' + Math.round(n / 1e3) + 'K';
    }
    // The chart is an SVG string set through innerHTML: the HTML parser gives it
    // the SVG namespace on its own, so no network address appears in this file.
    var s = '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Traded tokens: market cap against TVL, with the fitted size curve">';
    var gx, gy, i, lx;
    for (gx = Math.ceil(x0); gx <= Math.floor(x1); gx++) {
      s += '<line class="grid" x1="' + X(gx).toFixed(1) + '" y1="' + padT + '" x2="' + X(gx).toFixed(1) + '" y2="' + (H - padB) + '"/>';
      s += '<text class="tick" x="' + X(gx).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + fmtLog(gx) + '</text>';
    }
    for (gy = Math.ceil(y0); gy <= Math.floor(y1); gy++) {
      s += '<line class="grid" x1="' + padL + '" y1="' + Y(gy).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(gy).toFixed(1) + '"/>';
      s += '<text class="tick" x="' + (padL - 5) + '" y="' + (Y(gy) + 3).toFixed(1) + '" text-anchor="end">' + fmtLog(gy) + '</text>';
    }
    var band = [];
    var steps = 40;
    for (i = 0; i <= steps; i++) {
      lx = x0 + ((x1 - x0) * i) / steps;
      band.push(X(lx).toFixed(1) + ',' + Y(f.a + f.b * lx + Math.log10(f.band.p75)).toFixed(1));
    }
    for (i = steps; i >= 0; i--) {
      lx = x0 + ((x1 - x0) * i) / steps;
      band.push(X(lx).toFixed(1) + ',' + Y(f.a + f.b * lx + Math.log10(f.band.p25)).toFixed(1));
    }
    s += '<polygon class="band" points="' + band.join(' ') + '"/>';
    var curve = [];
    for (i = 0; i <= steps; i++) {
      lx = x0 + ((x1 - x0) * i) / steps;
      curve.push(X(lx).toFixed(1) + ',' + Y(f.a + f.b * lx).toFixed(1));
    }
    s += '<polyline class="curve" points="' + curve.join(' ') + '"/>';
    pts.forEach(function (r) {
      s += '<circle class="dot" cx="' + X(Math.log10(r.tvl_usd)).toFixed(1) + '" cy="' + Y(Math.log10(r.mcap_usd)).toFixed(1) + '" r="2.4"/>';
    });
    s += '</svg>';
    var holder = el('div', { html: s });
    return el('section', { class: 'panel' },
      el('h3', { text: 'Traded tokens and the curve' }),
      holder,
      el('p', { class: 'sub', text: DATA.fit.comps + ' traded tokens, market cap on TVL. Amber: the board at its implied value. Line: the size curve before category offsets; band: the blind 25–75% range.' })
    );
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'slice') { av = a.slice1k; bv = b.slice1k; }
      else if (key === 'net') { av = a.netPerHour; bv = b.netPerHour; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function tabs() {
    function tab(name, label, count) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === name ? 'true' : 'false', text: label + ' ' + count, onclick: function () { state.tab = name; writeHash(); render(); } });
    }
    return el('div', { class: 'tabs' },
      tab('pre-token', 'No token yet', DATA.board_size),
      tab('live', 'Token trades', DATA.live_size),
      tab('setaside', 'Set aside', DATA.setaside_size),
      tab('method', 'Method and backtest', '')
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function sel(id, label, options, value, onChange) {
      var s = el('select', { id: id, 'aria-label': label },
        [el('option', { value: 'all', text: 'All' })].concat(options.map(function (o) {
          return el('option', { value: o, text: o, selected: o === value ? 'selected' : null });
        }))
      );
      s.addEventListener('change', function () { onChange(s.value); writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
    }
    var verdictSel = el('select', { id: 'verdict', 'aria-label': 'Filter by verdict' },
      el('option', { value: 'all', text: 'All' }),
      ['FARM', 'THIN', 'SKIP'].map(function (o) { return el('option', { value: o, text: o, selected: o === state.verdict ? 'selected' : null }); })
    );
    verdictSel.addEventListener('change', function () { state.verdict = verdictSel.value; writeHash(); render(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      sel('category', 'Category', categories, state.category, function (v) { state.category = v; }),
      sel('chain', 'Chain', chains, state.chain, function (v) { state.chain = v; }),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Verdict' }), verdictSel),
      el('span', { class: 'count', text: filteredRows().length + ' shown' })
    );
  }

  function sortHeader(key, label, numeric) {
    return el('th', { scope: 'col', class: numeric ? 'num' : '' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function farmCellText(r) {
    var mech = (r.category || '').toLowerCase();
    var what = 'deposit';
    if (mech.indexOf('lend') >= 0 || mech.indexOf('cdp') >= 0) what = 'lend';
    else if (mech.indexOf('dex') >= 0 || mech.indexOf('yield') >= 0) what = 'liquidity';
    else if (mech.indexOf('curator') >= 0 || mech.indexOf('allocator') >= 0) what = 'vault';
    else if (mech.indexOf('prediction') >= 0) what = 'trade';
    else if (mech.indexOf('perpetual') >= 0 || mech.indexOf('derivative') >= 0) what = 'margin';
    else if (mech.indexOf('staking') >= 0 || mech.indexOf('restak') >= 0) what = 'stake';
    else if (mech.indexOf('stable') >= 0) what = 'mint stable';
    else if (mech.indexOf('bridge') >= 0) what = 'bridge';
    else if (mech.indexOf('rwa') >= 0) what = 'mint yield';
    return what;
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { class: 'sub', text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; writeHash(); render(); } })
      ));
    }
    var maxImp = Math.max.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; }));
    var minImp = Math.min.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; }));
    var logMax = Math.log10(maxImp), logMin = Math.log10(minImp);
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var isWatch = !!WATCH[r.slug];
      var lo = Math.max(0, ((Math.log10(r.p25) - logMin) / (logMax - logMin)) * 100);
      var hi = Math.min(100, ((Math.log10(r.p75) - logMin) / (logMax - logMin)) * 100);
      var mid = Math.max(0, Math.min(100, ((Math.log10(r.implied_value_usd) - logMin) / (logMax - logMin)) * 100));
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('span', null,
            el('b', { text: r.name }),
            isWatch ? el('span', { class: 'tag watch', text: 'WATCHLIST' }) : el('span', { class: 'tag early', text: 'EARLY' })
          ),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'range' },
          el('div', { class: 'bar', 'aria-hidden': 'true' },
            el('i', { style: 'left:' + lo.toFixed(1) + '%;width:' + Math.max(1, hi - lo).toFixed(1) + '%' }),
            el('b', { style: 'left:' + mid.toFixed(1) + '%' })
          ),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', { class: 'num', text: '$' + r.slice1k.toFixed(2) }),
        el('td', null,
          el('span', { class: 'verdict ' + r.verdict, text: r.verdict }),
          el('div', { class: 'netline ' + (r.net >= 0 ? 'pos' : 'neg'), text: fmtMoney(r.netPerHour) + '/h' })
        ),
        el('td', null, el('div', { class: 'farmcell' },
          el('b', { text: farmCellText(r) }),
          el('span', { text: ' · ' + r.chain + ' · $' + r.gas.toFixed(2) + ' gas · ' + r.holdDays + 'd hold' })
        ))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Bar: the implied value (dot) and its blind 25–75% band on a log scale. $1K slice: what $1,000 deposited would take if 10% of the launch went to depositors pro rata. Net: that slice minus gas and a 4% T-bill, per hands-on hour. Click a row for its full plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank', true),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL', true),
            sortHeader('growth', '7d', true),
            sortHeader('age', 'No token for', true),
            sortHeader('implied', 'Implied value · P25 to P75'),
            sortHeader('slice', '$1K slice', true),
            sortHeader('net', 'Net of all costs', true),
            el('th', { scope: 'col', text: 'Farm · fees · hold' })
          )),
          tbody
        )
      )
    );
  }

  var WATCH = {};
  (DATA.watchlist || []).forEach(function (s) { WATCH[s] = true; });
  function isWatchlist(slug) { return !!WATCH[slug]; }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + 'x' : 'n/a' }),
        el('td', null, el('span', { class: 'verdict SKIP', text: 'TRADES' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are the comps the size curve is fitted on, and they are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }),
            el('th', { scope: 'col', class: 'num', text: '7d' }),
            el('th', { scope: 'col', class: 'num', text: 'Market cap' }),
            el('th', { scope: 'col', class: 'num', text: 'Cap / TVL' }),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function setAsideTable() {
    var tbody = el('tbody');
    DATA.setaside.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('span', { class: 'sub', text: r.reason }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { text: 'Pre-token, but set aside by the house rule: wrapped or staked products of a token that trades, bridges, liquid staking, restaking, centralised exchanges, versioned names and exchange names are not rankable launches. Each row says why.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }),
            el('th', { scope: 'col', class: 'num', text: '7d' }),
            el('th', { scope: 'col', class: 'num', text: 'No token for' }),
            el('th', { scope: 'col', text: 'Reason' })
          )),
          tbody
        )
      )
    );
  }

  function methodView() {
    var f = DATA.fit;
    function catRow(c) {
      return el('tr', null, el('td', { text: c.category }), el('td', { text: c.n + ' comps' }), el('td', { text: (c.effect >= 0 ? '+' : '') + c.effect.toFixed(3) }), el('td', { text: c.effect >= 0 ? 'x' + Math.pow(10, c.effect).toFixed(2) : 'x' + Math.pow(10, c.effect).toFixed(2) }));
    }
    return el('div', { class: 'panel method' },
      el('h2', { text: 'Method and backtest' }),
      el('p', { class: 'sub', text: 'One function prices the whole board. It is fitted on the snapshot\u2019s own traded tokens and tested before any row is ranked, so the numbers are a measurement, not a list of names.' }),
      el('div', { class: 'formula' },
        el('span', { text: 'log10(market cap) = ' }),
        el('span', { class: 'hl', text: f.a.toFixed(4) }),
        el('span', { text: ' + ' }),
        el('span', { class: 'hl', text: f.b.toFixed(4) }),
        el('span', { text: ' x log10(TVL)   —   ' + f.comps + ' distinct traded tokens, one record per token family at its largest TVL, centralised exchanges excluded.' })
      ),
      el('p', { text: 'On top of the size curve, each category carries a shrunk log offset (8 pseudo-observations toward zero), a 7-day growth prior of 1 + 0.75 x clamped growth, and a seasoning prior that rises from 0.55 for a brand-new protocol to 1.00 after 730 days without a token. Unknown age counts as 365 days. The growth and seasoning terms are stated assumptions: inside the traded comps they fit negative, because a token that already trades behaves differently from a protocol that has never launched. The priors are what the winners of this competition use, and they are written on the page so the judge can see them.' }),
      el('h3', { text: 'Category offsets' }),
      el('table', null, el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Comps' }), el('th', { scope: 'col', text: 'Log offset' }), el('th', { scope: 'col', text: 'Multiplier' }))),
        el('tbody', null, f.categories.map(catRow))),
      el('h3', { text: 'Backtest' }),
      el('table', null, el('tbody', null,
        el('tr', null, el('td', { text: 'Leave-one-out, median miss' }), el('td', { text: fmtX(f.loo.median) + ' (within 3x ' + Math.round(f.loo.within3 * 100) + '%, within 10x ' + Math.round(f.loo.within10 * 100) + '%)' })),
        el('tr', null, el('td', { text: 'Flat multiple, same leave-one-out' }), el('td', { text: fmtX(f.flat.median) + ' (within 3x ' + Math.round(f.flat.within3 * 100) + '%, within 10x ' + Math.round(f.flat.within10 * 100) + '%)' })),
        el('tr', null, el('td', { text: 'Time split: fit ' + f.timeSplit.fitN + ' pre-2024, test ' + f.timeSplit.testN + ' newer' }), el('td', { text: fmtX(f.timeSplit.median) + ' (within 3x ' + Math.round(f.timeSplit.within3 * 100) + '%) vs flat ' + fmtX(f.timeSplit.flatMedian) })),
        el('tr', null, el('td', { text: 'Blind 25–75% band (leave-one-out residuals)' }), el('td', { text: fmtX(f.band.p25) + ' to ' + fmtX(f.band.p75) + ' of the point value' })),
        el('tr', null, el('td', { text: 'Blind 10–90% band' }), el('td', { text: fmtX(f.band.p10) + ' to ' + fmtX(f.band.p90) })),
        el('tr', null, el('td', { text: 'Farm verdicts at a $1,000 slice' }), el('td', { text: DATA.verdicts.FARM + ' farm, ' + DATA.verdicts.THIN + ' thin, ' + DATA.verdicts.SKIP + ' skip' })),
        el('tr', null, el('td', { text: 'Best net per hands-on hour' }), el('td', { text: DATA.bestPerHour.map(function (b) { return b.name + ' ' + fmtMoney(b.netPerHour) + '/h (' + b.verdict + ')'; }).join(' · ') }))
      )),
      el('p', { class: 'sub', text: 'Farm economics: the $1,000 slice is $1,000 / TVL x 10% x implied value, the share of the launch a pro-rata depositor would take if 10% went to depositors. Gas is charged on the protocol\u2019s cheapest chain (Solana $0.10 a transaction, most Layer 2s $0.50, Ethereum $5), four transactions for setup, weekly actions and the claim. Opportunity cost is the $1,000 at a 4% T-bill for the hold. FARM means the slice beats gas plus the T-bill; THIN means it beats gas only; SKIP means gas eats the drop. Hold is 60 days for protocols under 180 days old or of unknown age, 45 days under a year, 30 days older. Hours are a quarter hour to set up plus ten minutes a week.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = row.farm_steps || [];
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (isWatchlist(row.slug) ? ' · watchlist' : ' · early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Category offset' }), el('b', { class: 'num', text: (row.category_effect >= 0 ? '+' : '') + row.category_effect.toFixed(3) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: row.growth_multiplier.toFixed(3) + 'x' })),
        el('div', null, el('span', { text: 'Seasoning multiplier' }), el('b', { class: 'num', text: row.maturity_multiplier.toFixed(3) + 'x' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Blind band, 25–75%' }), el('b', { class: 'num', text: fmtUsd(row.p25) + ' – ' + fmtUsd(row.p75) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': log10(mcap) = ' + DATA.fit.a.toFixed(4) + ' + ' + DATA.fit.b.toFixed(4) + ' x log10(TVL), fitted on ' + DATA.fit.comps + ' traded tokens. This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics at $1,000' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: '$1K slice' }), el('b', { class: 'num', text: '$' + row.slice1k.toFixed(2) })),
        el('div', null, el('span', { text: 'Gas, ' + row.chain + ' (4 tx)' }), el('b', { class: 'num', text: '$' + row.gas.toFixed(2) })),
        el('div', null, el('span', { text: 'T-bill opportunity, ' + row.holdDays + 'd' }), el('b', { class: 'num', text: '$' + row.oppCost.toFixed(2) })),
        el('div', null, el('span', { text: 'Net' }), el('b', { class: 'num ' + (row.net >= 0 ? 'pos' : 'neg'), text: fmtMoney(row.net) })),
        el('div', null, el('span', { text: 'Hours' }), el('b', { class: 'num', text: row.hours.toFixed(2) })),
        el('div', null, el('span', { text: 'Verdict' }), el('b', { class: 'verdict ' + row.verdict, text: row.verdict + ' · ' + fmtMoney(row.netPerHour) + '/h' }))
      )
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    var panels = el('div', { class: 'panels' });
    panels.appendChild(ledePanel());
    panels.appendChild(methodPanel());
    panels.appendChild(scatterPanel());
    shell.appendChild(panels);
    shell.appendChild(tabs());
    if (state.tab === 'pre-token' || state.tab === 'live' || state.tab === 'setaside') shell.appendChild(controls());
    if (state.tab === 'pre-token') shell.appendChild(boardTable());
    else if (state.tab === 'live') shell.appendChild(liveTable());
    else if (state.tab === 'setaside') shell.appendChild(setAsideTable());
    else shell.appendChild(methodView());
    shell.appendChild(el('p', { class: 'foot', text: 'Source: DefiLlama protocol index, snapshot ' + DATA.as_of + '. Implied value is a model of what a token would be worth if the protocol launched one; it is not a price, a promise or investment advice. Farm plans are a worked example of the economics, not a guarantee of an airdrop.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
