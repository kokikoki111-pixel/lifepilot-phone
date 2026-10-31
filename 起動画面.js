// 起動画面（Mac・スマホ共通）。暗い街に、港・広場・穴の順に灯りがつく → LIFEPILOT の文字 → エルピーの一言。約3秒。タップ・キーで飛ばせる。
// 出す回数：1日の最初の1回だけ（画面を移るたびには出さない。開いたブラウザ・アプリの1回の起動でも1回）。設定「見た目→起動画面」を false にすると出さない。
// 街の絵：設定「見た目→隠す機能」に「街の地図」が入っている間（既定）は、街の絵と灯りは出さず、LIFEPILOT の文字と一言だけ出す。
// 背景の動きが「なし」（か、端末が動きを減らす設定）の時は、動かさず、出きった絵だけを短く出す。
(() => {
  const 読む = 鍵 => { try { return localStorage.getItem(鍵); } catch (e) { return null; } };
  const 今 = new Date(), 日 = 今.getFullYear() + "-" + String(今.getMonth() + 1).padStart(2, "0") + "-" + String(今.getDate()).padStart(2, "0");
  try { if (sessionStorage.getItem("lp_起動済") || localStorage.getItem("lp_起動日") === 日) return; sessionStorage.setItem("lp_起動済", "1"); } catch (e) {}
  // 自動操作の画面（試験・撮影）では出さない。見たい時は、アドレスの最後に #起動=見る
  if (navigator.webdriver && !/起動=見る/.test(location.href)) return;
  const b = document.body; if (!b) return;
  let 設定 = {}; try { 設定 = (JSON.parse(読む("lifepilot_settings") || "{}").見た目) || {}; } catch (e) {}
  if (b.dataset.起動 === "なし" || 設定.起動画面 === false) return;
  const 隠す = (b.dataset.隠す !== undefined ? b.dataset.隠す.split(",") : Array.isArray(設定.隠す機能) ? 設定.隠す機能 : ["ニュース", "使った機能", "街の地図", "実験室"]);      // Mac は サーバーが body に入れる。スマホは設定。項目がなければ既定（隠す）
  const 街を出す = !隠す.includes("街の地図");
  try { localStorage.setItem("lp_起動日", 日); } catch (e) {}          // 今日はもう出した（同じ日の次の画面・次の起動では出さない）
  const 動き = b.dataset.動き || 読む("lifepilot_motion") || 設定.背景の動き || "多い";
  const 静止 = 動き === "なし" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  let 見せる = b.dataset.点顔 === "見せる"; if (!見せる) try { 見せる = !!((JSON.parse(読む("lifepilot_settings") || "{}").エルピー) || {}).点数と顔を見せる; } catch (e) {}      // 点数と顔を隠している間は、点数の一言を出さない
  const 一言 = ["起きたか、パイロット。", "灯りは足りねえが、街は待ってた。", "五分でいい。始めようぜ。"].concat(見せる ? ["今日の俺の機嫌は、お前の点数しだいだ。"] : []);
  const 文 = 一言[Math.floor(Math.random() * 一言.length)];
  const 灯 = [[71, 88, "港"], [52, 44, "広場"], [76, 53, "穴"]];     // 街の絵の上の位置（%）
  const 遅れ = 静止 ? [0, 0, 0] : [0.5, 1.0, 1.5];
  const css = document.createElement("style");
  css.textContent = `
#起動{position:fixed;inset:0;z-index:99999;background:#04060a;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .4s}
#起動.消える{opacity:0}
#起動 .起絵{position:absolute;left:50%;top:50%;width:max(100vw,calc(100vh * 1.583));aspect-ratio:1216/768;transform:translate(-50%,-50%)}
#起動 img{width:100%;height:100%;display:block;object-fit:cover;filter:brightness(${静止 ? .5 : .1}) saturate(.9)}
#起動 .起灯{position:absolute;width:26%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,214,102,.75),rgba(255,160,40,.25) 40%,transparent 70%);opacity:${静止 ? 1 : 0}}
#起動 .起題{position:absolute;left:0;right:0;top:40%;text-align:center;font-family:"DotGothic16","Chakra Petch",monospace;font-size:clamp(28px,7vw,64px);letter-spacing:.35em;color:#f3e9c9;text-shadow:0 0 18px rgba(255,200,80,.7);padding-left:.35em;opacity:${静止 ? 1 : 0}}
#起動 .起言{position:absolute;left:0;right:0;top:56%;text-align:center;font-family:"DotGothic16",sans-serif;font-size:clamp(14px,3.4vw,22px);color:#9fd8e8;opacity:${静止 ? 1 : 0}}
#起動 .起飛{position:absolute;right:14px;bottom:10px;font:11px "Share Tech Mono",monospace;color:rgba(243,233,201,.45);letter-spacing:.1em}
${静止 ? "" : `
@keyframes 明るく{to{filter:brightness(.55) saturate(.9)}}
@keyframes 点く{to{opacity:1}}
#起動 img{animation:明るく 2.4s ease-out .2s forwards}
#起動 .起灯{animation:点く .7s ease-out forwards}
#起動 .起題{animation:点く .8s ease-out 1.7s forwards}
#起動 .起言{animation:点く .6s ease-out 2.3s forwards}`}`;
  const 要素 = document.createElement("div");
  要素.id = "起動"; 要素.setAttribute("aria-hidden", "true");
  要素.innerHTML = `${街を出す ? `<div class="起絵"><img src="絵/街.jpg" alt="">${灯.map((p, i) => `<div class="起灯" style="left:${p[0]}%;top:${p[1]}%;animation-delay:${遅れ[i]}s"></div>`).join("")}</div>` : ""}<div class="起題">LIFEPILOT</div><div class="起言"></div><div class="起飛">TAP TO SKIP</div>`;
  要素.querySelector(".起言").textContent = 文;
  let 済 = false;
  const 閉じる = () => { if (済) return; 済 = true; 要素.classList.add("消える"); setTimeout(() => { 要素.remove(); css.remove(); }, 450); };
  要素.addEventListener("click", 閉じる); addEventListener("keydown", 閉じる, { once: true });
  document.head.appendChild(css); b.appendChild(要素);
  setTimeout(閉じる, 静止 ? 1600 : 3300);
})();
