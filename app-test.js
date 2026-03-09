const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const video = document.getElementById("video");

let streamRef = null;

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);

function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }

  video.pause();
  video.srcObject = null;

  btnStart.disabled = false;
  btnStop.disabled = true;
}

function waitForVideoReady(videoEl) {
  return new Promise((resolve) => {
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
  tempStream.getTracks().forEach(track => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter(d => d.kind === "videoinput");

  let backCam = videos.find(v =>
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

// すでにあるカメラ処理の下でも上でもOK
btnLookup.addEventListener("click", lookupBook);

// Enterキーでも取得できるようにする
isbnInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    lookupBook();
  }
});

function normalizeIsbn(value) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function setBookInfoEmpty(message = "-") {
  titleEl.textContent = message;
  authorsEl.textContent = "-";
  publisherEl.textContent = "-";
  thumbEl.removeAttribute("src");
  thumbEl.style.display = "none";
}

function updateSearchLinks(keyword) {
  const q = encodeURIComponent(keyword || isbnInput.value || "");
  linkMercari.href = `https://jp.mercari.com/search?keyword=${q}`;
  linkRakuma.href = `https://fril.jp/s?query=${q}`;
  linkYahoo.href = `https://paypayfleamarket.yahoo.co.jp/search/${q}`;
}

async function lookupBook() {
  const raw = isbnInput.value.trim();
  const isbn = normalizeIsbn(raw);

  if (!isbn) {
    alert("ISBNを入力してください。");
    return;
  }

  titleEl.textContent = "取得中...";
  authorsEl.textContent = "-";
  publisherEl.textContent = "-";
  thumbEl.removeAttribute("src");
  thumbEl.style.display = "none";

  updateSearchLinks(isbn);

  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const item = data.items?.[0];

    if (!item) {
      setBookInfoEmpty("見つかりませんでした");
      return;
    }

    const info = item.volumeInfo || {};
    const title = info.title || "タイトル不明";
    const authors = Array.isArray(info.authors) ? info.authors.join(" / ") : "-";
    const publisher = info.publisher || "-";
    const thumb =
      info.imageLinks?.thumbnail ||
      info.imageLinks?.smallThumbnail ||
      "";

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

    updateSearchLinks(title);
  } catch (e) {
    console.error(e);
    setBookInfoEmpty("取得エラー");
    alert("書籍情報を取得できませんでした。");
  }
}
