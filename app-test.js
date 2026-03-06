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

// まずは本で使いそうな形式を広めに取る
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39
]);

const reader = new BrowserMultiFormatReader(hints);

function normalizeText(text) {
  return String(text || "").trim();
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

    // まずは安定優先
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

    // 少し待つとピントが合いやすい
    await new Promise(resolve => setTimeout(resolve, 800));

    controls = await reader.decodeFromVideoElement(video, async (result, err) => {
      if (!scanning) return;

      if (result) {
        const raw = normalizeText(result.getText());

        // まずは読めた値を必ず出す
        alert("読取値: " + raw);

        isbnInput.value = raw;
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
