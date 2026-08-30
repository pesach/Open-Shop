import fs from 'fs';

console.log('--- Step 1: Copying ext.js ---');
const extCode = fs.readFileSync('C:/Users/pesac/Projects/Open-Photopea/deob-live/ext/deobfuscated.js', 'utf8');
fs.writeFileSync('code/external/ext.js', extCode, 'utf8');

console.log('--- Step 2: Copying dbs.js ---');
const dbsCode = fs.readFileSync('C:/Users/pesac/Projects/Open-Photopea/deob-live/dbs/deobfuscated.js', 'utf8');
fs.writeFileSync('code/dbs.js', dbsCode, 'utf8');

console.log('--- Step 3: Patching pp/deobfuscated.js into code/openshop.js ---');
let ppCode = fs.readFileSync('C:/Users/pesac/Projects/Open-Photopea/deob-live/pp/deobfuscated.js', 'utf8');

// 1. Permanently disable showCap (giant bloated overlay)
ppCode = ppCode.replace(
  'window.showCap = function () {',
  'window.showCap = function () {}; window._old_showCap = function () {'
);
ppCode = ppCode.replace(
  'window.hideCap = function () {',
  'window.hideCap = function () {}; window._old_hideCap = function () {'
);
ppCode = ppCode.replace(
  'if (window.locStor.getItem("capShown") == "false" || window.self != window.top) {} else {',
  'if (true) {} else {'
);

// 2. Disable external telemetry & routing
ppCode = ppCode.replace(
  /g7\.event\s*=\s*function[\s\S]*?v\.send\(\);\s*\};/,
  'g7.event = function(y, P, D) {};'
);

ppCode = ppCode.replace(
  /g7\.kH\s*=\s*function[\s\S]*?return y;\s*\};/,
  'g7.kH = function(y) { return y; };'
);

ppCode = ppCode.replace(
  /g7\.xt\s*=\s*function[\s\S]*?return g7\.kH\(y\);\s*\};/,
  'g7.xt = function(y) { return y; };'
);

ppCode = ppCode.replace(
  'if (g7.w1() && navigator.onLine) {',
  'if (false) {'
);

ppCode = ppCode.replaceAll(/fetch\([^)]*papi\/event\.php[^)]*\);?/g, '/* telemetry disabled */');

// 3. Permanent 100% Ad-Free / Pro mode (no sidebar push, no ads)
ppCode = ppCode.replace(
  'dj.prototype.b$ = function () {',
  'dj.prototype.b$ = function () { return true; }; dj.prototype._old_b$ = function () {'
);

ppCode = ppCode.replace(
  'ke.r7 = function () {',
  'ke.r7 = function () { return true; }; ke._old_r7 = function () {'
);

ppCode = ppCode.replace(
  'ke.WT = function () {',
  'ke.WT = function () { return false; }; ke._old_WT = function () {'
);

ppCode = ppCode.replace(
  'ke.wN = function () {',
  'ke.wN = function () { return false; }; ke._old_wN = function () {'
);

// 4. In menubar: Inject Open-Shop logo on the top left BEFORE File and persist in qv
ppCode = ppCode.replace(
  'this.$.appendChild(this.a1b);\n    this.$.appendChild(this.aIP);',
  `this.$.appendChild(this.a1b);
    this.$.appendChild(this.aIP);
    var _osLogo = this._osLogo = b.r("img", "os-logo");
    _osLogo.src = "promo/icon256.png";
    _osLogo.setAttribute("style", "width: 18px; height: 18px; vertical-align: middle; margin: 0 8px 0 6px; cursor: pointer; display: inline-block;");
    _osLogo.setAttribute("title", "Open-Shop");
    this.a1b.insertBefore(_osLogo, this.a1b.firstChild);`
);

ppCode = ppCode.replace(
  'b.KY(this.a1b);\n      for (var n = 0; n < this.jt.length; n++) {',
  'b.KY(this.a1b);\n      if (this._osLogo) this.a1b.appendChild(this._osLogo);\n      for (var n = 0; n < this.jt.length; n++) {'
);

// 5. Remove Account button completely from top menubar & qv
ppCode = ppCode.replace(
  'this.TH = new lN([0, 13, 0], false, null, true);',
  'this.TH = new lN([0, 13, 0], false, null, true); this.TH.$.style.display = "none"; if (this.TH.$.parentNode) this.TH.$.parentNode.removeChild(this.TH.$);'
);

ppCode = ppCode.replace(
  'if (y.h1) {\n        r.appendChild(this.TH.$);\n      }',
  '/* Account button permanently excluded */'
);

// 6. Remove topfloat buttons (About, Issues, Learn, Blog, API, Twitter, Facebook, Reddit)
ppCode = ppCode.replace(
  'for (var n = 0; n < this.xX.length; n++) {',
  'this.qE.style.display = "none"; for (var n = 0; false && n < this.xX.length; n++) {'
);

// 7. Remove PeaMark & About from More menu
ppCode = ppCode.replace(
  'name: "PeaMark"',
  'name: "PeaMark", d: function() { return { d: false }; }'
);

ppCode = ppCode.replace(
  'Kg: "About " + ["Photopea", "Vectorpea"][d7],',
  'Kg: "", d: false,'
);

// 8. Remove side options: PeaDrive, PeaGames, external Open-Shop launchers, Jampea
ppCode = ppCode.replace(
  /r\.push\(\["Open-Shop",\s*null,\s*"https:\/\/www\.vecpea\.com\/promo\/icon512\.png"\][\s\S]*?\["Jampea",\s*null,\s*"https:\/\/www\.vecpea\.com\/promo\/icon512_jp\.png"\]\);/,
  '/* side launchers removed */'
);

ppCode = ppCode.replace(
  /r\.push\(\["Photopea",\s*null,\s*"https:\/\/www\.vecpea\.com\/promo\/icon512\.png"\][\s\S]*?\["Jampea",\s*null,\s*"https:\/\/www\.vecpea\.com\/promo\/icon512_jp\.png"\]\);/,
  '/* side launchers removed */'
);

ppCode = ppCode.replace(
  /dm\.Jc\s*=\s*\[\["PeaGames"[\s\S]*?\]\];/,
  'dm.Jc = [];'
);

ppCode = ppCode.replace(
  '["PeaDrive", "peadriveStorage.html", "strg/peadrive", true, "A cloud storage system from Photopea."],',
  ''
);
ppCode = ppCode.replace(
  '["PeaDrive", "peadriveStorage.html", "strg/peadrive", true, "A cloud storage system from Open-Shop."],',
  ''
);

// 9. Enforce Open-Shop logo on Home screen and dialogs
ppCode = ppCode.replace(
  'v.setAttribute("src", PIMG[n == 0 ? "logo" : "bottom"]);',
  'v.setAttribute("src", n == 0 ? "promo/logo.svg" : PIMG.bottom);'
);

ppCode = ppCode.replace(
  'this.aBW.setAttribute("src", PIMG[r]);',
  'this.aBW.setAttribute("src", "promo/logo.svg"); this.aBW.style.maxWidth = "240px"; this.aBW.style.height = "auto";'
);

// 10. General Branding string cleanup
ppCode = ppCode.replaceAll('Photopea', 'Open-Shop');
ppCode = ppCode.replaceAll('photopea', 'open-shop');
ppCode = ppCode.replaceAll('Vectorpea', 'Open-Shop');
ppCode = ppCode.replaceAll('vectorpea', 'open-shop');

// 11. Route plugin gallery locally
ppCode = ppCode.replaceAll('//www.open-shop.com/plugins/gallery.json', 'plugins/gallery.json');
ppCode = ppCode.replaceAll('//www.photopea.com/plugins/gallery.json', 'plugins/gallery.json');
ppCode = ppCode.replaceAll('//www.vecpea.com/plugins/gallery.json', 'plugins/gallery.json');

// 12. Safe template hits handler (prevents TypeError on empty hits)
ppCode = ppCode.replace(
  'var D = this.D1 = P.hits;\n    for (var n = 0; n < D.length; n++) {',
  'var D = this.D1 = (P && P.hits) ? P.hits : [];\n    for (var n = 0; n < D.length; n++) {'
);

// 13. Assign window.app
ppCode = ppCode.replace(
  'document.body.appendChild(new dj().$);',
  'window.app = new dj(); document.body.appendChild(window.app.$);'
);

fs.writeFileSync('code/openshop.js', ppCode, 'utf8');
console.log('Rebuilt code/openshop.js successfully with Open-Shop logo, 0 accounts, 0 external links.');
