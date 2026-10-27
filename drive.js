// Google ドライブとの、読み書き（スマホ版の同期用）。権限は drive.file だけ：このページが作ったファイルしか、見えない。
// クライアントID は、Google Cloud で作る（秘密ではない）。ログイン画面は、同期ボタンを押した時にだけ出る。
(function (root) {
  const 範囲 = "https://www.googleapis.com/auth/drive.file", 基 = "https://www.googleapis.com/drive/v3", 上 = "https://www.googleapis.com/upload/drive/v3";
  const フォルダ名 = "LifePilot同期", ファイル名 = "lifepilot_sync.json", 前の名 = "lifepilot_sync_前.json";

  function 部品を読む() {
    return new Promise((ok, ng) => {
      if (root.google && root.google.accounts && root.google.accounts.oauth2) return ok();
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = () => ok(); s.onerror = () => ng(new Error("Google の認証の部品を読み込めません（ネットワークを確認してください）")); document.head.appendChild(s);
    });
  }
  async function 通行証(クライアントID) {                         // 1時間だけ使える「通行証」。ボタンを押すたびに、取り直す
    await 部品を読む();
    return new Promise((ok, ng) => {
      const 窓口 = root.google.accounts.oauth2.initTokenClient({ client_id: クライアントID, scope: 範囲,
        callback: r => r.error ? ng(new Error("Google の許可が、得られませんでした（" + r.error + "）")) : ok(r.access_token),
        error_callback: e => ng(new Error("Google のログインが、中断されました（" + (e && e.type || "不明") + "）")) });
      窓口.requestAccessToken({ prompt: "" });
    });
  }
  async function 呼ぶ(トークン, url, 設定 = {}) {
    const r = await fetch(url, Object.assign({}, 設定, { headers: Object.assign({ Authorization: "Bearer " + トークン }, 設定.headers || {}) }));
    if (!r.ok) throw new Error("ドライブとの通信に失敗しました（" + r.status + "）");
    return r;
  }
  const 探す = async (トークン, 条件) => ((await (await 呼ぶ(トークン, 基 + "/files?q=" + encodeURIComponent(条件 + " and trashed=false") + "&fields=files(id,name)&spaces=drive&orderBy=" + encodeURIComponent("modifiedTime desc"))).json()).files || []);
  async function フォルダを用意する(トークン) {
    const 既 = await 探す(トークン, "name='" + フォルダ名 + "' and mimeType='application/vnd.google-apps.folder'");
    if (既.length) return 既[0].id;
    return (await (await 呼ぶ(トークン, 基 + "/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: フォルダ名, mimeType: "application/vnd.google-apps.folder" }) })).json()).id;
  }
  async function 書き込む(トークン, フォルダ, 名前, 中身) {
    const 既 = await 探す(トークン, "name='" + 名前 + "'");
    if (既.length) { await 呼ぶ(トークン, 上 + "/files/" + 既[0].id + "?uploadType=media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: 中身 }); return; }
    const 境 = "lifepilot" + Date.now();
    const 本体 = "--" + 境 + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify({ name: 名前, parents: [フォルダ] }) + "\r\n--" + 境 + "\r\nContent-Type: application/json\r\n\r\n" + 中身 + "\r\n--" + 境 + "--";
    await 呼ぶ(トークン, 上 + "/files?uploadType=multipart", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + 境 }, body: 本体 });
  }
  // 同期用の「ドライブ」を作る
  async function ドライブを作る(クライアントID) {
    const トークン = await 通行証(クライアントID);
    return {
      async 読む() {
        const f = await 探す(トークン, "name='" + ファイル名 + "'");
        return f.length ? await (await 呼ぶ(トークン, 基 + "/files/" + f[0].id + "?alt=media")).text() : null;
      },
      async 書く(新しい, 前) {
        const フォルダ = await フォルダを用意する(トークン);
        if (前 !== null) await 書き込む(トークン, フォルダ, 前の名, 前);          // 上書きの前の1世代を残す
        await 書き込む(トークン, フォルダ, ファイル名, 新しい);
      }
    };
  }
  root.LifePilotDrive = { ドライブを作る };
})(typeof self !== "undefined" ? self : this);
