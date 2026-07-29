/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 主色：温暖橙黄，亲和有活力
        brand: {
          50: "#FFF8EC",
          100: "#FFEFD3",
          200: "#FFDDA1",
          300: "#FFC56E",
          400: "#FFAD3B",
          500: "#FF9F43", // 主色
          600: "#F08A1F",
          700: "#C76F12",
        },
        // 成功：墨绿
        success: {
          500: "#2E7D5B",
          600: "#246A4D",
        },
        // 警示：暖橙（超时用）
        warn: {
          500: "#E8804A",
        },
        // 背景：暖灰，不用纯黑
        ink: {
          50: "#FAF9F7",
          100: "#F3F1ED",
          200: "#E5E1DA",
          700: "#3D3A36",
          800: "#2A2825",
          900: "#1F1D1B",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
