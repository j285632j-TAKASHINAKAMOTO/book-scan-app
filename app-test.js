alert("app-test.js 読み込みOK");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const video = document.getElementById("video");

let streamRef = null;

btnStart.addEventListener("click", startCamera);
btnStop.addEventListener("click", stopCamera);

async function stopCamera() {
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }
  video.srcObject = null;
}

async function startCamera() {
  try {
    await stopCamera();

    // いったん何でもいいので許可を取る
    let tempStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    // 一度止める
    tempStream.getTracks().forEach(track => track.stop());

    // カメラ一覧を取得
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === "videoinput");

    const names = videos.map(v => v.label || "(no label)");
    alert("カメラ一覧:\n" + names.join("\n"));

    // 背面っぽいカメラを探す
    let backCam = videos.find(v =>
      /back|rear|environment|背面|外側/i.test(v.label)
    );

    // 見つからなければ最後のカメラを使うことが多い
    if (!backCam && videos.length > 1) {
      backCam = videos[videos.length - 1];
    }

    if (backCam) {
      streamRef = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: backCam.deviceId }
        },
        audio: false
      });
      alert("背面候補で起動: " + backCam.label);
    } else {
      streamRef = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      alert("背面候補が見つからないため通常起動");
    }

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = streamRef;

    await video.play();
    alert("カメラ起動OK");
  } catch (e) {
    alert(`カメラ失敗: ${e.name} / ${e.message}`);
    console.error(e);
  }
}
