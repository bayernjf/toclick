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
          50: "#EBF5F0",
          100: "#D4ECE1",
          200: "#A9D8C3",
          300: "#7EC5A5",
          400: "#53B287",
          500: "#2E7D5B", // 主色
          600: "#246A4D",
          700: "#1A543D",
          800: "#103D2D",
          900: "#08291E",
        },
        // 警示：暖橙
        warn: {
          50: "#FEF3ED",
          100: "#FDE4D6",
          200: "#FAC8AB",
          300: "#F7AD80",
          400: "#F09155",
          500: "#E8804A", // 主色
          600: "#D06A35",
          700: "#A85328",
        },
        // 背景：暖灰，不用纯黑
        ink: {
          50: "#FAF9F7",
          100: "#F3F1ED",
          200: "#E5E1DA",
          300: "#C4C0B7", // 次要文字 placeholder
          400: "#A09C94", // 辅助图标
          500: "#7D7972", // 较淡文字
          600: "#5D5952", // 次要标题
          700: "#3D3A36", // 正文
          800: "#2A2825", // 主标题
          900: "#1F1D1B", // 最深
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
