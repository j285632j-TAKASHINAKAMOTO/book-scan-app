const $ = (id) => document.getElementById(id);

// --------------------
// 要素取得
// --------------------

// カメラ
const btnStart = $("btnStart");
const btnStop = $("btnStop");
const video = $("video");

// ISBN / 取得
const isbnInput = $("isbn");
const btnLookup = $("btnLookup");

// 書籍情報
const titleEl = $("title");
const authorsEl = $("authors");
const publisherEl = $("publisher");
const thumbEl = $("thumb");

// 検索リンク
const linkMercari = $("linkMercari");
const linkRakuma = $("linkRakuma");
const linkYahoo = $("linkYahoo");

// モード切替
const btnModeBuy = $("btnModeBuy");
const btnModeList = $("btnModeList");
const panelBuy = $("panelBuy");
const panelList = $("panelList");

// 利益計算
const sellPrice = $("sellPrice");
const buyPrice = $("buyPrice");
const shipping = $("shipping");
const feeRate = $("feeRate");
const feeYen = $("feeYen");
const profitEl = $("profit");
const judgeEl = $("judge");
const threshold = $("threshold");

// 出品サポート
const listPrice = $("listPrice");
const condition = $("condition");
const note = $("note");
const btnGenerate = $("btnGenerate");
const btnCopy = $("btnCopy");
const output = $("output");
const copyMsg = $("copyMsg");

let streamRef = null;

// --------------------
// 初期設定
// --------------------
btnStart?.addEventListener("click", startCamera);
btnStop?.addEventListener("click", stopCamera);
btnLookup?.addEventListener("click", lookupBook);

isbnInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    lookupBook();
  }
});

btnModeBuy?.addEventListener("click", () => switchMode("buy"));
btnModeList?.addEventListener("click", () => switchMode("list"));

[sellPrice, buyPrice, shipping, feeRate, threshold].forEach((el) => {
  el?.addEventListener("input", calcProfit);
});

btnGenerate?.addEventListener("click", generateListingText);
btnCopy?.addEventListener("click", copyListingText);

updateSearchLinks("");
switchMode("buy");
calcProfit();

if (thumbEl) {
  thumbEl.style.display = "none";
}

console.log("BookScan 完成版 app-test.js 読み込みOK");

// --------------------
// カメラ
// --------------------
function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach((track) => track.stop());
    streamRef = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }

  if (btnStart) btnStart.disabled = false;
  if (btnStop) btnStop.disabled = true;
}

function waitForVideoReady(videoEl) {
  return new Promise((resolve) => {
    if (!videoEl) {
      resolve();
      return;
    }

    if (videoEl.readyState >= 1) {
      resolve();
      return;
    }

    videoEl.onloadedmetadata = () => resolve();
  });
}

async function getBackCameraStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });
  } catch (e) {
    console.log("facingMode指定で失敗。deviceId方式に切り替えます。", e);
  }

  const tempStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
  tempStream.getTracks().forEach((track) => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter((d) => d.kind === "videoinput");

  let backCam = videos.find((v) =>
    /back|rear|environment|背面|外側/i.test(v.label)
  );

  if (!backCam && videos.length > 1) {
    backCam = videos[videos.length - 1];
  }

  if (backCam) {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: backCam.deviceId }
      },
      audio: false
    });
  }

  return await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
}

async function startCamera() {
  try {
    stopCamera();

    if (!window.isSecureContext) {
      alert("HTTPSのページで開いてください。");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("このブラウザではカメラが使えません。");
      return;
    }

    streamRef = await getBackCameraStream();

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await waitForVideoReady(video);
    await video.play();

    btnStart.disabled = true;
    btnStop.disabled = false;
  } catch (e) {
    alert(`カメラを起動できませんでした: ${e.name} / ${e.message}`);
    console.error(e);
    stopCamera();
  }
}

// --------------------
// モード切替
// --------------------
function switchMode(mode) {
  if (mode === "buy") {
    panelBuy?.classList.remove("hidden");
    panelList?.classList.add("hidden");
    btnModeBuy?.classList.add("active");
    btnModeList?.classList.remove("active");
  } else {
    panelBuy?.classList.add("hidden");
    panelList?.classList.remove("hidden");
    btnModeBuy?.classList.remove("active");
    btnModeList?.classList.add("active");
  }
}

// --------------------
// 書籍情報取得
// --------------------
function normalizeIsbn(value) {
  return (value || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isValidIsbn13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(isbn[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(isbn[12]);
}

function setBookInfoEmpty(message = "-") {
  if (titleEl) titleEl.textContent = message;
  if (authorsEl) authorsEl.textContent = "-";
  if (publisherEl) publisherEl.textContent = "-";

  if (thumbEl) {
    thumbEl.removeAttribute("src");
    thumbEl.style.display = "none";
  }
}

function setBookInfo({ title = "-", authors = "-", publisher = "-", thumb = "" }) {
  if (titleEl) titleEl.textContent = title;
  if (authorsEl) authorsEl.textContent = authors;
  if (publisherEl) publisherEl.textContent = publisher;

  if (thumbEl) {
    if (thumb) {
      thumbEl.src = thumb.replace("http://", "https://");
      thumbEl.style.display = "block";
    } else {
      thumbEl.removeAttribute("src");
      thumbEl.style.display = "none";
    }
  }
}

function updateSearchLinks(keyword) {
  const q = encodeURIComponent(keyword || isbnInput?.value || "");

  if (linkMercari) {
    linkMercari.href = `https://jp.mercari.com/search?keyword=${q}`;
  }
  if (linkRakuma) {
    linkRakuma.href = `https://fril.jp/s?query=${q}`;
  }
  if (linkYahoo) {
    linkYahoo.href = `https://paypayfleamarket.yahoo.co.jp/search/${q}`;
  }
}

async function lookupBook() {
  console.log("lookupBook 実行");

  const raw = isbnInput?.value.trim() || "";
  const isbn = normalizeIsbn(raw);

  if (!isbn) {
    alert("ISBNを入力してください。");
    return;
  }

  if (!isValidIsbn13(isbn)) {
    setBookInfoEmpty("ISBN誤り");
    updateSearchLinks(isbn);
    alert("ISBNの数字が正しくない可能性があります。");
    return;
  }

  setBookInfoEmpty("取得中...");
  updateSearchLinks(isbn);

  // 1) openBD
  try {
    const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    if (res.ok) {
      const data = await res.json();
      const book = data?.[0];

      if (book?.summary) {
        const title = book.summary.title || "タイトル不明";
        const authors = book.summary.author || "-";
        const publisher = book.summary.publisher || "-";
        const thumb = book.summary.cover || "";

        setBookInfo({ title, authors, publisher, thumb });
        updateSearchLinks(title);

        if (listPrice && !listPrice.value) {
          listPrice.value = "";
        }
        return;
      }
    }
  } catch (e) {
    console.warn("openBD失敗", e);
  }

  // 2) Google Books
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (res.ok) {
      const data = await res.json();
      const item = data?.items?.[0];

      if (item?.volumeInfo) {
        const info = item.volumeInfo;
        const title = info.title || "タイトル不明";
        const authors = Array.isArray(info.authors) ? info.authors.join(" / ") : "-";
        const publisher = info.publisher || "-";
        const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";

        setBookInfo({ title, authors, publisher, thumb });
        updateSearchLinks(title);
        return;
      }
    }
  } catch (e) {
    console.warn("Google Books失敗", e);
  }

  setBookInfoEmpty("書誌取得不可");
  if (authorsEl) authorsEl.textContent = "検索リンクで確認してください";
  updateSearchLinks(isbn);
  alert("書籍情報を自動取得できませんでした。検索リンクで確認してください。");
}

// --------------------
// 利益計算
// --------------------
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatYen(value) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function calcProfit() {
  const sell = toNumber(sellPrice?.value);
  const buy = toNumber(buyPrice?.value);
  const ship = toNumber(shipping?.value);
  const rate = toNumber(feeRate?.value);
  const line = toNumber(threshold?.value);

  const fee = Math.round(sell * (rate / 100));
  const profit = sell - fee - buy - ship;

  if (feeYen) feeYen.textContent = formatYen(fee);
  if (profitEl) profitEl.textContent = formatYen(profit);

  if (judgeEl) {
    let text = "-";

    if (sell <= 0) {
      text = "未入力";
    } else if (profit >= line) {
      text = "買い";
    } else if (profit >= 0) {
      text = "微妙";
    } else {
      text = "見送り";
    }

    judgeEl.textContent = text;

    judgeEl.style.borderColor = "";
    judgeEl.style.color = "";

    if (text === "買い") {
      judgeEl.style.borderColor = "rgba(72,209,122,.6)";
      judgeEl.style.color = "#48d17a";
    } else if (text === "微妙") {
      judgeEl.style.borderColor = "rgba(255,200,80,.6)";
      judgeEl.style.color = "#ffc850";
    } else if (text === "見送り") {
      judgeEl.style.borderColor = "rgba(255,90,107,.6)";
      judgeEl.style.color = "#ff5a6b";
    }
  }
}

// --------------------
// 出品文生成
// --------------------
function getSafeText(el, fallback = "") {
  const text = el?.textContent?.trim();
  return text && text !== "-" ? text : fallback;
}

function generateListingText() {
  const title = getSafeText(titleEl, "タイトル不明");
  const authors = getSafeText(authorsEl, "-");
  const publisher = getSafeText(publisherEl, "-");
  const price = listPrice?.value?.trim() || "";
  const cond = condition?.value || "目立った傷や汚れなし";
  const extra = note?.value?.trim() || "";
  const isbn = normalizeIsbn(isbnInput?.value || "");

  const lines = [
    `${title}`,
    "",
    `【商品情報】`,
    `・著者：${authors}`,
    `・出版社：${publisher}`,
    isbn ? `・ISBN：${isbn}` : "",
    price ? `・販売価格：${price}円` : "",
    `・状態：${cond}`,
    "",
    `【商品説明】`,
    `${title} の出品です。`,
    `中古本のため、多少の使用感はある場合があります。`,
    extra ? `補足：${extra}` : "",
    `状態は写真でもご確認ください。`,
    "",
    `【発送について】`,
    `防水対策をして発送します。`,
    `よろしくお願いいたします。`
  ].filter(Boolean);

  if (output) {
    output.value = lines.join("\n");
  }

  if (btnCopy) {
    btnCopy.disabled = !output?.value;
  }

  if (copyMsg) {
    copyMsg.textContent = "テキストを生成しました。";
  }
}

async function copyListingText() {
  const text = output?.value || "";

  if (!text) {
    if (copyMsg) copyMsg.textContent = "先にテキストを生成してください。";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    if (copyMsg) copyMsg.textContent = "コピーしました。";
  } catch (e) {
    console.error("コピー失敗", e);
    if (copyMsg) copyMsg.textContent = "コピーに失敗しました。手動でコピーしてください。";
  }
}
