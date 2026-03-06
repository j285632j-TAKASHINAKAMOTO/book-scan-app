import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType
} from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/esm/index.js";

const video = document.getElementById("video");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const isbnInput = document.getElementById("isbn");

let streamRef = null;
let controls = null;
let scanning = false;

// 本のバーコード向け設定
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A
]);
hints.set(DecodeHintType.TRY_HARDER, true);

const reader = new BrowserMultiFormatReader(hints);

function normalizeText(text) {
  return String(text || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

async function stopCamera() {
  scanning = false;

  try {
    controls?.stop();
    controls = null;
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
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();
    alert("video play 成功");

    // ピントが合うまで少し待つ
    await new Promise(resolve => setTimeout(resolve, 1200));

    controls = await reader.decodeFromVideoElement(video, async (result, err) => {
      if (!scanning) return;

      if (result) {
        const raw = result.getText();
        const code = normalizeText(raw);

        alert("読取値: " + code);

        isbnInput.value = code;
        await stopCamera();
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
