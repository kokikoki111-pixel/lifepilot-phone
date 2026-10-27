// LifePilot の人物の絵（エルピー・リラ・パーシー）。SVG の文字列を、JS で組み立てる。外部ライブラリは使わない。
// リラ・パーシーは、既定で画像AIの絵（絵/名前_表情.jpg）を出す。設定 画像:false で、コードで描く絵に戻せる。
// 見た目の正本は 2_仕様と進行/世界観/17_設定集.md の「登場人物」。Mac 版（L2_エルピーの窓.html）と、スマホ版の両方から使う。
(function (root) {
  "use strict";

  // ================= 設定（エルピー。Mac 版 L2 の設定と同じ意味。呼ぶ側が 状態.設定 で上書きできる） =================
  const 既定設定 = {
    背景模様: { 線の濃さ: 0.34, 線の太さ: 1.1, 部品の濃さ: 0.6, 点の濃さ: 0.75, 光る点の濃さ: 0.55, 点の格子: 0.3 },
    計器: { 濃さ: 0.6 },
    考え中: { 回る速さ: 240, 大きさ: 46, 太さ: 9 },
    点数: { 下限: -100, 上限: 100 },
    段階: [[-100, "激怒"], [-70, "怒り"], [-40, "不機嫌"], [-15, "通常"], [15, "微笑"], [40, "楽しい"], [70, "大喜び"]],
    疲れ: { 透け: [0.26, 0.07], 全体: [1, 0.5] },
  };
  const 停点 = [{ p: -100, 窓: "#C62E3A", 光: "#FF7A85" }, { p: 0, 窓: "#1F5FBF", 光: "#6FD3FF" }, { p: 100, 窓: "#F2C94C", 光: "#FFE58A" }];
  const エルピーの顔 = ["激怒", "怒り", "不機嫌", "通常", "微笑", "楽しい", "大喜び", "おどけ", "迷い"];
  const 顔の既定点 = { 激怒: -90, 怒り: -55, 不機嫌: -28, 通常: 0, 微笑: 28, 楽しい: 55, 大喜び: 85, おどけ: 30, 迷い: 0 };
  const 顔の手 = {
    激怒: [{ x: 195, y: 318, r: 0, s: 1.2, p: "fist" }, { x: 365, y: 318, r: 0, s: 1.2, p: "fist" }],
    不機嫌: [{ x: 135, y: 335, r: -6, s: 1, p: "open" }, { x: 425, y: 335, r: 6, s: 1, p: "open" }],
    微笑: [{ x: 105, y: 285, r: -16, s: 1, p: "open" }, { x: 455, y: 285, r: 16, s: 1, p: "open" }],
    大喜び: [{ x: 78, y: 128, r: -42, s: 1.1, p: "open" }, { x: 482, y: 128, r: 42, s: 1.1, p: "open" }],
    通常: [{ x: 110, y: 300, r: -10, s: 1, p: "open" }, { x: 450, y: 300, r: 10, s: 1, p: "open" }],
    楽しい: [{ x: 95, y: 175, r: -25, s: 1, p: "open" }, { x: 465, y: 175, r: 25, s: 1, p: "open" }],
    怒り: [{ x: 205, y: 322, r: 0, s: 1.1, p: "fist" }, { x: 355, y: 322, r: 0, s: 1.1, p: "fist" }],
    おどけ: [{ x: 92, y: 160, r: -35, s: 1.1, p: "open" }, { x: 468, y: 150, r: 35, s: 1.1, p: "open" }],
    迷い: [{ x: 70, y: 250, r: -50, s: 1, p: "open" }, { x: 392, y: 62, r: 28, s: 1, p: "open" }],
  };
  const 傾き = { おどけ: 7, 迷い: -4 };
  const 顔の部品 = {
    激怒: ["rage", "teeth"], 怒り: ["angry", "flat"], 不機嫌: ["sulk", "frown"], 通常: ["open", "smile"],
    微笑: ["gentle", "smile2"], 楽しい: ["happy", "grin"], 大喜び: ["happy", "biggrin"], おどけ: ["wink", "tongue"], 迷い: ["side", "wave"],
  };

  // ================= 小さな道具 =================
  const 数 = (v, 既 = 0) => { v = Number(v); return isFinite(v) ? String(Math.round(v * 100) / 100) : String(既); };
  const 有限 = (v, 既) => { v = Number(v); return isFinite(v) ? v : 既; };
  const 範囲 = (v, a, b) => Math.max(a, Math.min(b, v));
  const 逃がす = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const 十六 = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const 色字 = rgb => "#" + rgb.map(v => Math.round(範囲(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
  const 混 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const 合成 = (既定, 上書き) => { const 出 = {}; for (const k in 既定) { const v = 既定[k]; 出[k] = (v && typeof v === "object" && !Array.isArray(v)) ? Object.assign({}, v, (上書き && 上書き[k]) || {}) : (上書き && 上書き[k] !== undefined ? 上書き[k] : v); } return 出; };
  // 画像の絵（画像AIで作った絵。スマホ版/絵/ にある）。場所は、ページからの相対。変な文字は捨てる
  const 絵の場所を整える = v => { v = typeof v === "string" ? v.replace(/[^A-Za-z0-9_./\-\u3040-\u30ff\u4e00-\u9fff]/g, "").replace(/\.\.+/g, ".") : "絵/"; return v && !/\/$/.test(v) ? v + "/" : (v || "絵/"); };
  let 通し番号 = 0;
  const 次の接頭辞 = p => "lp" + p + (++通し番号);
  const 接頭辞を整える = (s, 既) => { s = String(s == null ? "" : s).replace(/[^A-Za-z0-9_-]/g, ""); return s || 既; };

  function 点の色(点, 設) {
    const p = 範囲(有限(点, 0), 設.点数.下限, 設.点数.上限);
    const 区間 = p < 0 ? [停点[0], 停点[1]] : [停点[1], 停点[2]];
    const t = (p - 区間[0].p) / (区間[1].p - 区間[0].p);
    return { 窓: 混(十六(区間[0].窓), 十六(区間[1].窓), t), 光: 混(十六(区間[0].光), 十六(区間[1].光), t) };
  }
  function 顔の名前(点, 設 = 既定設定) {
    let 名 = 設.段階[0][1]; const p = 有限(点, 0);
    for (const [下, n] of 設.段階) if (p >= 下) 名 = n;
    return 名;
  }
  // 全部の動きに共通の CSS（SVG の中に入れる。動きを減らす設定のときは止める）
  const 共通CSS = `<style>
.lpa-fl{animation:lpa-float 4s ease-in-out infinite}.lpa-sh{animation:lpa-shake .12s linear infinite}.lpa-bo{animation:lpa-bounce .7s ease-in-out infinite}
.lpa-bk{animation:lpa-blink 5s infinite;transform-box:fill-box;transform-origin:center}.lpa-pu{animation:lpa-pulse 2.6s ease-in-out infinite}.lpa-sc{animation:lpa-scan 1.2s linear infinite}
.lpa-fk{animation:lpa-flick 6s infinite}.lpa-qf{animation:lpa-qf 1.4s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
.lpa-br{animation:lpa-breathe 4.2s ease-in-out infinite}.lpa-gl{animation:lpa-glow 3.2s ease-in-out infinite}.lpa-bk2{animation:lpa-blink 6.4s infinite;transform-box:fill-box;transform-origin:center}
@keyframes lpa-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes lpa-shake{0%{transform:translate(0,0)}25%{transform:translate(2px,-1px)}50%{transform:translate(-2px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0,0)}}
@keyframes lpa-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes lpa-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes lpa-pulse{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes lpa-scan{from{transform:translateY(0)}to{transform:translateY(8px)}}
@keyframes lpa-flick{0%,46%,49%,82%,85%,100%{opacity:1}47.5%{opacity:.7}83.5%{opacity:.85}}
@keyframes lpa-qf{from{transform:translateY(0) rotate(-10deg)}to{transform:translateY(-10px) rotate(12deg) scale(1.12)}}
@keyframes lpa-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(1.6px)}}
@keyframes lpa-glow{0%,100%{opacity:.55}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lpa-fl,.lpa-sh,.lpa-bo,.lpa-bk,.lpa-bk2,.lpa-pu,.lpa-sc,.lpa-fk,.lpa-qf,.lpa-br,.lpa-gl{animation:none}}
</style>`;

  // ================= エルピー =================
  function 定義(id) {
    return `<defs>
    <filter id="${id}_g" filterUnits="userSpaceOnUse" x="-40" y="-40" width="640" height="480"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="${id}_p" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r=".75" fill="currentColor" fill-opacity="0.3"/></pattern>
    <pattern id="${id}_s" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="currentColor" fill-opacity=".12"/></pattern>
    <clipPath id="${id}_c"><rect x="150" y="80" width="260" height="190" rx="14"/></clipPath>
    <radialGradient id="${id}_rg" cx="280" cy="175" r="150" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".35"/></radialGradient>
    <mask id="${id}_m" maskUnits="userSpaceOnUse" x="150" y="80" width="260" height="190"><rect x="150" y="80" width="260" height="190" fill="url(#${id}_rg)"/></mask>
  </defs>`;
  }
  // 基板：中央のチップから、配線が放射状に出る（顔の目・口を避けて、上下に曲がる）。顔の後ろなので、薄く
  function 基板(id, 設, 動) {
    const B = 設.背景模様, cx = 280, 上 = 118, 下 = 182, 左 = 248, 右 = 312;
    let 線 = "", 端 = [];
    // 上と下：5本ずつ。端の2本ずつが斜めに曲がる
    const xs = [256, 268, 280, 292, 304];
    xs.forEach((x, k) => {
      const 向 = k < 2 ? -1 : (k > 2 ? 1 : 0), 順 = k < 2 ? k : (k > 2 ? 4 - k : 0);
      if (向 === 0) { 線 += `M${x} ${上}V70M${x} ${下}V280`; 端.push([x, 82], [x, 268]); return; }
      const 曲上 = 上 - 6 - 11 * 順, 曲下 = 下 + 6 + 11 * 順;
      線 += `M${x} ${上}V${曲上}l${向 * 14} -14H${向 < 0 ? 150 : 410}`; 端.push([向 < 0 ? 160 : 400, 曲上 - 14]);
      線 += `M${x} ${下}V${曲下}l${向 * 14} 14H${向 < 0 ? 150 : 410}`; 端.push([向 < 0 ? 160 : 400, 曲下 + 14]);
    });
    // 左と右：上2本は上へ、下2本は下へ（目を横切らない）
    [[上 + 6, -1, 0], [上 + 16, -1, 1], [下 - 16, 1, 1], [下 - 6, 1, 0]].forEach(([y, 縦, 順]) => {
      const 離 = 6 + 10 * (縦 < 0 ? 順 : 順);
      [[左, -1], [右, 1]].forEach(([x0, 横]) => {
        const 曲 = x0 + 横 * 離;
        線 += `M${x0} ${y}H${曲}l${横 * 16} ${縦 * 16}V${縦 < 0 ? 84 : 266}`; 端.push([曲 + 横 * 16, 縦 < 0 ? 94 : 256]);
      });
    });
    const 脚 = [];
    xs.forEach(x => { 脚.push(`M${x} ${上}v-5M${x} ${下}v5`); });
    [上 + 6, 上 + 16, 下 - 16, 下 - 6].forEach(y => { 脚.push(`M${左} ${y}h-5M${右} ${y}h5`); });
    const 点列 = 端.map(([x, y]) => `M${x} ${y}h0`).join("");
    const 角の部品 = `<g fill="none" stroke="currentColor" stroke-opacity="${数(B.部品の濃さ * 0.7)}" stroke-width="1.2">
      <rect x="170" y="238" width="22" height="9"/><path d="M174 238v-3M180 238v-3M186 238v-3M174 247v3M180 247v3M186 247v3"/>
      <path d="M366 236h4l2 -4l4 8l4 -8l4 8l2 -4h4"/><circle cx="388" cy="104" r="5"/><circle cx="172" cy="102" r="5"/>
      <rect x="368" y="244" width="20" height="14"/><path d="M372 244v-3M378 244v-3M384 244v-3"/></g>`;
    const 光点 = 動 ? [[216, 100], [346, 98], [214, 250], [352, 248]].map(([x, y], i) => `<circle class="lpa-pu" style="animation-delay:${-i * 0.6}s" cx="${x}" cy="${y}" r="2.4"/>`).join("") : "";
    const チップ = `<g>
      <rect x="${左}" y="${上}" width="${右 - 左}" height="${下 - 上}" rx="6" fill="currentColor" fill-opacity=".09" stroke="currentColor" stroke-opacity=".75" stroke-width="1.8"/>
      <rect x="${左 + 9}" y="${上 + 9}" width="${右 - 左 - 18}" height="${下 - 上 - 18}" rx="3" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1"/>
      <circle cx="${左 + 7}" cy="${上 + 7}" r="1.8" fill="currentColor" fill-opacity=".8"/>
      <text x="${cx}" y="${(上 + 下) / 2 + 3}" text-anchor="middle" font-size="9" font-family="ui-monospace,Menlo,monospace" fill="currentColor" fill-opacity=".55" letter-spacing=".5">LP-01</text></g>`;
    return `<g>
    <rect x="150" y="80" width="260" height="190" fill="url(#${id}_p)"/>
    <g mask="url(#${id}_m)"><path d="${線}${脚.join("")}" fill="none" stroke="currentColor" stroke-opacity="${数(B.線の濃さ)}" stroke-width="${数(B.線の太さ)}" stroke-linejoin="round" clip-path="url(#${id}_c)"/>
    <path d="${点列}" stroke="currentColor" stroke-opacity="${数(B.点の濃さ)}" stroke-width="3.2" stroke-linecap="round"/></g>
    ${角の部品}${チップ}
    <g filter="url(#${id}_g)" fill="currentColor" fill-opacity="${数(B.光る点の濃さ)}">${光点}</g>
  </g>`;
  }
  function 計器(id, 点, 疲, 設) {
    const 数値 = Math.round((点 + 100) / 2), 残 = 範囲(100 - 疲, 0, 100), o = 数(設.計器.濃さ);
    return `<g fill="currentColor" stroke="currentColor" fill-opacity="${o}" stroke-opacity="${o}">
    <rect x="368" y="87" width="22" height="9" rx="1.5" fill="none" stroke-width="1"/><rect x="390.5" y="89.5" width="2" height="4" stroke="none"/>
    <rect data-r="bat" x="369.5" y="88.5" width="${数(19 * 残 / 100)}" height="6" stroke="none"/>
    <text data-r="mood" x="392" y="110" text-anchor="end" font-size="12" stroke="none" font-family="ui-monospace,Menlo,monospace">${数値}</text></g>`;
  }
  function リロード(id, 設, 表示) {
    const r = 設.考え中.大きさ, c = 280, d = 175, t0 = -40, t1 = 250, R = g => g * Math.PI / 180;
    const P = g => [c + r * Math.cos(R(g)), d + r * Math.sin(R(g))];
    const [x0, y0] = P(t0), [x1, y1] = P(t1), 向 = [-Math.sin(R(t1)), Math.cos(R(t1))];
    const 頭 = 角 => { const q = R(角), bx = -向[0], by = -向[1]; return [x1 + (bx * Math.cos(q) - by * Math.sin(q)) * 20, y1 + (bx * Math.sin(q) + by * Math.cos(q)) * 20]; };
    const [h1x, h1y] = 頭(40), [h2x, h2y] = 頭(-40);
    const 秒 = 360 / Math.max(30, 有限(設.考え中.回る速さ, 240));
    return `<g data-r="reload" style="display:${表示 ? "" : "none"}" filter="url(#${id}_g)" fill="none" stroke="#FFFFFF" stroke-width="${数(設.考え中.太さ)}" stroke-linecap="round" stroke-linejoin="round">
    <animateTransform attributeName="transform" type="rotate" from="0 ${c} ${d}" to="360 ${c} ${d}" dur="${数(秒)}s" repeatCount="indefinite"/>
    <path d="M${数(x0)} ${数(y0)} A${数(r)} ${数(r)} 0 1 1 ${数(x1)} ${数(y1)}"/><path d="M${数(h1x)} ${数(h1y)} L${数(x1)} ${数(y1)} L${数(h2x)} ${数(h2y)}"/></g>`;
  }
  function 目(種, id, 動) {
    const y = 150, L = 215, R = 345, W = "#FFFFFF", F = `filter="url(#${id}_g)"`, b = 動 ? ' class="lpa-bk"' : "";
    const 楕円 = (cx, rx, ry, cy = y) => `<g${b}><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${W}"/></g>`;
    const 弧 = cx => `<path d="M${cx - 26} ${y + 12} Q${cx} ${y - 28} ${cx + 26} ${y + 12}" fill="none" stroke="${W}" stroke-width="10" stroke-linecap="round"/>`;
    switch (種) {
      case "happy": return `<g ${F}>${弧(L)}${弧(R)}</g>`;
      case "angry": return `<g ${F} fill="${W}" stroke="${W}" stroke-width="5" stroke-linejoin="round"><path d="M${L - 26} ${y - 18} L${L + 24} ${y - 2} L${L + 22} ${y + 26} L${L - 22} ${y + 26} Z"/><path d="M${R + 26} ${y - 18} L${R - 24} ${y - 2} L${R - 22} ${y + 26} L${R + 22} ${y + 26} Z"/></g>`;
      case "rage": return `<g ${F} fill="${W}" stroke="${W}" stroke-width="5" stroke-linejoin="round"><path d="M${L - 30} ${y - 30} L${L + 26} ${y - 6} L${L + 22} ${y + 24} L${L - 24} ${y + 24} Z"/><path d="M${R + 30} ${y - 30} L${R - 26} ${y - 6} L${R - 22} ${y + 24} L${R + 24} ${y + 24} Z"/></g>`;
      case "sulk": return `<g ${F} fill="${W}" stroke="${W}" stroke-width="5" stroke-linejoin="round"><path d="M${L - 22} ${y - 4} L${L + 22} ${y + 2} L${L + 20} ${y + 24} L${L - 20} ${y + 24} Z"/><path d="M${R + 22} ${y - 4} L${R - 22} ${y + 2} L${R - 20} ${y + 24} L${R + 20} ${y + 24} Z"/></g>`;
      case "gentle": return `<g ${F}>${楕円(L, 17, 19, y + 2)}${楕円(R, 17, 19, y + 2)}</g>`;
      case "wink": return `<g ${F}>${弧(L)}${楕円(R, 22, 30)}</g>`;
      case "side": return `<g ${F}>${楕円(L + 12, 19, 26)}${楕円(R + 12, 17, 22)}</g>`;
      default: return `<g ${F}>${楕円(L, 17, 23)}${楕円(R, 17, 23)}</g>`;
    }
  }
  function 口(種, id) {
    const x = 280, y = 210, W = "#FFFFFF", F = `filter="url(#${id}_g)"`;
    const 線 = d => `<path d="${d}" fill="none" stroke="${W}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    switch (種) {
      case "grin": return `<g ${F}><path d="M${x - 40} ${y - 6} Q${x} ${y + 40} ${x + 40} ${y - 6} Z" fill="${W}"/></g>`;
      case "flat": return `<g ${F}>${線(`M${x - 30} ${y + 8} L${x + 30} ${y + 8}`)}</g>`;
      case "wave": return `<g ${F}>${線(`M${x - 36} ${y + 6} q9 -12 18 0 t18 0 t18 0 t18 0`)}</g>`;
      case "teeth": return `<g ${F}><rect x="${x - 34}" y="${y - 2}" width="68" height="28" rx="6" fill="${W}"/><path d="M${x - 17} ${y - 2} V${y + 26} M${x} ${y - 2} V${y + 26} M${x + 17} ${y - 2} V${y + 26} M${x - 34} ${y + 12} H${x + 34}" stroke="#0E1621" stroke-opacity=".55" stroke-width="2.5"/></g>`;
      case "frown": return `<g ${F}>${線(`M${x - 20} ${y + 16} Q${x} ${y + 2} ${x + 20} ${y + 16}`)}</g>`;
      case "smile2": return `<g ${F}>${線(`M${x - 38} ${y - 2} Q${x} ${y + 32} ${x + 38} ${y - 2}`)}</g>`;
      case "biggrin": return `<g ${F}><path d="M${x - 50} ${y - 12} Q${x} ${y + 54} ${x + 50} ${y - 12} Z" fill="${W}"/></g>`;
      case "tongue": return `<g ${F}><path d="M${x - 40} ${y - 6} Q${x} ${y + 30} ${x + 40} ${y - 6} Z" fill="${W}"/><ellipse cx="${x + 8}" cy="${y + 22}" rx="14" ry="12" fill="currentColor"/></g>`;
      default: return `<g ${F}>${線(`M${x - 30} ${y} Q${x} ${y + 24} ${x + 30} ${y}`)}</g>`;
    }
  }
  const 星 = (cx, cy, r) => `<path d="M${cx} ${cy - r} L${cx + r * .28} ${cy - r * .28} L${cx + r} ${cy} L${cx + r * .28} ${cy + r * .28} L${cx} ${cy + r} L${cx - r * .28} ${cy + r * .28} L${cx - r} ${cy} L${cx - r * .28} ${cy - r * .28} Z"/>`;
  function 飾り(顔, id, 動) {
    const G = `filter="url(#${id}_g)" fill="currentColor"`, q = (d) => 動 ? `class="lpa-qf" style="animation-delay:${d}s"` : "";
    if (顔 === "おどけ") return `<g ${G}><g ${q(0)}>${星(120, 100, 16)}</g><g ${q(-0.6)}>${星(452, 86, 11)}</g><g ${q(-1)}>${星(440, 250, 9)}</g></g>`;
    if (顔 === "大喜び") return `<g ${G}><g ${q(0)}>${星(128, 104, 14)}</g><g ${q(-0.5)}>${星(446, 98, 12)}</g><g ${q(-0.9)}>${星(420, 252, 8)}</g></g>`;
    if (顔 === "迷い") return `<g ${G} font-family="sans-serif" font-weight="700" text-anchor="middle"><text x="446" y="92" font-size="34" fill-opacity=".9">?</text></g>`;
    return "";
  }
  function 窓の絵(顔, st, id, 動, 設, 明, 計器を出す, 考え中) {
    const 角 = [[144, 74, 1, 1], [416, 74, -1, 1], [144, 276, 1, -1], [416, 276, -1, -1]].map(([x, y, a, b]) =>
      `<path d="M${x} ${y + b * 26} V${y} H${x + a * 26}" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="${x + a * 6}" cy="${y + b * 6}" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/>`).join("");
    const [e, m] = 顔の部品[顔];
    const 動き = !動 ? "" : (顔 === "激怒" ? "lpa-sh" : (顔 === "おどけ" || 顔 === "大喜び") ? "lpa-bo" : "");
    const 地 = 明 ? `<rect x="150" y="80" width="260" height="190" rx="14" fill="#0B1424" fill-opacity="${数(0.9 - 0.4 * st.疲れ / 100)}"/>` : "";
    return `<g transform="rotate(${傾き[顔] || 0} 280 175)"><g class="${動 ? "lpa-fl" : ""}"><g class="${動き}"><g class="${動 ? "lpa-fk" : ""}">
    ${地}<rect data-r="win" x="150" y="80" width="260" height="190" rx="14" fill="${色字(st.窓)}" fill-opacity="${数(st.α)}"/>
    <g clip-path="url(#${id}_c)">${基板(id, 設, 動)}<g class="${動 ? "lpa-sc" : ""}"><rect x="150" y="72" width="260" height="206" fill="url(#${id}_s)"/></g></g>
    <rect x="150" y="80" width="260" height="190" rx="14" fill="none" stroke="currentColor" stroke-width="2" filter="url(#${id}_g)"/>
    ${角}
    <g stroke="currentColor" stroke-width="2" stroke-opacity=".7">${[62, 67, 72].map(y => `<path d="M254 ${y} H306"/>`).join("")}</g>
    <g fill="currentColor" fill-opacity=".85"><rect x="164" y="276" width="9" height="4"/><rect x="177" y="276" width="9" height="4"/><rect x="190" y="276" width="9" height="4" fill-opacity=".35"/></g>
    ${計器を出す ? 計器(id, st.点, st.疲れ, 設) : ""}<g data-r="face" style="display:${考え中 ? "none" : ""}">${目(e, id, 動)}${口(m, id)}</g>${リロード(id, 設, 考え中)}${飾り(顔, id, 動)}
  </g></g></g></g>`;
  }
  // 手：指先を丸めて閉じた手。関節の細い線と、袖口
  function 手の中身(型) {
    const 袖 = `<rect x="-12" y="17" width="24" height="9" rx="3"/>`;
    const 親指 = `<rect x="-32" y="-12" width="9" height="22" rx="4.5" transform="rotate(-32 -27 -2)"/>`;
    const 指x = [-14.25, -4.75, 4.75, 14.25];
    if (型 === "fist") return `<rect x="-17" y="-14" width="34" height="32" rx="11"/>` + 指x.map(fx => `<rect x="${fx - 4}" y="-26" width="8" height="18" rx="4"/>`).join("") + `<rect x="-14" y="2" width="28" height="9" rx="4.5"/>${袖}`;
    const 長 = [27, 33, 31, 24];
    return `<rect x="-17" y="-8" width="34" height="26" rx="9"/>` + 指x.map((fx, k) => `<rect x="${fx - 3.5}" y="${-8 - 長[k]}" width="7" height="${長[k] + 4}" rx="3.5"/><path d="M${fx - 3.5} ${-8 - 長[k] * .5} H${fx + 3.5}" fill="none" stroke-opacity=".6"/>`).join("") + `<path d="M-17 4 H17" fill="none" stroke-opacity=".5"/><circle cx="0" cy="10" r="3"/>${親指}${袖}`;
  }
  const 手の変形 = (h, ox = 0, oy = 0, or = 0) => `translate(${数(h.x + ox)} ${数(h.y + oy)}) rotate(${数(h.r + or)}) scale(${数(h.s, 1)})`;
  function 手の群(i, h, id) {
    return `<g class="hand" data-r="h${i}" data-i="${i}" filter="url(#${id}_g)" transform="${手の変形(h)}"><g fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" class="inner">${手の中身(h.p)}</g></g>`;
  }
  function 手を決める(指定, 顔) {
    const 既 = 顔の手[顔];
    if (Array.isArray(指定)) {
      return [0, 1].map(i => { const h = 指定[i] || {}, d = 既[i]; return { x: 有限(h.x, d.x), y: 有限(h.y, d.y), r: 有限(h.r, d.r), s: 有限(h.s, d.s), p: (h.p === "fist" || h.p === "open") ? h.p : d.p }; });
    }
    if (指定 === "fist" || 指定 === "open") return 既.map(h => Object.assign({}, h, { p: 指定 }));
    return 既.map(h => Object.assign({}, h));
  }
  // 状態から、窓の色・透け・全体の濃さを出す
  function エルピーの色(点, 疲れ, 設定 = {}) {
    const 設 = 合成(既定設定, 設定), c = 点の色(点, 設), t = 範囲(有限(疲れ, 0), 0, 100) / 100;
    const 透 = 設.疲れ.透け, 全 = 設.疲れ.全体;
    return { 窓: c.窓, 光: c.光, α: 透[0] + (透[1] - 透[0]) * t, 濃さ: 全[0] + (全[1] - 全[0]) * t, 点: 有限(点, 0), 疲れ: t * 100 };
  }
  // エルピーを描く：状態 = { 顔, 点, 疲れ(0〜100), 手("open"|"fist"|[{x,y,r,s,p},{…}]), 考え中, 接頭辞, 動き, 明るい背景, 計器, 設定, 大きさ, 画像(true＝画像の絵), 絵の場所 }
  function エルピーを描く(状態) {
    const s0 = (状態 && typeof 状態 === "object") ? 状態 : {}, 設 = 合成(既定設定, s0.設定);
    const 点 = s0.点 === undefined ? undefined : 有限(s0.点, 0);
    let 顔 = s0.顔;
    if (!顔顔(顔)) 顔 = 点 !== undefined ? 顔の名前(点, 設) : "通常";
    const 使う点 = 点 !== undefined ? 点 : 顔の既定点[顔];
    const id = 接頭辞を整える(s0.接頭辞, "") || 次の接頭辞("e"), 動 = s0.動き !== false;
    const st = エルピーの色(使う点, s0.疲れ, s0.設定), 手s = 手を決める(s0.手, 顔), 考 = !!s0.考え中;
    const 幅 = s0.大きさ ? ` width="${数(有限(s0.大きさ, 280))}"` : "";
    if (s0.画像) {   // 画像の絵（絵/エルピー_顔.jpg）。窓の色の縁・疲れの透け・考え中のぐるぐるは、上に重ねる（エルピーを更新 も効く）
      const 場 = 逃がす(絵の場所を整える(s0.絵の場所)), 動き = !動 ? "" : (顔 === "激怒" ? "lpa-sh" : (顔 === "おどけ" || 顔 === "大喜び") ? "lpa-bo" : "lpa-fl");
      return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="0 0 560 400"${幅} role="img" aria-label="エルピー：${逃がす(顔)}" data-lp="elpie" data-face="${逃がす(顔)}" style="color:${色字(st.光)}">${共通CSS}${定義(id)}
    <defs><clipPath id="${id}_ic"><rect x="90" y="10" width="380" height="380" rx="36"/></clipPath></defs>
    <g data-r="op" style="opacity:${数(st.濃さ)}"><rect data-r="win" x="86" y="6" width="388" height="388" rx="40" fill="${色字(st.窓)}" fill-opacity="${数(st.α)}" filter="url(#${id}_g)"/>
    <g data-r="face" style="display:${考 ? "none" : ""}"><g class="${動き}"><image href="${場}エルピー_${顔}.jpg" x="90" y="10" width="380" height="380" clip-path="url(#${id}_ic)"/></g></g>
    <rect x="90" y="10" width="380" height="380" rx="36" fill="none" stroke="currentColor" stroke-width="3" stroke-opacity=".8"/>${リロード(id, 設, 考)}</g></svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" viewBox="0 0 560 400"${幅} role="img" aria-label="エルピー：${逃がす(顔)}" data-lp="elpie" data-face="${逃がす(顔)}" style="color:${色字(st.光)}">${共通CSS}${定義(id)}
    <g data-r="op" style="opacity:${数(st.濃さ)}">${窓の絵(顔, st, id, 動, 設, !!s0.明るい背景, s0.計器 !== false, 考)}${手s.map((h, i) => 手の群(i, h, id)).join("")}</g></svg>`;
  }
  function 顔顔(v) { return typeof v === "string" && 顔の部品[v] !== undefined && Object.prototype.hasOwnProperty.call(顔の部品, v); }
  // 描いたあとに、色・透け・疲れ・考え中だけを変える（動きを止めずに更新できる）
  function エルピーを更新(svg, 状態 = {}) {
    if (!svg || !svg.querySelector) return;
    const st = エルピーの色(状態.点, 状態.疲れ, 状態.設定), q = k => svg.querySelector(`[data-r="${k}"]`);
    svg.style.color = 色字(st.光);
    const w = q("win"); if (w) { w.setAttribute("fill", 色字(st.窓)); w.setAttribute("fill-opacity", 数(st.α)); }
    const b = q("bat"); if (b) b.setAttribute("width", 数(19 * 範囲(100 - st.疲れ, 0, 100) / 100));
    const m = q("mood"); if (m) m.textContent = Math.round((st.点 + 100) / 2);
    const o = q("op"); if (o) o.style.opacity = 数(st.濃さ);
    if (状態.考え中 !== undefined) { const f = q("face"), r = q("reload"); if (f) f.style.display = 状態.考え中 ? "none" : ""; if (r) r.style.display = 状態.考え中 ? "" : "none"; }
  }
  const エルピーの手の型 = 顔 => (顔顔(顔) ? 顔の手[顔] : 顔の手.通常).map(h => Object.assign({}, h));

  // ================= 人物（リラ・パーシー） =================
  const 表情の一覧 = ["ふつう", "笑顔", "真剣", "困り", "驚き"];
  const 人物の一覧 = ["リラ", "パーシー"];
  // open＝目の開き／brow＝眉の上下（正＝下）／tilt＝眉の傾き（正＝眉頭が下がる＝きつい、負＝眉頭が上がる＝困り）／口／深さ／happy＝目が笑う
  const 表情表 = {
    ふつう: { open: 1, brow: 0, tilt: 0, 口: "平", 深: 0.25, happy: 0, 頬: 0 },
    笑顔: { open: 0.85, brow: -1, tilt: -0.2, 口: "笑", 深: 1, happy: 1, 頬: 1 },
    真剣: { open: 0.78, brow: 1.5, tilt: 1, 口: "平", 深: -0.1, happy: 0, 頬: 0 },
    困り: { open: 1, brow: -1, tilt: -1, 口: "波", 深: 0, happy: 0, 頬: 0.6 },
    驚き: { open: 1.3, brow: -4, tilt: -0.1, 口: "丸", 深: 1, happy: 0, 頬: 0 },
  };
  const 人物の定義 = id => `<defs>
    <filter id="${id}_gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="${id}_hz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#17191D"/><rect width="6" height="12" fill="#F2C230"/></pattern>
    <linearGradient id="${id}_tip" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="190"><stop offset="0" stop-color="#C2C7D0"/><stop offset=".45" stop-color="#E9C9A8"/><stop offset="1" stop-color="#FFA24A"/></linearGradient>
  </defs>`;

  function パーシーを描く(表情, id, 動) {
    const E = 表情表[表情] || 表情表.ふつう, k = 0.4;                        // 顔がほとんど動かない：変化を 4 割に弱める
    const 肌 = "#9BA4A9", 影 = "#838C92", 黒 = "#181B20", 水 = "#7FE6F5", 暗 = "#101318";
    const bl = 動 ? ' class="lpa-bk2"' : "", gl = 動 ? ' class="lpa-gl"' : "";
    const 開 = 1 + (E.open - 1) * k * 1.4, 眉y = 72 + E.brow * k, 傾 = E.tilt * 3 * (0.6 + k);
    const 目 = [87, 113].map((cx, i) => {
      const 内 = i === 0 ? 1 : -1;
      if (E.happy) return `<path d="M${cx - 6} 85 Q${cx} 80 ${cx + 6} 85" fill="none" stroke="${暗}" stroke-width="2.4" stroke-linecap="round"/>`;
      return `<g${bl}><ellipse cx="${cx}" cy="84" rx="6" ry="${数(4.4 * 開)}" fill="${暗}"/><circle cx="${数(cx + 1.6 * 内 * -1)}" cy="${数(83 - 0.6)}" r="1.7" fill="${水}" filter="url(#${id}_gl)"/></g>`;
    }).join("");
    const 眉 = [87, 113].map((cx, i) => { const 内 = i === 0 ? 1 : -1, x1 = cx - 8 * 内, x2 = cx + 8 * 内;
      return `<path d="M${数(x1)} ${数(眉y - 傾)} L${数(x2)} ${数(眉y + 傾)}" stroke="${黒}" stroke-width="2.6" stroke-linecap="round"/>`; }).join("");
    const 深 = E.深 * k * 5;
    let 口 = `<path d="M92 108 H108" stroke="#3B434A" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    if (E.口 === "笑") 口 = `<path d="M91 107 Q100 ${数(107 + 深 * 1.6)} 109 107" stroke="#3B434A" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    else if (E.口 === "平" && E.深 < 0) 口 = `<path d="M92 109 Q100 ${数(109 + E.深 * 6)} 108 109" stroke="#3B434A" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    else if (E.口 === "波") 口 = `<path d="M91 108 q4.5 -2.4 9 0 t9 0" stroke="#3B434A" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    else if (E.口 === "丸") 口 = `<ellipse cx="100" cy="108" rx="3.2" ry="${数(3.4 + 深 * 0.3)}" fill="${暗}"/>`;
    const 腕の黒 = `fill="#1D2026" stroke="#0C0E11" stroke-width="1.4"`;
    return `<g class="${動 ? "lpa-br" : ""}">
      <path d="M40 270 L46 214 L54 170 Q60 158 84 150 L116 150 Q140 158 146 170 L154 214 L160 270Z" fill="#1D2026" stroke="#0C0E11" stroke-width="1.4"/>
      <rect x="88" y="112" width="24" height="42" fill="${影}"/>
      <path d="M20 270 L14 198 Q14 168 46 160 L60 156 L58 206 L50 270Z" ${腕の黒}/>
      <path d="M180 270 L186 198 Q186 168 154 160 L140 156 L142 206 L150 270Z" ${腕の黒}/>
      <rect x="22" y="204" width="34" height="12" fill="url(#${id}_hz)" transform="skewY(0)"/><rect x="144" y="204" width="34" height="12" fill="url(#${id}_hz)"/>
      <path d="M22 214 L52 270 L28 270 Z" fill="${肌}" opacity="0"/>
      <rect x="24" y="216" width="26" height="54" rx="6" fill="${肌}"/><rect x="24" y="216" width="26" height="8" fill="#14161A" opacity=".35"/>
      <g><rect x="150" y="216" width="26" height="54" rx="5" fill="#7D8892" stroke="#4B545C" stroke-width="1.4"/><rect x="150" y="216" width="26" height="9" fill="#555E66"/><path d="M152 232 H174 M152 256 H174" stroke="#4B545C" stroke-width="1.6"/><rect x="156" y="238" width="14" height="10" rx="2" fill="#A9B4BC" stroke="#4B545C" stroke-width="1"/><circle cx="163" cy="243" r="2" fill="${水}" filter="url(#${id}_gl)"/></g>
      <rect x="21" y="249" width="32" height="6" rx="3" fill="${水}" filter="url(#${id}_gl)"${gl}/><rect x="147" y="249" width="32" height="6" rx="3" fill="${水}" filter="url(#${id}_gl)"${gl}/>
      <path d="M58 270 L58 214 Q60 196 84 190 L116 190 Q140 196 142 214 L142 270Z" fill="#14161A"/>
      <path d="M58 226 H142 V246 H58Z" fill="url(#${id}_hz)"/><path d="M58 226 H142 M58 246 H142" stroke="#0C0E11" stroke-width="1.2"/>
      <path d="M100 160 V226" stroke="#2C3139" stroke-width="2"/>
      <path d="M84 148 L100 176 L116 148 L128 150 L118 190 L100 184 L82 190 L72 150Z" fill="#262B32" stroke="#0C0E11" stroke-width="1.2"/>
      <path d="M84 148 L100 176 L116 148" fill="none" stroke="#3A414A" stroke-width="1.6"/>
      <path d="M81 147 Q100 160 119 147" fill="none" stroke="${水}" stroke-width="3.6" stroke-linecap="round" filter="url(#${id}_gl)"${gl}/>
      <path d="M72 70 Q72 44 100 44 Q128 44 128 70 L128 92 Q128 120 100 126 Q72 120 72 92Z" fill="${肌}"/>
      <path d="M100 126 Q128 120 128 92 L128 84 Q120 112 100 118 Q80 112 72 84 L72 92 Q72 120 100 126Z" fill="${影}" opacity=".55"/>
      <circle cx="71" cy="86" r="5.5" fill="${影}"/><circle cx="129" cy="86" r="5.5" fill="${影}"/>
      <path d="M71 83 v6" stroke="${水}" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>
      <path d="M76 100 L82 111 H90" fill="none" stroke="${水}" stroke-width="1.2" opacity=".55"/>
      <path d="M100 88 L97 99 H101" fill="none" stroke="${影}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${眉}${目}${口}
      <path d="M71 80 Q66 40 100 36 Q134 40 129 80 Q127 62 116 57 Q104 63 90 55 Q76 62 71 80Z" fill="${黒}"/>
      <path d="M95 38 Q108 46 107 62 L101 60 Q102 50 92 42Z" fill="${水}" filter="url(#${id}_gl)"${gl}/>
    </g>`;
  }

  function リラを描く(表情, id, 動) {
    const E = 表情表[表情] || 表情表.ふつう;
    const 肌 = "#EBD8CC", 影 = "#D6B9A8", 髪 = "#B8BDC8", 髪影 = "#9AA0AD", 黒 = "#1E2126", 橙 = "#F28A3C", 橙影 = "#D2661F", 暗 = "#2A2E36";
    const bl = 動 ? ' class="lpa-bk"' : "", gl = 動 ? ' class="lpa-gl"' : "";
    const 開 = E.open, 眉y = 91 + E.brow, 傾 = E.tilt * 4;
    const 目 = [86, 114].map((cx, i) => {
      const 内 = i === 0 ? 1 : -1;
      if (E.happy) return `<path d="M${cx - 10} 114 Q${cx} 102 ${cx + 10} 114" fill="none" stroke="${暗}" stroke-width="3.4" stroke-linecap="round"/>`;
      const ry = 12 * 開, 虹 = 表情 === "驚き" ? 6.2 : 7.8, ox = (表情 === "困り" ? 1.6 : 0) * 内;
      return `<g${bl}><ellipse cx="${cx}" cy="112" rx="10.5" ry="${数(ry)}" fill="#FFFFFF"/>
        <ellipse cx="${数(cx + ox)}" cy="${数(113 + (表情 === "真剣" ? -0.5 : 0))}" rx="${数(虹)}" ry="${数(Math.min(虹 * 1.25, ry - 0.5))}" fill="#E8913A"/>
        <ellipse cx="${数(cx + ox)}" cy="${数(113.5)}" rx="${数(虹 * 0.5)}" ry="${数(Math.min(虹 * 0.7, ry - 1.5))}" fill="${暗}"/>
        <circle cx="${数(cx + ox - 2.6)}" cy="${数(109)}" r="2.2" fill="#FFFFFF"/><circle cx="${数(cx + ox + 2.6)}" cy="${数(116)}" r="1.1" fill="#FFFFFF"/>
        <path d="M${cx - 11} ${数(112 - ry * 0.55)} Q${cx} ${数(112 - ry - 2)} ${cx + 11} ${数(112 - ry * 0.55)}" fill="none" stroke="${暗}" stroke-width="2.4" stroke-linecap="round"/></g>`;
    }).join("");
    const 眉 = [86, 114].map((cx, i) => { const 内 = i === 0 ? 1 : -1;
      return `<path d="M${数(cx - 9 * 内)} ${数(眉y - 傾)} Q${数(cx - 0 * 内)} ${数(眉y - 3)} ${数(cx + 8 * 内)} ${数(眉y + 傾)}" fill="none" stroke="${髪影}" stroke-width="2.4" stroke-linecap="round"/>`; }).join("");
    let 口 = `<path d="M94 133 Q100 ${数(133 + 3 * E.深 + 1)} 106 133" stroke="#9A5548" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    if (E.口 === "笑") 口 = `<path d="M90 131 Q100 ${数(131 + 12 * E.深)} 110 131 Z" fill="#8E3B3B" stroke="#8E3B3B" stroke-width="1.6" stroke-linejoin="round"/><path d="M93 135.5 Q100 139 107 135.5" fill="#F08A7E" stroke="none"/>`;
    else if (E.口 === "平" && E.深 < 0) 口 = `<path d="M94 134 H106" stroke="#9A5548" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    else if (E.口 === "波") 口 = `<path d="M92 134 q4 -3 8 0 t8 0" stroke="#9A5548" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    else if (E.口 === "丸") 口 = `<ellipse cx="100" cy="134" rx="4.4" ry="5.4" fill="#8E3B3B"/>`;
    const 頬 = E.頬 ? `<ellipse cx="76" cy="124" rx="7" ry="4" fill="${橙}" opacity="${数(0.28 * E.頬)}"/><ellipse cx="124" cy="124" rx="7" ry="4" fill="${橙}" opacity="${数(0.28 * E.頬)}"/>` : "";
    const 汗 = 表情 === "困り" ? `<path d="M133 92 Q137 99 133 103 Q129 99 133 92Z" fill="#9FE3F5" stroke="#6FB9CF" stroke-width="1"/>` : "";
    const 先光 = (動 ? `<g class="lpa-gl">` : `<g>`) + `<path d="M62 160 Q56 176 60 188 L74 188 L74 164Z M138 160 L126 164 L126 188 L140 188 Q144 176 138 160Z" fill="#FF9A3E" opacity=".55" filter="url(#${id}_gl)"/></g>`;
    return `<g class="${動 ? "lpa-br" : ""}">
      <path d="M62 100 Q58 66 100 62 Q142 66 138 100 L144 158 Q146 184 130 188 L70 188 Q54 184 56 158Z" fill="url(#${id}_tip)"/>${先光}
      <path d="M52 270 L44 222 Q42 192 70 184 L90 178 L110 178 L130 184 Q158 192 156 222 L148 270Z" fill="${黒}" stroke="#0C0E11" stroke-width="1.4"/>
      <path d="M34 270 L36 222 Q36 192 66 184 L70 190 L62 222 L58 270Z" fill="${黒}" stroke="#0C0E11" stroke-width="1.4"/>
      <path d="M166 270 L164 222 Q164 192 134 184 L130 190 L138 222 L142 270Z" fill="${黒}" stroke="#0C0E11" stroke-width="1.4"/>
      <path d="M38 226 Q37 208 44 200 L62 206 L58 232 Z" fill="${黒}"/><path d="M162 226 Q163 208 156 200 L138 206 L142 232Z" fill="${黒}"/>
      <path d="M35 218 L61 226 L60 236 L35 229Z" fill="#363B44" stroke="#0C0E11" stroke-width="1.2"/><path d="M165 218 L139 226 L140 236 L165 229Z" fill="#363B44" stroke="#0C0E11" stroke-width="1.2"/>
      <rect x="39" y="232" width="18" height="38" rx="5" fill="${肌}"/><rect x="143" y="232" width="18" height="38" rx="5" fill="${肌}"/>
      <rect x="38" y="248" width="20" height="5" rx="2.5" fill="${橙}" filter="url(#${id}_gl)"${gl}/><rect x="142" y="248" width="20" height="5" rx="2.5" fill="${橙}" filter="url(#${id}_gl)"${gl}/>
      <rect x="92.5" y="138" width="15" height="32" rx="3" fill="${影}"/>
      <path d="M70 186 L100 214 L130 186" fill="none" stroke="#3A404A" stroke-width="2"/><path d="M100 214 V270" stroke="#2D323A" stroke-width="2"/>
      <path d="M52 242 H148 V256 H52Z" fill="#55422E" stroke="#2A2118" stroke-width="1.2"/><rect x="94" y="240" width="12" height="18" rx="2" fill="#C9A24A" stroke="#7A5C1E" stroke-width="1"/>
      <rect x="58" y="252" width="22" height="18" rx="3" fill="#6A5238" stroke="#2A2118" stroke-width="1.2"/><rect x="120" y="252" width="22" height="18" rx="3" fill="#6A5238" stroke="#2A2118" stroke-width="1.2"/>
      <path d="M126 236 L138 214 L142 218 L132 240Z" fill="#B8BEC6" stroke="#6E747C" stroke-width="1"/><circle cx="140" cy="214" r="4.2" fill="none" stroke="#B8BEC6" stroke-width="2.2"/>
      <path d="M74 168 Q100 190 126 168 L130 178 Q100 202 70 178Z" fill="${橙}"/><path d="M74 168 Q100 190 126 168" fill="none" stroke="${橙影}" stroke-width="1.4"/>
      <path d="M84 182 L72 214 L84 210 L92 188Z" fill="${橙}"/><path d="M84 182 L72 214" stroke="${橙影}" stroke-width="1.4" fill="none"/>
      <path d="M68 104 Q68 78 100 76 Q132 78 132 104 Q132 136 100 146 Q68 136 68 104Z" fill="${肌}"/>
      <path d="M100 146 Q132 136 132 104 Q128 130 100 138 Q72 130 68 104 Q68 136 100 146Z" fill="${影}" opacity=".5"/>
      <circle cx="67" cy="112" r="4.4" fill="${影}"/><circle cx="133" cy="112" r="4.4" fill="${影}"/>
      ${頬}${眉}${目}<path d="M100 121 L98.5 126 H101.5" fill="none" stroke="${影}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${口}${汗}
      <path d="M64 108 Q60 70 100 64 Q140 70 136 108 Q134 92 128 86 Q112 96 96 82 Q84 92 72 90 Q66 96 64 108Z" fill="${髪}"/>
      <path d="M96 82 Q112 96 128 86" fill="none" stroke="${髪影}" stroke-width="1.4"/><path d="M80 72 Q96 66 110 70" fill="none" stroke="#DADEE6" stroke-width="2" stroke-linecap="round" opacity=".8"/>
      <path d="M64 108 Q56 150 60 176 L74 178 Q70 150 74 118Z" fill="url(#${id}_tip)"/><path d="M136 108 Q144 150 140 176 L126 178 Q130 150 126 118Z" fill="url(#${id}_tip)"/>
    </g>`;
  }

  // 人物を描く(名前, 表情, 設定)：設定 = { 接頭辞, 動き, 大きさ(横幅px), 画像(既定 true＝画像の絵／false＝コードの絵), 絵の場所 }。胸から上。viewBox は 0 0 200 270
  function 人物の中身(名前, 表情, 設定) {
    const s = (設定 && typeof 設定 === "object") ? 設定 : {};
    const 名 = 人物の一覧.indexOf(名前) >= 0 ? 名前 : "リラ", 情 = 表情の一覧.indexOf(表情) >= 0 ? 表情 : "ふつう";
    const id = 接頭辞を整える(s.接頭辞, "") || 次の接頭辞("c"), 動 = s.動き !== false;
    if (s.画像 !== false) {
      const 場 = 逃がす(絵の場所を整える(s.絵の場所));
      return { id, 名, 情, 動, 絵: `<g class="${動 ? "lpa-br" : ""}"><image href="${場}${名}_${情}.jpg" x="-4" y="-4" width="208" height="278" preserveAspectRatio="xMidYMin slice"/></g>` };
    }
    return { id, 名, 情, 動, 絵: 人物の定義(id) + (名 === "パーシー" ? パーシーを描く(情, id, 動) : リラを描く(情, id, 動)) };
  }
  function 人物を描く(名前, 表情, 設定 = {}) {
    const p = 人物の中身(名前, 表情, 設定), 幅 = (設定 && 設定.大きさ) ? ` width="${数(有限(設定.大きさ, 240))}"` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${p.id}" viewBox="0 0 200 270"${幅} role="img" aria-label="${逃がす(p.名)}（${逃がす(p.情)}）" data-lp="person" data-name="${逃がす(p.名)}" data-face="${逃がす(p.情)}">${共通CSS}${p.絵}</svg>`;
  }
  // 通信の枠：視界の端に開く小さな枠。胸から上だけ、走査線、名前の札。リラは橙、パーシーは水色の縁
  function 通信の枠を描く(名前, 表情, 設定 = {}) {
    const p = 人物の中身(名前, 表情, 設定), 橙か = p.名 === "リラ", 色 = 橙か ? "#FF9A3E" : "#6FE3F5", id = p.id;
    const 幅 = (設定 && 設定.大きさ) ? ` width="${数(有限(設定.大きさ, 240))}"` : "";
    const 点滅 = p.動 ? `<animate attributeName="opacity" values="1;1;.25;1" keyTimes="0;.6;.8;1" dur="1.8s" repeatCount="indefinite"/>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}_f" viewBox="0 0 240 330"${幅} role="img" aria-label="通信：${逃がす(p.名)}（${逃がす(p.情)}）" data-lp="comms" data-name="${逃がす(p.名)}" data-face="${逃がす(p.情)}">${共通CSS}
    <defs><linearGradient id="${id}_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2A3C"/><stop offset="1" stop-color="#0D1520"/></linearGradient>
    <pattern id="${id}_sl" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1.4" fill="#000" fill-opacity=".22"/></pattern>
    <clipPath id="${id}_cl"><rect x="10" y="40" width="220" height="280" rx="8"/></clipPath></defs>
    <rect x="3" y="3" width="234" height="324" rx="14" fill="${色}" fill-opacity=".08" stroke="${色}" stroke-opacity=".75" stroke-width="2"/>
    <rect x="10" y="10" width="220" height="26" rx="7" fill="${色}" fill-opacity=".16"/>
    <circle cx="26" cy="23" r="4.5" fill="${色}">${点滅}</circle>
    <text x="38" y="28" font-size="14" font-weight="700" fill="${色}" font-family="'BIZ UDPGothic','Noto Sans JP','Hiragino Sans',sans-serif">通信　${逃がす(p.名)}</text>
    <rect x="10" y="40" width="220" height="280" rx="8" fill="url(#${id}_bg)"/>
    <g clip-path="url(#${id}_cl)"><svg x="20" y="46" width="200" height="270" viewBox="0 0 200 270" overflow="hidden">${p.絵}</svg>
    <rect x="10" y="40" width="220" height="280" fill="url(#${id}_sl)"/></g>
    <rect x="10" y="40" width="220" height="280" rx="8" fill="none" stroke="${色}" stroke-opacity=".5" stroke-width="1.2"/>
    <path d="M14 58 V46 Q14 44 16 44 H28 M226 58 V46 Q226 44 224 44 H212 M14 302 V314 Q14 316 16 316 H28 M226 302 V314 Q226 316 224 316 H212" fill="none" stroke="${色}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  }

  const 公開 = { エルピーを描く, エルピーを更新, エルピーの色, エルピーの手の型, エルピーの手の中身: 手の中身, エルピーの手の変形: 手の変形, エルピーの顔: エルピーの顔.slice(), 人物を描く, 通信の枠を描く, 表情の一覧: 表情の一覧.slice(), 人物の一覧: 人物の一覧.slice(), 顔の名前 };
  if (typeof module !== "undefined" && module.exports) module.exports = 公開; else root.LifePilotArt人物 = 公開;
})(typeof self !== "undefined" ? self : this);
