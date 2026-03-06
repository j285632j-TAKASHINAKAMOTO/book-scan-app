import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType
} from "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/esm/index.js";

alert("app-test.js v12 読み込みOK");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const video = document.getElementById("video");
const isbnInput = document.getElementById("isbn");

let streamRef = null;
let controls = null;
let scanning = false;

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A
]);
hints.set(DecodeHintType.TRY_HARDER, true);

const reader = new BrowserMultiFormatReader(hints);

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);

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

  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }

  video.srcObject = null;
}

async function getBackCameraStream() {
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
    return navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: backCam.deviceId } },
      audio: false
    });
  }

  return navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false
  });
}

async function startCamera() {
  if (scanning) return;
  scanning = true;

  try {
    await stopCamera();

    streamRef = await getBackCameraStream();

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();
    alert("v12 カメラ起動OK");

    await new Promise(resolve => setTimeout(resolve, 1200));

    controls = await reader.decodeFromVideoElement(video, async (result, err) => {
      if (!scanning) return;

      if (result) {
        const code = normalizeText(result.getText());
        alert("読取値: " + code);
        isbnInput.value = code;
        await stopCamera();
      }
    });
  } catch (e) {
    alert(`v12 エラー: ${e.name} / ${e.message}`);
    console.error(e);
    await stopCamera();
  }
}
