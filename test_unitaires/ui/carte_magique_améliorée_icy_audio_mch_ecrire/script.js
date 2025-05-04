document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("magicCard");
  const details = document.getElementById("details");
  const closeBtn = details.querySelector(".close-btn");
  const magicSound = document.getElementById("magicSound");
  const magicText = details.querySelector("p");
  const originalText = magicText.textContent;

  let isExpanded = false;
  let animationFrame;

  const expand = () => {
    magicSound.currentTime = 0;
    magicSound.play();
    details.classList.add("open");
    let height = 0;
    const fullHeight = details.scrollHeight;

    const step = () => {
      height += 10;
      if (height >= fullHeight) {
        details.style.maxHeight = fullHeight + "px";
        return;
      }
      details.style.maxHeight = height + "px";
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
    typeWriter(magicText, originalText);
  };

  const collapse = () => {
    cancelAnimationFrame(animationFrame);
    let height = details.scrollHeight;
    details.classList.remove("open");

    const step = () => {
      height -= 10;
      if (height <= 0) {
        details.style.maxHeight = "0px";
        magicText.textContent = originalText; // reset texte
        return;
      }
      details.style.maxHeight = height + "px";
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
  };

  const typeWriter = (element, text) => {
    element.textContent = "";
    let i = 0;

    function write() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(write, 30); // vitesse d’écriture
      }
    }
    write();
  };

  card.addEventListener("click", (e) => {
    if (e.target === closeBtn) return;

    card.classList.add("clicked");
    setTimeout(() => card.classList.remove("clicked"), 700);

    if (!isExpanded) {
      expand();
    } else {
      collapse();
    }
    isExpanded = !isExpanded;
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    collapse();
    isExpanded = false;
  });

  // Effet de l’ombre dynamique
  card.addEventListener("mousemove", (e) => {
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 10;
    const y = (e.clientY - top - height / 2) / 10;
    card.style.boxShadow = `${x}px ${y}px 24px rgba(0, 200, 255, 0.4)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = `0 0 20px rgba(0, 200, 255, 0.4)`;
  });
});
