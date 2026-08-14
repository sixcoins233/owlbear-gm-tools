import { RESULT_KEY, themes } from "./shared.js";
import "./style.css";

const stage = document.querySelector("#roll-stage");
const result = JSON.parse(localStorage.getItem(RESULT_KEY) || "null");
const themeName = themes.find(([id]) => id === result?.theme)?.[1] || "深紫漩涡";

if (!result) {
  stage.innerHTML = `<p class="loading">命运的回声已经消散。</p>`;
} else {
  const dense = result.dice.length > 45 ? "tiny" : result.dice.length > 20 ? "dense" : "";
  stage.className = `${result.theme} ${dense}`;
  const heading = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = `${result.actor} 的命运投掷`;
  const subtitle = document.createElement("p");
  subtitle.textContent = `${themeName} · ${result.dice.length} 枚骰子`;
  heading.append(title, subtitle);
  const tray = document.createElement("div");
  tray.className = "roll-tray";
  result.dice.forEach((die, index) => {
    const element = document.createElement("div");
    element.className = `rolled-die d${die.sides}`;
    element.style.setProperty("--delay", `${Math.min(index * 0.035, 1.2)}s`);
    element.style.setProperty("--turn", `${(index % 2 ? -1 : 1) * (420 + (index % 5) * 75)}deg`);
    const face = document.createElement("b");
    face.textContent = die.value;
    const type = document.createElement("small");
    type.textContent = `d${die.sides}`;
    element.append(face, type);
    tray.append(element);
  });
  const total = document.createElement("div");
  total.className = "grand-total";
  const label = document.createElement("span");
  label.textContent = "总计";
  total.append(label);
  if (result.modifier) {
    const equation = document.createElement("div");
    equation.className = "equation";
    const diceValue = document.createElement("b");
    diceValue.textContent = result.diceTotal;
    const sign = document.createElement("em");
    sign.textContent = result.modifier > 0 ? "+" : "−";
    const bonus = document.createElement("b");
    bonus.textContent = Math.abs(result.modifier);
    const equals = document.createElement("em");
    equals.textContent = "=";
    const final = document.createElement("strong");
    final.textContent = result.total;
    equation.append(diceValue, sign, bonus, equals, final);
    total.append(equation);
  } else {
    const value = document.createElement("strong");
    value.textContent = result.total;
    total.append(value);
  }
  stage.append(heading, tray, total);
}
