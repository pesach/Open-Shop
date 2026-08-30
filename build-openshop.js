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

// 4. In menubar: Inject Open-Shop logo on the top left before File
ppCode = ppCode.replace(
  'this.$.appendChild(this.a1b);\n    this.$.appendChild(this.aIP);',
  `this.$.appendChild(this.a1b);
    this.$.appendChild(this.aIP);
    var _osLogo = b.r("img", "os-logo");
    _osLogo.src = "promo/icon256.png";
    _osLogo.setAttribute("style", "width: 18px; height: 18px; vertical-align: middle; margin: 0 8px 0 6px; cursor: pointer; display: inline-block;");
    _osLogo.setAttribute("title", "Open-Shop");
    this.a1b.appendChild(_osLogo);`
);

// 5. Remove Account button from top menubar
ppCode = ppCode.replace(
  'this.TH = new lN([0, 13, 0], false, null, true);',
  'this.TH = new lN([0, 13, 0], false, null, true); this.TH.$.style.display = "none";'
);

// 6. Remove topfloat buttons (About, Issues, Learn, Blog, API, Twitter, Facebook, Reddit)
ppCode = ppCode.replace(
  'for (var n = 0; n < this.xX.length; n++) {',
  'for (var n = 0; false && n < this.xX.length; n++) {'
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

// 8. General Branding string cleanup
ppCode = ppCode.replaceAll('Photopea', 'Open-Shop');
ppCode = ppCode.replaceAll('photopea', 'open-shop');
ppCode = ppCode.replaceAll('Vectorpea', 'Open-Shop');
ppCode = ppCode.replaceAll('vectorpea', 'open-shop');

// 9. Assign window.app
ppCode = ppCode.replace(
  'document.body.appendChild(new dj().$);',
  'window.app = new dj(); document.body.appendChild(window.app.$);'
);

fs.writeFileSync('code/openshop.js', ppCode, 'utf8');
console.log('Rebuilt code/openshop.js successfully with Open-Shop logo, 0 accounts, 0 external links.');
