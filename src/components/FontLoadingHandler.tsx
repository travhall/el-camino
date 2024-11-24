import React, { useEffect } from "react";

const FontLoadingHandler = () => {
  useEffect(() => {
    // Create a link preload tag for each font file
    const fontFiles = [
      { url: "/fonts/AlumniSans.woff2", type: "font/woff2" },
      { url: "/fonts/AlumniSans-Italic.woff2", type: "font/woff2" },
      { url: "/fonts/Cabin.woff2", type: "font/woff2" },
      { url: "/fonts/Cabin-Italic.woff2", type: "font/woff2" },
    ];

    // Add preload links
    fontFiles.forEach((font) => {
      const link = document.createElement("link");
      link.href = font.url;
      link.rel = "preload";
      link.as = "font";
      link.type = font.type;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });

    // Add font-display optimization
    const style = document.createElement("style");
    style.textContent = `
      .font-loading {
        opacity: 0;
        transition: opacity 0.1s ease-in;
      }
      .fonts-loaded {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    // Check if fonts are loaded
    Promise.all(
      fontFiles.map((font) =>
        new FontFace(
          font.url.includes("Alumni")
            ? font.url.includes("Italic")
              ? "Alumni Italic"
              : "Alumni"
            : font.url.includes("Italic")
              ? "Cabin Italic"
              : "Cabin",
          `url(${font.url}) format('woff2')`
        ).load()
      )
    ).then(() => {
      document.documentElement.classList.add("fonts-loaded");
    });
  }, []);

  return null;
};

export default FontLoadingHandler;
