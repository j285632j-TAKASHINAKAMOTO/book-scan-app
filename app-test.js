const $ = (id) => document.getElementById(id);

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

let streamRef = null;

// 初期化
btnStart?.addEventListener("click", startCamera);
btnStop?.addEventListener("click", stopCamera);
btnLookup?.addEventListener("click", lookupBook);

isbnInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    lookupBook();
  }
});

updateSearchLinks("");

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
// 書籍情報
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
  titleEl.textContent = message;
  authorsEl.textContent = "-";
  publisherEl.textContent = "-";
  thumbEl.removeAttribute("src");
  thumbEl.style.display = "none";
}

function setBookInfo({ title = "-", authors = "-", publisher = "-", thumb = "" }) {
  titleEl.textContent = title;
  authorsEl.textContent = authors;
  publisherEl.textContent = publisher;

  if (thumb) {
    thumbEl.src = thumb.replace("http://", "https://");
    thumbEl.style.display = "block";
  } else {
    thumbEl.removeAttribute("src");
    thumbEl.style.display = "none";
  }
}

function updateSearchLinks(keyword) {
  const q = encodeURIComponent(keyword || isbnInput?.value || "");
  if (linkMercari) linkMercari.href = `https://jp.mercari.com/search?keyword=${q}`;
  if (linkRakuma) linkRakuma.href = `https://fril.jp/s?query=${q}`;
  if (linkYahoo) linkYahoo.href = `https://paypayfleamarket.yahoo.co.jp/search/${q}`;
}

async function lookupBook() {
  console.log("lookupBook 実行");

  const raw = isbnInput.value.trim();
  const isbn = normalizeIsbn(raw);

  if (!isbn) {
    alert("ISBNを入力してください。");
    return;
  }

  if (!isValidIsbn13(isbn)) {
    setBookInfoEmpty("ISBN誤り");
    alert("ISBNの数字が正しくない可能性があります。");
    updateSearchLinks(isbn);
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
    console.warn("Google Books失敗", e);
  }

  setBookInfoEmpty("書誌取得不可");
  authorsEl.textContent = "検索リンクで確認してください";
  updateSearchLinks(isbn);
  alert("書籍情報を自動取得できませんでした。検索リンクで確認してください。");
}

console.log("app-test.js 読み込みOK");
