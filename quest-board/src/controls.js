import OBR from "@owlbear-rodeo/sdk";
import { CONTROL } from "./shared.js";
import "./style.css";

const send = (type) => OBR.broadcast.sendMessage(CONTROL, { type }, { destination: "LOCAL" });

OBR.onReady(() => {
  document.querySelector("#toggle").textContent = localStorage.getItem("quest-board-visible") === "false" ? "显示任务栏" : "隐藏任务栏";
  document.querySelector("#toggle").addEventListener("click", async (event) => {
    await send("toggle");
    event.currentTarget.textContent = event.currentTarget.textContent.includes("隐藏") ? "显示任务栏" : "隐藏任务栏";
  });
  document.querySelector("#reset").addEventListener("click", () => send("reset"));
});
