/* PPログ用：JAL Fラウンジ 鮨鶴亭 週替わりネタのカレンダー表示部品（メイン Muse の元の画面に合わせた形）。
 * 使い方：<div id="pplog-sushi-cal"></div><script src="https://pplog4.github.io/sushi-calendar/embed.js" defer></script>
 * データは Muse（メイン）が GitHub pplog4/sushi-calendar-data に直接書く。Mac・Bot は中継しない。
 * 最新（sushi-calendar.json）と、Actions が検査に通した版（last-good.json）を読み、
 * 最新がこのページの検査にも通ればそれを、通らなければ last-good を表示して「更新を確認中」と出す。
 * 表示：月ごとのカード（新しい月が上）。週の行ごとに、提供期間を色付きの帯で日付の下に描く。
 * 帯の色はネタ（確認できた品目の組み合わせ）ごと。同じ組み合わせは同じ色、違えば違う色（落ち着いた10色）。
 * 未確認の品がある週は、帯の文字「＋1品未確認」と点線の縁取りで示す。帯を押すと、その週の詳細（空港・ラウンジ・出典）をカードの下に出す。
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

  // ---- 期間とネタの読み取り（detail の書き方：「A・B・C（〜MM-DD・補足）」、分からない品は「3品目未確認」）
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
    var known = neta.filter(function (n) { return !/未確認/.test(n); });
    var missing = neta.length - known.length;
    var label = known.slice();
    if (missing) label.push("＋" + missing + "品未確認");
    return { it: it, start: start, end: end, neta: neta, note: note, label: label.join("・"), ok: missing === 0,
             combo: known.join("・") };
  }

  // ---- ネタの組み合わせ → 色。見本の緑・からし色の系統に近い、白文字が読める落ち着いた10色。
  // 並び順は、隣の番号どうしが似た色にならないようにしてある。
  var PALETTE = ["#2e8b57", "#c8952e", "#4f7cac", "#b5655b", "#7a6aa8", "#3f8f8f", "#8a9a3b", "#b4708f", "#a07a4f", "#5f6f7f"];
  function hash(s) {   // FNV-1a。組み合わせの文字だけで決まるので、ページを開くたびに変わらない
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  // 組み合わせごとに1色。前後に並ぶ週（データの順で隣）の組み合わせどうしは別の色にする。
  // 古い順に初めて出た組み合わせから、文字列で決まる色を起点に、隣の組み合わせが使っていない色を選ぶ。
  // 入力（データ）だけで決まるので、ページを開くたびに変わらない。
  function assignColors(weeks) {
    var keys = weeks.map(function (w) { return w.combo || "（品目未確認）"; });
    var order = [], nb = {};
    keys.forEach(function (k, i) {
      if (!nb[k]) { nb[k] = {}; order.push(k); }
      [keys[i - 1], keys[i + 1]].forEach(function (o) { if (o !== undefined && o !== k) nb[k][o] = true; });
    });
    var map = {};
    order.forEach(function (k) {
      var start = hash(k) % PALETTE.length, pick = start;
      for (var n = 0; n < PALETTE.length; n++) {
        var c = (start + n) % PALETTE.length, clash = false;
        for (var o in nb[k]) if (map[o] === c) { clash = true; break; }
        if (!clash) { pick = c; break; }
      }
      map[k] = pick;
    });
    weeks.forEach(function (w, i) { w.color = PALETTE[map[keys[i]]]; });
  }
  function srcLabel(u) {
    var h = (u.split("/")[2] || "").toLowerCase();
    if (/(^|\.)jal\.co\.jp$/.test(h)) return "JAL公式";
    if (h === "x.com" || h === "twitter.com") return "X投稿";
    return "出典";
  }

  // ---- 見た目。クラス名はすべて pplog-sushi- で始め、ブログのCSSとぶつからないようにする（下の「P-」を置き換える）
  var CSS = [
    ".P-root{margin:1em 0;padding:0;color:#222;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',Meiryo,sans-serif;line-height:1.4;max-width:720px;box-sizing:border-box}",
    ".P-root *{box-sizing:border-box}",
    ".P-root .P-note{margin:0 2px .35em;font-size:12px;color:#666;line-height:1.5}",
    ".P-root .P-note a{color:inherit;text-decoration:underline}",
    ".P-root .P-warn{margin:0 0 .6em;padding:6px 10px;background:#fff8e1;border-left:4px solid #ffc107;font-size:13px;border-radius:4px}",
    ".P-root .P-key{display:inline-block;width:18px;height:10px;border-radius:3px;vertical-align:-1px;margin:0 3px 0 8px}",
    ".P-root .P-card{background:#fff;border:1px solid #dcdcdc;border-radius:10px;padding:14px 12px 22px;margin:0 0 18px}",
    ".P-root .P-title{margin:2px 0 9px;padding:0;font-size:18px;font-weight:700;letter-spacing:.01em;color:#222;line-height:1.3;border:0;background:none}",
    ".P-root .P-wdrow,.P-root .P-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}",
    ".P-root .P-wdrow{border-bottom:1px solid #e6e6e6;padding-bottom:5px}",
    ".P-root .P-wd{text-align:center;font-size:12px;color:#555}",
    ".P-root .P-sun{color:#d32f2f}.P-root .P-sat{color:#1e5bbf}",
    ".P-root .P-week{grid-template-rows:25px 18px;grid-auto-rows:18px;padding-bottom:7px}",
    ".P-root .P-week+.P-week{border-top:1px solid #ececec}",
    ".P-root .P-num{grid-row:1;align-self:end;padding:0 0 3px 5px;font-size:14.5px;font-variant-numeric:tabular-nums}",
    ".P-root .P-num.P-out{color:#c4c4c4}",
    ".P-root .P-bar{display:block;min-width:0;height:18px;margin:0 3px 0 0;padding:0 5px;border:0;border-radius:5px;color:#fff;font:inherit;font-size:11.5px;line-height:18px;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;-webkit-appearance:none;appearance:none;box-shadow:none;letter-spacing:0}",
    // 次の行へ続く帯は、見本と同じく右端まで平らに伸ばす
    ".P-root .P-bar.P-cont{margin-right:0;border-top-right-radius:0;border-bottom-right-radius:0}",
    // 未確認の品がある週：白い点線の縁取り（色はネタごとのまま）
    ".P-root .P-bar.P-ng{outline:1.5px dashed rgba(255,255,255,.95);outline-offset:-3px}",
    ".P-root .P-key{background:#999}.P-root .P-key.P-ng{outline:1.5px dashed #fff;outline-offset:-3px}",
    ".P-root .P-bar.P-on{box-shadow:inset 0 0 0 2px rgba(0,0,0,.35)}",
    ".P-root .P-detail{margin:10px 2px 0;padding:9px 11px;border-radius:8px;background:#f6f6f6;font-size:13.5px;line-height:1.55}",
    ".P-root .P-detail[hidden]{display:none}",
    ".P-root .P-detail .P-h{font-weight:700;margin-bottom:2px}",
    ".P-root .P-detail p{margin:2px 0}",
    "@media (min-width:601px){.P-root .P-title{font-size:20px}.P-root .P-week{grid-template-rows:28px 20px}.P-root .P-num{font-size:15.5px;padding-left:7px}.P-root .P-bar{height:20px;line-height:20px;font-size:12.5px;padding:0 7px}}"
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
  function fmt(t) { return (t.getMonth() + 1) + "/" + t.getDate() + "（" + WEEK[t.getDay()] + "）"; }

  function showDetail(det, w) {
    det.textContent = "";
    det._w = w;
    det.hidden = false;
    det.appendChild(el("div", "h", fmt(w.start) + "〜" + fmt(w.end) + "　" + w.it.airport));
    det.appendChild(el("p", null, w.neta.join("・")));
    if (w.note) det.appendChild(el("p", null, w.note));
    det.appendChild(el("p", null, w.it.lounge));
    if (w.it.source_url) {
      var p = el("p", null, "出典：");
      var a = document.createElement("a");
      a.textContent = srcLabel(w.it.source_url); a.href = w.it.source_url; a.target = "_blank"; a.rel = "noopener nofollow";
      p.appendChild(a); det.appendChild(p);
    }
  }

  function build(root, d, pending) {
    root.textContent = "";
    var src = d.items.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var weeks = src.map(function (it, i) { return parseItem(it, src[i + 1] ? realDate(src[i + 1].date).d : null); });
    assignColors(weeks);
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
    months.sort(function (a, b) { return b - a; });   // 新しい月が上

    var box = el("div", "root");
    if (pending) box.appendChild(el("p", "warn", "更新を確認中です。前回の内容を表示しています。"));

    var bars = [];
    months.forEach(function (k) {
      var y = Math.floor(k / 100), mo = k % 100 - 1;
      var card = el("section", "card");
      card.appendChild(el("h3", "title", y + "年" + (mo + 1) + "月"));
      var wd = el("div", "wdrow");
      WEEK.split("").forEach(function (c, j) { wd.appendChild(el("div", "wd" + (j === 0 ? " sun" : j === 6 ? " sat" : ""), c)); });
      card.appendChild(wd);
      var first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0);
      var start = addDays(first, -first.getDay());
      var rows = Math.ceil((first.getDay() + last.getDate()) / 7);
      var detail = el("div", "detail");
      detail.hidden = true;
      for (var r = 0; r < rows; r++) {
        var row = el("div", "week");
        var days = [];
        for (var c = 0; c < 7; c++) {
          var t = addDays(start, r * 7 + c);
          days.push(t);
          var n = el("div", "num" + (t.getMonth() !== mo ? " out" : c === 0 ? " sun" : c === 6 ? " sat" : ""), t.getDate());
          n.style.gridColumn = String(c + 1);
          row.appendChild(n);
        }
        // 同じ週が続く日をまとめて1本の帯にする（行をまたぐ期間は行ごとに分かれる）
        var c0 = 0;
        while (c0 < 7) {
          var w = byDay[ymd(days[c0])];
          if (!w) { c0++; continue; }
          var c1 = c0;
          while (c1 + 1 < 7 && byDay[ymd(days[c1 + 1])] === w) c1++;
          var cont = c1 === 6 && w.end > days[6];
          var b = el("button", "bar " + (w.ok ? "ok" : "ng") + (cont ? " cont" : ""), w.label);
          b.type = "button";
          b.style.background = w.color;
          b.style.gridColumn = (c0 + 1) + " / " + (c1 + 2);
          b.style.gridRow = "2";
          b.title = w.label;
          b.setAttribute("aria-label", fmt(w.start) + "〜" + fmt(w.end) + " " + w.label);
          bars.push({ node: b, w: w, det: detail });
          row.appendChild(b);
          c0 = c1 + 1;
        }
        card.appendChild(row);
      }
      card.appendChild(detail);
      box.appendChild(card);
    });
    bars.forEach(function (x) {
      x.node.addEventListener("click", function () {
        var open = !x.det.hidden && x.det._w === x.w;
        bars.forEach(function (y) { y.node.classList.toggle(P + "on", !open && y.w === x.w && y.det === x.det); });
        if (open) { x.det.hidden = true; x.det._w = null; return; }
        showDetail(x.det, x.w);
      });
    });
    // 出典と最終更新日は、見本の画面の邪魔にならないよう下に小さく出す
    var top = el("p", "note", "最終更新 " + d.updated + "（" + src.length + "件）");
    top.appendChild(document.createTextNode("　帯の色はネタの組み合わせごと。"));
    top.appendChild(el("span", "key ng")); top.appendChild(document.createTextNode("点線の帯は未確認の品あり"));
    box.appendChild(top);
    box.appendChild(el("p", "note", "帯を押すと、空港・ラウンジ・出典が出ます。内容は変わることがあります。ご利用前にJAL公式サイトでご確認ください。"));
    if (str(d.hours)) box.appendChild(el("p", "note", "提供時間：" + d.hours));
    if (typeof d.sources === "string" && d.sources) box.appendChild(el("p", "note", "出典：" + d.sources.slice(0, 400)));
    root.appendChild(box);
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
