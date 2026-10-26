// Google カレンダーとの、読み書き（スマホ版）。権限は calendar.events：予定を見る・直す。
// 守ること：書く・直す・消すのは、自分（LifePilot）が作った予定だけ（「［LP］」付き・拡張プロパティ lifepilot=1）。ふだんの予定は、読むだけ。
// 予定の中身は、この端末の中だけで使う（同期ファイルや、Google以外へは、出さない）。
(function (root) {
  const 範囲 = "https://www.googleapis.com/auth/calendar.events", 基 = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  function 部品を読む() {
    return new Promise((ok, ng) => {
      if (root.google && root.google.accounts && root.google.accounts.oauth2) return ok();
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = () => ok(); s.onerror = () => ng(new Error("Google の認証の部品を読み込めません（ネットワークを確認してください）")); document.head.appendChild(s);
    });
  }
  async function 通行証(クライアントID) {
    await 部品を読む();
    return new Promise((ok, ng) => {
      const 窓口 = root.google.accounts.oauth2.initTokenClient({ client_id: クライアントID, scope: 範囲,
        callback: r => r.error ? ng(new Error("Google の許可が、得られませんでした（" + r.error + "）。Google Cloud の同意画面に、カレンダーの権限（calendar.events）を足してありますか？")) : ok(r.access_token),
        error_callback: e => ng(new Error("Google のログインが、中断されました（" + (e && e.type || "不明") + "）")) });
      窓口.requestAccessToken({ prompt: "" });
    });
  }
  async function 呼ぶ(トークン, url, 設定 = {}) {
    const f = root.fetch ? root.fetch.bind(root) : fetch;
    const r = await f(url, Object.assign({}, 設定, { headers: Object.assign({ Authorization: "Bearer " + トークン }, 設定.headers || {}) }));
    if (!r.ok) {
      if (r.status === 403 || r.status === 401) throw new Error("カレンダーの権限がありません（" + r.status + "）。Google Cloud で Calendar API を有効にし、同意画面に calendar.events を足してください");
      throw new Error("カレンダーとの通信に失敗しました（" + r.status + "）");
    }
    return r;
  }
  async function 読む(トークン, 開始, 終了, LPだけ = false) {
    let 全部 = [], ページ = null;
    for (let i = 0; i < 5; i++) {                                           // 最大 5ページ（2500件）まで
      const q = new URLSearchParams({ timeMin: 開始.toISOString(), timeMax: 終了.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "500" });
      if (LPだけ) q.append("privateExtendedProperty", "lifepilot=1");
      if (ページ) q.set("pageToken", ページ);
      const j = await (await 呼ぶ(トークン, 基 + "?" + q.toString())).json();
      全部 = 全部.concat(j.items || []); ページ = j.nextPageToken; if (!ページ) break;
    }
    return 全部;
  }
  // 差（LifePilotCore.予定の差 の結果）を、Googleに反映する。作る・直す・消すは、LP予定だけ
  async function 反映する(トークン, 差) {
    let 作った = 0, 直した = 0, 消した = 0;
    for (const x of 差.作る) { await 呼ぶ(トークン, 基, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x.本体) }); 作った++; }
    for (const x of 差.直す) { await 呼ぶ(トークン, 基 + "/" + encodeURIComponent(x.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(x.予定.本体) }); 直した++; }
    for (const x of 差.消す) { await 呼ぶ(トークン, 基 + "/" + encodeURIComponent(x.id), { method: "DELETE" }); 消した++; }
    return { 作った, 直した, 消した };
  }
  root.LifePilotCalendar = { 通行証, 読む, 反映する };
})(typeof self !== "undefined" ? self : this);
