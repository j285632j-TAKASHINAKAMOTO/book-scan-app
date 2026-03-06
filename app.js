import { BrowserMultiFormatReader } from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/esm/index.js";

const $ = (id) => document.getElementById(id);

// UI
const video = $("video");
const isbnInput = $("isbn");
const btnStart = $("btnStart");
const btnStop = $("btnStop");
const btnLookup = $("btnLookup");

const titleEl = $("title");
const authorsEl = $("authors");
const publisherEl = $("publisher");
const thumbEl = $("thumb");

const linkMercari = $("linkMercari");
const linkRakuma = $("linkRakuma");
const linkYahoo = $("linkYahoo");

// Mode switch
const btnModeBuy = $("btnModeBuy");
const btnModeList = $("btnModeList");
const panelBuy = $("panelBuy");
const panelList = $("panelList");

// Profit calc
const sellPrice = $("sellPrice");
const buyPrice = $("buyPrice");
const shipping = $("shipping");
const feeRate = $("feeRate");
const feeYen = $("feeYen");
const profitEl = $("profit");
const threshold = $("threshold");
const judge = $("judge");

// Listing support
const listPrice = $("listPrice");
const condition = $("condition");
const note = $("note");
const btnGenerate = $("btnGenerate");
const btnCopy = $("btnCopy");
const output = $("output");
const copyMsg = $("copyMsg");

let mode = "buy"; // "buy" or "list"
let currentBook = {
  isbn: "",
  title: "",
  authors: "",
  publisher: "",
  thumb: ""
};

// Scanner
const reader = new BrowserMultiFormatReader();
let scanning = false;

function setMode(next) {
  mode = next;
  if (mode === "buy") {
    btnModeBuy.classList.add("active");
    btnModeList.classList.remove("active");
    panelBuy.classList.remove("hidden");
    panelList.classList.add("hidden");
  } else {
    btnModeList.classList.add("active");
    btnModeBuy.classList.remove("active");
    panelList.classList.remove("hidden");
    panelBuy.classList.add("hidden");
  }
}

btnModeBuy.addEventListener("click", () => setMode("buy"));
btnModeList.addEventListener("click", () => setMode("list"));

function setBadge(text, kind) {
  judge.textContent = text;
  judge.style.borderColor = "var(--line)";
  judge.style.background = "transparent";
  if (kind === "ok") {
    judge.style.borderColor = "rgba(72,209,122,.5)";
    judge.style.background = "rgba(72,209,122,.12)";
  }
  if (kind === "ng") {
    judge.style.borderColor = "rgba(255,90,107,.5)";
    judge.style.background = "rgba(255,90,107,.12)";
  }
}

function yen(n) {
  if (!Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("ja-JP") + "円";
}

function updateLinks(isbn) {
  // 安定運用：各サイト検索を開く方式
  const q = encodeURIComponent(isbn);
  linkMercari.href = `https://www.mercari.com/jp/search/?keyword=${q}`;
  linkRakuma.href = `https://fril.jp/s?query=${q}`;
  linkYahoo.href = `https://paypayfleamarket.yahoo.co.jp/search/${q}`;
}

async function fetchBookByISBN(isbn) {
  // Google Books API
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google Books API error");
  const json = await res.json();
  const info = json.items?.[0]?.volumeInfo;

  if (!info) {
    return {
      title: "見つかりませんでした",
      authors: "",
      publisher: "",
      thumb: ""
    };
  }
  return {
    title: info.title ?? "",
    authors: (info.authors ?? []).join(", "),
    publisher: info.publisher ?? "",
    thumb: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? ""
  };
}

async function lookup() {
  const raw = (isbnInput.value || "").trim();
  if (!raw) return;

  currentBook.isbn = raw;
  updateLinks(raw);

  // UI reset
  titleEl.textContent = "取得中...";
  authorsEl.textContent = "-";
  publisherEl.textContent = "-";
  thumbEl.removeAttribute("src");
  thumbEl.style.opacity = "0.6";

  try {
    const b = await fetchBookByISBN(raw);
    currentBook.title = b.title;
    currentBook.authors = b.authors;
    currentBook.publisher = b.publisher;
    currentBook.thumb = b.thumb;

    titleEl.textContent = b.title || "-";
    authorsEl.textContent = b.authors || "-";
    publisherEl.textContent = b.publisher || "-";
    if (b.thumb) {
      thumbEl.src = b.thumb;
      thumbEl.style.opacity = "1";
    } else {
      thumbEl.style.opacity = "0.6";
    }

    // 出品サポートで価格が空なら、仕入れ側の想定価格をコピーしておく（任意）
    if (!listPrice.value && sellPrice.value) listPrice.value = sellPrice.value;

    recalcProfit();
  } catch (e) {
    titleEl.textContent = "取得に失敗しました";
    authorsEl.textContent = "-";
    publisherEl.textContent = "-";
    thumbEl.style.opacity = "0.6";
    console.error(e);
  }
}

btnLookup.addEventListener("click", lookup);

isbnInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") lookup();
});

// Profit
function recalcProfit() {
  const sp = Number(sellPrice.value);
  const bp = Number(buyPrice.value);
  const sh = Number(shipping.value);
  const fr = Number(feeRate.value);

  if (!Number.isFinite(sp) || sp <= 0) {
    feeYen.textContent = "-";
    profitEl.textContent = "-";
    setBadge("-", "");
    return;
  }

  const fee = sp * (Number.isFinite(fr) ? fr : 0) / 100;
  const prof = sp - fee - (Number.isFinite(sh) ? sh : 0) - (Number.isFinite(bp) ? bp : 0);

  feeYen.textContent = yen(fee);
  profitEl.textContent = yen(prof);

  const th = Number(threshold.value);
  if (Number.isFinite(th)) {
    if (prof >= th) setBadge("買い（GO）", "ok");
    else setBadge("見送り", "ng");
  } else {
    setBadge("-", "");
  }
}

[sellPrice, buyPrice, shipping, feeRate, threshold].forEach(el => {
  el.addEventListener("input", recalcProfit);
});

// Listing text
function generateListingText() {
  const isbn = currentBook.isbn || (isbnInput.value || "").trim();
  const title = currentBook.title || "";
  const authors = currentBook.authors || "";
  const pub = currentBook.publisher || "";
  const price = listPrice.value ? `${Number(listPrice.value).toLocaleString("ja-JP")}円` : "（価格未入力）";
  const cond = condition.value;
  const extra = (note.value || "").trim();

  const lines = [];

  // タイトル行（コピペしやすく）
  if (title) lines.push(`【商品名】${title}`);
  if (authors) lines.push(`【著者】${authors}`);
  if (pub) lines.push(`【出版社】${pub}`);
  if (isbn) lines.push(`【ISBN】${isbn}`);
  lines.push("");
  lines.push(`【価格】${price}`);
  lines.push(`【状態】${cond}`);
  if (extra) lines.push(`【補足】${extra}`);
  lines.push("");
  lines.push("【商品説明】");
  lines.push("中古書籍です。");
  lines.push("カバーにスレ等の使用感がある場合があります。");
  lines.push("通読には問題ありません。");
  lines.push("防水対策をして発送します。");
  lines.push("");
  lines.push("※即購入OK / まとめ買い歓迎");
  lines.push("");

  output.value = lines.join("\n");
  btnCopy.disabled = output.value.trim().length === 0;
  copyMsg.textContent = "";
}

btnGenerate.addEventListener("click", generateListingText);

btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.value);
    copyMsg.textContent = "✅ コピーしました！メルカリ等に貼り付けてください。";
  } catch {
    // iPhone等で失敗したときは選択してコピーしてもらう
    output.focus();
    output.select();
    copyMsg.textContent = "⚠️ 自動コピーできない場合は、テキストを選択して手動コピーしてください。";
  }
});

// Camera scan
async function startScan() {
  if (scanning) return;
  scanning = true;

  btnStart.disabled = true;
  btnStop.disabled = false;

  try {
    const devices = await BrowserMultiFormatReader.listVideoInputDevices();

    // 背面カメラ優先（ラベル取れない場合もある）
    const back = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];
    const deviceId = back?.deviceId;

    reader.decodeFromVideoDevice(deviceId, video, async (result, err) => {
      if (!scanning) return;
      if (result) {
        const code = result.getText();
        isbnInput.value = code;
        await lookup();

        // 連続読み取りは止める（店舗での誤連打防止）
        stopScan();
      }
    });
  } catch (e) {
    console.error(e);
    alert("カメラを起動できませんでした。HTTPS環境か、権限設定を確認してください。");
    stopScan();
  }
}

function stopScan() {
  scanning = false;
  reader.reset();
  btnStart.disabled = false;
  btnStop.disabled = true;
}

btnStart.addEventListener("click", startScan);
btnStop.addEventListener("click", stopScan);

// 初期化
setMode("buy");
setBadge("-", "");
updateLinks("");
