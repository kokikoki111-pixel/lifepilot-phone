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
      if (残り日 <= 0 && !重み.期限切れは直前と同じ) 緊急 = 重要度 * 重み.期限切れの倍率;     // 期限切れは、直前と同じ（設定で、前の決まりにも戻せる）
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
    const L = データ.state_logs.filter(r => !r.休会); if (!L.length) return null;      // 休会の印は、体・気分ではない
    const 最新 = L.reduce((a, b) => (b.日時 >= a.日時 ? b : a));
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(最新.日時);
    const 経過 = 今 - new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return 経過 >= 0 && 経過 <= 設定.土台2.使い回す時間_時間 * 3600 * 1000 ? 最新 : null;
  }

  // ---------- 休会と復帰（第2段階。Mac の B1_状態.py と同じ決まり。state_logs に「休会」の印（開始・再開・復帰を見た）を足す） ----------
  const 休会の印 = (データ, 種類) => 生きた一覧(データ.state_logs).filter(r => r.休会 && (!種類 || 種類.includes(r.休会))).sort((a, b) => (a.日時 < b.日時 ? -1 : a.日時 > b.日時 ? 1 : 0));
  function 休会中(データ) { const h = 休会の印(データ, ["開始", "再開"]); return h.length > 0 && h[h.length - 1].休会 === "開始"; }
  function 休会の印を足す(データ, 種, 今) { const r = 更新印({ id: 新しいid(データ.state_logs), 日時: 時刻文字(今), 休会: 種 }, 今); データ.state_logs.push(r); return r; }
  function 休会する(データ, 今 = new Date()) { return 休会中(データ) ? null : 休会の印を足す(データ, "開始", 今); }
  function 再開する(データ, 今 = new Date()) { return 休会中(データ) ? 休会の印を足す(データ, "再開", 今) : null; }
  const 日数差 = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
  function 復帰の材料(データ, 設定, 今 = new Date()) {
    const 今日 = 日付文字(今); if (休会中(データ)) return null;
    const 印 = 休会の印(データ), 再開 = 印.filter(r => r.休会 === "再開"), 見た = 印.filter(r => r.休会 === "復帰を見た");
    let 理由 = null, 日数 = null;
    if (再開.length && (!見た.length || 見た[見た.length - 1].日時 < 再開[再開.length - 1].日時)) {
      理由 = "再開"; const 開始 = 印.filter(r => r.休会 === "開始" && r.日時 <= 再開[再開.length - 1].日時);
      if (開始.length) 日数 = 日数差(開始[開始.length - 1].日時.slice(0, 10), 再開[再開.length - 1].日時.slice(0, 10));
    } else if (!(見た.length && 見た[見た.length - 1].日時.slice(0, 10) === 今日)) {
      const 前 = 生きた一覧(データ.life_events).filter(r => r.種 === "ログイン" && r.日付 < 今日).map(r => r.日付).sort();
      if (前.length) { const あき = 日数差(前[前.length - 1], 今日); if (あき >= ((((設定 || {}).土台2 || {}).休会 || {}).久しぶりの日数 ?? 3)) {      // 古い設定（休会の項目がない）でも、3日で動く
         理由 = "久しぶり"; 日数 = あき; } }
    }
    if (!理由) return null;
    const 提案 = 生きた一覧(データ.suggestion_log).sort((a, b) => (a.日時 < b.日時 ? -1 : a.日時 > b.日時 ? 1 : 0));
    let 最後 = null, 待ち = null;
    if (提案.length) { const 末 = 提案[提案.length - 1], タ = 生きた一覧(データ.tasks).find(t => t.id === 末.候補id); 最後 = タ ? タ.内容 : null; 待ち = 末.空き分 ?? null; }
    return { 理由, 休んだ日数: 日数, 最後の一手: 最後, 待ち時間: 待ち };
  }
  function 復帰を見た(データ, 設定, 今 = new Date()) { return 復帰の材料(データ, 設定, 今) ? 休会の印を足す(データ, "復帰を見た", 今) : null; }

  // ---------- 預ける ----------
  function 預ける(データ, 設定, 本文, 種類 = null, 返す選択 = "なし", 今 = new Date()) {
    const s = 設定.柱B; 本文 = (本文 || "").trim();
    if (!本文 && 種類 === "もやっと") 本文 = "もやっと";                // ワンタップ。押した時刻だけ残す
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
    if (休会中(データ)) return [];                                  // 休会中は、通知を止める（［LP］の予定は、次のカレンダー反映で消える。再開すれば、また作る）
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
    const 持つ = new Map(), 重複 = []; for (const e of 既存) { const p = (e.extendedProperties || {}).private || {}; if (p.lifepilot === "1" && p.lpkey) { if (持つ.has(p.lpkey)) 重複.push(e); else 持つ.set(p.lpkey, e); } }
    const 作る = [], 直す = [], 消す = [], 望むキー = new Set(望む.map(x => x.キー));
    for (const e of 重複) { const 始 = new Date((e.start || {}).dateTime || (e.start || {}).date || 0); if (始 >= 今) 消す.push({ id: e.id, キー: e.extendedProperties.private.lpkey }); }
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
  // スマホの AI：自由な言葉は「返事待ち」にして、同期で Mac の AI が返事を書く（Mac 版の V1_スマホへの返事.py）
  function AIの依頼を足す(データ, 相手, 文, 状況, 履歴 = [], 今 = new Date()) {
    データ.ai_requests = データ.ai_requests || [];
    const r = 更新印({ id: 新しいid(データ.ai_requests), 日時: 時刻文字(今), 相手, 文: (文 || "").trim(), 状況, 履歴: 履歴.slice(-6) }, 今);
    データ.ai_requests.push(r); return r;
  }
  function 届いた返事(データ, 見た = []) {         // まだ通信に出していない、AI の返事（本文のある物だけ）
    const 済 = new Set(見た); return 生きた一覧(データ.ai_replies).filter(r => r.由来 === "AI" && r.本文 && !済.has(r.id));
  }
  // 通信の絵の表情：最後に来た通信の出所から（達成は笑顔、命令は真剣、締切切れは困り）
  function 通信の表情(出所) {
    return ({ 達成: "笑顔", 筋トレ: "笑顔", 朝: "笑顔", 五分: "真剣", 放置: "真剣", 筋トレの間: "真剣", 締切切れ: "困り", 専門窓口: "真剣" })[出所] || "ふつう";
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

  function 見出しの実験の文(設定, 題) {                 // Mac の X1 の 見出しの実験の文 と同じ文
    const 長さ = ((設定 && 設定.実験室) || {}).長さ分 || 15, T = (題 || "").trim();
    if (!T) throw new Error("見出しが空です");
    return "「" + T + "」への興味を、" + 長さ + "分で小さく試します。①見出しの中で、いちばん知らない言葉を1つ選びます（2分）。②その言葉を調べて、自分の言葉で1行にまとめます（" + Math.max(3, 長さ - 7) + "分）。③その1行を使って、いまの暮らしや勉強で試せる小さなことを1つ書きます（5分）。";
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
  const 日の差 = (文字, 今) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(文字); return Math.round((Date.UTC(今.getFullYear(), 今.getMonth(), 今.getDate()) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000); };
  // 戻す仕組み（Mac の D2 と同じ決まり）：①古い声＝返す日なしで古い一言を7日に1つ ②わからなかった一点＝土日に2つまで
  function 箱の中身(データ, 設定, 今 = new Date()) {
    const 今日 = 日付文字(今), 一覧 = 生きている(データ.deposits), s = (設定 && 設定.柱B) || {};
    const 古い日数 = s.古い声の日数 ?? 30, 一点の種類 = s.週末に出す種類 || ["わからない一点"];
    let 箱 = 一覧.filter(r => r.返す日 && r.返す日 <= 今日 && r.反応 === null);
    if (今.getDay() === 0 || 今.getDay() === 6) {
      const 一点 = 一覧.filter(r => 一点の種類.includes(r.種類) && r.反応 === null && r.日付.slice(0, 10) < 今日 && 日の差(r.持ち越し日 || r.日付, 今) >= (r.持ち越し日 ? 6 : 1)).sort((x, y) => x.日付 < y.日付 ? -1 : 1).slice(0, 2);
      箱 = 箱.concat(一点);
    }
    const 古い = 一覧.filter(r => r.返す日 === null && r.反応 === null && !一点の種類.includes(r.種類) && r.種類 !== "もやっと" && r.種類 !== "勝ち" && !r.古い声を聞いた日 && 日の差(r.日付, 今) >= 古い日数).sort((x, y) => x.日付 < y.日付 ? -1 : 1);
    const 直近 = 一覧.some(r => r.古い声を聞いた日 && 日の差(r.古い声を聞いた日, 今) < 7);
    if (古い.length && !直近) 箱.push(古い[0]);
    for (const r of 一覧) if (r.古い声を聞いた日 && r.反応 === null && r.返す日 === null && !箱.includes(r)) 箱.push(r);
    return 箱;
  }
  const 区分 = (r, 設定) => (((設定 || {}).柱B || {}).週末に出す種類 || ["わからない一点"]).includes(r.種類) ? "わからなかった一点" : (r.返す日 === null ? "古い声" : "返す日");
  function 預けを開く(データ, 設定, 番号, 今 = new Date()) {
    const 箱 = new Set(箱の中身(データ, 設定, 今).map(r => r.id)), r = データ.deposits.find(x => x.id === 番号 && !x.削除);
    if (!r) throw new Error("その預けはありません");
    if (!箱.has(番号)) throw new Error("その預けは、受け取り箱にありません");
    if (r.返す日 === null && 区分(r, 設定) === "古い声" && !r.古い声を聞いた日) { r.古い声を聞いた日 = 日付文字(今); 更新印(r, 今); }
    if (r.受け取った日 === null) { r.受け取った日 = 日付文字(今); 更新印(r, 今); }
    return r;
  }
  function 預けに反応する(データ, 設定, 番号, 反応, 新しい本文 = null, 返す選択 = "なし", 今 = new Date()) {
    if (!["いまも同じ", "変わった", "消す", "解決済み", "持ち越し"].includes(反応)) throw new Error("反応は、いまも同じ・変わった・消す・解決済み・持ち越し のどれかです");
    預けを開く(データ, 設定, 番号, 今);
    let 新しい預け = null;
    if (反応 === "変わった" && (新しい本文 || "").trim()) 新しい預け = 預ける(データ, 設定, 新しい本文, null, 返す選択, 今);   // 先に預け直す（失敗したら、元は変えない）
    const r = データ.deposits.find(x => x.id === 番号);
    if (反応 === "消す") 削除印(r, 今); else if (反応 === "持ち越し") { r.持ち越し日 = 日付文字(今); 更新印(r, 今); } else { r.反応 = 反応; 更新印(r, 今); }
    return 新しい預け;
  }

  // ---------- もやっと・拠り所（Mac の D2 と同じ決まり） ----------
  function もやっと回数(データ, 日数 = 7, 今 = new Date()) {
    const 日別 = {};
    for (const r of 生きている(データ.deposits)) if (r.種類 === "もやっと" && 日の差(r.日付, 今) >= 0 && 日の差(r.日付, 今) < 日数) 日別[r.日付.slice(0, 10)] = (日別[r.日付.slice(0, 10)] || 0) + 1;
    return { 日数, 合計: Object.values(日別).reduce((a, b) => a + b, 0), 日別 };
  }
  const 勝ち一覧 = データ => 生きている(データ.deposits).filter(r => r.種類 === "勝ち");
  function 拠り所にする(データ, 番号, はい = true, 今 = new Date()) {
    const r = データ.deposits.find(x => x.id === 番号 && !x.削除); if (!r) throw new Error("その預けはありません");
    if (r.種類 !== "勝ち") throw new Error("拠り所にできるのは、種類が「勝ち」の預けだけです");
    r.拠り所 = !!はい; 更新印(r, 今); return r;
  }
  function 拠り所を出す(データ, 設定, 自分で開く = false, 今 = new Date()) {
    const 棚 = 勝ち一覧(データ).filter(r => r.拠り所).sort((x, y) => x.日付 < y.日付 ? -1 : 1); if (!棚.length) return null;
    if (!自分で開く) { const 状態 = 使える状態(データ, 設定, 今); if (!状態 || 状態.体 === null || 状態.体 > (設定.柱B.拠り所を出す体の値 ?? 40)) return null; }
    return 棚[日の差("2026-01-01", 今) % 棚.length];
  }

  // ---------- 授業ノート（Mac の N1 と同じ決まり。スマホでは、写真の文字を貼って残す。文字にするのは iPhone の「テキスト認識表示」） ----------
  function ノートを足す(データ, 科目, 本文, 今 = new Date()) {
    科目 = (科目 || "").trim(); 本文 = (本文 || "").trim();
    if (!科目) throw new Error("科目を書いてください");
    if (!本文) throw new Error("文字が空です");
    if (本文.length > 20000) throw new Error("長すぎます（20000文字まで）");
    データ.class_notes = データ.class_notes || [];
    const r = 更新印({ id: 新しいid(データ.class_notes), 日付: 時刻文字(今), 科目, 本文 }, 今); データ.class_notes.push(r); return r;
  }
  function ノートを消す(データ, 番号, 今 = new Date()) {
    const r = (データ.class_notes || []).find(x => x.id === 番号 && !x.削除); if (!r) throw new Error("そのノートはありません");
    削除印(r, 今);
  }
  const ノートを探す = (データ, 語) => 生きている(データ.class_notes || []).filter(r => !語 || r.本文.includes(語) || r.科目.includes(語)).sort((a, b) => (a.日付 < b.日付 ? 1 : -1));

  // ---------- 思考の種（X10。Mac の X3 と同じ決まり：日付だけで、問いを1つ選ぶ） ----------
  function 今日の問い(設定, 今 = new Date()) { const 問い = 設定.思考の種.問い; return { 問い: 問い[日の差("2026-01-01", 今) % 問い.length], 分: 設定.思考の種.考える分 }; }

  // ---------- 街の5つの段階・機能の木（Mac の Y1_街 と同じ決まり。段階は記録から、いつでも計算し直せる） ----------
  const 段階の名前 = ["崩壊", "混乱", "平和", "活気", "栄華"];
  function 日の終わりの点数(出来事, 設定, 今) {
    if (!出来事.length) return [];
    const 最初 = 出来事.map(r => r.日付).sort()[0], 答 = [], 今日 = 日付文字(今);
    let d = new Date(+最初.slice(0, 4), +最初.slice(5, 7) - 1, +最初.slice(8, 10));
    while (日付文字(d) < 今日) {
      const 日 = 日付文字(d);
      答.push([日, 点数を計算(出来事.filter(r => r.日付 <= 日), 設定, new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)).点数]);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return 答;
  }
  function 段階を計算(日ごと, s) {
    let 段 = s.始まり, 待つ = 0, 平均 = null; const 動いた = [];
    日ごと.forEach(([日], i) => {
      待つ -= 1;
      if (i + 1 < s.見る日数) return;
      const 窓 = 日ごと.slice(i + 1 - s.見る日数, i + 1).map(x => x[1]);
      平均 = Math.round(窓.reduce((a, b) => a + b, 0) / 窓.length * 10) / 10;
      if (待つ > 0) return;
      const 新 = Math.max(1, Math.min(段階の名前.length, 平均 >= s.上がる点 ? 段 + 1 : 平均 <= s.下がる点 ? 段 - 1 : 段));
      if (新 !== 段) { 動いた.push([日, 段, 新]); 段 = 新; 待つ = s.動かない日数; }
    });
    return { 段階: 段, 名前: 段階の名前[段 - 1], 平均, 動いた };
  }
  function 今の段階(データ, 設定, 今 = new Date()) { return 段階を計算(日の終わりの点数(生きた一覧(データ.life_events || []), 設定, 今), 設定.街.段階); }
  function 機能の木(データ, 設定, 今 = new Date()) {
    const 最後 = {}; for (const f of 使った機能の集計(データ, 今).機能) 最後[f.名前] = f.最後;
    return ((設定.街 || {}).機能の木 || []).map(群 => ({ 段階: 群.段階, 機能: 群.機能.map(([名, 元]) => { const 状態 = 元 === null || !(元 in 最後) ? "数えない" : 最後[元] ? "使った" : "まだ"; return { 名前: 名, 状態, 最後: 状態 === "使った" ? 最後[元] : null }; }) }));
  }

  // ---------- 練習（自由コーチの型。Mac の X3 と同じ決まり：日付で1つ、回を足すと別の問い） ----------
  function 練習の問い(設定, 型, 今 = new Date(), 回 = 0) {
    const t = (設定.練習 || { 型: {} }).型[型]; if (!t) throw new Error("型は " + Object.keys((設定.練習 || { 型: {} }).型).join("・") + " のどれかです");
    return { 型, 問い: t.質問[(日の差("2026-01-01", 今) + 回) % t.質問.length], 分: t.分, 言語: t.言語 };
  }

  // ---------- 夜の封印（Mac 版の A6 と同じ決まり） ----------
  function 封じる(データ, 設定, タスクid, 今 = new Date()) {
    if (!生きている(データ.tasks).filter(t => !t.倉庫).some(t => t.id === タスクid)) throw new Error("そのタスクはありません");
    const 境 = 設定.柱A.夜の封印.朝とみなす境の時, 対象 = new Date(今.getFullYear(), 今.getMonth(), 今.getDate() + (今.getHours() >= 境 ? 1 : 0));
    for (const r of データ.seals) if (r.状態 === "封中") { r.状態 = "差し替え"; 更新印(r, 今); }
    const r = 更新印({ id: 新しいid(データ.seals), 封じた日時: 時刻文字(今), 対象日: 日付文字(対象), タスクid, 状態: "封中" }, 今); データ.seals.push(r); return r;
  }
  function 封をやめる(データ, 今 = new Date()) { let n = 0; for (const r of データ.seals) if (r.状態 === "封中") { r.状態 = "やめた"; 更新印(r, 今); n++; } return n; }
  const 今の封 = データ => データ.seals.filter(r => r.状態 === "封中").reduce((a, r) => (!a || r.封じた日時 > a.封じた日時) ? r : a, null);   // 同期で2つになったら、新しい方
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
    const 一覧 = (ニュース || []).filter(r => r.反応 !== "いらない" && !r.見た日).map(r => { const 合う = 語.filter(w => r.見出し.includes(w)); return Object.assign({}, r, { 合う語: 合う, 理由: 合う.length ? "『" + 合う.join("』『") + "』を含むため" : null }); });
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
        const 旧 = データ.life_events.find(r => r.id === "締切切れ-" + t.id);     // 前の形の番号（締切つきでない）
        if (旧 && 旧.日付 === 日付文字(切れ)) continue;
        if (切れ <= 今 && 日付文字(切れ) >= 開始 && 出来事を書く(データ, "締切切れ", 切れ, { 番号: "締切切れ-" + t.id + "-" + 締切を整える(t.締切), 理由: "締切切れ：" + t.内容 })) 報告.締切切れ++;
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

  // ---------- AIコーチ 役1「苦手の克服」：理由から、小さい最初の一手（Mac 版の A4.最初の一手の文 と同じ決まり） ----------
  function 最初の一手(タスク, 反応, 理由, 自由記述, 設定) {
    const c = ((設定 || {}).コーチ || {}).最初の一手;
    if ((反応 !== "今やらない" && 反応 !== "今日はやらない") || !タスク || !c || !c.使う) return null;
    let 文;
    if ((理由 === "やりたくない" || 理由 === "気分じゃない") && (タスク.見積もり分 || 0) >= c.大きいとみなす分) 文 = c.大きい時;
    else { const キー = 理由 || ((自由記述 || "").trim() ? "自分の言葉" : null); 文 = キー ? c.理由ごと[キー] : null; }
    return 文 ? 文.split("{タスク}").join(タスク.内容) : null;
  }
  // ---------- AIコーチ 役4「自由コーチ」：筋トレ（Mac 版の Z1_筋トレ.py と同じ決まり）。声かけと世界観だけ。数字の評価はしない ----------
  function 筋トレの様子(記録, s, 今 = new Date(), 最後に促した = null) {
    const 今日 = 日付文字(今), 週の始め = 日付文字(new Date(今.getFullYear(), 今.getMonth(), 今.getDate() - (今.getDay() + 6) % 7));
    const 日 = Array.from(new Set(生きた一覧(記録).map(r => r.日付).filter(d => d <= 今日))).sort();
    const 今週 = 日.filter(d => d >= 週の始め).length, 最後 = 日.length ? 日[日.length - 1] : null;
    const 空いた日数 = 最後 ? 日数の差(今, 最後) : null;
    const 空いた = !!(s.使う && 空いた日数 !== null && 空いた日数 >= s.空いたとみなす日数);
    const 促す = 空いた && (!最後に促した || 最後に促した.slice(0, 10) <= 最後);
    return { 今週, 目標: s.週の回数, 最後, 空いた日数, 空いた, 促す };
  }
  function 筋トレをやった(データ, 設定, メモ = "", 今 = new Date()) {
    const s = 設定.自由コーチ.筋トレ; if (!s.使う) throw new Error("筋トレのコーチは、設定で切ってあります");
    メモ = (メモ || "").trim(); if (メモ.length > 100) throw new Error("メモは100文字までです");
    データ.workout_logs = データ.workout_logs || [];
    const r = 更新印({ id: 新しいid(データ.workout_logs), 日時: 時刻文字(今), 日付: 日付文字(今), 分: s.分, メモ }, 今); データ.workout_logs.push(r);
    出来事を書く(データ, "達成", 今, { 理由: "筋トレをやった" }); return r;
  }
  function 筋トレを取り消す(データ, 番号, 今 = new Date()) {
    const r = (データ.workout_logs || []).find(x => x.id === 番号 && !x.削除); if (!r) throw new Error("その記録はありません");
    削除印(r, 今);
  }
  // ---------- 記録を引く（柱B ③-1。Mac 版の D3_記録を引く.py と同じ決まり。AIは使わない） ----------
  function 記録を引く(データ, 言葉 = "", 開始日 = null, 終了日 = null, 種類 = null) {
    const 日付か = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return false; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]; };
    for (const 日 of [開始日, 終了日]) if (日 && !日付か(日)) throw new Error("日付は、半角の 2026-10-21 の形で書いてください");
    if (開始日 && 終了日 && 開始日 > 終了日) throw new Error("開始日が、終了日より後になっています");
    const 語 = (言葉 || "").split("　").join(" ").split(" ").filter(w => w);
    return 生きている(データ.deposits).filter(r => {
      const 日 = r.日付.slice(0, 10);
      return !(開始日 && 日 < 開始日) && !(終了日 && 日 > 終了日) && !(種類 && r.種類 !== 種類) && 語.every(w => r.本文.includes(w));
    }).sort((a, b) => (a.日付 < b.日付 ? 1 : a.日付 > b.日付 ? -1 : 0));
  }
  // ---------- 街の地図（小説の世界ルミナ・パレス。Mac 版の Y1_街.py と同じ決まり。絵は、Mac とスマホで共通） ----------
  // 補足：{ ニュース: 反応していない見出しの数, 同期: "YYYY-MM-DD HH:MM:SS" か null }（スマホでは、端末の中の物から渡す）
  function 街の材料(データ, 設定, 今 = new Date(), 補足 = {}) {
    const 状 = 生活の状態(データ, 設定, 今);
    return { 点数: 状.点数, 疲れ: 状.疲れ, 出来事: 生きた一覧(データ.life_events), タスク: 生きている(データ.tasks).filter(t => !t.倉庫),
             箱: 箱の中身(データ, 設定, 今).length, メモ: 生きた一覧(データ.memos).length, ニュース: 補足.ニュース || 0, 同期: 補足.同期 || null, 筋トレ: 筋トレの材料(データ, 設定, 今) };
  }
  function 筋トレの材料(データ, 設定, 今) {
    const s = (設定.自由コーチ || {}).筋トレ; if (!s || !s.使う) return null;
    const x = 筋トレの様子(データ.workout_logs || [], s, 今); return { 今週: x.今週, 目標: x.目標, 空いた: x.空いた, 空いた日数: x.空いた日数 };
  }
  function 街の様子(材料, 設定, 今 = new Date()) {
    const s = 設定.街, 今日 = 日付文字(今), 始 = 日付文字(new Date(今.getFullYear(), 今.getMonth(), 今.getDate() - (s.集計日数 - 1)));
    const 灯 = 材料.出来事.filter(r => (r.種 === "達成" || r.種 === "五分") && 始 <= r.日付 && r.日付 <= 今日).length;
    const 放置 = [], 切れ = [], 鐘 = [];
    for (const t of 材料.タスク) {
      if (日数の差(今, t.最後に触った日) >= s.霧の放置日数) 放置.push(t.内容);
      if (t.種類 === "締切" && t.締切) {
        const 残り = (締切の日時(t.締切) - 今) / 3600000;
        if (残り <= 0) 切れ.push(t.内容); else if (残り <= s.鐘の時間) 鐘.push(t.内容);
      }
    }
    let 灯台 = null;
    if (材料.同期) { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(材料.同期); if (m) 灯台 = (今 - new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) / 1000 <= s.灯台の日数 * 86400; }
    const [種, n] = 切れ.length ? ["クラッシュ", 切れ.length] : 鐘.length ? ["鐘", 鐘.length] : 放置.length >= s.霧を言う数 ? ["霧", 放置.length]
                  : 材料.疲れ >= s.池が濁る疲れ ? ["池", 0] : (材料.筋トレ && 材料.筋トレ.空いた) ? ["筋トレ", 材料.筋トレ.空いた日数] : 灯 === 0 ? ["暗い", 0] : ["ふつう", 0];
    return { 明るさ: Math.max(0.15, Math.min(1, (材料.点数 + 100) / 200)), 灯籠: [Math.min(灯, s.灯籠の数), s.灯籠の数],
             霧: Math.min(1, 放置.length / s.霧が満ちる数), 霧の物: 放置.slice(0, 3), 塔: 切れ.length, 塔の物: 切れ.slice(0, 3),
             鐘: 鐘.length, 鐘の物: 鐘.slice(0, 3), 池: Math.min(1, Math.max(0, 材料.疲れ / 100)), 図書館: 材料.箱,
             遊歩道: Math.min(材料.メモ, s.飾りの数), 楼閣: Math.min(材料.ニュース, s.映像の数), 灯台,
             鍛錬場: 材料.筋トレ ? [材料.筋トレ.今週, 材料.筋トレ.目標] : null,
             一言の種: 種, 一言: s.一言[種].split("{n}").join(String(n)) };
  }
  // 地区の説明（押した時に出す）。行き先：[名前, Mac の道, スマホの画面]
  function 街の説明(k, 様) {
    const 物 = a => a.length ? "（" + a.join("、") + (a.length === 3 ? "…" : "") + "）" : "";
    return ({
      港: { 題: "港　Lantern Pier（電源）", 文: `灯籠：${様.灯籠[0]}／${様.灯籠[1]}。達成と「5分だけ」の数だけ灯る。`, 行き先: [["今なにする？", "/suggest", "提案"]] },
      広場: { 題: "広場　Link Plaza（CPU）", 文: 様.塔 ? `塔の面が ${様.塔} つ黒い（締切切れ）${物(様.塔の物)}。` : "塔は、全部の面が動いている。地下に反応室と制御室、そばに計測所がある。",
              行き先: [["カレンダー", "/calendar", "カレンダー"], ["反応室（実験室）", "/lab", "実験室"], ["計測所（相場帳）", "/ledger", null], ["制御室（整備室）", "/room", null]] },
      鐘楼: { 題: "鐘楼", 文: 様.鐘 ? `鐘が鳴っている：締切の近い物 ${様.鐘} 件${物(様.鐘の物)}。` : "鐘は静か。近い締切は、ない。", 行き先: [["カレンダー", "/calendar", "カレンダー"]] },
      楼閣: { 題: "楼閣　Loud Pavilion（GPU）", 文: `外界放送：まだ見ていない知らせ ${様.楼閣} 件。`, 行き先: [["ニュース", "/news", "ニュース"]] },
      穴: { 題: "穴　Loop Pit（メモリ）", 文: 様.霧 ? `霧が溜まっている：長く手付かずの物${物(様.霧の物)}。` : "霧は、ほとんど無い。", 行き先: [["倉庫", "/warehouse", "倉庫"]] },
      池: { 題: "池　Lunar Pool（冷却）", 文: `濁り：${Math.round(様.池 * 100)}%（疲れ）。眠れば澄む。`, 行き先: [["エルピーの窓（睡眠）", "/window", "エルピー"], ["明日何やる？", "/night", "夜"]] },
      図書館: { 題: "図書館　Lore Pages（SSD）", 文: 様.図書館 ? `返ってきた本：${様.図書館} 冊。` : "預けた本は、まだ眠っている。", 行き先: [["受け取り箱", "/inbox", "預ける"], ["預ける", "/deposit", "預ける"]] },
      遊歩道: { 題: "遊歩道　Lune Passage（デスクトップ）", 文: `飾られた願い：${様.遊歩道} 件。`, 行き先: [["メモ", "/memo", "メモ"]] },
      鍛錬場: { 題: "鍛錬場（筋トレ）", 文: 様.鍛錬場 ? `今週の鍛錬：${様.鍛錬場[0]}／${様.鍛錬場[1]} 日。やった日には、パイロットの姿が少し強くなる。` : "筋トレのコーチは、切ってある。",
                行き先: [["筋トレ", "/train", "筋トレ"]] },
      灯台: { 題: "灯台　Line Port（ネットワーク）", 文: 様.灯台 === true ? "光がついている（最近、同期した）。向こうの光と、同じ拍で瞬いている。" : 様.灯台 === false ? "光が消えている（しばらく同期していない）。" : "光の様子が、ここからは分からない。",
              行き先: [["同期", null, "同期"]] }
    })[k];
  }
  function 街を描く(様) {
    const 安 = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const 混ぜ色 = (a, b, t) => "#" + [0, 2, 4].map(i => Math.round(parseInt(a.substr(1 + i, 2), 16) * (1 - t) + parseInt(b.substr(1 + i, 2), 16) * t).toString(16).padStart(2, "0")).join("");
    const 明 = 様.明るさ, 道 = (0.25 + 0.6 * 明).toFixed(2);
    const 地区 = (k, 名, x, y, 中) => `<g class="地区" data-k="${k}" tabindex="0" role="button" aria-label="${安(名)}" style="cursor:pointer">${中}<text x="${x}" y="${y}" text-anchor="middle" font-size="11" fill="#e6f2ea">${安(名)}</text></g>`;
    const 道筋 = [[240, 331, 320, 215], ...(様.鍛錬場 ? [[158, 90, 320, 215]] : []), [320, 215, 505, 250], [320, 215, 460, 350], [320, 215, 320, 90], [320, 215, 170, 205], [505, 250, 560, 145], [320, 215, 320, 380], [320, 215, 395, 170]]
      .map(([a, b, c, d]) => `<path d="M${a} ${b}L${(a + c) / 2} ${b}L${c} ${d}" stroke="#d4a63a" stroke-width="3" fill="none" opacity="${道}"/>`).join("");
    const 灯籠 = Array.from({ length: 様.灯籠[1] }, (_, i) => { const x = 70 + i * (160 / Math.max(1, 様.灯籠[1] - 1)), 点 = i < 様.灯籠[0];
      return `<line x1="${x}" y1="330" x2="${x}" y2="320" stroke="#7a6a52"/><circle cx="${x}" cy="316" r="5" fill="${点 ? "#ffd36b" : "#2d3a33"}" stroke="${点 ? "#fff1c4" : "#56665c"}"${点 ? ' filter="url(#光)"' : ""}/>`; }).join("");
    const 面 = [0, 1, 2, 3].map(i => i < 様.塔 ? `<rect x="${303 + 9 * i}" y="156" width="6" height="68" fill="#151515" stroke="#d0453a"/>` : `<rect x="${303 + 9 * i}" y="156" width="6" height="68" fill="#9fe3c4" opacity="${(0.35 + 0.6 * 明).toFixed(2)}"/>`).join("");
    const 鐘 = 様.鐘 ? `<circle cx="395" cy="127" r="7" fill="#ff6b5b"><animate attributeName="r" values="7;9;7" dur="1.2s" repeatCount="indefinite"/></circle><circle cx="395" cy="127" r="12" fill="none" stroke="#ff6b5b"><animate attributeName="r" values="9;22" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0" dur="1.2s" repeatCount="indefinite"/></circle>` : `<circle cx="395" cy="127" r="7" fill="#8a9a90"/>`;
    const 映像色 = ["#ff5fa2", "#5fd0ff", "#ffd35f", "#8dff7a", "#c58bff", "#ff9a5f"];
    const 映像 = Array.from({ length: 6 }, (_, i) => `<rect x="${472 + 24 * (i % 3)}" y="${224 + 20 * Math.floor(i / 3)}" width="18" height="14" fill="${i < 様.楼閣 ? 映像色[i] : "#1d1830"}"/>`).join("");
    const 本 = Array.from({ length: 6 }, (_, i) => `<rect x="${287 + 11 * i}" y="60" width="7" height="24" fill="${i < 様.図書館 ? "#ffe59a" : "#1c2638"}"${i < 様.図書館 ? ' filter="url(#光)"' : ""}/>`).join("");
    const 窓 = Array.from({ length: 6 }, (_, i) => `<rect x="${46 + 20 * i}" y="191" width="16" height="22" fill="${i < 様.遊歩道 ? "#b8e0ff" : "#142430"}"/>${i < 様.遊歩道 ? `<circle cx="${54 + 20 * i}" cy="202" r="3" fill="#ffd36b"/>` : ""}`).join("");
    const 灯台色 = 様.灯台 === true ? "#fff3a0" : 様.灯台 === false ? "#4a4a4a" : "#777";
    const 光 = 様.灯台 === true ? `<polygon points="565,96 640,72 640,120" fill="#fff3a0" opacity="0.22"/><circle cx="628" cy="52" r="3" fill="#fff3a0"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></circle>` : "";
    return `<svg viewBox="0 0 640 440" role="img" aria-label="街の地図" style="width:100%;height:auto;display:block;border-radius:12px">
<defs><filter id="光" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="640" height="440" fill="#0e2b20"/>
<g opacity="0.12" stroke="#7fd1a8">${Array.from({ length: 15 }, (_, i) => `<line x1="0" y1="${i * 30}" x2="640" y2="${i * 30}"/>`).join("")}${Array.from({ length: 22 }, (_, i) => `<line x1="${i * 30}" y1="0" x2="${i * 30}" y2="440"/>`).join("")}</g>
${道筋}
${地区("図書館", "図書館 Lore Pages", 320, 106, `<polygon points="276,46 320,22 364,46" fill="#3a4f70"/><rect x="280" y="46" width="80" height="44" fill="#2d3f5a"/>${本}`)}
${地区("遊歩道", "遊歩道 Lune Passage", 105, 236, `<path d="M58 172a12 12 0 1 0 10 -16a9 9 0 1 1 -10 16z" fill="#e8e3b0" opacity="0.8"/><rect x="40" y="185" width="130" height="36" fill="#263a48"/>${窓}`)}
${地区("灯台", "灯台 Line Port", 565, 178, `${光}<polygon points="530,165 600,165 585,150 545,150" fill="#24493a"/><rect x="558" y="100" width="14" height="50" fill="#e9ecef"/><circle cx="565" cy="96" r="6" fill="${灯台色}"${様.灯台 === true ? ' filter="url(#光)"' : ""}/>`)}
${地区("広場", "広場 Link Plaza", 320, 285, `<circle cx="320" cy="215" r="55" fill="#173d2e" stroke="#d4a63a" stroke-opacity="${道}"/><rect x="298" y="150" width="44" height="80" fill="#2a5a47"/>${面}`)}
${地区("鐘楼", "鐘楼", 395, 195, `<rect x="388" y="132" width="14" height="50" fill="#3b5a4c"/>${鐘}`)}
${地区("楼閣", "楼閣 Loud Pavilion", 505, 300, `<circle cx="482" cy="209" r="8" fill="none" stroke="#9aa"/><circle cx="528" cy="209" r="8" fill="none" stroke="#9aa"/><rect x="465" y="216" width="80" height="68" fill="#2b2340"/>${映像}`)}
${地区("港", "港 Lantern Pier", 150, 372, `<rect x="40" y="334" width="220" height="26" fill="#071a14"/><rect x="60" y="328" width="180" height="7" fill="#5b4a36"/>${灯籠}`)}
${地区("穴", "穴 Loop Pit", 460, 404, `<ellipse cx="460" cy="360" rx="70" ry="28" fill="#06120d" stroke="#3b5d4f"/><ellipse cx="460" cy="362" rx="48" ry="18" fill="none" stroke="#2c4a3e"/><ellipse cx="460" cy="364" rx="26" ry="9" fill="none" stroke="#2c4a3e"/><ellipse cx="460" cy="356" rx="76" ry="34" fill="#a3aaa6" opacity="${(様.霧 * 0.75).toFixed(2)}"/>`)}
${地区("池", "池 Lunar Pool", 320, 428, `<ellipse cx="320" cy="398" rx="62" ry="20" fill="${混ぜ色("#2fb6d8", "#6b6f5a", 様.池)}"/><circle cx="338" cy="394" r="4" fill="#f4f1d0" opacity="${(0.8 - 0.6 * 様.池).toFixed(2)}"/>`)}
${様.鍛錬場 ? 地区("鍛錬場", "鍛錬場", 110, 120, `<rect x="62" y="62" width="96" height="40" rx="4" fill="#3a3326" stroke="#7a6a52"/><rect x="88" y="78" width="44" height="4" fill="#b9c2bc"/><rect x="82" y="72" width="7" height="16" rx="1" fill="#b9c2bc"/><rect x="131" y="72" width="7" height="16" rx="1" fill="#b9c2bc"/>` + Array.from({ length: 様.鍛錬場[1] }, (_, i) => { const 点 = i < 様.鍛錬場[0], x = 70 + i * (80 / Math.max(1, 様.鍛錬場[1] - 1)); return `<circle cx="${x}" cy="56" r="4" fill="${点 ? "#ff9a5f" : "#2d3a33"}" stroke="${点 ? "#ffd2b8" : "#56665c"}"${点 ? ' filter="url(#光)"' : ""}/>`; }).join("")) : ""}
<rect width="640" height="440" fill="#000" opacity="${((1 - 明) * 0.55).toFixed(2)}" pointer-events="none"/>
</svg>`;
  }

  // ---------- 同期（突き合わせ。Mac 版の H1_突き合わせ.py と同じ決まり） ----------
  const 形式の版 = 1, 混ぜる一覧名 = ["tasks", "deposits", "state_logs", "seals", "suggestion_log", "focus_log", "memos", "life_events", "sleep_logs", "warehouse_items", "wishlist", "duration_log", "workout_logs", "ai_requests", "ai_replies", "class_notes"];
  const 整列 = v => Array.isArray(v) ? v.map(整列) : (v && typeof v === "object") ? Object.keys(v).sort().reduce((o, k) => (o[k] = 整列(v[k]), o), {}) : v;
  const 同じ内容 = (a, b) => JSON.stringify(整列(a)) === JSON.stringify(整列(b));
  // 同じ時刻で中身が違う時は、並びを決めた JSON の文字が大きい方（Mac の H1 と同じ。両方で同じ側が勝つので、食い違いが残らない）
  const 正規の文字 = v => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort((p, q) => { const A = Array.from(p), B = Array.from(q); for (let i = 0; i < Math.min(A.length, B.length); i++) { const d = A[i].codePointAt(0) - B[i].codePointAt(0); if (d) return d; } return A.length - B.length; }).map(k2 => [k2, x[k2]])) : x);
  const 文字を比べる = (a, b) => { const A = Array.from(a), B = Array.from(b); for (let i = 0; i < Math.min(A.length, B.length); i++) { const d = A[i].codePointAt(0) - B[i].codePointAt(0); if (d) return d; } return A.length - B.length; };
  const 新しい方 = (自分, 相手) => { const a = 自分.更新日時 || "", b = 相手.更新日時 || ""; if (b !== a) return b > a ? 相手 : 自分; return JSON.stringify(相手) !== JSON.stringify(自分) && 文字を比べる(正規の文字(相手), 正規の文字(自分)) > 0 ? 相手 : 自分; };
  function 一覧を混ぜる(自分, 相手) {
    const 混ぜた = new Map(自分.filter(r => r.id != null).map(r => [r.id, r])), id無し = 自分.filter(r => r.id == null); let 入った = 0;   // id 無しは、消さずに残し、相手からは入れない
    for (const r of 相手) {
      if (r.id == null) continue;
      if (!混ぜた.has(r.id)) { 混ぜた.set(r.id, r); 入った++; }
      else { const 今の = 混ぜた.get(r.id), 勝つ = 新しい方(今の, r); if (勝つ === r && !同じ内容(r, 今の)) 入った++; 混ぜた.set(r.id, 勝つ); }
    }
    return [Array.from(混ぜた.values()).concat(id無し), 入った];
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
    const 日数 = (相手 && 相手.Macから && 相手.Macから.設定 && 相手.Macから.設定.スマホ連携 && 相手.Macから.設定.スマホ連携.削除の印を本当に消すまでの日数) || 365;
    const 結果 = 同期を組み立てる(データ, 相手, 日数, 今);
    await ドライブ.書く(JSON.stringify(結果.出力), 生);
    return { 新しいデータ: 結果.新しいデータ, 報告: 結果.報告, 設定: 相手 && 相手.Macから ? 相手.Macから.設定 : null, ニュース: 相手 && 相手.Macから ? 相手.Macから.ニュース : null };
  }

  // ---------- 使った機能（Mac 版の U1_使った機能.py と同じ決まり）。数えるだけ。点数・評価はしない ----------
  // 表：[名前, [[一覧の名前, 日付の項目, 絞り]]]。絞りは [項目, "=" か "≠", 値]。一覧がデータに無い機能は出さない（Macだけの物）
  const 使った機能の表 = [
    ["タスクを足した", [["tasks", "作成日", []]]],
    ["提案を見た", [["suggestion_log", "日時", []]]],
    ["提案に反応した", [["suggestion_log", "反応の日時", []]]],
    ["5分だけ", [["focus_log", "開始", []]]],
    ["達成", [["life_events", "日付", [["種", "=", "達成"], ["理由", "≠", "筋トレをやった"]]]]],
    ["預けた", [["deposits", "日付", []]]],
    ["受け取り箱を開いた", [["deposits", "受け取った日", []]]],
    ["明日何やる？（封）", [["seals", "封じた日時", []]]],
    ["メモ", [["memos", "日付", []]]],
    ["体と気分", [["state_logs", "日時", [["休会", "≠", "開始"], ["休会", "≠", "再開"], ["休会", "≠", "復帰を見た"]]]]],
    ["睡眠", [["sleep_logs", "日付", []]]],
    ["倉庫", [["warehouse_items", "置いた日", []], ["warehouse_items", "処理した日", []], ["wishlist", "置いた日", []], ["wishlist", "答えた日", []]]],
    ["相場帳", [["duration_log", "日時", []]]],
    ["筋トレ", [["workout_logs", "日付", []]]],
    ["ログイン", [["life_events", "日付", [["種", "=", "ログイン"]]]]],
    ["通信で話した", [["comm_log", "日時", [["送り手", "=", "あなた"]]]]],
    ["実験室", [["experiments", "日付", []]]]
  ];
  function 使った機能の集計(データ, 今 = new Date(), 日数 = 28) {
    const 日 = i => 日付文字(new Date(今.getFullYear(), 今.getMonth(), 今.getDate() - i));
    const 日付 = []; for (let i = 日数 - 1; i >= 0; i--) 日付.push(日(i));
    const 位置 = new Map(日付.map((d, i) => [d, i])), 今日 = 日(0), 七日前 = 日(6), 持つ = k => Object.prototype.hasOwnProperty.call(データ || {}, k);
    const 合う = (r, 絞り) => 絞り.every(([項目, 比べ方, 値]) => 比べ方 === "=" ? r[項目] === 値 : 比べ方 === "≠" ? r[項目] !== 値 : true);
    const 機能 = [];
    for (const [名前, 元一覧] of 使った機能の表) {
      if (!元一覧.some(([一覧]) => 持つ(一覧))) continue;
      const 毎日 = new Array(日数).fill(0); let 最後 = null;
      for (const [一覧, 項目, 絞り] of 元一覧) for (const r of (データ[一覧] || [])) {
        if (!r || typeof r !== "object" || Array.isArray(r) || r.削除 || !合う(r, 絞り)) continue;
        const v = r[項目]; if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) continue;
        const d = v.slice(0, 10); if (d > 今日) continue;
        if (最後 === null || d > 最後) 最後 = d;
        if (位置.has(d)) 毎日[位置.get(d)]++;
      }
      機能.push({ 名前, 毎日, 合計: 毎日.reduce((a, b) => a + b, 0), 最後 });
    }
    return { 日付, 日数, 機能, 使った機能の数_7日: 機能.filter(x => x.最後 && x.最後 >= 七日前).length, まだ使っていない: 機能.filter(x => x.最後 === null).map(x => x.名前) };
  }
  // 絵（SVG の文字列）：上に事実の一言、日ごとの回数の表（行＝機能・列＝日）、合計の横棒（多い順）。幅は画面の幅（px）を渡す
  // 色：文字は currentColor（画面の文字色）。ます目は青1色の濃さ（透明度）なので、明るい画面でも暗い画面でも読める
  function 使った機能を描く(集計, 幅 = 360) {
    const 逃 = s => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const W = Math.max(300, Math.round(+幅 || 360)), 機能 = (集計 && 集計.機能) || [], 日付 = (集計 && 集計.日付) || [], n = 日付.length || 1;
    const 青 = "#2a78d6", 濃さ = [0.42, 0.64, 0.84, 1], 段 = v => v >= 8 ? 3 : v >= 4 ? 2 : v >= 2 ? 1 : 0, 字 = W < 480 ? 11 : 12;
    const 月日 = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); return m ? (+m[2]) + "/" + (+m[3]) : ""; };
    const LW = Math.min(140, Math.round(W * 0.3)), gx = LW + 6, gw = W - gx - 2, 歩 = gw / n, cw = Math.max(2, 歩 - (歩 > 8 ? 2 : 1)), RH = 18, ch = 14;
    const 出 = []; let y = 0;
    const 文 = (x, yy, s, 付け = "") => 出.push(`<text x="${x}" y="${yy}" fill="currentColor" ${付け}>${逃(s)}</text>`);
    // 事実
    y += 16; 文(0, y, "この7日で使った機能：" + ((集計 && 集計.使った機能の数_7日) || 0) + "種類", `font-size="14" font-weight="bold"`);
    const まだ = (集計 && 集計.まだ使っていない) || [];
    if (!機能.length) { y += 20; 文(0, y, "記録がまだありません", `font-size="12" fill-opacity=".7"`); }
    else if (まだ.length) {
      const 一行 = Math.max(10, Math.floor(W / 12)); let 行 = "まだ使っていない：";
      for (const [i, 名] of まだ.entries()) { const 足 = 名 + (i < まだ.length - 1 ? "、" : ""); if ((行 + 足).length > 一行) { y += 18; 文(0, y, 行, `font-size="12" fill-opacity=".7"`); 行 = "　"; } 行 += 足; }
      y += 18; 文(0, y, 行, `font-size="12" fill-opacity=".7"`);
    }
    if (機能.length) {
      // 日ごとの回数
      y += 30; 文(0, y, "日ごとの回数（直近" + 日付.length + "日）", `font-size="13" font-weight="bold"`); y += 8;
      機能.forEach((f, i) => {
        const yy = y + i * RH; 文(LW, yy + 11, f.名前, `font-size="${字}" text-anchor="end"`);
        (f.毎日 || []).forEach((v, j) => {
          const 色 = v > 0 ? `fill="${青}" fill-opacity="${濃さ[段(v)]}"` : `fill="currentColor" fill-opacity=".08"`;
          出.push(`<rect class="使ったます" x="${(gx + j * 歩).toFixed(1)}" y="${yy}" width="${cw.toFixed(1)}" height="${ch}" rx="2" ${色}><title>${逃(f.名前 + "　" + 月日(日付[j]) + "：" + v + "回")}</title></rect>`);
        });
      });
      y += 機能.length * RH + 10;
      for (let j = n - 1; j >= 0; j -= 7) {
        const 終 = j === n - 1, x = 終 ? gx + (n - 1) * 歩 + cw : gx + j * 歩 + cw / 2;
        文(x.toFixed(1), y, 終 ? "今日" : 月日(日付[j]), `font-size="10" fill-opacity=".7" text-anchor="${終 ? "end" : "middle"}"`);
      }
      // 凡例
      y += 20; let lx = gx; 文(LW, y, "回数", `font-size="10" fill-opacity=".7" text-anchor="end"`);
      for (const [名, k] of [["0", -1], ["1", 0], ["2–3", 1], ["4–7", 2], ["8以上", 3]]) {
        出.push(`<rect x="${lx}" y="${y - 9}" width="10" height="10" rx="2" ${k < 0 ? `fill="currentColor" fill-opacity=".08"` : `fill="${青}" fill-opacity="${濃さ[k]}"`}/>`);
        文(lx + 13, y, 名, `font-size="10" fill-opacity=".7"`); lx += 13 + 名.length * 7 + 12;
      }
      // 合計（多い順）
      y += 32; 文(0, y, "直近" + 日付.length + "日の合計（多い順）", `font-size="13" font-weight="bold"`); y += 8;
      const 並び = 機能.map((f, i) => [f, i]).sort((a, b) => b[0].合計 - a[0].合計 || a[1] - b[1]).map(x => x[0]);
      const 最大 = Math.max(1, ...並び.map(f => f.合計)), bw = W - gx - 40, bh = 10;
      並び.forEach((f, i) => {
        const yy = y + i * RH, 長 = f.合計 / 最大 * bw, r = Math.min(4, 長 / 2, bh / 2);
        文(LW, yy + 11, f.名前, `font-size="${字}" text-anchor="end"`);
        const 説明 = `<title>${逃(f.名前 + "：" + f.合計 + "回（最後に使った日：" + (f.最後 || "なし") + "）")}</title>`;
        if (長 > 0) 出.push(`<path d="M${gx} ${yy + 2}h${(長 - r).toFixed(1)}a${r} ${r} 0 0 1 ${r} ${r}v${bh - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${(-(長 - r)).toFixed(1)}z" fill="${青}">${説明}</path>`);
        文((gx + 長 + 4).toFixed(1), yy + 11, String(f.合計), `font-size="11" fill-opacity="${f.合計 ? 1 : 0.6}"`);
      });
      y += 並び.length * RH;
    }
    y += 6;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}" role="img" aria-label="使った機能" style="max-width:100%;height:auto;font-family:inherit">${出.join("")}</svg>`;
  }

  const 公開 = { 締切を整える, 点数, 順位表, 提案, 理由を作る, 残りの言い方, 今日の様子, 新しいid, 更新印, 削除印, 生きている, タスクを足す, タスクを直す, タスクを消す,
                 倉庫設定, 倉庫の候補, 倉庫に積む, 倉庫に入れる, 窓口, 倉庫で処理, 灰, 種, 灰を戻す, 棚に置く, 棚, 棚に答える, 翌朝の体を答える, 棚から外す,
                 通信の状況, 通信の返事, 節目の文, 実験の材料, 実験の組, 実験の文, 見出しの実験の文, カレンダー設定, 望む予定, 予定の差, 空き時間, 今の空き, 倍率の表, 使う見積もり, 相場を足す, 分解の案, 分解して足す, 提案を記録, 反応を記録, あとでを戻す, 五分を始める, 五分を終える, 状態を記録, 使える状態, 休会中, 休会する, 再開する, 復帰の材料, 復帰を見た, 預ける, メモ設定, メモを足す, メモを直す, メモを消す, 締切の一覧, 月の表, 日付文字, 時刻文字,
                 一覧を混ぜる, 価値観を混ぜる, 古い削除を消す, 同期を組み立てる, 同期ファイルを確かめる, 同期を実行,
                 点数を計算, 疲れを計算, 出来事を書く, 開く, 睡眠を答える, 達成する, 会話の点, 生活の状態, 顔の名前, 放置日数の合計,
                 箱の中身, 区分, 今日の問い, 練習の問い, ノートを足す, ノートを消す, ノートを探す, 日の終わりの点数, 段階を計算, 今の段階, 機能の木, もやっと回数, 勝ち一覧, 拠り所にする, 拠り所を出す, 預けを開く, 預けに反応する, 封じる, 封をやめる, 今の封, 今日の封印, 封を済にする, 次の問い, 価値観に答える, 価値観を今日はやめる, ニュースを並べる, 通信の表情, AIの依頼を足す, 届いた返事, 使った機能の表, 使った機能の集計, 使った機能を描く, 筋トレの様子, 筋トレをやった, 筋トレを取り消す, 最初の一手, 記録を引く, 街の材料, 街の様子, 街の説明, 街を描く };
  if (typeof module !== "undefined" && module.exports) module.exports = 公開; else root.LifePilot = 公開;
})(typeof self !== "undefined" ? self : this);
