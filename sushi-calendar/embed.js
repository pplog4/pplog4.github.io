/* PPログ用：JAL Fラウンジ 鮨鶴亭 週替わりネタの表示部品。
 * 使い方：<div id="pplog-sushi-cal"></div><script src="https://pplog4.github.io/sushi-calendar/embed.js" defer></script>
 * data.json（同じフォルダ）を読み、新しい順に月ごとの表を描く。データはテキストとして入れ、HTMLとして解釈しない。 */
(function () {
  "use strict";
  var BASE = "https://pplog4.github.io/sushi-calendar/";
  var WEEK = "日月火水木金土";

  function el(tag, style, text) {
    var n = document.createElement(tag);
    if (style) n.setAttribute("style", style);
    if (text != null) n.textContent = String(text);
    return n;
  }
  function safeUrl(u) {
    return typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : "";
  }
  var SMALL = "margin:0 0 .5em;font-size:13px;color:#555;";
  var TH = "text-align:left;padding:6px 8px;border-bottom:2px solid #c00;white-space:nowrap;";
  var TD = "padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top;";
  var TDN = TD + "white-space:nowrap;";

  function render(root, d) {
    root.textContent = "";
    var box = el("div", "margin:1em 0;font-size:15px;line-height:1.6;");
    box.appendChild(el("p", SMALL, "JALファーストクラスラウンジの寿司カウンター「鮨 鶴亭」の週替わりネタの記録です（新しい順、日付は提供開始日）。内容は変わることがあります。ご利用前にJAL公式サイトでご確認ください。"));
    box.appendChild(el("p", SMALL, "最終更新：" + (d.updated || "不明") + "　掲載：" + (d.first || "") + "〜" + (d.last || "") + "（" + (d.count || 0) + "件）"));
    if (d.hours) box.appendChild(el("p", SMALL, "提供時間：" + d.hours));
    if (d.sources) box.appendChild(el("p", SMALL, "出典：" + d.sources));
    var items = Array.isArray(d.items) ? d.items : [];
    if (!items.length) box.appendChild(el("p", "padding:12px;background:#f6f6f6;border-radius:6px;", "準備中です。"));
    var month = null, tbody = null;
    items.forEach(function (it) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(it.date || "");
      if (!m) return;
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
      var dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      var row = el("tr");
      row.appendChild(el("td", TDN, Number(m[2]) + "/" + Number(m[3]) + "（" + WEEK[dt.getDay()] + "）"));
      row.appendChild(el("td", TDN, it.airport || ""));
      row.appendChild(el("td", TD, it.detail || ""));
      var td = el("td", TDN), u = safeUrl(it.source_url);
      if (u) {
        var a = el("a", null, it.source_type || "出典");
        a.href = u; a.target = "_blank"; a.rel = "noopener nofollow";
        td.appendChild(a);
      }
      row.appendChild(td);
      tbody.appendChild(row);
    });
    root.appendChild(box);
  }

  function fail(root) {
    root.textContent = "";
    var p = el("p", SMALL, "寿司カレンダーを読み込めませんでした。");
    var a = el("a", null, "こちらで表示");
    a.href = BASE; a.target = "_blank"; a.rel = "noopener";
    p.appendChild(a);
    root.appendChild(p);
  }

  function start() {
    var roots = document.querySelectorAll("#pplog-sushi-cal, [data-pplog-sushi-cal]");
    if (!roots.length) return;
    // 10分単位で変わる値を付け、GitHub Pagesのキャッシュ（最大10分）より古い版を掴まないようにする
    var url = BASE + "data.json?t=" + Math.floor(Date.now() / 600000);
    fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      Array.prototype.forEach.call(roots, function (root) { render(root, d); });
    }).catch(function () {
      Array.prototype.forEach.call(roots, fail);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
