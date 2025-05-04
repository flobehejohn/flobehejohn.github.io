document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("magicCard");
  const details = document.getElementById("details");
  const closeBtn = details.querySelector(".close-btn");
  const clickSound = document.getElementById("clickSound");
  const closeSound = document.getElementById("closeSound");

  let animationFrame;
  let isExpanded = false;

  const expand = () => {
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
  };

  const collapse = () => {
    cancelAnimationFrame(animationFrame);
    let height = details.scrollHeight;

    const step = () => {
      height -= 10;
      if (height <= 0) {
        details.style.maxHeight = "0px";
        details.classList.remove("open");
        return;
      }
      details.style.maxHeight = height + "px";
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
  };

  card.addEventListener("click", (e) => {
    if (e.target === closeBtn) return;
    card.classList.add("clicked");
    setTimeout(() => card.classList.remove("clicked"), 700);

    if (!isExpanded) {
      clickSound.currentTime = 0;
      clickSound.play();
      expand();
    } else {
      closeSound.currentTime = 0;
      closeSound.play();
      collapse();
    }
    isExpanded = !isExpanded;
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSound.currentTime = 0;
    closeSound.play();
    collapse();
    isExpanded = false;
  });

  // 🔥 Ombre dynamique qui suit le pointeur
  card.addEventListener("mousemove", (e) => {
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 10;
    const y = (e.clientY - top - height / 2) / 10;
    card.style.boxShadow = `${x}px ${y}px 24px var(--shadow)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = `0 0 20px var(--shadow)`;
  });
});
