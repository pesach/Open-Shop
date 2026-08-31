import fs from 'fs';
import https from 'https';
import path from 'path';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RESPONSE_BYTES = 50 * 1024 * 1024;
const patchFailures = [];

function countMatches(source, pattern) {
  if (typeof pattern === 'string') {
    if (pattern.length === 0) throw new Error('Patch anchors must not be empty');
    return source.split(pattern).length - 1;
  }

  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return Array.from(source.matchAll(new RegExp(pattern.source, flags))).length;
}

function requiredReplace(source, pattern, replacement, label, expectedCount = 1) {
  const actualCount = countMatches(source, pattern);
  if (actualCount !== expectedCount) {
    patchFailures.push(`${label}: expected ${expectedCount} match(es), found ${actualCount}`);
    return source;
  }
  return source.replace(pattern, replacement);
}

function assertRequiredPatches() {
  if (patchFailures.length === 0) return;
  throw new Error(`Required build patches failed:\n- ${patchFailures.join('\n- ')}`);
}

function fetchUrl(url, redirectCount = 0) {
  const target = new URL(url);
  if (target.protocol !== 'https:') {
    return Promise.reject(new Error(`Refusing non-HTTPS download: ${target.href}`));
  }

  return new Promise((resolve, reject) => {
    const request = https.get(target, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error(`Too many redirects while downloading ${target.href}`));
          return;
        }

        let redirectUrl;
        try {
          redirectUrl = new URL(res.headers.location, target);
        } catch (error) {
          reject(new Error(`Invalid redirect from ${target.href}: ${error.message}`));
          return;
        }

        fetchUrl(redirectUrl, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download failed for ${target.href}: HTTP ${res.statusCode}`));
        return;
      }

      const data = [];
      let responseBytes = 0;
      res.on('data', (chunk) => {
        responseBytes += chunk.length;
        if (responseBytes > MAX_RESPONSE_BYTES) {
          res.destroy(new Error(`Download exceeded ${MAX_RESPONSE_BYTES} bytes: ${target.href}`));
          return;
        }
        data.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(data), headers: res.headers, url: target.href }));
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Download timed out after ${REQUEST_TIMEOUT_MS}ms: ${target.href}`));
    });
    request.on('error', reject);
  });
}

async function build() {
  console.log('--- Step 1: Ensuring local directory structure ---');
  ['fetched-pp', 'code/external', 'code/dbs', 'code/pp', 'style', 'promo', 'img'].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  console.log('--- Step 2: Ensuring base Photopea files in fetched-pp ---');
  const filesToFetch = [
    { url: 'https://www.vecpea.com/style/all10.css', dest: 'fetched-pp/all10.css' },
    { url: 'https://www.vecpea.com/code/ext/ext1787746256.js', dest: 'fetched-pp/ext1787746256.js' },
    { url: 'https://www.vecpea.com/code/dbs/DBS1781343324.js', dest: 'fetched-pp/DBS1781343324.js' },
    { url: 'https://www.vecpea.com/code/pp/pp1787917131.js', dest: 'fetched-pp/pp1787917131.js' }
  ];

  for (const item of filesToFetch) {
    if (!fs.existsSync(item.dest)) {
      console.log(`Downloading ${item.url} -> ${item.dest}...`);
      const res = await fetchUrl(item.url);
      fs.writeFileSync(item.dest, res.data);
    }
  }

  console.log('--- Step 3: Generating code/external/ext.js with OpenShop branding ---');
  let extCode = fs.readFileSync('fetched-pp/ext1787746256.js', 'utf8');
  extCode = extCode.replaceAll('Photopea', 'OpenShop');
  extCode = extCode.replaceAll('photopea', 'openshop');

  console.log('--- Step 4: Generating code/dbs.js with Blue Open-Shop Logos and OpenShop naming ---');
  let dbsCode = fs.readFileSync('fetched-pp/DBS1781343324.js', 'utf8');
  const blueLogoDataUrl = 'data:image/svg+xml;base64,' + Buffer.from('<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 110" width="480" height="110"><defs><linearGradient id="osg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="50%" stop-color="#2563eb"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><g transform="translate(10, 5)"><rect x="0" y="0" width="100" height="100" rx="26" fill="url(#osg)"/><circle cx="50" cy="50" r="28" fill="none" stroke="#ffffff" stroke-width="7"/><path d="M50 32 L68 50 L50 68 L32 50 Z" fill="#ffffff"/><circle cx="50" cy="50" r="6" fill="#2563eb"/></g><text x="130" y="74" font-family="sans-serif" font-size="64" font-weight="700" fill="#ffffff">Open-Shop</text></svg>').toString('base64');

  dbsCode = requiredReplace(dbsCode, /"logo_pp"\s*:\s*"[^"]+"/, `"logo_pp" : "${blueLogoDataUrl}"`, 'DBS Photopea logo');
  dbsCode = requiredReplace(dbsCode, /"logo_vp"\s*:\s*"[^"]+"/, `"logo_vp" : "${blueLogoDataUrl}"`, 'DBS Vectorpea logo');
  dbsCode = requiredReplace(dbsCode, /"logo_jp"\s*:\s*"[^"]+"/, `"logo_jp" : "${blueLogoDataUrl}"`, 'DBS Jampea logo');
  dbsCode = requiredReplace(dbsCode, /"logo_cucumber"\s*:\s*"[^"]+"/, `"logo_cucumber" : "${blueLogoDataUrl}"`, 'DBS Cucumber logo');

  dbsCode = dbsCode.replaceAll('Photopea', 'OpenShop');
  dbsCode = dbsCode.replaceAll('photopea', 'openshop');
  dbsCode = dbsCode.replaceAll('Vectorpea', 'OpenShop');
  dbsCode = dbsCode.replaceAll('vectorpea', 'openshop');
  dbsCode = dbsCode.replaceAll('Jampea', 'OpenShop');
  dbsCode = dbsCode.replaceAll('jampea', 'openshop');
  dbsCode = requiredReplace(dbsCode, /var PMRK\s*=\s*\[[\s\S]*?\];/, 'var PMRK = [];', 'DBS PeaMark data');

  console.log('--- Step 5: Patching and Generating code/openshop.js ---');
  let ppCode = fs.readFileSync('fetched-pp/pp1787917131.js', 'utf8');

  // 1. Permanently disable showCap
  ppCode = ppCode.replace('window.showCap=function(){', 'window.showCap=function(){};window._old_showCap=function(){');
  ppCode = ppCode.replace('window.hideCap=function(){', 'window.hideCap=function(){};window._old_hideCap=function(){');
  ppCode = ppCode.replace('if(window.locStor.getItem("capShown")=="false"||window.self!=window.top){}else window.showCap()', 'if(true){}else{}');

  // 2. Disable external telemetry
  ppCode = ppCode.replace(/g7\.event=function[\s\S]*?v\.send\(\);\s*\};/, 'g7.event=function(y,P,D){};');
  ppCode = ppCode.replace(/g7\.kH=function[\s\S]*?return y;\s*\};/, 'g7.kH=function(y){return y;};');
  ppCode = ppCode.replace(/g7\.xt=function\(y\)[\s\S]*?return g7\.kH\(y\);\s*\};/, 'g7.xt=function(y){return y;};');
  ppCode = ppCode.replace('if(g7.w1()&&navigator.onLine){', 'if(false){');
  ppCode = ppCode.replace(/fetch\([^)]*papi\/event\.php[^)]*\)/g, 'void 0');

  // 3. Permanent 100% Pro Mode
  ppCode = ppCode.replace('dj.prototype.b$=function(){', 'dj.prototype.b$=function(){return true;};dj.prototype._old_b$=function(){');
  ppCode = ppCode.replace('ke.r7=function(){', 'ke.r7=function(){return true;};ke._old_r7=function(){');
  ppCode = ppCode.replace('ke.WT=function(){', 'ke.WT=function(){return false;};ke._old_WT=function(){');
  ppCode = ppCode.replace('ke.wN=function(){', 'ke.wN=function(){return false;};ke._old_wN=function(){');

  // 4. In menubar: Inject Open-Shop logo on top-left BEFORE File
  ppCode = ppCode.replace(
    'this.$.appendChild(this.a1b);this.$.appendChild(this.aIP);',
    `this.$.appendChild(this.a1b);
    this.$.appendChild(this.aIP);
    var _osLogo = this._osLogo = b.r("img", "os-logo");
    _osLogo.src = "promo/icon.svg";
    _osLogo.setAttribute("style", "width: 18px; height: 18px; vertical-align: middle; margin: 0 8px 0 6px; cursor: pointer; display: inline-block;");
    _osLogo.setAttribute("title", "Open-Shop");
    this.a1b.insertBefore(_osLogo, this.a1b.firstChild);`
  );
  ppCode = ppCode.replace(
    'b.KY(this.a1b);for(var n=0;n<this.jt.length;n++){',
    'b.KY(this.a1b);if(this._osLogo)this.a1b.appendChild(this._osLogo);for(var n=0;n<this.jt.length;n++){'
  );

  // 5. Hide Account from the menu
  ppCode = ppCode.replace(
    'if(y.h1){r.appendChild(this.TH.$)}',
    '/* Account button excluded */'
  );

  // 6. Completely remove About, Report a bug, Learn, Blog, API, Reddit, Twitter, Facebook from top bar
  ppCode = ppCode.replace(
    'var r=[[0,13,3],[0,13,4],[0,13,5],"Blog","API",v+"<path',
    'var r=[];var _unused=[[0,13,3],[0,13,4],[0,13,5],"Blog","API",v+"<path'
  );
  ppCode = ppCode.replace(
    'eP.prototype.W=function(){var y=this.a2T;b.KY(y);for(var n=0;',
    'eP.prototype.W=function(){var y=this.a2T;y.style.display="none";b.KY(y);return;for(var n=0;'
  );

  // 7. Remove PeaDrive, PeaGames, Photopea, Vectorpea, Jampea
  ppCode = ppCode.replace(
    /r\.push\(\["Photopea",\s*null,\s*"https:\/\/www\.vecpea\.com\/promo\/icon512\.png"\][\s\S]*?\["Jampea",\s*null,\s*"https:\/\/www\.vecpea\.com\/promo\/icon512_jp\.png"\]\);?/,
    '/* side launchers removed */'
  );
  ppCode = ppCode.replace(
    /dm\.Jc\s*=\s*\[\["PeaGames"[\s\S]*?\]\];/,
    'dm.Jc = [];'
  );
  ppCode = ppCode.replace(
    '["PeaDrive","peadriveStorage.html","strg/peadrive",!0,"A cloud storage system from Photopea."],',
    ''
  );

  // 8. Enforce Blue Open-Shop logo and 3 Home buttons: New Project, Open From Computer, Install Open-Shop (with Blue Favicon)
  ppCode = ppCode.replace(
    'v.setAttribute("src",PIMG[n==0?"l"+"o"+"g"+"o":"b"+"o"+"t"+"t"+"o"+"m"]);',
    'v.setAttribute("src",n==0?"promo/logo.svg":PIMG.bottom);'
  );
  ppCode = ppCode.replace(
    'if(n==0)this.aBW=v;else this.aoK=v',
    'if(n==0){this.aBW=v;v.setAttribute("src","promo/logo.svg");v.style.width="360px";v.style.height="82px";v.style.objectFit="contain";v.style.marginBottom="24px";}else this.aoK=v'
  );
  ppCode = ppCode.replace(
    'this.aBW.setAttribute("src",PIMG[r]);',
    'this.aBW.setAttribute("src","promo/logo.svg");this.aBW.style.width="360px";this.aBW.style.height="82px";this.aBW.style.objectFit="contain";this.aBW.style.marginBottom="24px";'
  );
  ppCode = ppCode.replace(
    'n<[6,4,3][d7]',
    'n<3'
  );
  ppCode = ppCode.replace(
    /if\(n==0\)P\.data=\{S:G\.m\.bq,V\$:"newproject"\};[\s\S]*?this\.K\(P\);/,
    'if(n==0){P.data={S:G.m.bq,V$:"newproject"};this.K(P);}else if(n==1){P.data={S:G.m.D$};this.K(P);}else if(n==2){var _p=window.deferredInstallPrompt||(window.app&&window.app.o?window.app.o.iI:null);if(_p){_p.prompt();if(_p.userChoice)_p.userChoice.then(function(res){if(res&&res.outcome==="accepted")console.log("Open-Shop PWA Installed");});window.deferredInstallPrompt=null;}else{alert("To install Open-Shop into your browser as a standalone app, click the Install icon (⨁) in your browser address bar or menu (⋮ -> Install Open-Shop).");}}}'
  );
  ppCode = ppCode.replace(
    'P=[[11,7],[1,6],[25,0],[0,17,6],"Generate","Video?"]',
    'P=[[11,7],[1,6],[0,17,6]]'
  );
  ppCode = ppCode.replace(
    'D="lrs/newlayer strg/tdevice pix_layer lrs/clipping lrs/newlayer panels/actions".split(" ");',
    'D="lrs/newlayer strg/tdevice promo_icon".split(" ");'
  );
  ppCode = ppCode.replace(
    'y[n].innerHTML="<span style=\\"vertical-align:middle\\">"+b.ss(D[n],null,"autoscale")+"</span>\\u2000"+cf.get(P[n]);',
    'y[n].innerHTML=(n==2?"<img src=\\"promo/icon.svg\\" style=\\"width:20px;height:20px;vertical-align:middle;display:inline-block;border-radius:4px;margin-right:6px;\\" />":"<span style=\\"vertical-align:middle\\">"+b.ss(D[n],null,"autoscale")+"</span>\\u2000")+cf.get(P[n]);'
  );
  ppCode = ppCode.replace(
    'if(n==3)t.style.display="none";',
    '/* buttons visible */'
  );
  ppCode = ppCode.replace(
    'if(this.xX[3])this.xX[3].style.display=j.iI?"inline-block":"none"',
    '/* install button is item 2 */'
  );
  ppCode = ppCode.replace(
    'b.v(t,D+"margin:20px 10px 0 10px; cursor:pointer; padding:12px;");',
    'b.v(t,D+"margin:16px 8px 0 8px; cursor:pointer; padding:10px 18px; white-space:nowrap;");'
  );
  ppCode = ppCode.replace(
    'var r=Math.min(y*.9,600);',
    'var r=Math.min(y*.95,860);'
  );
  ppCode = ppCode.replace(
    /if\(T==G\.m\.uK\)if\(this\.o\.iI\)\{this\.o\.iI\.prompt\(\);[\s\S]*?this\.o\.iI=null\}/,
    'if(T==G.m.uK){var _p=window.deferredInstallPrompt||(this.o?this.o.iI:null);if(_p){_p.prompt();if(_p.userChoice)_p.userChoice.then(function(res){if(res&&res.outcome==="accepted")console.log("Open-Shop PWA Installed");});window.deferredInstallPrompt=null;if(this.o)this.o.iI=null;}else{alert("To install Open-Shop, click the Install icon (⨁) in your browser address bar or menu (⋮ -> Install Open-Shop).");}}'
  );

  // 9. Assign window.app
  ppCode = ppCode.replace(
    'document.body.appendChild(new dj().$)}())',
    'window.app=new dj();document.body.appendChild(window.app.$)}())'
  );

  // 10. Remove PeaMark and About OpenShop from More menu
  ppCode = ppCode.replace(
    /Y\.items\.push\(\{name:\s*"PeaMark"\}\);[\s\S]*?Y\.Ii\.push\(\{N:G\.E\.b,M:\{S:G\.m\.bq,V\$:"aboutpp"\}\}\);?/,
    '/* PeaMark and About removed from More menu */'
  );

  // 11. Fix alertpanel removeChild safety guard
  ppCode = ppCode.replace(
    'this.dP.removeChild(P);delete this.a1H[JSON.stringify(y)]',
    'if(P&&P.parentNode)this.dP.removeChild(P);delete this.a1H[JSON.stringify(y)]'
  );

  // 12. Restrict the core script command channel to trusted same-origin windows.
  ppCode = ppCode.replace(
    'window.onmessage=function($){if(Storage.aGX($.source))return;',
    'window.onmessage=function($){if(Storage.aGX($.source))return;var osTrustedOrigin=$.origin!=="null"&&window.location.origin!=="null"&&$.origin===window.location.origin,osTrustedSource=$.source===window||$.source===window.parent||(window.opener&&$.source===window.opener);if(!osTrustedOrigin||!osTrustedSource||$.source===window&&($.data==="done"||$.data==="saved"))return;'
  );
  ppCode = ppCode.replace(
    'if(window.parent!=window)window.parent.postMessage(y.data.lN,"*");',
    'window.parent.postMessage(y.data.lN,window.location.origin);'
  );
  ppCode = ppCode.replace(
    /if\(b\.yP\(this\.mj\.\$\)\)\s*\$\s*\+=\s*31;[\s\S]*?if\(b\.yP\(this\.Kn\.\$\)\)\s*\$\s*\+=\s*32;/,
    () => 'if(b.yP(this.mj.$))$+=Math.ceil((this.mj.$&&this.mj.$.getBoundingClientRect().height)||38);if(b.yP(this.Kn.$))$+=Math.ceil((this.Kn.$&&this.Kn.$.getBoundingClientRect().height)||38);'
  );
  ppCode = ppCode.replace(
    /,\s*\{\s*name:\s*"Peas Maker"[\s\S]*?url:\s*"[^"]*peasmaker"[^}]*\}/,
    ''
  );
  ppCode = ppCode.replace(
    /,\s*\{\s*name:\s*"Plugins",\s*KU:\s*(!0|true)\s*\}/,
    ''
  );
  ppCode = ppCode.replace(
    /,\s*\{\s*N:\s*G\.E\.b,\s*M:\s*\{\s*S:\s*G\.m\.bq,\s*V\$:\s*"res1"\s*\}\s*\}/,
    ''
  );

  // 13. General Branding & naming replacement across openshop.js
  ppCode = ppCode.replaceAll('Photopea', 'OpenShop');
  ppCode = ppCode.replaceAll('photopea', 'openshop');
  ppCode = ppCode.replaceAll('Vectorpea', 'OpenShop');
  ppCode = ppCode.replaceAll('vectorpea', 'openshop');
  ppCode = ppCode.replaceAll('Jampea', 'OpenShop');
  ppCode = ppCode.replaceAll('jampea', 'openshop');
  ppCode += '\nwindow.OpenShop = window.OpenShop || {}; window.openshop = window.openshop || window.OpenShop;\n';

  fs.writeFileSync('code/external/ext.js', extCode, 'utf8');
  fs.writeFileSync('code/dbs.js', dbsCode, 'utf8');
  fs.writeFileSync('code/openshop.js', ppCode, 'utf8');
  console.log('Saved code/openshop.js successfully');

  console.log('--- Step 6: Generating master style/all.css ---');
  let css = fs.readFileSync('fetched-pp/all10.css', 'utf8');

  // Insert master theme variables and corner rules
  const themeVars = `
:root {
	--base: #474747;
	--bg-panel: #252525;
	--bg-canvas: #252525;
	--bg-color: #252525;
	--bg-input: #252525;
	--bg-bbtn: #5d5d5d;
	--bg-bbtnOver: #6a6a6a;
	--brdrLgt: 0.15;
	--brdrDrk: 0.6;
	--alphaDark: 0.25;
	--text-color: #d5d5d5;
	--gs-invert: 0.78;
	--brdr: #252525;
	--sh-clr: 0;
	--absc: 0;
	--abs255: 0;
	--accent: #2563eb;
	--img20: 20px;
	--img15: 15px;
}

body, .theme0 {
	background-color: var(--base) !important;
	color: var(--text-color) !important;
}

.confbar, .options, div.flexrow.top {
	background-color: var(--base) !important;
}

.mainblock .panelhead {
	background-color: var(--bg-canvas) !important;
	border-top-left-radius: 7px !important;
	padding: 4px 4px 0 4px !important;
}

.mainblock .panelhead div {
	border-radius: 4px !important;
	height: 26.1px !important;
	display: inline-block !important;
	margin-right: 4px !important;
}

.mainblock .panelhead div.active {
	background-color: var(--base) !important;
	opacity: 1 !important;
}

/* Master Topbar Menus & Hover styling matching photopea.com */
.topbar {
	background-color: var(--base) !important;
	color: var(--text-color) !important;
	border-bottom: 1px solid var(--brdr) !important;
	padding: 2px 0 3px 0 !important;
	min-height: 31px !important;
	box-sizing: border-box !important;
}

.topbar button {
	background-color: transparent !important;
	color: var(--text-color) !important;
	border: none !important;
	padding: 3px 7px !important;
	margin: 2px 2px !important;
	font-size: 13px !important;
	line-height: 22px !important;
	border-radius: 3px !important;
}

.topbar button:hover, .topbar button.active {
	background-color: rgba(255, 255, 255, 0.14) !important;
	color: #ffffff !important;
}

.topbar .os-logo {
	width: 19px !important;
	height: 19px !important;
	vertical-align: middle !important;
	margin: 0 8px 0 6px !important;
	cursor: pointer !important;
	display: inline-block !important;
}

.contextmenu div:hover, .menuitem:hover, .contextpanel div:hover {
	background-color: #3a6ea5 !important;
	color: #ffffff !important;
}

/* Universal High-Contrast Dark Dropdowns & Form Inputs */
select, .window select, .form select, .confbar select, .options select, .fitem select {
	background-color: #242424 !important;
	color: #ffffff !important;
	border: 1px solid rgba(255, 255, 255, 0.2) !important;
	border-radius: 4px !important;
	padding: 3px 22px 3px 8px !important;
	font-size: 13px !important;
	height: 24px !important;
	appearance: none !important;
	-webkit-appearance: none !important;
	-moz-appearance: none !important;
	background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23cccccc%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") !important;
	background-repeat: no-repeat !important;
	background-position: right 6px center !important;
	background-size: 10px 10px !important;
	cursor: pointer !important;
	outline: none !important;
}

select:hover, select:focus {
	border-color: #2563eb !important;
	background-color: #2b2b2b !important;
}

select option {
	background-color: #242424 !important;
	color: #ffffff !important;
	padding: 4px 8px !important;
}
`;

  css = themeVars + '\n' + css;
  fs.writeFileSync('style/all.css', css, 'utf8');
  console.log('Saved style/all.css successfully');

  console.log('--- Step 7: Generating index.html ---');
  const html = `<!DOCTYPE html>
<html translate="no">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, minimum-scale=1.0, maximum-scale=5.0, initial-scale=1.0" />
		<meta name="theme-color" content="#474747">
		<title>Open-Shop | Online Image Editor</title>
		
		<link rel="manifest" href="manifest.json" />
		<link rel="icon" href="promo/icon.svg" type="image/svg+xml" />
		<link rel="icon" type="image/png" sizes="512x512" href="promo/icon512.png" />
		<link rel="icon" type="image/png" sizes="256x256" href="promo/icon256.png" />
		<link rel="icon" type="image/png" sizes="192x192" href="promo/icon192.png" />
		<link rel="icon" type="image/png" sizes="32x32" href="favicon.png" />
		<link rel="shortcut icon" href="favicon.ico" />
		<link rel="apple-touch-icon" href="promo/icon512.png" />
		
		<link rel="stylesheet" href="style/all.css?v=52" />
		<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:400,400i,700,700i" />
		
		<style>
			#cap, .topfloat { display: none !important; }
		</style>
		
		<!-- Diagnostics Engine -->
		<script src="code/openshop-logger.js?v=52"></script>
	</head>
	<body class="theme0">
		<div id="cap" style="display:none;"></div>
		<div class="topfloat" style="display:none;"></div>
		<script>
			function showCap(){} 
			function hideCap(){}
		</script>
		
		<script src="code/external/ext.js?v=52"></script>
		<script src="code/dbs.js?v=52"></script>
		<script src="code/openshop.js?v=52"></script>
		
		<script src="code/openshop-recovery.js?v=52"></script>
		<script src="code/openshop-agent.js?v=52"></script>
		<script src="code/openshop-memory.js?v=52"></script>
		<script src="code/openshop-batch.js?v=52"></script>
		<script src="code/openshop-color.js?v=52"></script>
		<script src="code/openshop-vector.js?v=52"></script>
		<script src="code/openshop-format.js?v=52"></script>
		<script src="code/openshop-ps-compat.js?v=52"></script>

		<script>
			window.addEventListener('beforeinstallprompt', (e) => {
				e.preventDefault();
				window.deferredInstallPrompt = e;
			});

			if ('serviceWorker' in navigator) {
				window.addEventListener('load', () => {
					navigator.serviceWorker.register('./sw.js').catch(() => {});
				});
			}
		</script>
	</body>
</html>
`;
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('Saved index.html successfully');

  console.log('--- Step 8: Sanitizing Trackers from Documentation, Tutorials, and API Pages ---');
  const sanitizeDocs = () => {
    // 1. learn/*.html
    const learnDir = path.join(process.cwd(), 'learn');
    if (fs.existsSync(learnDir)) {
      const files = fs.readdirSync(learnDir).filter(f => f.endsWith('.html'));
      for (const f of files) {
        const fullPath = path.join(learnDir, f);
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/\r?\n\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js"><\/script>\r?\n\s*<ins class="adsbygoogle"[\s\S]*?<\/ins>\r?\n\s*<script>\s*\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{\}\);\s*<\/script>/g, '');
        content = content.replace(/\r?\n\s*<h2 style="margin-top:\s*4em">Comments<\/h2>\r?\n\s*<div id="disqus_thread"><\/div>\r?\n\s*<script>[\s\S]*?disqus\.com\/embed\.js[\s\S]*?<\/script>/g, '');
        content = content.replace(/\r?\n\s*<div id="disqus_thread"><\/div>\s*<script>[\s\S]*?disqus\.com\/embed\.js[\s\S]*?<\/script>/g, '');
        content = content.replace(/\r?\n\s*<script>\s*\(function\(i,s,o,g,r,a,m\)[\s\S]*?GoogleAnalyticsObject[\s\S]*?ga\('send',\s*'pageview'\);\s*<\/script>/g, '');
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }

    // 2. tuts/**/*.html
    function walkDir(dir) {
      let results = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const item of list) {
        const p = path.join(dir, item);
        const stat = fs.statSync(p);
        if (stat && stat.isDirectory()) {
          results = results.concat(walkDir(p));
        } else if (p.endsWith('.html')) {
          results.push(p);
        }
      }
      return results;
    }

    const tutsDir = path.join(process.cwd(), 'tuts');
    const tutFiles = walkDir(tutsDir);
    for (const f of tutFiles) {
      let content = fs.readFileSync(f, 'utf8');
      content = content.replace(/\r?\n\s*<!-- Global site tag \(gtag\.js\) - Google Analytics -->\r?\n\s*<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+"><\/script>\r?\n\s*<script>[\s\S]*?gtag\('config'[\s\S]*?<\/script>/g, '');
      content = content.replace(/\r?\n\s*<div style="width:110px;\s*margin:\s*0px auto;">[\s\S]*?<\/div>/g, '');
      content = content.replace(/\r?\n\s*<div id="disqus_thread"><\/div>\r?\n\s*<script[^>]*>[\s\S]*?disqus\.com[\s\S]*?<\/script>/g, '');
      fs.writeFileSync(f, content, 'utf8');
    }

    // 3. api/*.html
    const apiDir = path.join(process.cwd(), 'api');
    if (fs.existsSync(apiDir)) {
      const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.html'));
      for (const f of apiFiles) {
        const fullPath = path.join(apiDir, f);
        let content = fs.readFileSync(fullPath, 'utf8');
        content = content.replace(/\r?\n\s*<div id="disqus_thread"><\/div>\r?\n\s*<script>[\s\S]*?disqus\.com\/embed\.js[\s\S]*?<\/script>/g, '');
        fs.writeFileSync(fullPath, content, 'utf8');
      }
    }
  };
  sanitizeDocs();
  console.log('Sanitized all documentation, tutorials, and API pages.');
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
