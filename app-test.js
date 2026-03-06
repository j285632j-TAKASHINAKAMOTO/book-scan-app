import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType
} from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/esm/index.js";

const video = document.getElementById("video");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const isbnInput = document.getElementById("isbn");
const btnLookup = document.getElementById("btnLookup");

let streamRef = null;
let controls = null;
let scanning = false;

// 本のバーコード向け
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8
]);

const reader = new BrowserMultiFormatReader(hints, {
  delayBetweenScanAttempts: 200
});

function normalizeIsbn(text) {
  return String(text || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

async function stopCamera() {
  scanning = false;

  try {
    if (controls) {
      controls.stop();
      controls = null;
    }
  } catch (e) {
    console.warn(e);
  }

  try {
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
      streamRef = null;
    }
  } catch (e) {
    console.warn(e);
  }

  video.pause();
  video.srcObject = null;

  btnStart.disabled = false;
  btnStop.disabled = true;
}

async function startCamera() {
  if (scanning) return;
  scanning = true;

  try {
    if (!window.isSecureContext) {
      alert("HTTPSで開いてください");
      scanning = false;
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("このブラウザではカメラが使えません");
      scanning = false;
      return;
    }

    btnStart.disabled = true;
    btnStop.disabled = false;

    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
      streamRef = null;
    }

    streamRef = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();

    controls = await reader.decodeFromVideoElement(video, async (result, err) => {
      if (!scanning) return;

      if (result) {
  const raw = result.getText();
  alert("読取値: " + raw);

  const code = normalizeIsbn(raw);
  if (!/^(978|979)\d{10}$/.test(code)) return;

        isbnInput.value = code;
        alert("ISBNを読み取りました: " + code);

        await stopCamera();

        if (btnLookup) {
          btnLookup.click();
        }
      }
    });

  } catch (e) {
    alert(`カメラ/読取失敗: ${e.name || "Error"} / ${e.message || ""}`);
    console.error(e);
    await stopCamera();
  }
}

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);

window.addEventListener("pagehide", stopCamera);
window.addEventListener("beforeunload", stopCamera);
