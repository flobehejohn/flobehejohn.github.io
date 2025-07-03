import { playTypingClick } from "./audioFunctions.js";

/**
 * Effet machine à écrire enrichi avec animation de surbrillance
 * @param {HTMLElement} element - Élément cible
 * @param {string} text - Contenu HTML
 * @param {Function} onComplete - Callback après animation
 * @param {number} speedFactor - Facteur de ralentissement (ex: 1.25 = +25%)
 */
export function typeWriter(
  element,
  text,
  onComplete = () => {},
  speedFactor = 1,
) {
  element.innerHTML = "";
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(`<span>${text}</span>`, "text/html");
  const nodes = Array.from(htmlDoc.body.firstChild.childNodes);
  let i = 0;

  function write() {
    if (i < nodes.length) {
      const node = nodes[i++];

      if (node.nodeType === Node.TEXT_NODE) {
        const span = document.createElement("span");
        span.textContent = node.textContent;
        element.appendChild(span);
        playTypingClick();
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.tagName === "STRONG"
      ) {
        const strong = document.createElement("strong");
        strong.classList.add("mgc-highlight-pop");
        strong.textContent = node.textContent;
        element.appendChild(strong);
        playTypingClick();
        // Ajoute la classe "mgc-active" pour déclencher l'effet CSS
        requestAnimationFrame(() => {
          strong.classList.add("mgc-active");
        });
      }

      setTimeout(() => requestAnimationFrame(write), 8 * speedFactor);
    } else {
      onComplete();
    }
  }

  requestAnimationFrame(write);
}
