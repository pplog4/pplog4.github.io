/* PPログ用：JAL Fラウンジ 鮨鶴亭 週替わりネタのカレンダー表示部品。
 * 使い方：<div id="pplog-sushi-cal"></div><script src="https://pplog4.github.io/sushi-calendar/embed.js" defer></script>
 * データは Muse（メイン）が GitHub pplog4/sushi-calendar-data に直接書く。Mac・Bot は中継しない。
 * 最新（sushi-calendar.json）と、Actions が検査に通した版（last-good.json）を読み、
 * 最新がこのページの検査にも通ればそれを、通らなければ last-good を表示して「更新を確認中」と出す。
 * 月ごとのカレンダーで、提供期間の日付のマスに空港とネタを載せる。日付を押すと、その週の詳細（ラウンジ・出典）を下に出す。
 * データは文字として入れ、HTMLとして解釈しない。 */
(function () {
  "use strict";
  var RAW = "https://raw.githubusercontent.com/pplog4/sushi-calendar-data/main/";
  var HOME = "https://pplog4.github.io/sushi-calendar/";
  var WEEK = "日月火水木金土";
  var DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var P = "pplog-sushi-";

  function realDate(s) {
    var m = DATE.exec(s || "");
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? { d: d, m: m } : null;
  }
  function str(s) { return typeof s === "string" && s.trim() !== "" && s.length <= 200; }
  function url(u) { return u === "" || (typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u)); }

  // validate.py と同じ検査。prev を渡すと、件数が6件以上減っていないかも見る
  function valid(d, prev) {
    if (!d || typeof d !== "object" || d.schema !== 1 || !realDate(d.updated)) return false;
    if (!Array.isArray(d.items) || !d.items.length) return false;
    for (var i = 0; i < d.items.length; i++) {
      var it = d.items[i];
      if (!it || !realDate(it.date) || !str(it.airport) || !str(it.lounge) || !str(it.detail) ||
          !url(it.source_url === undefined ? "" : it.source_url)) return false;
    }
    if (prev && Array.isArray(prev.items) && d.items.length < prev.items.length - 5) return false;
    return true;
  }

  // ---- 期間とネタの読み取り（detail の書き方：「A・B・C（〜MM-DD・補足）」）
  function ymd(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function parseItem(it, nextStart) {
    var start = realDate(it.date).d, end = null;
    var m = /〜\s*(?:(\d{4})-)?(\d{1,2})-(\d{1,2})/.exec(it.detail);
    if (m) {
      var y = m[1] ? Number(m[1]) : start.getFullYear();
      end = new Date(y, Number(m[2]) - 1, Number(m[3]));
      if (!m[1] && end < start) end = new Date(y + 1, Number(m[2]) - 1, Number(m[3]));
      if (end < start || (end - start) / 864e5 > 40) end = null;
    }
    if (!end) end = nextStart && (nextStart - start) / 864e5 <= 7 ? addDays(nextStart, -1) : addDays(start, 6);
    var paren = it.detail.indexOf("（");
    var neta = (paren > 0 ? it.detail.slice(0, paren) : it.detail).split("・").filter(function (x) { return x; });
    var note = paren > 0 ? it.detail.slice(paren + 1).replace(/）\s*$/, "") : "";
    return { it: it, start: start, end: end, neta: neta, note: note };
  }
  function airportKey(a) {
    if (/羽田/.test(a) && /成田/.test(a)) return "both";
    if (/羽田/.test(a)) return "hnd";
    if (/成田/.test(a)) return "nrt";
    return "unk";
  }
  var AP_SHORT = { both: "羽・成", hnd: "羽田", nrt: "成田", unk: "?" };
  function srcLabel(u) {
    var h = (u.split("/")[2] || "").toLowerCase();
    if (/(^|\.)jal\.co\.jp$/.test(h)) return "JAL公式";
    if (h === "x.com" || h === "twitter.com") return "X投稿";
    return "出典";
  }

  // ---- 見た目。クラス名はすべて pplog-sushi- で始め、ブログのCSSとぶつからないようにする（下の「P-」を置き換える）
  var CSS = [
    ".P-root{margin:1em 0;font-size:15px;line-height:1.5;color:#222;max-width:100%;box-sizing:border-box}",
    ".P-root *{box-sizing:border-box}",
    ".P-root .P-note{margin:0 0 .4em;font-size:12.5px;color:#555}",
    ".P-root .P-warn{margin:0 0 .6em;padding:6px 10px;background:#fff8e1;border-left:4px solid #ffc107;font-size:13px}",
    ".P-root .P-nav{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:.8em 0 .4em}",
    ".P-root .P-nav button{border:1px solid #ccc;background:#fff;border-radius:6px;padding:6px 12px;font-size:14px;cursor:pointer;color:#222;margin:0;line-height:1.4}",
    ".P-root .P-nav button:disabled{opacity:.35;cursor:default}",
    ".P-root .P-nav select{font-size:15px;font-weight:bold;padding:4px 6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#222;max-width:60%;margin:0}",
    ".P-root .P-legend{display:flex;flex-wrap:wrap;gap:8px;margin:.3em 0 .5em;font-size:12px}",
    ".P-root .P-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid #ddd;border-left:1px solid #ddd}",
    ".P-root .P-wd{font-size:12px;text-align:center;padding:4px 0;background:#f4f4f4;border-right:1px solid #ddd;border-bottom:1px solid #ddd}",
    ".P-root .P-wd.P-sun,.P-root .P-day.P-sun .P-num{color:#c62828}.P-root .P-wd.P-sat,.P-root .P-day.P-sat .P-num{color:#1565c0}",
    ".P-root .P-day{display:block;width:100%;min-width:0;min-height:96px;margin:0;padding:3px 4px;border:0;border-right:1px solid #ddd;border-bottom:1px solid #ddd;border-radius:0;background:#fff;overflow:hidden;text-align:left;vertical-align:top;font:inherit;color:inherit;-webkit-appearance:none;appearance:none;box-shadow:none}",
    ".P-root .P-day.P-out{background:#fafafa}.P-root .P-day.P-out .P-num{color:#bbb}",
    ".P-root .P-day.P-has{cursor:pointer}.P-root .P-day.P-has:hover{background:#fff6f6}",
    ".P-root .P-day.P-sel{background:#fff0f0;box-shadow:inset 0 0 0 2px #c00}",
    ".P-root .P-num{font-size:12px;font-weight:bold;display:inline-block;line-height:1.5}",
    ".P-root .P-day.P-today .P-num{background:#c00;color:#fff !important;border-radius:10px;padding:0 6px}",
    ".P-root .P-ap{display:inline-block;font-size:10.5px;line-height:1.45;padding:0 4px;border-radius:3px;color:#fff;margin-left:3px;vertical-align:1px;white-space:nowrap}",
    ".P-root .P-legend .P-ap{margin-left:0}",
    ".P-root .P-ap-hnd{background:#1565c0}.P-root .P-ap-nrt{background:#2e7d32}.P-root .P-ap-both{background:#6a1b9a}.P-root .P-ap-unk{background:#888}",
    ".P-root .P-band{display:block;height:4px;border-radius:2px;margin:2px 0 3px}",
    ".P-root .P-neta{font-size:11.5px;line-height:1.35;margin:1px 0;overflow-wrap:anywhere}",
    ".P-root .P-neta.P-unk{color:#999}",
    ".P-root .P-detail{margin-top:.8em;padding:10px 12px;border:1px solid #ddd;border-radius:8px;background:#fcfcfc}",
    ".P-root .P-detail .P-h{margin:0 0 .3em;font-size:14px;font-weight:bold}",
    ".P-root .P-detail .P-p{margin:.2em 0;font-size:14px}",
    // スマホ幅：空港の名札を隠して色の帯だけにし、ネタを小さく。詳細は押して下に出す
    "@media (max-width:600px){.P-root .P-day{min-height:70px;padding:2px 2px}.P-root .P-day .P-ap{display:none}.P-root .P-neta{font-size:9.5px;line-height:1.25}.P-root .P-nav button{padding:6px 8px;font-size:13px}}",
    "@media (max-width:400px){.P-root .P-neta{font-size:9px}.P-root .P-num{font-size:11px}}"
  ].join("\n").replace(/P-/g, P);

  function injectCss() {
    if (document.getElementById(P + "css")) return;
    var s = document.createElement("style");
    s.id = P + "css";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls.split(" ").filter(Boolean).map(function (c) { return P + c; }).join(" ");
    if (text != null) n.textContent = String(text);
    return n;
  }

  function build(root, d, pending) {
    root.textContent = "";
    var src = d.items.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var weeks = src.map(function (it, i) { return parseItem(it, src[i + 1] ? realDate(src[i + 1].date).d : null); });
    var byDay = {};
    weeks.forEach(function (w) {   // 重なる日は、後ろ（新しい開始日）の週を優先
      for (var t = w.start; t <= w.end; t = addDays(t, 1)) byDay[ymd(t)] = w;
    });
    var months = [];
    weeks.forEach(function (w) {
      for (var t = new Date(w.start.getFullYear(), w.start.getMonth(), 1); t <= w.end; t = new Date(t.getFullYear(), t.getMonth() + 1, 1)) {
        var k = t.getFullYear() * 100 + t.getMonth() + 1;
        if (months.indexOf(k) < 0) months.push(k);
      }
    });
    months.sort(function (a, b) { return a - b; });
    var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var tk = today.getFullYear() * 100 + today.getMonth() + 1;
    var cur = months.indexOf(tk) >= 0 ? tk : months[months.length - 1];

    var box = el("div", "root");
    if (pending) box.appendChild(el("p", "warn", "更新を確認中です。前回の内容を表示しています。"));
    box.appendChild(el("p", "note", "JALファーストクラスラウンジの寿司カウンター「鮨 鶴亭」の週替わりネタです。日付を押すと、その週の詳細と出典が下に出ます。内容は変わることがあります。ご利用前にJAL公式サイトでご確認ください。"));
    box.appendChild(el("p", "note", "最終更新：" + d.updated + "　掲載：" + src[0].date + "〜" + src[src.length - 1].date + "（" + src.length + "件）"));
    if (str(d.hours)) box.appendChild(el("p", "note", "提供時間：" + d.hours));

    var nav = el("div", "nav");
    var prev = el("button", null, "‹ 前の月"), next = el("button", null, "次の月 ›"), sel = el("select");
    prev.type = next.type = "button";
    sel.setAttribute("aria-label", "表示する月");
    months.forEach(function (k) {
      var o = document.createElement("option");
      o.value = String(k); o.textContent = Math.floor(k / 100) + "年" + (k % 100) + "月";
      sel.appendChild(o);
    });
    nav.appendChild(prev); nav.appendChild(sel); nav.appendChild(next);
    box.appendChild(nav);
    var legend = el("div", "legend");
    [["hnd", "羽田"], ["nrt", "成田"], ["both", "羽田・成田"], ["unk", "空港未確認"]].forEach(function (a) {
      legend.appendChild(el("span", "ap ap-" + a[0], a[1]));
    });
    box.appendChild(legend);
    var gridWrap = el("div", "gridwrap");
    box.appendChild(gridWrap);
    var detail = el("div", "detail");
    box.appendChild(detail);
    if (typeof d.sources === "string" && d.sources) box.appendChild(el("p", "note", "出典：" + d.sources.slice(0, 400)));
    root.appendChild(box);

    function fmt(t) { return (t.getMonth() + 1) + "/" + t.getDate() + "（" + WEEK[t.getDay()] + "）"; }
    function showDetail(w) {
      detail.textContent = "";
      if (!w) { detail.appendChild(el("p", "note", "この月の記録はありません。")); return; }
      detail.appendChild(el("div", "h", fmt(w.start) + "〜" + fmt(w.end) + "　" + w.it.airport));
      detail.appendChild(el("p", "p", w.neta.join("・")));
      if (w.note) detail.appendChild(el("p", "note", w.note));
      detail.appendChild(el("p", "note", w.it.lounge));
      if (w.it.source_url) {
        var p = el("p", "note", "出典：");
        var a = document.createElement("a");
        a.textContent = srcLabel(w.it.source_url); a.href = w.it.source_url; a.target = "_blank"; a.rel = "noopener nofollow";
        p.appendChild(a); detail.appendChild(p);
      }
    }

    function draw() {
      sel.value = String(cur);
      var i = months.indexOf(cur);
      prev.disabled = i <= 0; next.disabled = i >= months.length - 1;
      var y = Math.floor(cur / 100), mo = cur % 100 - 1;
      var first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0), grid = el("div", "grid");
      WEEK.split("").forEach(function (w, j) { grid.appendChild(el("div", "wd" + (j === 0 ? " sun" : j === 6 ? " sat" : ""), w)); });
      var start = addDays(first, -first.getDay());
      var cells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;
      var firstInMonth = null, todayWeek = null, nodes = [];
      for (var c = 0; c < cells; c++) {
        var t = addDays(start, c), w = byDay[ymd(t)], inMonth = t.getMonth() === mo;
        var cls = "day" + (inMonth ? "" : " out") + (t.getDay() === 0 ? " sun" : t.getDay() === 6 ? " sat" : "") +
          (w ? " has" : "") + (ymd(t) === ymd(today) ? " today" : "");
        var cell = el(w ? "button" : "div", cls);
        cell.appendChild(el("span", "num", t.getDate()));
        if (w) {
          cell.type = "button";
          if (inMonth && !firstInMonth) firstInMonth = w;
          if (ymd(t) === ymd(today)) todayWeek = w;
          var k = airportKey(w.it.airport);
          cell.appendChild(el("span", "ap ap-" + k, AP_SHORT[k]));
          cell.appendChild(el("span", "band ap-" + k));
          w.neta.forEach(function (n) { cell.appendChild(el("div", "neta" + (/未確認/.test(n) ? " unk" : ""), n)); });
          cell.setAttribute("aria-label", (t.getMonth() + 1) + "月" + t.getDate() + "日 " + w.it.airport + " " + w.neta.join("・"));
          nodes.push({ node: cell, w: w });
        }
        grid.appendChild(cell);
      }
      function pick(wk) {
        nodes.forEach(function (x) { x.node.classList.toggle(P + "sel", x.w === wk); });
        showDetail(wk);
      }
      nodes.forEach(function (x) { x.node.addEventListener("click", function () { pick(x.w); }); });
      gridWrap.textContent = "";
      gridWrap.appendChild(grid);
      pick(todayWeek || firstInMonth);
    }
    prev.addEventListener("click", function () { var i = months.indexOf(cur); if (i > 0) { cur = months[i - 1]; draw(); } });
    next.addEventListener("click", function () { var i = months.indexOf(cur); if (i < months.length - 1) { cur = months[i + 1]; draw(); } });
    sel.addEventListener("change", function () { cur = Number(sel.value); draw(); });
    draw();
  }

  function fail(root) {
    root.textContent = "";
    var p = el("p", "note", "寿司カレンダーは更新を確認中です。");
    var a = document.createElement("a");
    a.textContent = "こちらで表示"; a.href = HOME; a.target = "_blank"; a.rel = "noopener";
    p.appendChild(a);
    root.appendChild(p);
  }

  function get(name) {
    // raw.githubusercontent.com のキャッシュは最大5分。5分単位の値を付けて、それより古い版を掴まないようにする
    return fetch(RAW + name + "?t=" + Math.floor(Date.now() / 300000), { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } })
      .catch(function () { return null; });
  }

  function start() {
    var roots = document.querySelectorAll("#pplog-sushi-cal, [data-pplog-sushi-cal]");
    if (!roots.length) return;
    injectCss();
    Promise.all([get("sushi-calendar.json"), get("last-good.json")]).then(function (res) {
      var latest = res[0], good = valid(res[1]) ? res[1] : null;
      var show = null, pending = false;
      if (valid(latest, good)) show = latest;
      else if (good) { show = good; pending = true; }
      Array.prototype.forEach.call(roots, function (root) { if (show) build(root, show, pending); else fail(root); });
    });
  }
  window.PPLOG_SUSHI_VALID = valid; // 試験用
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
