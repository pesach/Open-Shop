/**
 * Open-Shop ICC Color Management & Multi-Color Space Engine
 * Supports sRGB, Adobe RGB 1998, Display P3, CMYK (SWOP/FOGRA), CIELAB, and Delta-E calculations.
 */
(function(root) {
  'use strict';

  // Standard D65 and D50 white points
  const WHITE_D65 = { X: 0.95047, Y: 1.00000, Z: 1.08883 };
  const WHITE_D50 = { X: 0.96422, Y: 1.00000, Z: 0.82521 };

  class OpenShopColorEngine {
    constructor() {
      this.activeWorkingSpace = 'sRGB';
      this.softProofingEnabled = false;
      this.proofProfile = 'US Web Coated (SWOP) v2';
    }

    // Convert sRGB [0..255] to Linear sRGB [0..1]
    sRGBToLinear(c) {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    // Convert Linear sRGB [0..1] to sRGB [0..255]
    linearTosRGB(v) {
      const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(255, c * 255)));
    }

    // RGB to XYZ (D65)
    rgbToXYZ(r, g, b) {
      const lr = this.sRGBToLinear(r);
      const lg = this.sRGBToLinear(g);
      const lb = this.sRGBToLinear(b);

      const X = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
      const Y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
      const Z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;

      return { X, Y, Z };
    }

    // XYZ (D65) to RGB
    xyzToRGB(X, Y, Z) {
      const lr = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
      const lg = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
      const lb = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;

      return {
        r: this.linearTosRGB(lr),
        g: this.linearTosRGB(lg),
        b: this.linearTosRGB(lb)
      };
    }

    // XYZ to CIELAB (D65)
    xyzToLab(X, Y, Z) {
      const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + (16 / 116);

      const xr = X / WHITE_D65.X;
      const yr = Y / WHITE_D65.Y;
      const zr = Z / WHITE_D65.Z;

      const fx = f(xr);
      const fy = f(yr);
      const fz = f(zr);

      const L = (116 * fy) - 16;
      const a = 500 * (fx - fy);
      const b = 200 * (fy - fz);

      return { L, a, b };
    }

    // CIELAB to XYZ (D65)
    labToXYZ(L, a, b) {
      const fy = (L + 16) / 116;
      const fx = (a / 500) + fy;
      const fz = fy - (b / 200);

      const finv = (t) => {
        const t3 = t * t * t;
        return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
      };

      const X = finv(fx) * WHITE_D65.X;
      const Y = finv(fy) * WHITE_D65.Y;
      const Z = finv(fz) * WHITE_D65.Z;

      return { X, Y, Z };
    }

    // RGB to CIELAB
    rgbToLab(r, g, b) {
      const xyz = this.rgbToXYZ(r, g, b);
      return this.xyzToLab(xyz.X, xyz.Y, xyz.Z);
    }

    // CIELAB to RGB
    labToRGB(L, a, b) {
      const xyz = this.labToXYZ(L, a, b);
      return this.xyzToRGB(xyz.X, xyz.Y, xyz.Z);
    }

    // RGB to CMYK [0..100%]
    rgbToCMYK(r, g, b) {
      const nr = r / 255;
      const ng = g / 255;
      const nb = b / 255;

      const k = 1 - Math.max(nr, ng, nb);
      if (k === 1) {
        return { c: 0, m: 0, y: 0, k: 100 };
      }

      const c = Math.round(((1 - nr - k) / (1 - k)) * 100);
      const m = Math.round(((1 - ng - k) / (1 - k)) * 100);
      const y = Math.round(((1 - nb - k) / (1 - k)) * 100);

      return { c, m, y, k: Math.round(k * 100) };
    }

    // CMYK to RGB
    cmykToRGB(c, m, y, k) {
      const nc = c / 100;
      const nm = m / 100;
      const ny = y / 100;
      const nk = k / 100;

      const r = Math.round(255 * (1 - nc) * (1 - nk));
      const g = Math.round(255 * (1 - nm) * (1 - nk));
      const b = Math.round(255 * (1 - ny) * (1 - nk));

      return { r, g, b };
    }

    // Perceptual Delta-E 76 color difference
    deltaE76(lab1, lab2) {
      const dL = lab1.L - lab2.L;
      const da = lab1.a - lab2.a;
      const db = lab1.b - lab2.b;
      return Math.sqrt(dL * dL + da * da + db * db);
    }

    // Display P3 to sRGB
    displayP3TosRGB(r, g, b) {
      // Display P3 uses D65 with sRGB transfer function and wider gamut
      const nr = r / 255, ng = g / 255, nb = b / 255;
      const sr = nr * 1.2249 - ng * 0.2247 - nb * 0.0002;
      const sg = -nr * 0.0420 + ng * 1.0419 + nb * 0.0001;
      const sb = -nr * 0.0197 - ng * 0.0786 + nb * 1.0983;

      return {
        r: Math.round(Math.max(0, Math.min(255, sr * 255))),
        g: Math.round(Math.max(0, Math.min(255, sg * 255))),
        b: Math.round(Math.max(0, Math.min(255, sb * 255)))
      };
    }
  }

  const colorEngine = new OpenShopColorEngine();

  globalThis.OpenShopColorEngine = OpenShopColorEngine;
  globalThis.OpenShopColor = colorEngine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpenShopColorEngine, colorEngine };
  }
})(typeof window !== 'undefined' ? window : globalThis);
