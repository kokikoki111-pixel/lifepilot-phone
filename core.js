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
    const 結果 = 生きている(データ.tasks).map(t => [t, 点数(t, 設定, 体, 気分低, 今)]);
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
        if (r.反応 === "あとで") { if (!r.リセット済み) あとで.add(r.候補id); }
        else if (r.反応 === "今日はやらない") やらない.add(r.候補id);
      }
    }
    return { あとで, やらない, 最後に出した };
  }
  const 丸め = x => Math.round(x * 1e6) / 1e6;
  function 提案(データ, 設定, 空き分, 体 = 100, 気分低 = false, 今 = new Date(), 電池 = null) {
    const 絞り = 設定.柱A.提案の絞り, 選択肢 = 設定.柱A.空き時間の選択肢, 最後の選択肢 = 選択肢[選択肢.length - 1];
    const 疲れている = (絞り.体が低い時は重い候補を外す && 体 <= 絞り.重い候補を外す体の基準) || (絞り.気分が低い時は重い候補を外す && 気分低);
    const { あとで, やらない, 最後に出した } = 今日の様子(データ, 今);
    const 並び = 順位表(データ, 設定, 体, 気分低, 今).filter(([t]) => !(やらない.has(t.id) || あとで.has(t.id)));
    並び.sort((a, b) => (丸め(b[1].合計) - 丸め(a[1].合計)) || ((最後に出した[a[0].id] || "") < (最後に出した[b[0].id] || "") ? -1 : (最後に出した[a[0].id] || "") > (最後に出した[b[0].id] || "") ? 1 : 0));
    const 電池が少ない = 電池 !== null && 電池 <= 絞り.電池が少ない基準;
    const 候補 = [];
    for (const [t, 点] of 並び) {
      if (電池が少ない && (t.画面を使う !== false)) continue;
      if (空き分 !== 最後の選択肢 && t.見積もり分 > 空き分) continue;
      if (疲れている && t.楽しさの印 === "重い") continue;
      候補.push([t, 点]);
    }
    if (!候補.length) return { 候補なし: true, 文: 電池が少ない ? "電池が少ないので、画面を使わない物だけを探しましたが、ありません。" : "今は出せる物がありません。", あとでの件数: あとで.size };
    const [t, 点] = 候補[0];
    const 結果 = { 候補なし: false, 一手: t, 点数: 点.合計, 点, 理由: 理由を作る(t, 点, 設定, 今), あとでの件数: あとで.size, 電池が少ない };
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
    if (反応 === "今日はやらない") {
      if (!柱A.やらない理由.includes(理由)) throw new Error("「今日はやらない」の理由を選んでください");
      if (理由 === "その他" && !(自由記述 || "").trim()) throw new Error("「その他」を選んだ時は、一言を書いてください");
    }
    const r = データ.suggestion_log.find(x => x.id === 提案id);
    if (!r) throw new Error("その提案はありません");
    if (r.反応 !== null) throw new Error("この提案には、もう反応しています");
    r.反応 = 反応; r.理由の分類 = 反応 === "今日はやらない" ? 理由 : null; r.自由記述 = (自由記述 || "").trim(); r.反応の日時 = 時刻文字(今);
    更新印(r, 今); return r;
  }
  function あとでを戻す(データ, 今 = new Date()) {
    const 今日 = 日付文字(今), 戻した = new Set();
    for (const r of データ.suggestion_log) if (r.反応 === "あとで" && !r.リセット済み && (r.反応の日時 || "").startsWith(今日)) { r.リセット済み = true; 更新印(r, 今); 戻した.add(r.候補id); }
    return 戻した.size;
  }

  // ---------- 5分だけ ----------
  function 五分を始める(データ, タスクid, 今 = new Date()) {
    const t = データ.tasks.find(x => x.id === タスクid && !x.削除);
    if (!t) throw new Error("そのタスクはありません");
    t.最後に触った日 = 日付文字(今); 更新印(t, 今);
    const r = 更新印({ id: 新しいid(データ.focus_log), タスクid, 開始: 時刻文字(今), 終了: null, 結果: null }, 今); データ.focus_log.push(r); return r.id;
  }
  function 五分を終える(データ, 設定, 記録id, 結果, 今 = new Date()) {
    const 選択肢 = 設定.柱A["5分だけ終わりの選択肢"].concat(["中断"]);
    if (!選択肢.includes(結果)) throw new Error("結果は " + 選択肢.join("・") + " のどれかです");
    const r = データ.focus_log.find(x => x.id === 記録id);
    if (!r) throw new Error("その記録はありません");
    if (r.結果 !== null) throw new Error("もう終わっています");
    r.結果 = 結果; r.終了 = 時刻文字(今); 更新印(r, 今);
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


  // ---------- 同期（突き合わせ。Mac 版の H1_突き合わせ.py と同じ決まり） ----------
  const 形式の版 = 1, 混ぜる一覧名 = ["tasks", "deposits", "state_logs", "seals", "suggestion_log", "focus_log"];
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
                 提案を記録, 反応を記録, あとでを戻す, 五分を始める, 五分を終える, 状態を記録, 使える状態, 預ける, 日付文字, 時刻文字,
                 一覧を混ぜる, 価値観を混ぜる, 古い削除を消す, 同期を組み立てる, 同期ファイルを確かめる, 同期を実行 };
  if (typeof module !== "undefined" && module.exports) module.exports = 公開; else root.LifePilot = 公開;
})(typeof self !== "undefined" ? self : this);
