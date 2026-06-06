/*!
 * Zozio embed widget — zobrazí zvířata útulku na cizím webu.
 * Izolováno v Shadow DOM (nezasahuje do stylů hostitele).
 * Použití:
 *   <script src="https://zozio.cz/embed.js" data-utulek="slug"
 *     data-druh="vse|dog|cat" data-pocet="6" data-layout="grid|list"
 *     data-motiv="light|dark"></script>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var slug = script.getAttribute("data-utulek");
  if (!slug) return;
  var druhMap = { vse: "all", all: "all", psi: "dog", dog: "dog", kocky: "cat", cat: "cat" };
  var druh = druhMap[script.getAttribute("data-druh") || "all"] || "all";
  var pocet = parseInt(script.getAttribute("data-pocet") || "6", 10) || 6;
  var layout = script.getAttribute("data-layout") === "list" ? "list" : "grid";
  var dark = script.getAttribute("data-motiv") === "dark";

  var origin = new URL(script.src).origin;
  var host = document.createElement("div");
  script.parentNode.insertBefore(host, script.nextSibling);
  var root = host.attachShadow({ mode: "open" });

  var bg = dark ? "#2C1810" : "#FDF8F2";
  var card = dark ? "#3a2419" : "#ffffff";
  var text = dark ? "#FDF8F2" : "#2C1810";
  var muted = dark ? "#C9A87C" : "#8B7355";
  var border = dark ? "#5a3d2a" : "#F0E8DC";

  root.innerHTML =
    "<style>" +
    ":host{all:initial}" +
    ".z{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:" + bg + ";color:" + text + ";border-radius:18px;padding:16px}" +
    ".z h4{margin:0 0 12px;font-size:15px;font-weight:800;color:" + text + "}" +
    ".g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}" +
    ".l{display:flex;flex-direction:column;gap:10px}" +
    ".c{display:block;background:" + card + ";border:1px solid " + border + ";border-radius:14px;overflow:hidden;text-decoration:none;color:inherit}" +
    ".l .c{display:flex;align-items:center;gap:12px}" +
    ".img{aspect-ratio:4/3;background:#F5E6D3 url() center/cover;display:flex;align-items:center;justify-content:center;font-size:30px}" +
    ".l .img{width:72px;height:60px;aspect-ratio:auto;flex:0 0 auto}" +
    ".b{padding:9px 11px}" +
    ".n{font-weight:700;font-size:14px}" +
    ".m{font-size:12px;color:" + muted + ";margin-top:2px}" +
    ".ft{margin-top:12px;text-align:center;font-size:11px;color:" + muted + "}" +
    ".ft a{color:#E8634A;text-decoration:none;font-weight:700}" +
    "</style><div class='z'><div class='wrap'>Načítám…</div></div>";

  var wrap = root.querySelector(".wrap");

  fetch(origin + "/api/widget/" + encodeURIComponent(slug) + "?druh=" + druh + "&pocet=" + pocet)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var animals = (data && data.animals) || [];
      if (!animals.length) {
        wrap.textContent = "Aktuálně tu nejsou žádná zvířata k adopci.";
        return;
      }
      var items = animals.map(function (a) {
        var photo = a.photo
          ? "background-image:url('" + a.photo.replace(/'/g, "") + "')"
          : "";
        var emoji = a.species && a.species.toLowerCase().indexOf("koč") >= 0 ? "🐈" : "🐕";
        return (
          "<a class='c' href='" + a.url + "' target='_blank' rel='noopener'>" +
          "<div class='img' style=\"" + photo + "\">" + (a.photo ? "" : emoji) + "</div>" +
          "<div class='b'><div class='n'>" + escapeHtml(a.name) + "</div>" +
          "<div class='m'>" + escapeHtml([a.species, a.age].filter(Boolean).join(" · ")) + "</div></div></a>"
        );
      });
      wrap.innerHTML =
        "<h4>🐾 " + escapeHtml(data.institution || "Naše zvířata") + " — k adopci</h4>" +
        "<div class='" + (layout === "list" ? "l" : "g") + "'>" + items.join("") + "</div>" +
        "<div class='ft'>Přes <a href='" + origin + "' target='_blank' rel='noopener'>zozio.cz</a></div>";
    })
    .catch(function () {
      wrap.textContent = "Zvířata se nepodařilo načíst.";
    });

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
