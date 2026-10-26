// LifePilot スマホ版の中身（計算とデータの決まり）。Mac 版の Python と、同じ結果になるように作る。
// 画面（index.html）と、試験（Node）の両方から使う。個人のデータは、ここには書かない。
(function (root) {
  const 二桁 = n => String(n).padStart(2, "0");
  const 日付文字 = d => d.getFullYear() + "-" + 二桁(d.getMonth() + 1) + "-" + 二桁(d.getDate());
  const 時刻文字 = d => 日付文字(d) + " " + 二桁(d.getHours()) + ":" + 二桁(d.getMinutes()) + ":" + 二桁(d.getSeconds());

  // ---------- 日付 ----------
  function 締切を整える(文字) {
    // 「2026-10-25T18:00」「2026-10-25 18:00」「2026-10-25（その日の23:59）」を、2026-10-25T18:00 にそろえる
    let m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(文字 || "");
    if (!m) { m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(文字 || ""); if (m) m = [m[0], m[1], m[2], m[3], "23", "59"]; }
    if (!m) throw new Error("締切は、半角で 2026-10-25 18:00 のように、日付と時刻を指定してください");
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    if (d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3] || +m[4] > 23 || +m[5] > 59) throw new Error("締切は、半角で 2026-10-25 18:00 のように、日付と時刻を指定してください");
    return m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5];
  }
  const 締切の日時 = 文字 => { const s = 締切を整える(文字), m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s); return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); };
  function 日数の差(今, 日付) {          // 今日の日付 − 日付（日数、整数）
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(日付);
    return Math.round((Date.UTC(今.getFullYear(), 今.getMonth(), 今.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
  }

  // ---------- 点数（式J。Mac 版の A2 と同じ） ----------
  function 点数(タスク, 設定, 体 = 100, 気分低 = false, 今 = new Date()) {
    const 重み = 設定.柱A.点数の重み, 重要度 = タスク.重要度;
    const 放置 = 日数の差(今, タスク.最後に触った日);
    let 緊急 = 0.0;
    if (タスク.種類 === "締切") {
      const 残り日 = (締切の日時(タスク.締切) - 今) / 1000 / 86400;
      if (残り日 <= 0) 緊急 = 重要度 * 重み.期限切れの倍率;
      else {
        緊急 = 重要度 / Math.max(残り日, 重み.残り日数の下限);
        if (残り日 <= 重み.期限が近い日数) 緊急 *= 重み.期限が近い時の追加倍率;
      }
      緊急 *= 重み.期限の倍率;
    }
    let 遅れ = 0.0;
    if (タスク.種類 === "継続") 遅れ = 重要度 / 10 * Math.min(放置 / タスク.間隔日, 重み.継続の遅れ上限倍率) * 重み.継続の係数;
    const 放置点 = Math.min(放置, 重み.放置の上限日数) / 10 * 重要度 / 5;
    let 疲れ = (100 - 体) / 100 * 重み.疲れの重み[タスク.楽しさの印] * (気分低 ? 重み.気分が低い時の倍率 : 1);
    if (タスク.種類 === "締切") 疲れ *= 重み.締切型の疲れの割合;
    return { 合計: 緊急 + 遅れ + 放置点 - 疲れ, 緊急度: 緊急, 継続の遅れ: 遅れ, 放置: 放置点, 疲れ: 疲れ, 放置日数: 放置 };
  }
  const 生きている = 一覧 => 一覧.filter(r => !r.削除);
  function 順位表(データ, 設定, 体, 気分低, 今) {
    const 結果 = 生きている(データ.tasks).filter(t => !t.倉庫).map(t => [t, 点数(t, 設定, 体, 気分低, 今)]);
    return 結果.sort((a, b) => b[1].合計 - a[1].合計);          // 並べ替えは安定（同点は、元の順）
  }

  // ---------- 提案 ----------
  function 残りの言い方(締切, 今) {
    let 分 = Math.floor((締切の日時(締切) - 今) / 1000 / 60);
    if (分 <= 0) return "期限を過ぎています";
    const 日 = Math.floor(分 / 1440), 余り = 分 % 1440, 時 = Math.floor(余り / 60); 分 = 余り % 60;
    if (日) return 日 + "日" + 時 + "時間";
    return 時 ? 時 + "時間" + 分 + "分" : 分 + "分";
  }
  function 理由を作る(タスク, 点, 設定, 今) {
    const 文 = 設定.柱A.理由の文;
    let 主 = "緊急度", 最大 = 点.緊急度;
    for (const k of ["継続の遅れ", "放置"]) if (点[k] > 最大) { 主 = k; 最大 = 点[k]; }     // 同点なら、前の方（Python の max と同じ）
    let 本文;
    if (点[主] <= 0) 本文 = 文.ほか.replace("{見積もり分}", タスク.見積もり分);
    else if (主 === "緊急度" && 残りの言い方(タスク.締切, 今) === "期限を過ぎています") 本文 = 文.期限切れ.replace("{重要度}", タスク.重要度);
    else if (主 === "緊急度") 本文 = 文.期限.replace("{残り}", 残りの言い方(タスク.締切, 今)).replace("{重要度}", タスク.重要度);
    else if (主 === "継続の遅れ") 本文 = 文.遅れ.replace("{放置日数}", 点.放置日数).replace("{間隔日}", タスク.間隔日);
    else 本文 = 文.放置.replace("{放置日数}", 点.放置日数);
    return 本文 + (点.疲れ > 0 ? 文.疲れ : "");
  }
  function 今日の様子(データ, 今) {
    const 今日 = 日付文字(今), あとで = new Set(), やらない = new Set(), 最後に出した = {};
    for (const r of データ.suggestion_log) {
      最後に出した[r.候補id] = r.日時;
      if (r.反応 && (r.反応の日時 || "").startsWith(今日)) {
        if (r.反応 === "今やらない" || r.反応 === "あとで") { if (!r.リセット済み) あとで.add(r.候補id); }
        else if (r.反応 === "今日はやらない") やらない.add(r.候補id);
      }
    }
    return { あとで, やらない, 最後に出した };
  }
  const 丸め = x => Math.round(x * 1e6) / 1e6;
  // ---------- 相場帳（Mac 版の R1_相場帳.py と同じ決まり） ----------
  const 相場設定 = 設定 => Object.assign({ 選択肢分: [5, 15, 30, 60, 90], 補正: true, 最低件数: 5, 最近の件数: 20, 倍率の下限: 0.5, 倍率の上限: 3 }, (設定 && 設定.相場帳) || {});
  function 倍率の表(記録, 設定) {
    const s = 相場設定(設定), 並び = (記録 || []).filter(r => !r.削除).sort((a, b) => (a.日時 < b.日時 ? -1 : a.日時 > b.日時 ? 1 : 0) || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)), 表 = {};
    for (const 種 of new Set(並び.map(r => r.種類))) {
      const 使う = 並び.filter(r => r.種類 === 種).slice(-s.最近の件数);
      const 平均 = 使う.reduce((a, r) => a + r.実際分 / r.見積もり分, 0) / 使う.length;
      表[種] = { 件数: 使う.length, 倍率: Math.floor(Math.min(s.倍率の上限, Math.max(s.倍率の下限, 平均)) * 100 + 0.5) / 100 };
    }
    return 表;
  }
  function 使う見積もり(タスク, 表, 設定) {          // [提案に使う分, 理由の文 または null]
    const s = 相場設定(設定), 元 = タスク.見積もり分, x = 表[タスク.種類];
    if (!s.補正 || !x || x.件数 < s.最低件数) return [元, null];
    const 分 = Math.max(1, Math.floor(元 * x.倍率 + 0.5));
    if (分 === 元) return [元, null];
    const 名 = (設定.柱A.タスクの種類.find(k => k.キー === タスク.種類) || {}).名前 || タスク.種類;
    return [分, "あなたの「" + 名 + "」は、見積もりの" + x.倍率 + "倍かかる傾向（" + x.件数 + "件）なので、" + 元 + "分を" + 分 + "分として扱いました。"];
  }
  function 相場を足す(データ, 設定, タスクid, 種類, 見積もり分, 実際分, 元 = "達成", 今 = new Date()) {
    if (!設定.柱A.タスクの種類.some(k => k.キー === 種類)) throw new Error("種類が正しくありません");
    for (const [名, v, 上] of [["見積もり分", 見積もり分, 100000], ["実際分", 実際分, 1440]]) if (typeof v !== "number" || !(v > 0 && v <= 上)) throw new Error(名 + "は、0より大きい数字です（" + 上 + "以下）");
    データ.duration_log = データ.duration_log || [];
    const r = 更新印({ id: 新しいid(データ.duration_log), 日時: 時刻文字(今), タスクid, 種類, 見積もり分, 実際分: Math.round(実際分 * 10) / 10, 元 }, 今);
    データ.duration_log.push(r); return r;
  }
  function 提案(データ, 設定, 空き分, 体 = 100, 気分低 = false, 今 = new Date(), 電池 = null) {
    const 絞り = 設定.柱A.提案の絞り, 選択肢 = 設定.柱A.空き時間の選択肢, 最後の選択肢 = 選択肢[選択肢.length - 1];
    const 疲れている = (絞り.体が低い時は重い候補を外す && 体 <= 絞り.重い候補を外す体の基準) || (絞り.気分が低い時は重い候補を外す && 気分低);
    const { あとで, やらない, 最後に出した } = 今日の様子(データ, 今);
    const 並び = 順位表(データ, 設定, 体, 気分低, 今).filter(([t]) => !(やらない.has(t.id) || あとで.has(t.id)));
    並び.sort((a, b) => (丸め(b[1].合計) - 丸め(a[1].合計)) || ((最後に出した[a[0].id] || "") < (最後に出した[b[0].id] || "") ? -1 : (最後に出した[a[0].id] || "") > (最後に出した[b[0].id] || "") ? 1 : 0));
    const 電池が少ない = 電池 !== null && 電池 <= 絞り.電池が少ない基準;
    const 倍率 = 倍率の表(データ.duration_log, 設定);
    const 候補 = [];
    for (const [t, 点] of 並び) {
      if (電池が少ない && (t.画面を使う !== false)) continue;
      if (空き分 !== 最後の選択肢 && 使う見積もり(t, 倍率, 設定)[0] > 空き分) continue;
      if (疲れている && t.楽しさの印 === "重い") continue;
      候補.push([t, 点]);
    }
    if (!候補.length) return { 候補なし: true, 文: 電池が少ない ? "電池が少ないので、画面を使わない物だけを探しましたが、ありません。" : "今は出せる物がありません。", あとでの件数: あとで.size };
    const [t, 点] = 候補[0];
    const 結果 = { 候補なし: false, 一手: t, 点数: 点.合計, 点, 理由: 理由を作る(t, 点, 設定, 今) + (使う見積もり(t, 倍率, 設定)[1] ? " " + 使う見積もり(t, 倍率, 設定)[1] : ""), あとでの件数: あとで.size, 電池が少ない };
    if (候補.length > 1) 結果.代替 = 候補[1][0]; else 結果.代替の文 = 設定.柱A.理由の文.代替なし;
    return 結果;
  }

  // ---------- データの決まり（同期の土台：id・更新日時・削除の印） ----------
  function 新しいid(一覧) {
    const 使用中 = new Set(一覧.map(r => r.id)); let 番号 = Date.now();
    while (使用中.has(番号)) 番号 += 1;
    return 番号;
  }
  const 更新印 = (記録, 今 = new Date()) => { 記録.更新日時 = typeof 今 === "string" ? 今 : 時刻文字(今); return 記録; };
  const 削除印 = (記録, 今 = new Date()) => { 記録.削除 = typeof 今 === "string" ? 今 : 時刻文字(今); return 更新印(記録, 記録.削除); };

  // ---------- タスク ----------
  function タスクを検査して整える(入力, 設定) {
    const 柱A = 設定.柱A, キー = 柱A.タスクの種類.map(x => x.キー), [最小, 最大] = 柱A.重要度の範囲;
    const 整数 = v => Number.isInteger(v);
    if (!(入力.内容 || "").trim()) throw new Error("内容が空です");
    if (!キー.includes(入力.種類)) throw new Error("種類が正しくありません");
    if (!柱A.楽しさの印.includes(入力.楽しさの印)) throw new Error("楽しさの印は " + 柱A.楽しさの印.join("・") + " のどれかです");
    if (!整数(入力.重要度) || 入力.重要度 < 最小 || 入力.重要度 > 最大) throw new Error("重要度は " + 最小 + "〜" + 最大 + " の整数です");
    if (!整数(入力.見積もり分) || 入力.見積もり分 <= 0) throw new Error("見積もり分は、1以上の整数です");
    let 締切 = null;
    if (入力.種類 === "締切") { if (!入力.締切) throw new Error("この種類には、締切の日が要ります"); 締切 = 締切を整える(入力.締切); }
    if (入力.種類 === "継続" && !(整数(入力.間隔日) && 入力.間隔日 > 0)) throw new Error("この種類には、何日おきか（1以上の整数）が要ります");
    return { 内容: 入力.内容.trim(), 種類: 入力.種類, 画面を使う: 入力.画面を使う !== false, 締切, 間隔日: 入力.種類 === "継続" ? 入力.間隔日 : null,
             重要度: 入力.重要度, 楽しさの印: 入力.楽しさの印, 見積もり分: 入力.見積もり分 };
  }
  function タスクを足す(データ, 設定, 入力, 今 = new Date()) {
    const 中身 = タスクを検査して整える(入力, 設定), 日 = 日付文字(今);
    const t = 更新印(Object.assign({ id: 新しいid(データ.tasks), 作成日: 日, 最後に触った日: 日 }, 中身), 今); データ.tasks.push(t); return t;
  }
  function タスクを直す(データ, 設定, 番号, 入力, 今 = new Date()) {
    const 中身 = タスクを検査して整える(入力, 設定), t = データ.tasks.find(x => x.id === 番号 && !x.削除);
    if (!t) throw new Error("そのタスクはありません");
    Object.assign(t, 中身, { 最後に触った日: 日付文字(今) }); return 更新印(t, 今);
  }
  function タスクを消す(データ, 番号, 今 = new Date()) {
    const t = データ.tasks.find(x => x.id === 番号 && !x.削除);
    if (!t) throw new Error("そのタスクはありません");
    削除印(t, 今);
  }

  // ---------- 提案の記録と反応 ----------
  function 提案を記録(データ, 結果, 空き分, 状態, 今 = new Date()) {
    const 内訳 = {}; for (const k of ["緊急度", "継続の遅れ", "放置", "疲れ"]) 内訳[k] = Math.round(結果.点[k] * 1000) / 1000;
    const r = 更新印({ id: 新しいid(データ.suggestion_log), 日時: 時刻文字(今), 候補id: 結果.一手.id, 理由: 結果.理由, 内訳, 使った入力: 状態,
                       空き分, 代替id: 結果.代替 ? 結果.代替.id : null, 点数: Math.round(結果.点数 * 1000) / 1000, 反応: null, 理由の分類: null, 自由記述: "", 反応の日時: null }, 今);
    データ.suggestion_log.push(r); return r.id;
  }
  function 反応を記録(データ, 設定, 提案id, 反応, 理由 = null, 自由記述 = "", 今 = new Date()) {
    const 柱A = 設定.柱A;
    if (!柱A.反応の選択肢.includes(反応)) throw new Error("反応は " + 柱A.反応の選択肢.join("・") + " のどれかです");
    if (反応 === "今やらない") {
      if (理由 !== null && !柱A.今やらないの理由.includes(理由)) throw new Error("「今やらない」の理由は " + 柱A.今やらないの理由.join("・") + " のどれかです");
      if (理由 === null && !(自由記述 || "").trim()) throw new Error("「今やらない」は、理由を選ぶか、自分の言葉で書いてください");
    }
    if (反応 === "今日はやらない") {
      if (!柱A.やらない理由.includes(理由)) throw new Error("「今日はやらない」の理由を選んでください");
      if (理由 === "その他" && !(自由記述 || "").trim()) throw new Error("「その他」を選んだ時は、一言を書いてください");
    }
    const r = データ.suggestion_log.find(x => x.id === 提案id);
    if (!r) throw new Error("その提案はありません");
    if (r.反応 !== null) throw new Error("この提案には、もう反応しています");
    r.反応 = 反応; r.理由の分類 = (反応 === "今日はやらない" || 反応 === "今やらない") ? 理由 : null; r.自由記述 = (自由記述 || "").trim(); r.反応の日時 = 時刻文字(今);
    更新印(r, 今);
    if ((反応 === "今日はやらない" || 反応 === "今やらない") && 理由 === "気分じゃない") 出来事を書く(データ, "気分じゃない", 今);
    return r;
  }
  function あとでを戻す(データ, 今 = new Date()) {
    const 今日 = 日付文字(今), 戻した = new Set();
    for (const r of データ.suggestion_log) if ((r.反応 === "今やらない" || r.反応 === "あとで") && !r.リセット済み && (r.反応の日時 || "").startsWith(今日)) { r.リセット済み = true; 更新印(r, 今); 戻した.add(r.候補id); }
    return 戻した.size;
  }

  // ---------- 5分だけ ----------
  function 五分を始める(データ, タスクid, 今 = new Date()) {
    const t = データ.tasks.find(x => x.id === タスクid && !x.削除);
    if (!t) throw new Error("そのタスクはありません");
    t.最後に触った日 = 日付文字(今); 更新印(t, 今);
    const r = 更新印({ id: 新しいid(データ.focus_log), タスクid, 開始: 時刻文字(今), 終了: null, 結果: null }, 今); データ.focus_log.push(r); return r.id;
  }
  function 五分を終える(データ, 設定, 記録id, 結果, 今 = new Date(), 実績分 = null) {
    const 選択肢 = 設定.柱A["5分だけ終わりの選択肢"].concat(["中断"]);
    if (!選択肢.includes(結果)) throw new Error("結果は " + 選択肢.join("・") + " のどれかです");
    const r = データ.focus_log.find(x => x.id === 記録id);
    if (!r) throw new Error("その記録はありません");
    if (r.結果 !== null) throw new Error("もう終わっています");
    if (実績分 !== null) {
      if (typeof 実績分 !== "number" || !(実績分 >= 0 && 実績分 <= 1440)) throw new Error("実績分は、0〜1440 の数字です");
      r.実績分 = Math.round(実績分 * 10) / 10;
    }
    r.結果 = 結果; r.終了 = 時刻文字(今); 更新印(r, 今);
    if (結果 === "続ける" && r.実績分) {         // 「続ける」で計り続けた時間は、実際の所要。相場帳に入れる（5分だけの分は入れない）
      const t = データ.tasks.find(x => x.id === r.タスクid);
      if (t) 相場を足す(データ, 設定, t.id, t.種類, t.見積もり分, r.実績分, "続ける", 今);
    }
    if (結果 !== "中断") 出来事を書く(データ, "五分", 今, { 理由: "タスクを5分やった" });
  }

  // ---------- 体・気分・電池 ----------
  function 状態を記録(データ, 設定, 体, 気分, 電池 = null, 今 = new Date()) {
    const s = 設定.土台2, 刻み = (v, k) => Number.isInteger(v) && v >= 0 && v <= 100 && v % k === 0;
    if (!刻み(体, s.体の刻み)) throw new Error("体は、0〜100（%）で、" + s.体の刻み + "刻みです");
    if (!s.気分の選択肢.includes(気分)) throw new Error("気分は " + s.気分の選択肢.join("・") + " のどれかです");
    if (電池 !== null && !刻み(電池, s.電池の刻み)) throw new Error("電池は、0〜100（%）で、" + s.電池の刻み + "刻みです");
    const r = 更新印({ id: 新しいid(データ.state_logs), 日時: 時刻文字(今), 体, 気分, 電池 }, 今); データ.state_logs.push(r); return r;
  }
  function 使える状態(データ, 設定, 今 = new Date()) {
    const L = データ.state_logs; if (!L.length) return null;
    const 最新 = L.reduce((a, b) => (b.日時 >= a.日時 ? b : a));
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(最新.日時);
    const 経過 = 今 - new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return 経過 >= 0 && 経過 <= 設定.土台2.使い回す時間_時間 * 3600 * 1000 ? 最新 : null;
  }

  // ---------- 預ける ----------
  function 預ける(データ, 設定, 本文, 種類 = null, 返す選択 = "なし", 今 = new Date()) {
    const s = 設定.柱B; 本文 = (本文 || "").trim();
    if (!本文) throw new Error("一言が空です");
    if (本文.length > s.本文の最大文字数) throw new Error("長すぎます（" + s.本文の最大文字数 + "文字まで）");
    if (種類 !== null && !s.預ける種類.includes(種類)) throw new Error("種類は " + s.預ける種類.join("・") + " のどれかです");
    const 選択 = s.返す日の選択肢.find(x => x.名前 === 返す選択);
    if (!選択) throw new Error("返す日は " + s.返す日の選択肢.map(x => x.名前).join("・") + " のどれかです");
    const 状態 = 使える状態(データ, 設定, 今);
    let 返す日 = null;
    if (選択.日数 !== null) { const d = new Date(今.getFullYear(), 今.getMonth(), 今.getDate() + 選択.日数); 返す日 = 日付文字(d); }
    const 預け = 更新印({ id: 新しいid(データ.deposits), 日付: 時刻文字(今), 種類, 本文, 返す日, 受け取った日: null, 反応: null, 体: 状態 ? 状態.体 : null, 気分: 状態 ? 状態.気分 : null }, 今);
    データ.deposits.push(預け); return 預け;
  }


  // ---------- タスク分解（Mac 版の K1_分解.py と同じ決まり。ひな形・AIなし。元のタスクは残す） ----------
  const 分解設定 = 設定 => Object.assign({ 小さい分: 15, 準備分: 5, 見直し分: 5, 最大件数: 20, 準備の文: "{内容}：道具・資料を出す", 最初の文: "{内容}：最初の5分だけ触る", 本体の文: "{内容}：その{n}", 見直しの文: "{内容}：見直す" }, (設定 && 設定.分解) || {});
  function 分解の案(タスク, 設定) {
    const s = 分解設定(設定), 総 = タスク.見積もり分, 小 = s.小さい分;
    if (総 <= 小) throw new Error("このタスクは、すでに " + 小 + "分以下です。分けなくて大丈夫です");
    const 文 = (ひな形, n = "") => ひな形.split("{内容}").join(タスク.内容).split("{n}").join(String(n));
    let 前, 後, 前の文;
    if (総 >= s.準備分 + s.見直し分 + 小) { 前 = s.準備分; 後 = s.見直し分; 前の文 = 文(s.準備の文); } else { 前 = 5; 後 = 0; 前の文 = 文(s.最初の文); }
    const 本体 = 総 - 前 - 後, n = Math.ceil(本体 / 小), 基 = Math.floor(本体 / n), 余 = 本体 % n;
    const 手順 = [{ 内容: 前の文, 分: 前 }];
    for (let i = 0; i < n; i++) 手順.push({ 内容: 文(s.本体の文, i + 1), 分: 基 + (i < 余 ? 1 : 0) });
    if (後) 手順.push({ 内容: 文(s.見直しの文), 分: 後 });
    if (手順.length > s.最大件数) throw new Error("手順が多すぎます（" + s.最大件数 + "件まで）。先に、もっと大きく2つに分けてください");
    return 手順;
  }
  function 分解して足す(データ, 設定, タスクid, 手順, 今 = new Date()) {
    const 元 = 生きている(データ.tasks).filter(t => !t.倉庫).find(t => t.id === タスクid);
    if (!元) throw new Error("そのタスクはありません");
    if (!Array.isArray(手順) || !手順.length) throw new Error("手順がありません");
    if (手順.length > 分解設定(設定).最大件数) throw new Error("手順が多すぎます（" + 分解設定(設定).最大件数 + "件まで）");
    const 中身 = 手順.map(p => ({ 内容: (p || {}).内容, 種類: "その他", 重要度: 元.重要度, 楽しさの印: 元.楽しさの印, 見積もり分: (p || {}).分, 画面を使う: 元.画面を使う !== false }));
    中身.forEach(x => タスクを検査して整える(x, 設定));            // 先に全部検査する（半端に足さない）
    return 中身.map(x => タスクを足す(データ, 設定, x, 今).id);
  }

  // ---------- Googleカレンダー連携（詳細仕様16）：書く予定を組み立てる・既存との差を出す・空き時間を数える ----------
  // 通信そのもの（ログイン・API）は calendar.js。ここは、通信しない関数だけ（試験できる）。書くのは「［LP］」を頭に付けた自分の予定だけ。
  const カレンダー設定 = 設定 => Object.assign({ 接頭: "［LP］", 朝の時: 8, 朝の5分の通知分: 10, 前日の夜の時: 21, 当日の朝の時: 8, 予定の長さ分: 15, 活動の始まり: 8, 活動の終わり: 22, 空きの最小分: 15, 反映の先読み日数: 365 }, (設定 && 設定.カレンダー) || {});
  const 地方の時刻 = d => 日付文字(d) + "T" + 二桁(d.getHours()) + ":" + 二桁(d.getMinutes()) + ":00";
  const 簡易ハッシュ = 文 => { let h = 5381; for (let i = 0; i < 文.length; i++) h = ((h * 33) ^ 文.charCodeAt(i)) >>> 0; return h.toString(36); };
  function 予定を作る(キー, 題, 開始, 長さ分, 通知の分, 設定, 時間帯) {
    const 終わり = new Date(開始.getTime() + 長さ分 * 60000), 通知 = [...new Set(通知の分)].filter(m => m > 0 && m <= 40320).sort((a, b) => b - a);
    const 本体 = { summary: 題, start: { dateTime: 地方の時刻(開始), timeZone: 時間帯 }, end: { dateTime: 地方の時刻(終わり), timeZone: 時間帯 },
                   reminders: { useDefault: false, overrides: 通知.map(m => ({ method: "popup", minutes: m })) } };
    本体.extendedProperties = { private: { lifepilot: "1", lpkey: キー, h: 簡易ハッシュ(JSON.stringify(本体)) } };
    return { キー, 本体 };
  }
  function 望む予定(データ, 設定, 今 = new Date(), 時間帯 = "Asia/Tokyo") {
    const s = カレンダー設定(設定), 結果 = [], 先 = new Date(今.getTime() + s.反映の先読み日数 * 86400000);
    for (const t of 生きている(データ.tasks).filter(t => !t.倉庫)) {            // 課題の締切：前日の夜と、当日の朝に通知
      if (t.種類 !== "締切" || !t.締切) continue;
      let 切れ; try { 切れ = 締切の日時(t.締切); } catch (e) { continue; }
      if (切れ <= 今 || 切れ > 先) continue;
      const 前夜 = new Date(切れ.getFullYear(), 切れ.getMonth(), 切れ.getDate() - 1, s.前日の夜の時, 0), 朝 = new Date(切れ.getFullYear(), 切れ.getMonth(), 切れ.getDate(), s.当日の朝の時, 0);
      const 通知 = [Math.round((切れ - 前夜) / 60000)]; if (朝 < 切れ) 通知.push(Math.round((切れ - 朝) / 60000));
      結果.push(予定を作る("締切-" + t.id, s.接頭 + "課題：" + t.内容, 切れ, s.予定の長さ分, 通知, 設定, 時間帯));
    }
    const 封 = 今の封(データ);                                                    // 朝の5分：封をしたタスクを、対象日の朝の予定にする
    if (封) {
      const t = 生きている(データ.tasks).filter(t => !t.倉庫).find(t => t.id === 封.タスクid), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(封.対象日 || "");
      if (t && m) {
        const 開始 = new Date(+m[1], +m[2] - 1, +m[3], s.朝の時, 0);
        if (開始 > 今) 結果.push(予定を作る("朝-" + 封.id, s.接頭 + "朝の5分：" + t.内容, 開始, 5, [s.朝の5分の通知分], 設定, 時間帯));
      }
    }
    return 結果;
  }
  // 既存のLP予定（Googleから読んだ物）と、望む予定の差。過去の予定は、直さない・消さない
  function 予定の差(望む, 既存, 今 = new Date()) {
    const 持つ = new Map(); for (const e of 既存) { const p = (e.extendedProperties || {}).private || {}; if (p.lifepilot === "1" && p.lpkey) 持つ.set(p.lpkey, e); }
    const 作る = [], 直す = [], 消す = [], 望むキー = new Set(望む.map(x => x.キー));
    for (const x of 望む) { const e = 持つ.get(x.キー); if (!e) 作る.push(x); else if (e.extendedProperties.private.h !== x.本体.extendedProperties.private.h) 直す.push({ id: e.id, 予定: x }); }
    for (const [キー, e] of 持つ) { if (望むキー.has(キー)) continue; const 始 = new Date((e.start || {}).dateTime || (e.start || {}).date || 0); if (始 >= 今) 消す.push({ id: e.id, キー }); }
    return { 作る, 直す, 消す };
  }
  // 空き時間：ある日の、活動時間（8〜22時）から、予定のある時間を引いた残り。終日の予定は、数えない
  function 空き時間(予定一覧, 日付, 設定) {
    const s = カレンダー設定(設定), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(日付);
    const 始 = new Date(+m[1], +m[2] - 1, +m[3], s.活動の始まり, 0).getTime(), 終 = new Date(+m[1], +m[2] - 1, +m[3], s.活動の終わり, 0).getTime();
    const 忙しい = 予定一覧.filter(e => (e.start || {}).dateTime && (e.end || {}).dateTime && e.status !== "cancelled" && e.transparency !== "transparent")
      .map(e => [new Date(e.start.dateTime).getTime(), new Date(e.end.dateTime).getTime()]).filter(([a, b]) => b > 始 && a < 終).sort((a, b) => a[0] - b[0]);
    const 空き = []; let 位置 = 始;
    for (const [a, b] of 忙しい) { if (a > 位置) 空き.push([位置, Math.min(a, 終)]); 位置 = Math.max(位置, b); }
    if (位置 < 終) 空き.push([位置, 終]);
    const 時 = ms => 二桁(new Date(ms).getHours()) + ":" + 二桁(new Date(ms).getMinutes());
    return 空き.map(([a, b]) => ({ 開始: 時(a), 終了: 時(b), 分: Math.round((b - a) / 60000) })).filter(x => x.分 >= s.空きの最小分);
  }
  // いまから次の予定までの分（予定が無ければ、活動の終わりまで）→「今なにする？」の空き時間の選択肢に当てはめる
  function 今の空き(予定一覧, 今, 設定) {
    const s = カレンダー設定(設定), 終 = new Date(今.getFullYear(), 今.getMonth(), 今.getDate(), s.活動の終わり, 0).getTime();
    let 次 = 終;
    for (const e of 予定一覧) { if (!(e.start || {}).dateTime || e.status === "cancelled" || e.transparency === "transparent") continue; const a = new Date(e.start.dateTime).getTime(), b = new Date((e.end || e.start).dateTime).getTime(); if (a <= 今.getTime() && b > 今.getTime()) return { 分: 0, 選択: null }; if (a > 今.getTime() && a < 次) 次 = a; }
    const 分 = Math.max(0, Math.floor((次 - 今.getTime()) / 60000)), 選択肢 = 設定.柱A.空き時間の選択肢, 合う = 選択肢.filter(x => x <= 分);
    return { 分, 選択: 合う.length ? 合う[合う.length - 1] : null };
  }

  // ---------- 倉庫と寝かせ棚（Mac 版の W1_倉庫.py と同じ決まり。warehouse_items・wishlist は同期の対象） ----------
  const 倉庫設定 = 設定 => Object.assign({ 動かない日数: 14, 窓口の件数: 3, 寝かせ日数: 3, 理由の最大文字数: 200, 内容の最大文字数: 200, 入口: ["やりたかった", "見つからない"], 選択肢: ["買取", "解体", "焼却", "種"], NPCの言葉: "これは{日数}日、倉庫にあります。" }, (設定 && 設定.倉庫) || {});
  const 日を足す = (今, n) => new Date(今.getFullYear(), 今.getMonth(), 今.getDate() + n);
  function 倉庫の内容(内容, 上限) {
    内容 = (内容 || "").trim(); if (!内容) throw new Error("内容が空です");
    if (内容.length > 上限) throw new Error("長すぎます（" + 上限 + "文字まで）"); return 内容;
  }
  function 倉庫の候補(データ, 設定, 今 = new Date()) {     // 2週間以上触っていないタスク。締切が未来の締切型は出さない（期限切れは出す）
    const 限 = 日付文字(日を足す(今, -倉庫設定(設定).動かない日数)), 結果 = [];
    for (const t of 生きている(データ.tasks).filter(t => !t.倉庫)) {
      if (t.最後に触った日 > 限) continue;
      if (t.種類 === "締切" && 締切の日時(t.締切) > 今) continue;
      結果.push(Object.assign({}, t, { 触っていない日数: 日数の差(今, t.最後に触った日) }));
    }
    return 結果.sort((a, b) => b.触っていない日数 - a.触っていない日数);
  }
  const タスクの控え = t => { const c = {}; for (const k of ["内容", "種類", "重要度", "楽しさの印", "見積もり分", "締切", "間隔日", "画面を使う"]) c[k] = t[k] === undefined ? null : t[k]; return c; };
  function 倉庫に積む(データ, タスクid, 今 = new Date()) {
    const t = データ.tasks.find(x => x.id === タスクid && !x.削除 && !x.倉庫);
    if (!t) throw new Error("そのタスクはありません（もう倉庫にあるかもしれません）");
    データ.warehouse_items = データ.warehouse_items || [];
    t.倉庫 = true; t.倉庫に積んだ日 = 日付文字(今); 更新印(t, 今);
    const r = 更新印({ id: 新しいid(データ.warehouse_items), 内容: t.内容, 入口: "動かない", 置いた日: 日付文字(今), 元のタスクid: t.id, 元のタスク: タスクの控え(t), 処理: "保管中", 処理した日: null, 焼却の理由: null }, 今);
    データ.warehouse_items.push(r); return r;
  }
  function 倉庫に入れる(データ, 設定, 内容, 入口, 今 = new Date()) {
    const s = 倉庫設定(設定);
    if (!s.入口.includes(入口)) throw new Error("入口は " + s.入口.join("・") + " のどれかです");
    内容 = 倉庫の内容(内容, s.内容の最大文字数); データ.warehouse_items = データ.warehouse_items || [];
    const r = 更新印({ id: 新しいid(データ.warehouse_items), 内容, 入口, 置いた日: 日付文字(今), 元のタスクid: null, 元のタスク: null, 処理: "保管中", 処理した日: null, 焼却の理由: null }, 今);
    データ.warehouse_items.push(r); return r;
  }
  function 窓口(データ, 設定, 今 = new Date()) {           // 保管中の物を、古い順に、3件まで。言葉は、事実の一言だけ
    const s = 倉庫設定(設定);
    const 保管 = 生きている(データ.warehouse_items || []).filter(r => r.処理 === "保管中").sort((a, b) => (a.置いた日 < b.置いた日 ? -1 : a.置いた日 > b.置いた日 ? 1 : a.id - b.id));
    return { 件数: 保管.length, 出す: 保管.slice(0, s.窓口の件数).map(r => Object.assign({}, r, { 一言: s.NPCの言葉.split("{日数}").join(String(日数の差(今, r.置いた日))).split("{内容}").join(r.内容) })) };
  }
  function 倉庫で処理(データ, 設定, 物id, 選択, 理由 = null, 部品 = null, 今 = new Date()) {
    const s = 倉庫設定(設定);
    if (!s.選択肢.includes(選択)) throw new Error("選択は " + s.選択肢.join("・") + " のどれかです");
    const r = (データ.warehouse_items || []).find(x => x.id === 物id && !x.削除);
    if (!r || r.処理 !== "保管中") throw new Error("その物は、窓口にありません");
    const 元 = データ.tasks.find(x => x.id === r.元のタスクid && !x.削除), 今日 = 日付文字(今);
    if (理由 !== null) { 理由 = String(理由).trim(); if (理由.length > s.理由の最大文字数) throw new Error("理由が長すぎます（" + s.理由の最大文字数 + "文字まで）"); }
    const 新しく = 控え => タスクを足す(データ, 設定, { 内容: 控え.内容, 種類: 控え.種類, 重要度: 控え.重要度, 楽しさの印: 控え.楽しさの印, 見積もり分: 控え.見積もり分, 締切: 控え.締切, 間隔日: 控え.間隔日, 画面を使う: 控え.画面を使う !== false }, 今);
    if (選択 === "買取") {
      if (元 && 元.倉庫) { delete 元.倉庫; delete 元.倉庫に積んだ日; 元.最後に触った日 = 今日; 更新印(元, 今); }
      else { let 控え = r.元のタスク || { 内容: r.内容, 種類: "その他", 重要度: 5, 楽しさの印: "ふつう", 見積もり分: 5 }; if (控え.種類 === "締切") 控え = Object.assign({}, 控え, { 種類: "その他", 締切: null }); 新しく(控え); }
    } else {
      if (選択 === "解体") {
        部品 = (部品 || []).map(p => (p || "").trim()).filter(p => p);
        if (!部品.length) throw new Error("解体は、使える部品を1つ以上、書いてください");
        const 中身 = 部品.map(p => ({ 内容: 倉庫の内容(p, s.内容の最大文字数), 種類: "その他", 重要度: 5, 楽しさの印: "ふつう", 見積もり分: 5 }));
        中身.forEach(x => タスクを検査して整える(x, 設定)); 中身.forEach(x => タスクを足す(データ, 設定, x, 今));
      }
      if (元 && 元.倉庫) 削除印(元, 今);                         // 焼却・種・解体：元のタスクは消す（控えは、物の記録に残る）
    }
    r.処理 = 選択; r.処理した日 = 今日; r.焼却の理由 = 選択 === "焼却" ? (理由 || null) : null;
    if (選択 === "解体") r.部品 = 部品;
    更新印(r, 今); return r;
  }
  const 灰 = データ => 生きている(データ.warehouse_items || []).filter(r => r.処理 === "焼却").sort((a, b) => (b.処理した日 || "").localeCompare(a.処理した日 || ""));
  const 種 = データ => 生きている(データ.warehouse_items || []).filter(r => r.処理 === "種").sort((a, b) => (b.処理した日 || "").localeCompare(a.処理した日 || ""));
  function 灰を戻す(データ, 物id, 今 = new Date()) {
    const r = (データ.warehouse_items || []).find(x => x.id === 物id && !x.削除);
    if (!r || !["焼却", "種"].includes(r.処理)) throw new Error("戻せる物ではありません");
    r.処理 = "保管中"; r.処理した日 = null; r.焼却の理由 = null; 更新印(r, 今); return r;
  }
  function 棚に置く(データ, 設定, 物, 今 = new Date()) {
    const s = 倉庫設定(設定); 物 = 倉庫の内容(物, s.内容の最大文字数); データ.wishlist = データ.wishlist || [];
    const r = 更新印({ id: 新しいid(データ.wishlist), 物, 置いた日: 日付文字(今), 次に聞く日: 日付文字(日を足す(今, s.寝かせ日数)), 答え: null, 答えた日: null, 買った翌朝の体: null }, 今);
    データ.wishlist.push(r); return r;
  }
  function 棚(データ, 今 = new Date()) {
    const 日 = 日付文字(今), 一覧 = 生きている(データ.wishlist || []);
    return { 聞く: 一覧.filter(r => r.答え === null && r.次に聞く日 <= 日), 寝かせ中: 一覧.filter(r => r.答え === null && r.次に聞く日 > 日), 済み: 一覧.filter(r => r.答え !== null) };
  }
  function 棚に答える(データ, 設定, id, 答え, 今 = new Date()) {
    if (!["買う", "やめる", "もう少し置く"].includes(答え)) throw new Error("答えは、買う・やめる・もう少し置く のどれかです");
    const r = (データ.wishlist || []).find(x => x.id === id && !x.削除 && x.答え === null);
    if (!r) throw new Error("その物は、もう答え済みか、ありません");
    if (答え === "もう少し置く") r.次に聞く日 = 日付文字(日を足す(今, 倉庫設定(設定).寝かせ日数)); else { r.答え = 答え; r.答えた日 = 日付文字(今); }
    更新印(r, 今); return r;
  }
  function 翌朝の体を答える(データ, id, 体, 今 = new Date()) {
    if (!Number.isInteger(体) || 体 < 0 || 体 > 100) throw new Error("体は、0〜100（%）の整数です");
    const r = (データ.wishlist || []).find(x => x.id === id && !x.削除 && x.答え === "買う");
    if (!r) throw new Error("買った物ではありません");
    r.買った翌朝の体 = 体; 更新印(r, 今); return r;
  }
  function 棚から外す(データ, id, 今 = new Date()) {
    const r = (データ.wishlist || []).find(x => x.id === id && !x.削除); if (!r) throw new Error("その物はありません");
    削除印(r, 今); return r;
  }

  // ---------- 通信（スマホ版は AI につながらないので、設定の「決めた文」で返す。会話の記録は、この端末の中だけ） ----------
  function 通信の状況(データ, 設定, 今 = new Date()) {
    const s = 生活の状態(データ, 設定, 今);
    return "気分の点数は" + s.点数 + "（" + s.顔 + "）。疲れは" + s.疲れ + "。今日の達成は" + s.今日.達成 + "件、5分だけは" + s.今日.五分 + "回。タスクは" + 生きている(データ.tasks).filter(t => !t.倉庫).length + "件。";
  }
  function 通信の返事(設定, 相手, 文, 状況, 乱 = Math.random) {
    const s = 設定.通信;
    if (!s.人[相手]) throw new Error("相手は " + Object.keys(s.人).join("・") + " のどれかです");
    文 = (文 || "").trim(); if (!文) throw new Error("言葉が空です"); if (文.length > 300) throw new Error("長すぎます（300文字まで）");
    const 深刻 = ["死にたい", "消えたい", "自殺", "自傷", "リストカット", "殺したい"];
    if (深刻.some(w => 文.includes(w))) return { 本文: "つらい気持ちが大きいようです。ここでは答えず、話せる人につないでください。よりそいホットライン 0120-279-338（24時間・無料）、いのちSOS 0120-061-338 があります。", 出所: "専門窓口" };
    const 質問 = s.質問[文] ? 文 : ((s.キーワード.find(([語]) => 語.some(w => 文.includes(w))) || [])[1] || null);
    const 候補 = 質問 ? s.質問[質問][相手] : s.困った時[相手];
    return { 本文: 候補[Math.floor(乱() * 候補.length)].split("{状況}").join(状況), 出所: 質問 || "自由" };
  }
  function 節目の文(設定, キー, 状況, 乱 = Math.random) {
    const e = 設定.通信.節目[キー]; if (!e) throw new Error("その節目はありません");
    return { 送り手: e.送り手, 本文: e.文[Math.floor(乱() * e.文.length)].split("{状況}").join(状況), 出所: キー, 名: e.名 };
  }

  // ---------- 実験室（化学反応。Mac 版の X1 と同じ選び方。スマホ版は AI につながらないので、理由と実験の文は、ひな形） ----------
  function 実験の材料(データ, ニュース = [], 記録 = [], 使わない = []) {
    const 封 = new Set(使わない.map(x => x.出どころ + ":" + x.id)), 最後 = {}, 出 = [];
    for (const e of 記録) for (const m of e.材料) { const k = m.出どころ + ":" + m.id, d = e.日付.slice(0, 10); if (!最後[k] || 最後[k] < d) 最後[k] = d; }
    const 足す = (出どころ, id, 題, 楽しい = false) => { 題 = (題 || "").trim().replace(/\n/g, " ").slice(0, 40); if (題 && !封.has(出どころ + ":" + id)) 出.push({ 出どころ, id, 題, 最後に使った日: 最後[出どころ + ":" + id] || null, 楽しい }); };
    for (const r of 生きている(データ.warehouse_items || [])) if (["保管中", "種"].includes(r.処理)) 足す("倉庫", r.id, r.内容);
    for (const r of 生きている(データ.deposits || [])) 足す("預け", r.id, r.本文);
    for (const r of ニュース) if (r.反応 === "気になる") 足す("気になる", r.id, r.見出し);
    for (const t of 生きている(データ.tasks).filter(t => !t.倉庫)) 足す("タスク", t.id, t.内容, t.楽しさの印 === "楽しい");
    return 出;
  }
  const 二文字 = 題 => { const s = new Set(); for (let i = 0; i < 題.length - 1; i++) { const x = 題.slice(i, i + 2); if (x.trim().length === 2 && !/^\d+$/.test(x)) s.add(x); } return s; };
  function 実験の組(材料, 今 = new Date(), 乱 = Math.random, 除く = [], 組の数 = 3) {
    const 除 = new Set(除く.map(x => x.出どころ + ":" + x.id)), 古さ = m => m.最後に使った日 ? Math.min(30, 日数の差(今, m.最後に使った日)) : 30, 候補 = [];
    for (let i = 0; i < 材料.length; i++) for (let j = i + 1; j < 材料.length; j++) {
      const a = 材料[i], b = 材料[j];
      if (a.題 === b.題 || 除.has(a.出どころ + ":" + a.id) || 除.has(b.出どころ + ":" + b.id)) continue;
      const A = 二文字(a.題), 共通 = [...二文字(b.題)].filter(x => A.has(x)).sort();
      候補.push([共通.length * 3 + (古さ(a) + 古さ(b)) / 10 + (a.楽しい ? 1 : 0) + (b.楽しい ? 1 : 0) + 乱() * 0.5, a, b, 共通]);
    }
    候補.sort((x, y) => y[0] - x[0]);
    const 使った = new Set(), 組 = [];
    for (const [, a, b, 共通] of 候補) {
      const ka = a.出どころ + ":" + a.id, kb = b.出どころ + ":" + b.id; if (使った.has(ka) || 使った.has(kb)) continue;
      使った.add(ka); 使った.add(kb);
      組.push({ 材料: [a, b], 共通の語: 共通, 理由: 共通.length ? "「" + a.題 + "」と「" + b.題 + "」には、共通の言葉（" + 共通.slice(0, 3).join("、") + "）があるので、組にしました。" : "「" + a.題 + "」と「" + b.題 + "」は、最近あまり触れていない物なので、組にしました。" });
      if (組.length >= 組の数) break;
    }
    return 組;
  }
  function 実験の文(設定, 題A, 題B) {
    const 長さ = ((設定 && 設定.実験室) || {}).長さ分 || 15;
    const A = (題A || "").trim(), B = (題B || "").trim();
    if (!A || !B) throw new Error("言葉が空です"); if (A.length > 40 || B.length > 40) throw new Error("言葉が長すぎます（40文字まで）"); if (A === B) throw new Error("2つは、違う言葉にしてください");
    return "「" + A + "」と「" + B + "」を掛け合わせて、" + 長さ + "分で試します。「" + A + "」を、「" + B + "」の目で見直して、気づいたことを1つだけ書き出してください。";
  }

  // ---------- メモ（Mac 版の M1 と同じ決まり。期限なし。タスクとは別） ----------
  const メモ設定 = 設定 => Object.assign({ 種類: ["欲しい物", "やりたい事", "その他"], 本文の最大文字数: 500 }, (設定 && 設定.メモ) || {});
  function メモを検査する(設定, 本文, 種類) {
    const s = メモ設定(設定); 本文 = (本文 || "").trim();
    if (!本文) throw new Error("メモが空です");
    if (本文.length > s.本文の最大文字数) throw new Error("長すぎます（" + s.本文の最大文字数 + "文字まで）");
    if (!s.種類.includes(種類)) throw new Error("種類は " + s.種類.join("・") + " のどれかです");
    return 本文;
  }
  function メモを足す(データ, 設定, 本文, 種類 = "その他", 今 = new Date()) {
    本文 = メモを検査する(設定, 本文, 種類); データ.memos = データ.memos || [];
    const メモ = 更新印({ id: 新しいid(データ.memos), 日付: 時刻文字(今), 種類, 本文 }, 今); データ.memos.push(メモ); return メモ;
  }
  function メモを直す(データ, 設定, 番号, 本文, 種類, 今 = new Date()) {
    本文 = メモを検査する(設定, 本文, 種類);
    const r = (データ.memos || []).find(x => x.id === 番号 && !x.削除); if (!r) throw new Error("そのメモはありません");
    r.本文 = 本文; r.種類 = 種類; 更新印(r, 今); return r;
  }
  function メモを消す(データ, 番号, 今 = new Date()) {
    const r = (データ.memos || []).find(x => x.id === 番号 && !x.削除); if (!r) throw new Error("そのメモはありません");
    削除印(r, 今); return r;
  }

  // ---------- カレンダー（締切型タスクを、月の表に並べる。Mac の画面も、この関数を使う） ----------
  function 締切の一覧(タスク一覧, 今 = new Date()) {
    const 今日 = 日付文字(今), 結果 = [];
    for (const t of 生きている(タスク一覧).filter(t => !t.倉庫)) {
      if (t.種類 !== "締切" || !t.締切) continue;
      const 日 = t.締切.slice(0, 10), 時刻 = (t.締切.slice(11, 16) || "");
      結果.push({ タスク: t, 日付: 日, 時刻, 残り日: -日数の差(今, 日), 期限切れ: (() => { try { return 締切の日時(t.締切) < 今; } catch (e) { return 日 < 今日; } })() });
    }
    return 結果.sort((a, b) => (a.日付 + a.時刻).localeCompare(b.日付 + b.時刻));
  }
  function 月の表(年, 月, タスク一覧, 今 = new Date()) {         // 月は 1〜12。週は日曜はじまり
    const 今日 = 日付文字(今), 一覧 = 締切の一覧(タスク一覧, 今), 先頭 = new Date(年, 月 - 1, 1), 末 = new Date(年, 月, 0).getDate();
    const 日々 = [];
    for (let i = 0; i < 先頭.getDay(); i++) 日々.push(null);
    for (let d = 1; d <= 末; d++) { const 日付 = 年 + "-" + 二桁(月) + "-" + 二桁(d); 日々.push({ 日付, 日: d, 今日: 日付 === 今日, 締切: 一覧.filter(x => x.日付 === 日付) }); }
    while (日々.length % 7) 日々.push(null);
    const 週 = []; for (let i = 0; i < 日々.length; i += 7) 週.push(日々.slice(i, i + 7));
    return { 年, 月, 週 };
  }

  // ---------- 受け取り箱（Mac 版の D2 と同じ決まり） ----------
  function 箱の中身(データ, 今 = new Date()) {
    const 今日 = 日付文字(今);
    return 生きている(データ.deposits).filter(r => r.返す日 && r.返す日 <= 今日 && r.反応 === null);
  }
  function 預けを開く(データ, 番号, 今 = new Date()) {
    const 箱 = new Set(箱の中身(データ, 今).map(r => r.id)), r = データ.deposits.find(x => x.id === 番号 && !x.削除);
    if (!r) throw new Error("その預けはありません");
    if (!箱.has(番号)) throw new Error("その預けは、受け取り箱にありません");
    if (r.受け取った日 === null) { r.受け取った日 = 日付文字(今); 更新印(r, 今); }
    return r;
  }
  function 預けに反応する(データ, 設定, 番号, 反応, 新しい本文 = null, 返す選択 = "なし", 今 = new Date()) {
    if (!["いまも同じ", "変わった", "消す"].includes(反応)) throw new Error("反応は、いまも同じ・変わった・消す のどれかです");
    預けを開く(データ, 番号, 今);
    let 新しい預け = null;
    if (反応 === "変わった" && (新しい本文 || "").trim()) 新しい預け = 預ける(データ, 設定, 新しい本文, null, 返す選択, 今);   // 先に預け直す（失敗したら、元は変えない）
    const r = データ.deposits.find(x => x.id === 番号);
    if (反応 === "消す") 削除印(r, 今); else { r.反応 = 反応; 更新印(r, 今); }
    return 新しい預け;
  }

  // ---------- 夜の封印（Mac 版の A6 と同じ決まり） ----------
  function 封じる(データ, 設定, タスクid, 今 = new Date()) {
    if (!生きている(データ.tasks).filter(t => !t.倉庫).some(t => t.id === タスクid)) throw new Error("そのタスクはありません");
    const 境 = 設定.柱A.夜の封印.朝とみなす境の時, 対象 = new Date(今.getFullYear(), 今.getMonth(), 今.getDate() + (今.getHours() >= 境 ? 1 : 0));
    for (const r of データ.seals) if (r.状態 === "封中") { r.状態 = "差し替え"; 更新印(r, 今); }
    const r = 更新印({ id: 新しいid(データ.seals), 封じた日時: 時刻文字(今), 対象日: 日付文字(対象), タスクid, 状態: "封中" }, 今); データ.seals.push(r); return r;
  }
  function 封をやめる(データ, 今 = new Date()) { let n = 0; for (const r of データ.seals) if (r.状態 === "封中") { r.状態 = "やめた"; 更新印(r, 今); n++; } return n; }
  const 今の封 = データ => データ.seals.find(r => r.状態 === "封中") || null;
  function 今日の封印(データ, 今 = new Date()) {
    const r = 今の封(データ); if (!r || r.対象日 !== 日付文字(今)) return null;
    const タスク = 生きている(データ.tasks).filter(t => !t.倉庫).find(t => t.id === r.タスクid); return タスク ? Object.assign({}, r, { タスク }) : null;
  }
  function 封を済にする(データ, 封id, 結果, 今 = new Date()) {
    if (!["始めた", "今日はやらない"].includes(結果)) throw new Error("結果は、始めた・今日はやらない のどちらかです");
    const r = データ.seals.find(x => x.id === 封id && x.状態 === "封中"); if (!r) throw new Error("その封はありません");
    r.状態 = 結果; 更新印(r, 今);
  }

  // ---------- 価値観の問い（Mac 版の C1 と同じ決まり） ----------
  function 次の問い(データ, 設定, 今 = new Date()) {
    const 今日 = 日付文字(今), v = データ.values || { 答え: {}, 今日はやめた: {} };
    return (設定.土台2.価値観の問い || []).find(q => !(q.キー in v.答え) && v.今日はやめた[q.キー] !== 今日) || null;
  }
  function 価値観に答える(データ, 設定, キー, 選択 = null, 一言 = "", 今 = new Date()) {
    const q = (設定.土台2.価値観の問い || []).find(x => x.キー === キー); if (!q) throw new Error("その問いはありません");
    if (選択 !== null && !q.選択肢.includes(選択)) throw new Error("選択肢にない答えです");
    一言 = (一言 || "").trim(); if (選択 === null && !一言) throw new Error("選択肢を選ぶか、一言を書いてください");
    データ.values = データ.values || { 答え: {}, 今日はやめた: {} };
    データ.values.答え[キー] = 更新印({ 選択, 一言, 更新日: 日付文字(今) }, 今);
  }
  function 価値観を今日はやめる(データ, 設定, キー, 今 = new Date()) {
    if (!(設定.土台2.価値観の問い || []).some(x => x.キー === キー)) throw new Error("その問いはありません");
    データ.values = データ.values || { 答え: {}, 今日はやめた: {} }; データ.values.今日はやめた[キー] = 日付文字(今);
  }

  // ---------- ニュース（スマホは見るだけ。Mac が集めた見出しを、同期で受け取る） ----------
  function ニュースを並べる(ニュース, 設定) {
    const 語 = ((設定.柱E || {}).興味の語 || []).filter(w => w), 件 = (設定.柱E || {}).表示件数 || 50;
    const 一覧 = (ニュース || []).filter(r => r.反応 !== "いらない").map(r => { const 合う = 語.filter(w => r.見出し.includes(w)); return Object.assign({}, r, { 合う語: 合う, 理由: 合う.length ? "『" + 合う.join("』『") + "』を含むため" : null }); });
    const 新しい順 = (a, b) => ((b.掲載日時 || b.取得日時) > (a.掲載日時 || a.取得日時) ? 1 : (b.掲載日時 || b.取得日時) < (a.掲載日時 || a.取得日時) ? -1 : 0);
    return 一覧.filter(r => r.合う語.length).sort(新しい順).concat(一覧.filter(r => !r.合う語.length).sort(新しい順)).slice(0, 件);
  }

  // ---------- 生活の点数と睡眠（Mac 版の L1_生活の点数.py と同じ決まり） ----------
  // 点数は、出来事の記録（life_events）から、いつでも計算し直せる。疲れは、睡眠の記録（sleep_logs）から決まる。
  const 種類一覧 = ["ログイン", "達成", "五分", "気分じゃない", "締切切れ", "会話", "放置"];
  const 四捨五入 = x => Math.floor(x + 0.5), 一桁丸め = v => 四捨五入(v * 10) / 10;
  const 新しい今日 = () => ({ 達成: 0, 五分: 0, 気分じゃない: 0, 会話: 0, ログイン: false });
  const 生きた一覧 = 一覧 => (一覧 || []).filter(r => !r.削除);
  const 文字順 = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function 顔の名前(点, 段階) { let 名 = 段階[0][1]; for (const [下, n] of 段階) if (点 >= 下) 名 = n; return 名; }
  function 点数を計算(出来事, 設定, 今 = new Date()) {
    const e = 設定.エルピー, g = e.生活, p = e.点数, 今日 = 日付文字(今);
    const 並び = 出来事.slice().sort((a, b) => 文字順(a.日付, b.日付) || 文字順(a.日時 || "", b.日時 || "") || 文字順(String(a.id), String(b.id)));
    if (!並び.length) return { 点数: 0, 履歴: [], 今日: 新しい今日() };
    const 放置 = {}, 日別 = {};
    for (const r of 並び) { if (r.種 === "放置") 放置[r.日付] = r; else (日別[r.日付] = 日別[r.日付] || []).push(r); }
    const 日の値 = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
    const 日文字 = ms => { const d = new Date(ms); return d.getUTCFullYear() + "-" + 二桁(d.getUTCMonth() + 1) + "-" + 二桁(d.getUTCDate()); };
    let 点 = 0, 履歴 = [], 数 = 新しい今日();
    const 加える = (日, 差, 理由) => { const 前 = 点; 点 = Math.max(p.下限, Math.min(p.上限, 点 + 差)); 履歴.push({ 日付: 日, 理由, 点: 一桁丸め(点 - 前) }); };
    const 末 = Math.max(日の値(並び[並び.length - 1].日付), 日の値(今日));
    for (let ms = 日の値(並び[0].日付); ms <= 末; ms += 86400000) {
      const 日 = 日文字(ms); 数 = 新しい今日();
      for (const r of 日別[日] || []) {
        const k = r.種;
        if (k === "ログイン") { if (数.ログイン) 加える(日, 0, "ログイン（今日はもう加点済み）"); else { 数.ログイン = true; 加える(日, g.ログイン, "ログイン"); } }
        else if (k === "達成" || k === "五分") {
          const 名 = k === "達成" ? "タスク達成" : "タスクを5分やった", 実 = Math.min(g[k].点, g[k].上限 - 数[k]);
          if (実 <= 0) 加える(日, 0, 名 + "（今日の上限に達したので、加点なし）"); else { 数[k] += 実; 加える(日, 実, 名); }
        }
        else if (k === "気分じゃない") { if (数.気分じゃない >= g.気分じゃない.回数) 加える(日, 0, "「気分じゃない」（今日の回数の上限なので、減点なし）"); else { 数.気分じゃない++; 加える(日, g.気分じゃない.点, "「気分じゃない」を選んだ"); } }
        else if (k === "締切切れ") 加える(日, g.締切切れ, r.理由 || "締切切れ");
        else if (k === "会話") {
          const 差 = Math.max(-p.一回の最大, Math.min(p.一回の最大, r.点 || 0)), 残 = g.会話の上限 - 数.会話;
          const 実 = (差 > 0 ? 1 : 差 < 0 ? -1 : 0) * Math.min(Math.abs(差), Math.max(0, 残)); 数.会話 += Math.abs(実);
          if (差 !== 0) 加える(日, 実, 実 === 差 ? (r.理由 || "会話") : (r.理由 || "会話") + "（今日の会話の上限で、一部だけ）");
        }
      }
      if (日 < 今日) {
        加える(日, -点 * g.戻る割合, "1日の終わり：0へ戻る（" + 四捨五入(g.戻る割合 * 100) + "%）");
        if (放置[日] && (放置[日].日数 || 0) > 0) {
          const n = 放置[日].日数, 減 = Math.max(g.放置.上限, g.放置.点 * n);
          加える(日, 減, "放置（放置日数の合計 " + n + "日" + (減 > g.放置.点 * n ? "、1日の上限で止めた" : "") + "）");
        }
      }
    }
    return { 点数: 一桁丸め(点), 履歴: 履歴.reverse().slice(0, 30), 今日: 数 };
  }
  function 疲れを計算(睡眠, 設定, 今 = new Date()) {
    const s = 設定.エルピー.睡眠, n = s.日数, 表 = {}, 時間 = [];
    for (const r of 睡眠) 表[r.日付] = r.時間;
    for (let i = 0; i < n; i++) { const v = 表[日付文字(new Date(今.getFullYear(), 今.getMonth(), 今.getDate() - i))]; if (typeof v === "number") 時間.push(v); }
    if (!時間.length) return { 疲れ: 0, 入力日数: 0, 時間: [], 合計: null, 説明: "睡眠：まだ入力なし（疲れは0のまま）" };
    const 合計 = 時間.reduce((a, b) => a + b, 0) / 時間.length * n;
    const 疲れ = 四捨五入(Math.max(0, Math.min(100, (s.疲れ0 - 合計) / (s.疲れ0 - s.疲れ100) * 100)));
    return { 疲れ, 入力日数: 時間.length, 時間, 合計: 一桁丸め(合計), 説明: "直近" + n + "日の睡眠：" + 時間.length + "日分の入力（" + 時間.map(v => v + "h").join("、") + "）→ " + n + "日合計 " + 一桁丸め(合計).toFixed(1) + "時間 → 疲れ " + 疲れ + (時間.length < n ? "（入れ忘れは平均で補った）" : "") };
  }
  // 出来事を1件、足す。番号を決めたい物（ログイン・締切切れ・放置）は、同じ番号が既にあれば、足さない
  function 出来事を書く(データ, 種, 今 = new Date(), { 点 = null, 理由 = null, 日数 = null, 番号 = null } = {}) {
    if (!種類一覧.includes(種)) throw new Error("出来事の種類は " + 種類一覧.join("・") + " のどれかです");
    データ.life_events = データ.life_events || [];
    if (番号 !== null && データ.life_events.some(r => r.id === 番号)) return null;
    const r = { id: 番号 !== null ? 番号 : 新しいid(データ.life_events), 日時: 時刻文字(今), 日付: 日付文字(今), 種 };
    if (点 !== null) r.点 = 点; if (日数 !== null) r.日数 = 日数; if (理由) r.理由 = 理由;
    データ.life_events.push(更新印(r, 今)); return r;
  }
  function 放置日数の合計(日, タスク一覧) {
    let 合計 = 0;
    for (const t of タスク一覧) { if (t.倉庫 || (t.作成日 || "") > 日) continue; 合計 += Math.max(0, Math.round((日の値(日) - 日の値(t.最後に触った日)) / 86400000)); }
    return 合計;
  }
  const 日の値 = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); };
  // 起動の手続き（何度呼んでも同じ）：ログインを記録 → 昨日までの放置を数える → 締切が切れたタスクを数える
  function 開く(データ, 今 = new Date()) {
    const 今日 = 日付文字(今), 報告 = { 放置: 0, 締切切れ: 0 };
    出来事を書く(データ, "ログイン", 今, { 番号: "ログイン-" + 今日 });
    const 開始 = 生きた一覧(データ.life_events).filter(r => r.種 === "ログイン").map(r => r.日付).sort()[0];
    const タスク = 生きた一覧(データ.tasks);
    for (const t of タスク) {
      if (t.種類 === "締切" && !t.倉庫) {
        const 切れ = 締切の日時(t.締切);
        if (切れ <= 今 && 日付文字(切れ) >= 開始 && 出来事を書く(データ, "締切切れ", 切れ, { 番号: "締切切れ-" + t.id, 理由: "締切切れ：" + t.内容 })) 報告.締切切れ++;
      }
    }
    for (let ms = 日の値(開始); ; ms += 86400000) {
      const d = new Date(ms), 日 = d.getUTCFullYear() + "-" + 二桁(d.getUTCMonth() + 1) + "-" + 二桁(d.getUTCDate());
      if (日 >= 今日) break;
      const 終わり = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59);
      if (出来事を書く(データ, "放置", 終わり, { 日数: 放置日数の合計(日, タスク), 番号: "放置-" + 日 })) 報告.放置++;
    }
    return 報告;
  }
  // 今日の分（昨夜の睡眠）を記録する。時間が null なら「わからない」（入力なし扱い）。同じ日に答え直せる
  function 睡眠を答える(データ, 時間, 今 = new Date()) {
    if (時間 !== null && (typeof 時間 !== "number" || !(時間 >= 0 && 時間 <= 24))) throw new Error("睡眠時間は、0〜24 の数字か、「わからない」です");
    データ.sleep_logs = データ.sleep_logs || [];
    const 番号 = "睡眠-" + 日付文字(今), 既 = データ.sleep_logs.find(r => r.id === 番号);
    if (既) { 既.時間 = 時間; delete 既.削除; 更新印(既, 今); } else データ.sleep_logs.push(更新印({ id: 番号, 日付: 日付文字(今), 時間 }, 今));
  }
  function 達成する(データ, タスクid, 今 = new Date()) {
    const t = データ.tasks.find(x => x.id === タスクid && !x.削除);
    if (!t) throw new Error("そのタスクはありません");
    t.最後に触った日 = 日付文字(今);
    if (t.種類 === "締切") 削除印(t, 今); else 更新印(t, 今);
    出来事を書く(データ, "達成", 今, { 理由: "達成：" + t.内容 }); return t;
  }
  function 会話の点(文, 言葉) {
    let 合計 = 0; const 理由 = [];
    for (const [語一覧, 点] of 言葉) for (const w of 語一覧) if (文.includes(w)) { 合計 += 点; 理由.push("「" + w + "」" + (点 > 0 ? "+" : "") + 点); }
    return [合計, 理由];
  }
  function 生活の状態(データ, 設定, 今 = new Date()) {
    const 点 = 点数を計算(生きた一覧(データ.life_events), 設定, 今), 睡 = 生きた一覧(データ.sleep_logs), 疲 = 疲れを計算(睡, 設定, 今), 今日の答え = 睡.filter(r => r.日付 === 日付文字(今));
    return { 点数: 点.点数, 顔: 顔の名前(点.点数, 設定.エルピー.段階), 疲れ: 疲.疲れ, 疲れの説明: 疲.説明, 履歴: 点.履歴, 今日: 点.今日,
             睡眠の質問: !今日の答え.length, 今日の睡眠: 今日の答え.length ? 今日の答え[0].時間 : null };
  }

  // ---------- 同期（突き合わせ。Mac 版の H1_突き合わせ.py と同じ決まり） ----------
  const 形式の版 = 1, 混ぜる一覧名 = ["tasks", "deposits", "state_logs", "seals", "suggestion_log", "focus_log", "memos", "life_events", "sleep_logs", "warehouse_items", "wishlist", "duration_log"];
  const 整列 = v => Array.isArray(v) ? v.map(整列) : (v && typeof v === "object") ? Object.keys(v).sort().reduce((o, k) => (o[k] = 整列(v[k]), o), {}) : v;
  const 同じ内容 = (a, b) => JSON.stringify(整列(a)) === JSON.stringify(整列(b));
  const 新しい方 = (自分, 相手) => ((相手.更新日時 || "") > (自分.更新日時 || "") ? 相手 : 自分);
  function 一覧を混ぜる(自分, 相手) {
    const 混ぜた = new Map(自分.map(r => [r.id, r])); let 入った = 0;
    for (const r of 相手) {
      if (!混ぜた.has(r.id)) { 混ぜた.set(r.id, r); 入った++; }
      else { const 今の = 混ぜた.get(r.id), 勝つ = 新しい方(今の, r); if (勝つ === r && !同じ内容(r, 今の)) 入った++; 混ぜた.set(r.id, 勝つ); }
    }
    return [Array.from(混ぜた.values()), 入った];
  }
  function 価値観を混ぜる(自分, 相手) {
    const 結果 = { 答え: Object.assign({}, 自分.答え || {}), 今日はやめた: Object.assign({}, 自分.今日はやめた || {}) }; let 入った = 0;
    for (const [k, a] of Object.entries((相手 || {}).答え || {})) if (!(k in 結果.答え) || (a.更新日時 || "") > (結果.答え[k].更新日時 || "")) { 結果.答え[k] = a; 入った++; }
    for (const [k, 日] of Object.entries((相手 || {}).今日はやめた || {})) if (日 > (結果.今日はやめた[k] || "")) 結果.今日はやめた[k] = 日;
    return [結果, 入った];
  }
  function 古い削除を消す(一覧, 今, 日数) {
    const 限 = 時刻文字(new Date(今.getFullYear(), 今.getMonth(), 今.getDate() - 日数, 今.getHours(), 今.getMinutes(), 今.getSeconds()));
    const 残す = 一覧.filter(r => !(r.削除 && r.削除 < 限)); return [残す, 一覧.length - 残す.length];
  }
  function 同期ファイルを確かめる(ファイル) {
    if (!ファイル || ファイル.版 !== 形式の版 || !ファイル.データ || typeof ファイル.データ !== "object") throw new Error("同期ファイルが、読めません（壊れているか、新しい版です）。上書きしないで、止めました");
    return ファイル;
  }
  // 自分のデータと、同期ファイルを混ぜる。戻り値：{ 新しいデータ, 出力（同期ファイルに書く物）, 報告 }。何も書き換えない
  function 同期を組み立てる(データ, 相手ファイル, 日数 = 30, 今 = new Date()) {
    const 相手 = 相手ファイル ? 同期ファイルを確かめる(相手ファイル) : null, 相手デ = 相手 ? 相手.データ : {};
    const 新 = {}, 報告 = { 入った: 0, 消した古い削除: 0 };
    for (const 名 of 混ぜる一覧名) {
      let [混ぜた, 入った] = 一覧を混ぜる(データ[名] || [], 相手デ[名] || []); let 消した;
      [混ぜた, 消した] = 古い削除を消す(混ぜた, 今, 日数); 新[名] = 混ぜた; 報告.入った += 入った; 報告.消した古い削除 += 消した;
    }
    const [値, 入った] = 価値観を混ぜる(データ.values || { 答え: {}, 今日はやめた: {} }, 相手デ.values); 新.values = 値; 報告.入った += 入った;
    const 出力 = { 版: 形式の版, 更新: 時刻文字(今), 端末: "スマホ", データ: 新, Macから: 相手 ? (相手.Macから || null) : null };
    return { 新しいデータ: 新, 出力, 報告 };
  }

  // ドライブ（読む・書く）を渡して、同期を実行する。先に、ドライブへ書き、成功してから、手元の物を新しくする（途中で失敗しても、手元は壊れない）。
  // ドライブ：{ 読む(): 文字列|null、書く(新しい文字列, 前の文字列|null): 完了 }
  async function 同期を実行(ドライブ, データ, 今 = new Date()) {
    const 生 = await ドライブ.読む();
    let 相手 = null;
    if (生 !== null) { try { 相手 = JSON.parse(生); } catch (e) { throw new Error("同期ファイルが、読めません（壊れているか、新しい版です）。上書きしないで、止めました"); } }
    const 日数 = (相手 && 相手.Macから && 相手.Macから.設定 && 相手.Macから.設定.スマホ連携 && 相手.Macから.設定.スマホ連携.削除の印を本当に消すまでの日数) || 30;
    const 結果 = 同期を組み立てる(データ, 相手, 日数, 今);
    await ドライブ.書く(JSON.stringify(結果.出力), 生);
    return { 新しいデータ: 結果.新しいデータ, 報告: 結果.報告, 設定: 相手 && 相手.Macから ? 相手.Macから.設定 : null, ニュース: 相手 && 相手.Macから ? 相手.Macから.ニュース : null };
  }

  const 公開 = { 締切を整える, 点数, 順位表, 提案, 理由を作る, 残りの言い方, 今日の様子, 新しいid, 更新印, 削除印, 生きている, タスクを足す, タスクを直す, タスクを消す,
                 倉庫設定, 倉庫の候補, 倉庫に積む, 倉庫に入れる, 窓口, 倉庫で処理, 灰, 種, 灰を戻す, 棚に置く, 棚, 棚に答える, 翌朝の体を答える, 棚から外す,
                 通信の状況, 通信の返事, 節目の文, 実験の材料, 実験の組, 実験の文, カレンダー設定, 望む予定, 予定の差, 空き時間, 今の空き, 倍率の表, 使う見積もり, 相場を足す, 分解の案, 分解して足す, 提案を記録, 反応を記録, あとでを戻す, 五分を始める, 五分を終える, 状態を記録, 使える状態, 預ける, メモ設定, メモを足す, メモを直す, メモを消す, 締切の一覧, 月の表, 日付文字, 時刻文字,
                 一覧を混ぜる, 価値観を混ぜる, 古い削除を消す, 同期を組み立てる, 同期ファイルを確かめる, 同期を実行,
                 点数を計算, 疲れを計算, 出来事を書く, 開く, 睡眠を答える, 達成する, 会話の点, 生活の状態, 顔の名前, 放置日数の合計,
                 箱の中身, 預けを開く, 預けに反応する, 封じる, 封をやめる, 今の封, 今日の封印, 封を済にする, 次の問い, 価値観に答える, 価値観を今日はやめる, ニュースを並べる };
  if (typeof module !== "undefined" && module.exports) module.exports = 公開; else root.LifePilot = 公開;
})(typeof self !== "undefined" ? self : this);
