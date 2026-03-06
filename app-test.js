alert("app.js 読み込みOK");

const video = document.getElementById("video");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");

let streamRef = null;

async function startCamera() {
  alert("start");

  try {
    alert("try入りました");

    if (!window.isSecureContext) {
      alert("HTTPSではありません");
      return;
    }

    alert("HTTPS OK");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("getUserMediaが使えません");
      return;
    }

    alert("getUserMedia前");

    streamRef = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    alert("getUserMedia成功");

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();

    alert("video.play成功");

    btnStart.disabled = true;
    btnStop.disabled = false;
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
  btnStart.disabled = false;
  btnStop.disabled = true;
}

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);
