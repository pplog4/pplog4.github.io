/* PPログ用：JAL Fラウンジ 鮨鶴亭 週替わりネタの表示部品。
 * 使い方：<div id="pplog-sushi-cal"></div><script src="https://pplog4.github.io/sushi-calendar/embed.js" defer></script>
 * データは Muse（メイン）が GitHub pplog4/sushi-calendar-data に直接書く。Mac・Bot は中継しない。
 * 最新（sushi-calendar.json）と、Actions が検査に通した版（last-good.json）を読み、
 * 最新がこのページの検査にも通ればそれを、通らなければ last-good を表示して「更新を確認中」と出す。
 * データは文字として入れ、HTMLとして解釈しない。 */
(function () {
  "use strict";
  var RAW = "https://raw.githubusercontent.com/pplog4/sushi-calendar-data/main/";
  var HOME = "https://pplog4.github.io/sushi-calendar/";
  var WEEK = "日月火水木金土";
  var DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute("style", style);
    if (text != null) n.textContent = String(text);
    return n;
  }
  function srcLabel(u) {
    var h = (u.split("/")[2] || "").toLowerCase();
    if (/(^|\.)jal\.co\.jp$/.test(h)) return "JAL公式";
    if (h === "x.com" || h === "twitter.com") return "X投稿";
    return "出典";
  }
  var SMALL = "margin:0 0 .5em;font-size:13px;color:#555;";
  var TH = "text-align:left;padding:6px 8px;border-bottom:2px solid #c00;white-space:nowrap;";
  var TD = "padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top;";
  var TDN = TD + "white-space:nowrap;";

  function render(root, d, pending) {
    root.textContent = "";
    var items = d.items.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var box = el("div", "margin:1em 0;font-size:15px;line-height:1.6;");
    if (pending) box.appendChild(el("p", "margin:0 0 .5em;padding:6px 10px;background:#fff8e1;border-left:4px solid #ffc107;font-size:13px;", "更新を確認中です。前回の内容を表示しています。"));
    box.appendChild(el("p", SMALL, "JALファーストクラスラウンジの寿司カウンター「鮨 鶴亭」の週替わりネタの記録です（新しい順、日付は提供開始日）。内容は変わることがあります。ご利用前にJAL公式サイトでご確認ください。"));
    box.appendChild(el("p", SMALL, "最終更新：" + d.updated + "　掲載：" + items[items.length - 1].date + "〜" + items[0].date + "（" + items.length + "件）"));
    if (str(d.hours)) box.appendChild(el("p", SMALL, "提供時間：" + d.hours));
    if (typeof d.sources === "string" && d.sources) box.appendChild(el("p", SMALL, "出典：" + d.sources.slice(0, 400)));
    var month = null, tbody = null;
    items.forEach(function (it) {
      var r = realDate(it.date), m = r.m;
      var key = m[1] + "年" + Number(m[2]) + "月";
      if (key !== month) {
        month = key;
        box.appendChild(el("h4", "margin:1.2em 0 .4em;", key));
        var wrap = el("div", "overflow-x:auto;");
        var table = el("table", "width:100%;border-collapse:collapse;");
        var tr = el("tr");
        ["開始日", "空港", "ネタ（期間）", "出典"].forEach(function (h) { tr.appendChild(el("th", TH, h)); });
        var thead = el("thead"); thead.appendChild(tr); table.appendChild(thead);
        tbody = el("tbody"); table.appendChild(tbody); wrap.appendChild(table); box.appendChild(wrap);
      }
      var row = el("tr");
      row.appendChild(el("td", TDN, Number(m[2]) + "/" + Number(m[3]) + "（" + WEEK[r.d.getDay()] + "）"));
      row.appendChild(el("td", TDN, it.airport));
      row.appendChild(el("td", TD, it.detail));
      var td = el("td", TDN);
      if (it.source_url) {
        var a = el("a", null, srcLabel(it.source_url));
        a.href = it.source_url; a.target = "_blank"; a.rel = "noopener nofollow";
        td.appendChild(a);
      }
      row.appendChild(td);
      tbody.appendChild(row);
    });
    root.appendChild(box);
  }

  function fail(root) {
    root.textContent = "";
    var p = el("p", SMALL, "寿司カレンダーは更新を確認中です。");
    var a = el("a", null, "こちらで表示");
    a.href = HOME; a.target = "_blank"; a.rel = "noopener";
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
    Promise.all([get("sushi-calendar.json"), get("last-good.json")]).then(function (res) {
      var latest = res[0], good = valid(res[1]) ? res[1] : null;
      var show = null, pending = false;
      if (valid(latest, good)) show = latest;
      else if (good) { show = good; pending = true; }
      Array.prototype.forEach.call(roots, function (root) { if (show) render(root, show, pending); else fail(root); });
    });
  }
  window.PPLOG_SUSHI_VALID = valid; // 試験用
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
