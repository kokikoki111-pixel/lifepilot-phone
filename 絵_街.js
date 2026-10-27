// LifePilot の街の絵（マザーボードの街 ルミナ・パレス）。街を描く＝コードだけで描く動く SVG。絵の街を描く＝画像AIの絵（絵/街.jpg）に印を重ねる。外部ライブラリは使わない。
// core.js の 街を描く(様) と同じ入力・同じ「押せる地区」の決まり（.地区 の data-k）。置き換えて使える。
// 入力 様：明るさ 灯籠[点,総] 霧 塔 鐘 池 図書館 遊歩道 楼閣 灯台(true/false/null) 鍛錬場([今週,目標]かnull)
(function (root) {
  const 安 = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const 数 = (v, 下, 上, 既 = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(下, Math.min(上, n)) : 既; };
  const 整 = (v, 下, 上) => Math.round(数(v, 下, 上, 下));
  const 混ぜ色 = (a, b, t) => "#" + [0, 2, 4].map(i => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - t) + parseInt(b.substr(1 + i, 2), 16) * t).toString(16).padStart(2, "0")).join("");
  const f = v => (Math.round(v * 100) / 100).toString();
  const 金 = "#d4a63a", 板 = "#0d3b2a", 銅 = "#1f7a54";

  // 動き（CSS。動きを減らす設定では止める）。class "m" が付いた物だけが動く
  const 型 = `<style>
.lp-m{animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes lp-flow{to{stroke-dashoffset:-50}}
@keyframes lp-fan{to{transform:rotate(360deg)}}
@keyframes lp-flick{0%,100%{opacity:1}18%{opacity:.55}35%{opacity:.95}58%{opacity:.7}80%{opacity:1}}
@keyframes lp-drift{0%,100%{transform:translateX(-7px)}50%{transform:translateX(9px)}}
@keyframes lp-ring{0%,100%{transform:rotate(-17deg)}50%{transform:rotate(17deg)}}
@keyframes lp-sweep{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(16deg)}}
@keyframes lp-blink{0%,100%{opacity:1}50%{opacity:.15}}
@keyframes lp-wave{0%{opacity:0}30%{opacity:.9}100%{opacity:0}}
@keyframes lp-rise{0%{transform:translateY(0);opacity:0}20%{opacity:.8}100%{transform:translateY(-16px);opacity:0}}
@keyframes lp-expand{0%{transform:scale(.5);opacity:.9}100%{transform:scale(1.9);opacity:0}}
.lp-地区:focus{outline:none}.lp-地区:focus-visible .lp-枠,.lp-地区:hover .lp-枠{opacity:1}
@media (prefers-reduced-motion: reduce){.lp-m{animation:none!important}}
</style>`;

  function 街を描く(様) {
    様 = 様 || {};
    const 明 = 数(様.明るさ, 0.15, 1, 0.5), 霧 = 数(様.霧, 0, 1), 池 = 数(様.池, 0, 1);
    const 灯総 = 整((様.灯籠 || [0, 12])[1], 0, 24), 灯点 = 整((様.灯籠 || [0, 12])[0], 0, 灯総);
    const 塔 = 整(様.塔, 0, 4), 鐘 = 数(様.鐘, 0, 1e6) > 0, 本数 = 整(様.図書館, 0, 6), 窓数 = 整(様.遊歩道, 0, 6), 映数 = 整(様.楼閣, 0, 6);
    const 灯台 = 様.灯台 === true ? true : 様.灯台 === false ? false : null;
    const 鍛 = Array.isArray(様.鍛錬場) ? [整(様.鍛錬場[0], 0, 99), 整(様.鍛錬場[1], 0, 14)] : null;
    const 速 = (3.8 - 2.6 * 明), 流 = (0.3 + 0.7 * 明).toFixed(2), 道 = (0.35 + 0.55 * 明).toFixed(2);
    const 動 = (名, 秒, 遅 = 0, 余 = "") => `class="lp-m" style="animation-name:${名};animation-duration:${f(秒)}s;animation-delay:${f(遅)}s;${余}"`;
    const 原 = (x, y) => `transform-origin:${x}px ${y}px;`;

    // 名札（短い名前＋部品名）。幅は、全角 16、半角 9 で見積もる
    const 札 = (名, x, y) => { const w = [...名].reduce((s, c) => s + (c.charCodeAt(0) > 255 ? 16 : 9.5), 0) + 16;
      return `<rect x="${f(x - w / 2)}" y="${y - 15}" width="${f(w)}" height="21" rx="10" fill="#04140d" fill-opacity=".78" stroke="#7fd1a8" stroke-opacity=".5"/><text x="${x}" y="${y}" text-anchor="middle" font-size="16" font-weight="700" fill="#eaf6ee">${安(名)}</text>`; };
    // 押せる地区。当たり判定の見えない四角を付ける（スマホで押しやすいように大きめ）
    const 地区 = (k, 名, 札x, 札y, 当, 中) => `<g class="地区 lp-地区" data-k="${k}" tabindex="0" role="button" aria-label="${安(名)}" style="cursor:pointer;-webkit-tap-highlight-color:transparent"><rect x="${当[0]}" y="${当[1]}" width="${当[2]}" height="${当[3]}" rx="8" fill="#7fd1a8" fill-opacity="0" stroke="#fff3a0" stroke-width="2" opacity="0" class="lp-枠"/>${中}${札(名.split(" ").length > 3 ? 名.split(" ")[0] + " " + 名.split(" ")[3] : 名.split(" ")[0], 札x, 札y)}</g>`;

    // ---- 基板：緑のレジスト、にじんだ質感、銅の飾り配線、ビア、穴、シルク文字 ----
    let 乱 = 20261026; const 乱数 = () => (乱 = (乱 * 1664525 + 1013904223) % 4294967296) / 4294967296;
    let 飾 = "", ビア = "";
    for (let i = 0; i < 34; i++) {
      let x = 20 + Math.floor(乱数() * 30) * 20, y = 20 + Math.floor(乱数() * 20) * 20, d = `M${x} ${y}`;
      for (let j = 0; j < 3; j++) { const 長 = 20 + Math.floor(乱数() * 4) * 20, 向 = Math.floor(乱数() * 4);
        if (向 === 0) x += 長; else if (向 === 1) x -= 長; else if (向 === 2) { x += 長 / 2; y += 長 / 2; } else y += 長; d += `L${x} ${y}`; }
      飾 += `<path d="${d}"/>`; ビア += `<circle cx="${x}" cy="${y}" r="3"/>`;
    }
    const 穴の角 = [[14, 14], [626, 14], [14, 426], [626, 426]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#06140e" stroke="#c9ccc4" stroke-width="2.5"/><circle cx="${x}" cy="${y}" r="3" fill="#000" opacity=".6"/>`).join("");
    const 基板 = `<rect width="640" height="440" fill="url(#lp土)"/><rect width="640" height="440" filter="url(#lp砂)" opacity=".5"/><rect width="640" height="440" fill="url(#lp格)"/>
<g stroke="${銅}" stroke-width="2.4" fill="none" opacity=".55" stroke-linejoin="round">${飾}</g><g fill="#0d3b2a" stroke="#3aa377" stroke-width="1.5" opacity=".8">${ビア}</g>${穴の角}
<text x="600" y="432" text-anchor="end" font-size="8" fill="#cfe9d8" opacity=".3" letter-spacing="1.5">LUMINA PALACE REV 1.0</text>`;

    // ---- 金の道（配線）と、電気の流れ。明るいほど、本数が多く速く流れる ----
    const 線 = [
      ["M240 334V306L262 284V235H268", 1], ["M320 161V90", 1], ["M374 190H396V182", 1], ["M374 238H428L450 258H460", 1],
      ["M345 273V300L368 322H418L440 340", 2], ["M266 215H172", 1], ["M545 250H565V165", 2], ["M320 273V300", 3]
    ].concat(鍛 ? [["M158 82H214L280 148V161", 2]] : []);
    const 流す本数 = Math.round(3 + 明 * (線.length - 3));
    const 道筋 = 線.map(([d]) => `<path d="${d}" stroke="#06140e" stroke-width="7" fill="none" stroke-linejoin="round"/><path d="${d}" stroke="${金}" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="${道}"/>`).join("")
      + 線.map(([d], i) => i < 流す本数 ? `<path d="${d}" stroke="#fff6c8" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="6 44" opacity="${流}" ${動("lp-flow", 速 * (0.8 + (i % 3) * 0.25), -i * 0.6)}/>` : "").join("")
      + 線.map(([d]) => { const m = /M(\d+) (\d+)/.exec(d); return `<circle cx="${m[1]}" cy="${m[2]}" r="4" fill="${板}" stroke="${金}" stroke-width="2"/>`; }).join("");

    // ---- 港：電源（24ピンのコネクタ）と灯籠の桟橋 ----
    const ピン = Array.from({ length: 12 }, (_, i) => `<rect x="${48 + i * 17.5}" y="339" width="9" height="6" fill="${金}"/><rect x="${48 + i * 17.5}" y="349" width="9" height="6" fill="${金}"/>`).join("");
    const 灯籠 = Array.from({ length: 灯総 }, (_, i) => { const x = 灯総 === 1 ? 150 : 56 + i * (188 / (灯総 - 1)), 点 = i < 灯点;
      return `<line x1="${f(x)}" y1="334" x2="${f(x)}" y2="321" stroke="#9c8a6a" stroke-width="2"/>` + (点
        ? `<g ${動("lp-flick", 1.3 + (i % 4) * 0.35, -i * 0.37)}><circle cx="${f(x)}" cy="315" r="11" fill="#ffd36b" opacity=".28"/><circle cx="${f(x)}" cy="315" r="6" fill="#ffd36b" stroke="#fff1c4" stroke-width="1.5" filter="url(#lp光)"/></g>`
        : `<circle cx="${f(x)}" cy="315" r="5.5" fill="#26332c" stroke="#56665c" stroke-width="1.5"/>`); }).join("");
    const 港 = 地区("港", "港 Lantern Pier PSU", 150, 378, [30, 296, 240, 90], `<rect x="38" y="332" width="224" height="30" rx="3" fill="#d9d4c0" stroke="#8d8772" stroke-width="2"/><rect x="42" y="335" width="216" height="24" fill="#2a2a28"/>${ピン}<rect x="38" y="332" width="12" height="8" fill="#b8b29a"/>${灯籠}`);

    // ---- 広場：CPU ソケット、塔、VRM（コンデンサ・コイル） ----
    const 面 = [0, 1, 2, 3].map(i => { const x = 299 + 11 * i;
      return i < 塔
        ? `<rect x="${x}" y="150" width="9" height="76" fill="#140d0d" stroke="#ff4a3a" stroke-width="1.5"/><path d="M${x + 1} 170l7 8m0-8l-7 8m0 22l7 8m0-8l-7 8" stroke="#ff4a3a" stroke-width="1.2"/><rect x="${x}" y="150" width="9" height="76" fill="#ff4a3a" ${動("lp-blink", 1.4, i * 0.2)} opacity=".25"/>`
        : `<rect x="${x}" y="150" width="9" height="76" fill="#9fe3c4" opacity="${(0.35 + 0.6 * 明).toFixed(2)}"/><line x1="${x + 4.5}" y1="153" x2="${x + 4.5}" y2="224" stroke="#effff6" stroke-width="3" stroke-dasharray="3 9" opacity=".85" ${動("lp-flow", 1.6 + i * 0.3, -i * 0.4)}/>`; }).join("");
    const 缶 = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#1a1d22" stroke="#6b7480" stroke-width="1.5"/><path d="M${x - 4} ${y}h8M${x} ${y - 4}v8" stroke="#a9b3bd" stroke-width="1" opacity=".7"/>`;
    const コイル = (x, y) => `<rect x="${x - 7}" y="${y - 6}" width="14" height="12" rx="2" fill="#2b2f33" stroke="#b9a06a" stroke-width="1.5"/>`;
    const 広場 = 地区("広場", "広場 Link Plaza CPU", 320, 292, [196, 120, 190, 154], `<rect x="262" y="157" width="116" height="116" rx="7" fill="#15241d" stroke="#aab4ae" stroke-width="3" opacity=".95"/><rect x="266" y="161" width="108" height="108" fill="url(#lp針)" opacity=".9"/><rect x="276" y="171" width="88" height="88" rx="3" fill="#aeb8b2" opacity=".28" stroke="#d6dcd8" stroke-opacity=".5"/><circle cx="320" cy="215" r="${f(48 + 6 * 明)}" fill="${金}" opacity="${f(0.05 + 0.12 * 明)}"/>${缶(214, 160)}${缶(214, 180)}${缶(214, 200)}${コイル(236, 160)}${コイル(236, 180)}${コイル(236, 200)}${缶(282, 140)}${缶(300, 140)}${缶(340, 140)}${缶(358, 140)}<rect x="296" y="146" width="48" height="84" rx="2" fill="#0c1a14" stroke="#7fb89c"/>${面}<rect x="294" y="140" width="52" height="8" rx="2" fill="#3d6b55"/><rect x="374" y="168" width="8" height="52" rx="3" fill="#c3c9c5"/>`);

    // ---- 鐘楼：広場と穴のあいだ。鳴る時は、鐘が振れて輪が広がる ----
    const 鐘の形 = c => `<path d="M386 143a9 9 0 0 1 18 0v8h4v4h-26v-4h4z" fill="${c}" stroke="#1d2b24" stroke-width="1.2"/><circle cx="395" cy="158" r="2.4" fill="#2a1d14"/>`;
    const 鐘楼 = 地区("鐘楼", "鐘楼", 412, 205, [378, 112, 70, 98], `<rect x="387" y="160" width="16" height="24" fill="#3b5a4c" stroke="#7fb89c" stroke-width="1"/><rect x="383" y="126" width="24" height="5" fill="#4a6d5d"/><path d="M386 126l9-12l9 12z" fill="#4a6d5d"/>${鐘
      ? `<g ${動("lp-ring", 0.7, 0, 原(395, 131))}>${鐘の形("#ff7a68")}</g><circle cx="395" cy="148" r="12" fill="none" stroke="#ff6b5b" stroke-width="2" ${動("lp-expand", 1.3, 0, 原(395, 148))}/><circle cx="395" cy="148" r="12" fill="none" stroke="#ff6b5b" stroke-width="2" ${動("lp-expand", 1.3, -0.65, 原(395, 148))}/><circle cx="395" cy="148" r="26" fill="#ff6b5b" ${動("lp-blink", 0.7)} opacity=".12"/>`
      : 鐘の形("#8a9a90")}`);

    // ---- 楼閣：GPU カード。ファン2つと、色つきの画面 ----
    const 羽 = (cx, cy, r) => Array.from({ length: 7 }, (_, i) => `<ellipse cx="${cx}" cy="${cy - r * 0.55}" rx="${f(r * 0.2)}" ry="${f(r * 0.45)}" transform="rotate(${f(i * 360 / 7)} ${cx} ${cy})" fill="#9aa6ae"/>`).join("");
    const ファン = (cx, cy, 秒) => `<circle cx="${cx}" cy="${cy}" r="16" fill="#111418" stroke="#59626b" stroke-width="2"/><g ${動("lp-fan", 秒, 0, 原(cx, cy))}>${羽(cx, cy, 14)}</g><circle cx="${cx}" cy="${cy}" r="3.5" fill="#2c3238"/>`;
    const 映色 = ["#ff5fa2", "#5fd0ff", "#ffd35f", "#8dff7a", "#c58bff", "#ff9a5f"], 秒羽 = 2.6 - 映数 * 0.28;
    const 映像 = Array.from({ length: 6 }, (_, i) => { const x = 466 + 26 * (i % 3), y = 252 + 17 * Math.floor(i / 3);
      return i < 映数 ? `<rect x="${x}" y="${y}" width="22" height="13" rx="1.5" fill="${映色[i]}" ${動("lp-flick", 1.8 + i * 0.3, -i * 0.5)}/>` : `<rect x="${x}" y="${y}" width="22" height="13" rx="1.5" fill="#1d1830" stroke="#3a3158"/>`; }).join("");
    const 指 = Array.from({ length: 9 }, (_, i) => `<rect x="${464 + i * 9}" y="290" width="6" height="7" fill="${金}"/>`).join("");
    const 楼閣 = 地区("楼閣", "楼閣 Loud Pavilion GPU", 505, 318, [452, 200, 106, 126], `<rect x="458" y="206" width="94" height="84" rx="5" fill="#2b2340" stroke="#7a68b0" stroke-width="2"/>${指}${ファン(484, 228, 秒羽)}${ファン(528, 228, 秒羽)}${映像}`);

    // ---- 穴：RAM スロット（4本）の上に、螺旋の竪穴と霧 ----
    const 溝 = Array.from({ length: 4 }, (_, i) => `<rect x="394" y="${338 + i * 13}" width="132" height="9" rx="2" fill="#0a1510" stroke="#4a5d54"/><rect x="398" y="${340 + i * 13}" width="124" height="2.5" fill="${金}" opacity=".7"/><rect x="388" y="${337 + i * 13}" width="7" height="11" rx="1" fill="#c9ccc4"/><rect x="525" y="${337 + i * 13}" width="7" height="11" rx="1" fill="#c9ccc4"/>`).join("");
    let 渦 = ""; for (let t = 0; t <= 12.6; t += 0.3) { const r = 1 - t / 14; 渦 += (t === 0 ? "M" : "L") + f(460 + Math.cos(t) * 50 * r) + " " + f(362 + Math.sin(t) * 19 * r); }
    const 霧玉 = [[430, 352, 36, 14], [478, 358, 44, 17], [452, 372, 40, 13], [500, 346, 30, 12], [418, 366, 28, 11]].map(([x, y, rx, ry], i) =>
      `<g ${動("lp-drift", 6 + i * 1.7, -i * 1.3)}><ellipse cx="${x}" cy="${y}" rx="${f(rx * (0.7 + 0.9 * 霧))}" ry="${f(ry * (0.8 + 1.1 * 霧))}" fill="#b4bcb7" opacity="${f(霧 * 0.82)}"/></g>`).join("");
    const 穴 = 地区("穴", "穴 Loop Pit RAM", 460, 412, [384, 316, 154, 92], `${溝}<ellipse cx="460" cy="362" rx="54" ry="22" fill="#040b08" stroke="#6d8f80" stroke-width="2"/><path d="${渦}" fill="none" stroke="#3d6a58" stroke-width="2.2" stroke-dasharray="9 7" ${動("lp-flow", 4)}/><circle cx="460" cy="362" r="2.5" fill="#000"/>${霧 > 0.02 ? 霧玉 : ""}`);

    // ---- 池：水冷（水枕・ヒートシンク・管）。濁ると色が変わり、熱を持つ ----
    const 水 = 混ぜ色("#2fb6d8", "#6b6f5a", 池), 管 = 混ぜ色("#46c9e8", "#7a6e4a", 池), 熱 = 混ぜ色("#8fb0b8", "#d0603a", 池);
    const 泡 = 池 < 0.7 ? [0, 1, 2].map(i => `<circle cx="${312 + i * 8}" cy="392" r="2" fill="#effbff" ${動("lp-rise", 2.4 + i * 0.5, -i * 0.8)}/>`).join("") : [0, 1].map(i => `<ellipse cx="${300 + i * 40}" cy="378" rx="9" ry="4" fill="#9aa09a" opacity=".5" ${動("lp-rise", 3 + i, -i)}/>`).join("");
    const 羽根 = Array.from({ length: 6 }, (_, i) => `<rect x="${268 + i * 3.4}" y="386" width="1.8" height="22" fill="${熱}"/><rect x="${349 + i * 3.4}" y="386" width="1.8" height="22" fill="${熱}"/>`).join("");
    const 池地 = 地区("池", "池 Lunar Pool 冷却", 320, 434, [256, 296, 128, 124], `<path d="M320 384V300" stroke="#0a2a33" stroke-width="9" fill="none"/><path d="M320 384V300" stroke="${管}" stroke-width="5.5" fill="none"/><path d="M320 384V300" stroke="#effbff" stroke-width="2.5" fill="none" stroke-dasharray="3 14" opacity="${f(0.7 - 0.4 * 池)}" ${動("lp-flow", 1.6 + 池 * 2)}/>${羽根}<rect x="288" y="382" width="64" height="30" rx="9" fill="#0b2a33" stroke="#9fb3b8" stroke-width="2.5"/><rect x="293" y="387" width="54" height="20" rx="6" fill="${水}"/><circle cx="334" cy="395" r="4" fill="#f4f1d0" opacity="${f(0.85 - 0.6 * 池)}"/>${泡}`);

    // ---- 図書館：M.2 SSD。本が光る ----
    const 本 = Array.from({ length: 6 }, (_, i) => i < 本数
      ? `<rect x="${288 + 11 * i}" y="58" width="7" height="26" fill="#ffe59a" filter="url(#lp光)" ${動("lp-flick", 2.2 + i * 0.4, -i * 0.5)}/>`
      : `<rect x="${288 + 11 * i}" y="58" width="7" height="26" fill="#1c2638" stroke="#33445e" stroke-width=".8"/>`).join("");
    const 指2 = Array.from({ length: 7 }, (_, i) => `<rect x="${236 + i * 5}" y="46" width="3.2" height="30" fill="${金}"/>`).join("");
    const 図書館 = 地区("図書館", "図書館 Lore Pages SSD", 320, 112, [230, 14, 180, 104], `<rect x="272" y="40" width="108" height="52" rx="3" fill="#2d3f5a" stroke="#6c86ad" stroke-width="2"/><rect x="232" y="40" width="42" height="52" rx="3" fill="#143d2c" stroke="#6c86ad"/>${指2}<path d="M232 56h-3v22h3" fill="none" stroke="#0a1510"/><polygon points="272,40 326,18 380,40" fill="#3a4f70" stroke="#6c86ad" stroke-width="1.5"/><rect x="282" y="52" width="88" height="34" fill="#0c1422"/>${本}<circle cx="384" cy="86" r="5" fill="#0b1510" stroke="#c9ccc4" stroke-width="2"/>`);

    // ---- 遊歩道：デスクトップ。ショーウィンドウに願いが並ぶ ----
    const 窓 = Array.from({ length: 6 }, (_, i) => i < 窓数
      ? `<rect x="${46 + 20 * i}" y="196" width="16" height="22" fill="#b8e0ff"/><circle cx="${54 + 20 * i}" cy="207" r="3.5" fill="#ffd36b" ${動("lp-flick", 2 + i * 0.3, -i * 0.4)}/>`
      : `<rect x="${46 + 20 * i}" y="196" width="16" height="22" fill="#142430" stroke="#2c4a5c" stroke-width=".8"/>`).join("");
    const 遊歩道 = 地区("遊歩道", "遊歩道 Lune Passage", 105, 246, [32, 156, 148, 98], `<path d="M54 170a12 12 0 1 0 10 -16a9 9 0 1 1 -10 16z" fill="#e8e3b0" opacity=".85"/><rect x="38" y="188" width="134" height="40" fill="#263a48" stroke="#5e8aa6" stroke-width="2"/><path d="M34 188h142l-8-12H42z" fill="#3c5f78"/><path d="M42 176l8 12m16-12l8 12m16-12l8 12m16-12l8 12m16-12l8 12" stroke="#d7e9f3" stroke-width="1.5" opacity=".5"/>${窓}<rect x="150" y="196" width="16" height="30" fill="#0f1c25"/>`);

    // ---- 灯台：ネットワーク。LAN ポートの上のアンテナと光。光が点いたら、向こうの街も同じ拍で瞬く ----
    const 灯色 = 灯台 === true ? "#fff3a0" : 灯台 === false ? "#4a4a4a" : "#777";
    const 向こう = 灯台 === true ? `<g opacity=".55"><rect x="607" y="26" width="22" height="36" rx="4" fill="none" stroke="#fff3a0" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="618" cy="44" r="4" fill="#fff3a0" ${動("lp-blink", 2)}/><circle cx="618" cy="44" r="11" fill="#fff3a0" opacity=".18" ${動("lp-blink", 2)}/></g>` : "";
    const 光 = 灯台 === true ? `<g ${動("lp-sweep", 5, 0, 原(565, 96))}><polygon points="565,96 700,52 700,136" fill="url(#lp光線)"/></g>` : "";
    const 波 = [10, 16, 22].map((r, i) => `<path d="M${565 - r * 0.8} ${72 - r * 0.6}a${r} ${r} 0 0 1 ${r * 1.6} 0" fill="none" stroke="${灯台 === false ? "#555" : "#cfe9d8"}" stroke-width="2" stroke-linecap="round" ${灯台 === false ? "" : 動("lp-wave", 2.4, -i * 0.55)}/>`).join("");
    const 接点 = Array.from({ length: 8 }, (_, i) => `<rect x="${537 + i * 7.5}" y="157" width="4" height="6" fill="${金}"/>`).join("");
    const 灯台地区 = 地区("灯台", "灯台 Line Port LAN", 565, 190, [522, 20, 118, 184], `${光}${向こう}<rect x="528" y="148" width="74" height="20" rx="2" fill="#c9ccc4" stroke="#8d8f88" stroke-width="2"/><rect x="534" y="153" width="62" height="12" fill="#101512"/>${接点}<rect x="558" y="102" width="14" height="46" fill="#eef0f2"/><rect x="558" y="116" width="14" height="6" fill="#d04a3a"/><rect x="558" y="130" width="14" height="6" fill="#d04a3a"/><rect x="560" y="90" width="10" height="12" fill="#1c2a24" stroke="#8d8f88"/><circle cx="565" cy="96" r="6.5" fill="${灯色}"${灯台 === true ? ' filter="url(#lp光)"' : ""} ${灯台 === true ? 動("lp-blink", 2) : ""}/><line x1="565" y1="90" x2="565" y2="74" stroke="#c9ccc4" stroke-width="2"/>${波}`);

    // ---- 鍛錬場：ピンヘッダの上のダンベルと、鍛錬の灯 ----
    const 鍛灯 = 鍛 ? Array.from({ length: 鍛[1] }, (_, i) => { const 点 = i < 鍛[0], x = 鍛[1] === 1 ? 110 : 68 + i * (84 / (鍛[1] - 1));
      return 点 ? `<g ${動("lp-flick", 1.4 + (i % 3) * 0.3, -i * 0.3)}><circle cx="${f(x)}" cy="56" r="8" fill="#ff9a5f" opacity=".3"/><circle cx="${f(x)}" cy="56" r="4.5" fill="#ff9a5f" stroke="#ffd2b8" stroke-width="1.5" filter="url(#lp光)"/></g>` : `<circle cx="${f(x)}" cy="56" r="4.5" fill="#2d3a33" stroke="#56665c" stroke-width="1.5"/>`; }).join("") : "";
    const 鍛錬場 = 鍛 ? 地区("鍛錬場", "鍛錬場", 110, 126, [52, 36, 118, 104], `<rect x="62" y="62" width="96" height="44" rx="4" fill="#3a3326" stroke="#9a8a62" stroke-width="2"/>${Array.from({ length: 10 }, (_, i) => `<rect x="${67 + i * 9}" y="96" width="4" height="7" fill="${金}"/>`).join("")}<rect x="86" y="79" width="48" height="5" fill="#c4ccc6"/><rect x="78" y="70" width="9" height="23" rx="2" fill="#c4ccc6"/><rect x="133" y="70" width="9" height="23" rx="2" fill="#c4ccc6"/><rect x="72" y="75" width="6" height="13" rx="1" fill="#8e9792"/><rect x="142" y="75" width="6" height="13" rx="1" fill="#8e9792"/>${鍛灯}`) : "";

    // ---- 暗さ：街全体の明るさ（電力）。暗いほど、全体を沈める。明るいと緑が冴える ----
    const 暗 = ((1 - 明) * 0.58).toFixed(2);
    return `<svg viewBox="0 0 640 440" role="img" aria-label="街の地図（マザーボードの街 ルミナ・パレス）" style="width:100%;height:auto;display:block;border-radius:12px" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif">
${型}
<defs>
<linearGradient id="lp土" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f4a34"/><stop offset=".55" stop-color="${板}"/><stop offset="1" stop-color="#0a2f22"/></linearGradient>
<filter id="lp砂" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .1  0 0 0 0 .35  0 0 0 0 .22  0 0 0 .5 0"/></filter>
<pattern id="lp格" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r=".8" fill="#9fe3c4" opacity=".18"/></pattern>
<pattern id="lp針" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="${金}" opacity=".85"/></pattern>
<linearGradient id="lp光線" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3a0" stop-opacity=".5"/><stop offset="1" stop-color="#fff3a0" stop-opacity="0"/></linearGradient>
<filter id="lp光" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
${基板}
${道筋}
${図書館}
${遊歩道}
${鍛錬場}
${池地}
${広場}
${穴}
${港}
${楼閣}
${鐘楼}
${灯台地区}
<rect width="640" height="440" fill="#000" opacity="${暗}" pointer-events="none"/>
</svg>`;
  }


  // ================= 画像の街（画像AIで作った 絵/街.jpg の上に、押せる地区と、記録で変わる印を重ねる） =================
  // 位置は 1216×768 の絵の上の座標。当＝押せる四角 [x, y, 幅, 高]、札＝名札の位置、点＝印の中心。絵を作り直したら、ここを合わせる
  const 位置 = {   // 絵は 基板_街411（マザーボード）。部品＝地区
    港: { 当: [700, 580, 330, 188], 札: [865, 748], 点: [865, 640] },        // 右下の、頭が灯るコンデンサ
    広場: { 当: [500, 200, 275, 270], 札: [650, 458], 点: [640, 330] },      // 真ん中の CPU の台座
    鐘楼: { 当: [140, 290, 160, 150], 札: [220, 428], 点: [210, 340] },      // 左の銀の塔
    楼閣: { 当: [780, 60, 260, 200], 札: [910, 248], 点: [900, 160] },       // 右上の、橙に光る表示
    穴: { 当: [810, 270, 240, 280], 札: [930, 538], 点: [940, 420] },        // 右のヒートシンクのひだ（メモリ）
    池: { 当: [440, 560, 200, 200], 札: [540, 748], 点: [540, 650] },        // 下の丸い部品
    図書館: { 当: [0, 470, 300, 298], 札: [150, 700], 点: [150, 600] },      // 左下の長い差込口
    遊歩道: { 当: [280, 60, 210, 170], 札: [385, 218], 点: [385, 130] },     // 上のコンデンサの列
    灯台: { 当: [1060, 40, 156, 230], 札: [1138, 258], 点: [1150, 120] },    // 右上の角
    鍛錬場: { 当: [0, 80, 140, 200], 札: [110, 268], 点: [70, 170] },        // 左上の黒いチップ
  };
  const 名前 = { 港: "港 Lantern Pier", 広場: "広場 Link Plaza", 鐘楼: "鐘楼", 楼閣: "楼閣 Loud Pavilion", 穴: "穴 Loop Pit", 池: "池 Lunar Pool", 図書館: "図書館 Lore Pages", 遊歩道: "遊歩道 Lune Passage", 灯台: "灯台 Line Port", 鍛錬場: "鍛錬場" };
  function 絵の街を描く(様, 設定) {
    様 = 様 || {}; const 設 = (設定 && typeof 設定 === "object") ? 設定 : {};
    const 場 = 安(typeof 設.絵の場所 === "string" ? 設.絵の場所.replace(/[^A-Za-z0-9_./\-぀-ヿ一-鿿]/g, "").replace(/\.\.+/g, ".") : "絵/");
    const 明 = 数(様.明るさ, 0.15, 1, 0.5), 霧 = 数(様.霧, 0, 1), 池 = 数(様.池, 0, 1);
    const 灯総 = 整((様.灯籠 || [0, 12])[1], 0, 24), 灯点 = 整((様.灯籠 || [0, 12])[0], 0, 灯総);
    const 塔 = 整(様.塔, 0, 4), 鐘 = 数(様.鐘, 0, 1e6) > 0, 本数 = 整(様.図書館, 0, 6), 窓数 = 整(様.遊歩道, 0, 6), 映数 = 整(様.楼閣, 0, 6);
    const 灯台 = 様.灯台 === true ? true : 様.灯台 === false ? false : null;
    const 鍛 = Array.isArray(様.鍛錬場) ? [整(様.鍛錬場[0], 0, 99), 整(様.鍛錬場[1], 0, 14)] : null;
    const 動 = (名, 秒, 遅 = 0, 余 = "") => `class="lp-m" style="animation-name:${名};animation-duration:${f(秒)}s;animation-delay:${f(遅)}s;${余}"`;
    const 原 = (x, y) => `transform-origin:${x}px ${y}px;`;
    const 粒 = (n, 総, x, y, 色, 半) => Array.from({ length: 総 }, (_, i) => { const cx = x + (i - (総 - 1) / 2) * 半 * 3.2;
      return i < n ? `<g ${動("lp-flick", 1.3 + (i % 4) * 0.35, -i * 0.37)}><circle cx="${f(cx)}" cy="${y}" r="${f(半 * 2)}" fill="${色}" opacity=".3"/><circle cx="${f(cx)}" cy="${y}" r="${半}" fill="${色}" stroke="#fff" stroke-opacity=".7" filter="url(#lq光)"/></g>`
        : `<circle cx="${f(cx)}" cy="${y}" r="${f(半 * 0.8)}" fill="#1a2420" stroke="#6d7d75" stroke-width="1.5" opacity=".9"/>`; }).join("");
    const 札 = (名, x, y, 数字) => { const 字 = 名 + (数字 ? "　" + 数字 : ""), w = [...字].reduce((s, c) => s + (c.charCodeAt(0) > 255 ? 31 : 18), 0) + 28;
      return `<rect x="${f(x - w / 2)}" y="${y - 31}" width="${f(w)}" height="42" rx="21" fill="#04140d" fill-opacity=".8" stroke="#ffd36b" stroke-opacity=".55" stroke-width="1.5"/><text x="${x}" y="${y}" text-anchor="middle" font-size="30" font-weight="700" fill="#fff7e0">${安(字)}</text>`; };
    const 区 = (k, 中, 数字) => { const p = 位置[k], [x, y, w, h] = p.当;
      return `<g class="地区 lp-地区" data-k="${k}" tabindex="0" role="button" aria-label="${安(名前[k])}" style="cursor:pointer;-webkit-tap-highlight-color:transparent"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#fff3a0" fill-opacity="0" stroke="#fff3a0" stroke-width="3" opacity="0" class="lp-枠"/>${中}${札(名前[k].split(" ")[0], p.札[0], p.札[1], 数字)}</g>`; };
    const P = k => 位置[k].点;
    const 霧玉 = 霧 > 0.02 ? [[-60, -10, 90, 34], [40, 4, 110, 40], [-10, 26, 100, 32], [80, -20, 70, 28], [-90, 20, 70, 26]].map(([dx, dy, rx, ry], i) =>
      `<g ${動("lp-drift", 6 + i * 1.7, -i * 1.3)}><ellipse cx="${P("穴")[0] + dx}" cy="${P("穴")[1] + dy}" rx="${f(rx * (0.7 + 0.9 * 霧))}" ry="${f(ry * (0.8 + 1.1 * 霧))}" fill="#c4ccc7" opacity="${f(霧 * 0.7)}" filter="url(#lq霧)"/></g>`).join("") : "";
    const 波 = (x, y, 色) => [0, 1].map(i => `<circle cx="${x}" cy="${y}" r="30" fill="none" stroke="${色}" stroke-width="4" ${動("lp-expand", 1.4, -i * 0.7, 原(x, y))}/>`).join("");
    const 映色 = ["#ff5fa2", "#5fd0ff", "#ffd35f", "#8dff7a", "#c58bff", "#ff9a5f"];
    const 中 = {
      港: 粒(灯点, 灯総, P("港")[0], P("港")[1], "#ffd36b", 9),
      広場: 塔 ? `${波(P("広場")[0], P("広場")[1], "#ff4a3a")}<circle cx="${P("広場")[0]}" cy="${P("広場")[1]}" r="58" fill="none" stroke="#ff4a3a" stroke-width="5" ${動("lp-blink", 1.6)}/>` : `<circle cx="${P("広場")[0]}" cy="${P("広場")[1]}" r="${f(40 + 20 * 明)}" fill="#ffd36b" opacity="${f(0.05 + 0.15 * 明)}" filter="url(#lq霧)"/>`,
      鐘楼: 鐘 ? 波(P("鐘楼")[0], P("鐘楼")[1], "#ff6b5b") : "",
      楼閣: Array.from({ length: 映数 }, (_, i) => `<rect x="${P("楼閣")[0] - 75 + 26 * i}" y="${P("楼閣")[1] - 10}" width="20" height="14" rx="2" fill="${映色[i]}" ${動("lp-flick", 1.8 + i * 0.3, -i * 0.5)}/>`).join(""),
      穴: 霧玉,
      池: `<ellipse cx="${P("池")[0]}" cy="${P("池")[1]}" rx="110" ry="46" fill="${混ぜ色("#2fb6d8", "#6b5a3a", 池)}" opacity="${f(0.12 + 池 * 0.45)}" filter="url(#lq霧)"/>`,
      図書館: 粒(本数, 6, P("図書館")[0], P("図書館")[1], "#9fbcf5", 7),
      遊歩道: 粒(窓数, 6, P("遊歩道")[0], P("遊歩道")[1], "#d6c8ff", 7),
      灯台: 灯台 === true ? `<g ${動("lp-sweep", 5, 0, 原(P("灯台")[0], P("灯台")[1]))}><polygon points="${P("灯台")[0]},${P("灯台")[1]} ${P("灯台")[0] - 260},${P("灯台")[1] - 60} ${P("灯台")[0] - 260},${P("灯台")[1] + 60}" fill="url(#lq光線)"/></g><circle cx="${P("灯台")[0]}" cy="${P("灯台")[1]}" r="12" fill="#fff3a0" filter="url(#lq光)" ${動("lp-blink", 2)}/>`
        : `<circle cx="${P("灯台")[0]}" cy="${P("灯台")[1]}" r="10" fill="${灯台 === false ? "#3a3a3a" : "#777"}" stroke="#999" stroke-width="2"/>`,
      鍛錬場: 鍛 ? 粒(鍛[0], 鍛[1], P("鍛錬場")[0], P("鍛錬場")[1], "#ff9a5f", 8) : "",
    };
    const 数字 = { 港: 灯総 ? 灯点 + "/" + 灯総 : "", 広場: 塔 ? "切れ" + 塔 : "", 鐘楼: 鐘 ? "鳴" : "", 楼閣: 映数 || "", 図書館: 本数 || "", 遊歩道: 窓数 || "", 鍛錬場: 鍛 ? 鍛[0] + "/" + 鍛[1] : "" };
    const 並び = ["図書館", "鍛錬場", "灯台", "遊歩道", "広場", "鐘楼", "楼閣", "港", "池", "穴"].filter(k => k !== "鍛錬場" || 鍛);
    return `<div class="lp-街絵" style="position:relative;border-radius:12px;overflow:hidden;background:#06140e;aspect-ratio:1216/768">
<img src="${場}街.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block"/>
<svg viewBox="0 0 1216 768" role="img" aria-label="街の地図（マザーボードの街 ルミナ・パレス）" style="position:absolute;inset:0;width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif">
${型}
<defs><filter id="lq光" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="lq霧" x="-.5" y="-.5" width="2" height="2"><feGaussianBlur stdDeviation="12"/></filter>
<linearGradient id="lq光線" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fff3a0" stop-opacity=".55"/><stop offset="1" stop-color="#fff3a0" stop-opacity="0"/></linearGradient></defs>
<rect width="1216" height="768" fill="#000" opacity="${((1 - 明) * 0.55).toFixed(2)}" pointer-events="none"/>
${並び.map(k => 区(k, 中[k], 数字[k])).join("\n")}
</svg></div>`;
  }

  const 公開 = { 街を描く, 絵の街を描く, 位置 };
  if (typeof module !== "undefined" && module.exports) module.exports = 公開; else root.LifePilotArt街 = 公開;
})(typeof self !== "undefined" ? self : this);
