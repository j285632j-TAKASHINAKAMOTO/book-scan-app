const $ = (id) => document.getElementById(id);

console.log("app-test.js ZXing安全版 読み込み開始");

// --------------------
// 要素取得
// --------------------
const btnStart = $("btnStart");
const btnStop = $("btnStop");
const video = $("video");

const isbnInput = $("isbn");
const btnLookup = $("btnLookup");

const titleEl = $("title");
const authorsEl = $("authors");
const publisherEl = $("publisher");
const thumbEl = $("thumb");
const thumb =
  info.imageLinks?.thumbnail ||
  info.imageLinks?.smallThumbnail ||
  info.imageLinks?.small ||
  info.imageLinks?.medium ||
  "";

const linkMercari = $("linkMercari");
const linkRakuma = $("linkRakuma");
const linkYahoo = $("linkYahoo");

const btnModeBuy = $("btnModeBuy");
const btnModeList = $("btnModeList");
const panelBuy = $("panelBuy");
const panelList = $("panelList");

const sellPrice = $("sellPrice");
const buyPrice = $("buyPrice");
const shipping = $("shipping");
const feeRate = $("feeRate");
const feeYen = $("feeYen");
const profitEl = $("profit");
const judgeEl = $("judge");
const threshold = $("threshold");

const listPrice = $("listPrice");
const condition = $("condition");
const note = $("note");
const btnGenerate = $("btnGenerate");
const btnCopy = $("btnCopy");
const output = $("output");
const copyMsg = $("copyMsg");

let streamRef = null;
let scanReader = null;
let scanActive = false;
let lastScannedText = "";
let lastScanAt = 0;

// --------------------
// 初期化
// --------------------
init();

function init() {
  try {
    console.log("init 開始");

    btnStart?.addEventListener("click", startCameraAndScan);
    btnStop?.addEventListener("click", stopCamera);
    btnLookup?.addEventListener("click", lookupBook);

    isbnInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") lookupBook();
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

    if (thumbEl) thumbEl.style.display = "none";
    if (btnCopy) btnCopy.disabled = true;

    console.log("init 完了");
  } catch (e) {
    console.error("initエラー:", e);
    alert("初期化でエラーが発生しました。");
  }
}

// --------------------
// カメラ
// --------------------
function resetScanner() {
  try {
    if (scanReader && typeof scanReader.reset === "function") {
      scanReader.reset();
    }
  } catch (e) {
    console.warn("scanner reset warning:", e);
  }
  scanReader = null;
  scanActive = false;
}

function stopCamera() {
  try {
    resetScanner();

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
  } catch (e) {
    console.error("stopCameraエラー:", e);
  }
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
      video: { facingMode: { ideal: "environment" } },
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

async function startCameraAndScan() {
  try {
    console.log("startCameraAndScan 実行");

    stopCamera();

    if (!window.isSecureContext) {
      alert("HTTPSのページで開いてください。");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("このブラウザではカメラが使えません。");
      return;
    }

    if (!video) {
      alert("video要素が見つかりません。");
      return;
    }

    streamRef = await getBackCameraStream();

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await waitForVideoReady(video);
    await video.play();

    if (btnStart) btnStart.disabled = true;
    if (btnStop) btnStop.disabled = false;

    await startBarcodeScanning();
  } catch (e) {
    console.error("startCameraAndScanエラー:", e);
    alert(`カメラを起動できませんでした: ${e.name} / ${e.message}`);
    stopCamera();
  }
}

async function startBarcodeScanning() {
  try {
    if (!video || scanActive) return;

    console.log("ZXing 読み込み開始");

    const zxing = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
    const BrowserMultiFormatReader = zxing.BrowserMultiFormatReader;

    if (!BrowserMultiFormatReader) {
      throw new Error("ZXingの読み込みに失敗しました");
    }

    scanReader = new BrowserMultiFormatReader();
    scanActive = true;

    scanReader.decodeFromVideoElement(video, (result, error) => {
      if (result) {
        const text = typeof result.getText === "function"
          ? result.getText()
          : String(result.text || "");
        onBarcodeDetected(text);
        return;
      }

      if (error) {
        const name = error?.name || "";
        if (name !== "NotFoundException") {
          console.warn("scan error:", error);
        }
      }
    });

    console.log("ZXing スキャン開始");
  } catch (e) {
    console.error("startBarcodeScanningエラー:", e);
    alert("バーコード読み取り機能の読み込みに失敗しました。");
  }
}

function onBarcodeDetected(text) {
  const now = Date.now();
  const normalized = normalizeIsbn(text);

  if (!normalized) return;

  if (normalized === lastScannedText && now - lastScanAt < 2000) {
    return;
  }

  lastScannedText = normalized;
  lastScanAt = now;

  console.log("barcode detected:", normalized);

  if (isbnInput) isbnInput.value = normalized;
  updateSearchLinks(normalized);

  if (isValidIsbn13(normalized)) {
    lookupBook();
  }
}

// --------------------
// モード切替
// --------------------
function switchMode(mode) {
  try {
    if (!panelBuy || !panelList) return;

    if (mode === "buy") {
      panelBuy.classList.remove("hidden");
      panelList.classList.add("hidden");
      btnModeBuy?.classList.add("active");
      btnModeList?.classList.remove("active");
    } else {
      panelBuy.classList.add("hidden");
      panelList.classList.remove("hidden");
      btnModeBuy?.classList.remove("active");
      btnModeList?.classList.add("active");
    }
  } catch (e) {
    console.error("switchModeエラー:", e);
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
    thumbEl.alt = "表紙なし";
    thumbEl.style.display = "none";
  }
}

function setBookInfo({ title = "-", authors = "-", publisher = "-", thumb = "" }) {
  if (titleEl) titleEl.textContent = title;
  if (authorsEl) authorsEl.textContent = authors;
  if (publisherEl) publisherEl.textContent = publisher;

  if (!thumbEl) return;

  const safeThumb = (thumb || "").replace("http://", "https://").trim();

  if (!safeThumb) {
    console.log("表紙URLなし");
    thumbEl.removeAttribute("src");
    thumbEl.alt = "表紙なし";
    thumbEl.style.display = "none";
    return;
  }

  thumbEl.onload = () => {
    console.log("表紙画像 読み込み成功:", safeThumb);
    thumbEl.style.display = "block";
  };

  thumbEl.onerror = () => {
    console.log("表紙画像 読み込み失敗:", safeThumb);
    thumbEl.removeAttribute("src");
    thumbEl.alt = "表紙読み込み失敗";
    thumbEl.style.display = "none";
  };

  thumbEl.src = safeThumb;
  thumbEl.alt = `${title} の表紙`;
}
function updateSearchLinks(keyword) {
  const q = encodeURIComponent(keyword || isbnInput?.value || "");

  if (linkMercari) linkMercari.href = `https://jp.mercari.com/search?keyword=${q}`;
  if (linkRakuma) linkRakuma.href = `https://fril.jp/s?query=${q}`;
  if (linkYahoo) linkYahoo.href = `https://paypayfleamarket.yahoo.co.jp/search/${q}`;
}

async function lookupBook() {
  try {
    const raw = isbnInput?.value?.trim() || "";
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

    try {
      const res = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
      if (res.ok) {
        const data = await res.json();
        const book = data?.[0];
        if (book?.summary) {
          setBookInfo({
            title: book.summary.title || "タイトル不明",
            authors: book.summary.author || "-",
            publisher: book.summary.publisher || "-",
            thumb: book.summary.cover || ""
          });
          updateSearchLinks(book.summary.title || isbn);
          return;
        }
      }
    } catch (e) {
      console.warn("openBD失敗:", e);
    }

    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      if (res.ok) {
        const data = await res.json();
        const item = data?.items?.[0];
        if (item?.volumeInfo) {
          const info = item.volumeInfo;
          setBookInfo({
            title: info.title || "タイトル不明",
            authors: Array.isArray(info.authors) ? info.authors.join(" / ") : "-",
            publisher: info.publisher || "-",
            thumb: info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || ""
          });
          updateSearchLinks(info.title || isbn);
          return;
        }
      }
    } catch (e) {
      console.warn("Google Books失敗:", e);
    }

    setBookInfoEmpty("書誌取得不可");
    if (authorsEl) authorsEl.textContent = "検索リンクで確認してください";
    updateSearchLinks(isbn);
    alert("書籍情報を自動取得できませんでした。検索リンクで確認してください。");
  } catch (e) {
    console.error("lookupBook全体エラー:", e);
    alert("取得処理でエラーが発生しました。");
  }
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
  try {
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

      if (sell <= 0) text = "未入力";
      else if (profit >= line) text = "買い";
      else if (profit >= 0) text = "微妙";
      else text = "見送り";

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
  } catch (e) {
    console.error("calcProfitエラー:", e);
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
  try {
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

    if (output) output.value = lines.join("\n");
    if (btnCopy) btnCopy.disabled = !(output && output.value);
    if (copyMsg) copyMsg.textContent = "テキストを生成しました。";
  } catch (e) {
    console.error("generateListingTextエラー:", e);
    if (copyMsg) copyMsg.textContent = "テキスト生成でエラーが発生しました。";
  }
}

async function copyListingText() {
  try {
    const text = output?.value || "";

    if (!text) {
      if (copyMsg) copyMsg.textContent = "先にテキストを生成してください。";
      return;
    }

    await navigator.clipboard.writeText(text);
    if (copyMsg) copyMsg.textContent = "コピーしました。";
  } catch (e) {
    console.error("copyListingTextエラー:", e);
    if (copyMsg) copyMsg.textContent = "コピーに失敗しました。手動でコピーしてください。";
  }
}
