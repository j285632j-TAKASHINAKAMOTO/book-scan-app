alert("app-test.js 読み込みOK");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const video = document.getElementById("video");

alert("btnStart=" + !!btnStart);
alert("btnStop=" + !!btnStop);
alert("video=" + !!video);

btnStart.addEventListener("click", () => {
  alert("スキャン開始ボタン反応OK");
});
