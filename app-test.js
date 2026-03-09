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

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);
btnLookup.addEventListener("click", lookupBook);

isbnInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    lookupBook();
  }
});

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
    // ① まず openBD を試す
    const openBdRes = await fetch(`https://api.openbd.jp/v1/get?isbn=${isbn}`);
    if (!openBdRes.ok) {
      throw new Error(`openBD HTTP ${openBdRes.status}`);
    }

    const openBdData = await openBdRes.json();
    const book = openBdData?.[0];

    if (book) {
      const summary = book.summary || {};
      const title = summary.title || "タイトル不明";
      const authors = summary.author || "-";
      const publisher = summary.publisher || "-";
      const thumb =
        summary.cover ||
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
      return;
    }

    // ② openBDで見つからなければ Google Books
    const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    if (!googleRes.ok) {
      throw new Error(`Google Books HTTP ${googleRes.status}`);
    }

    const googleData = await googleRes.json();
    const item = googleData.items?.[0];

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
    console.error("lookupBook error:", e);
    setBookInfoEmpty("取得エラー");
    alert(`書籍情報を取得できませんでした。\n${e.message}`);
  }
}
