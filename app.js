alert("app.js 読み込みOK");

const video = document.getElementById("video");
const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");

let streamRef = null;

async function startCamera() {
  alert("start");
}

btnStart.addEventListener("click", startCamera);
