alert("app-test.js 読み込みOK");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const video = document.getElementById("video");

let streamRef = null;

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);

async function startCamera() {
  try {
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop());
      streamRef = null;
    }

    try {
      streamRef = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "environment" }
        },
        audio: false
      });
    } catch {
      streamRef = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });
    }

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();
    alert("背面カメラ起動OK");
  } catch (e) {
    alert(`カメラ失敗: ${e.name} / ${e.message}`);
    console.error(e);
  }
}

function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }
  video.srcObject = null;
}
