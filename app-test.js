import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType
} from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/esm/index.js";

alert("app-test.js v8 読み込みOK");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const video = document.getElementById("video");
const isbnInput = document.getElementById("isbn");
const btnLookup = document.getElementById("btnLookup");

let streamRef = null;
let controls = null;
let scanning = false;

// ISBN向け
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

async function getBackCameraStream() {
  // まず許可を取る
  const tempStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
  tempStream.getTracks().forEach(track => track.stop());

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter(d => d.kind === "videoinput");

  // 背面候補を探す
  let backCam = videos.find(v =>
    /back|rear|environment|背面|外側/i.test(v.label)
  );

  if (!backCam && videos.length > 1) {
    backCam = videos[videos.length - 1];
  }

  if (backCam) {
    return navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: backCam.deviceId }
      },
      audio: false
    });
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" }
    },
    audio: false
  });
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

    await stopCamera();

    streamRef = await getBackCameraStream();

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();

    // 少し待ってピントを合わせる
    await new Promise(resolve => setTimeout(resolve, 1200));

    controls = await reader.decodeFromVideoElement(video, async (result, err) => {
      if (!scanning) return;

      if (result) {
        const raw = result.getText();
        const code = normalizeText(raw);

        // 読めたものを一旦表示
        alert("読取値: " + code);

        // 本のISBNだけ通す
        if (!/^(978|979)\d{10}$/.test(code)) {
          return;
        }

        isbnInput.value = code;
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
