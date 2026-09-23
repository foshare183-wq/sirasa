// Tema visual bersama KITA SEBAYA (dimuat tepat setelah Tailwind CDN).
//
// Palet sengaja dibatasi: satu warna utama (hijau pinus), satu aksen
// (merah pita, simbol kepedulian HIV/AIDS), dan netral abu kehijauan.
// Warna-warna Tailwind lama (indigo, sky, emerald, dsb.) dipetakan ke
// palet ini supaya seluruh halaman, termasuk HTML yang dibuat oleh JS,
// otomatis tampil seragam tanpa perlu menulis ulang setiap kelas.

(function () {
    const netral = {
        50: "#F6F7F6", 100: "#EEF0EE", 200: "#E1E4E2", 300: "#C9CECB", 400: "#99A19D",
        500: "#6B746F", 600: "#4F5853", 700: "#39423E", 800: "#232C29", 900: "#18201D", 950: "#0F1513",
    };
    const pinus = {
        50: "#EEF6F4", 100: "#D5EAE5", 200: "#ADD5CC", 300: "#7DB9AD", 400: "#4E998C",
        500: "#2E7D71", 600: "#1F665C", 700: "#1A534B", 800: "#17433D", 900: "#133733", 950: "#0A201D",
    };
    const pita = {
        50: "#FBF1F1", 100: "#F6DEDE", 200: "#EDBBBC", 300: "#E08E90", 400: "#CF5F63",
        500: "#B93A3F", 600: "#A12B30", 700: "#852428", 800: "#6E2124", 900: "#5C1F21", 950: "#330D0F",
    };
    const oker = {
        50: "#FBF6EC", 100: "#F4E8CB", 200: "#E9D199", 300: "#DDB766", 400: "#D0A143",
        500: "#B9872C", 600: "#976C22", 700: "#75531D", 800: "#5A4018", 900: "#463315", 950: "#271C0A",
    };

    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    slate: netral, gray: netral, zinc: netral, neutral: netral, stone: netral,
                    teal: pinus, emerald: pinus, green: pinus, cyan: pinus, sky: pinus,
                    blue: pinus, indigo: pinus, violet: pinus, purple: pinus,
                    rose: pita, red: pita, pink: pita,
                    amber: oker, yellow: oker, orange: oker,
                    pinus, pita, netral, oker,
                },
                fontFamily: {
                    sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                },
                fontWeight: { medium: "500", semibold: "600", bold: "650", extrabold: "720", black: "760" },
                borderRadius: {
                    sm: "4px", DEFAULT: "6px", md: "8px", lg: "10px", xl: "12px", "2xl": "14px", "3xl": "18px",
                },
                boxShadow: {
                    sm: "0 1px 2px rgba(24,32,29,.05)",
                    DEFAULT: "0 1px 3px rgba(24,32,29,.06), 0 1px 2px rgba(24,32,29,.04)",
                    md: "0 2px 8px -2px rgba(24,32,29,.08)",
                    lg: "0 8px 24px -10px rgba(24,32,29,.14)",
                    xl: "0 16px 40px -16px rgba(24,32,29,.18)",
                    "2xl": "0 28px 64px -20px rgba(24,32,29,.26)",
                    inner: "inset 0 1px 2px rgba(24,32,29,.06)",
                },
                letterSpacing: { tight: "-0.015em", tighter: "-0.03em" },
            },
        },
    };
})();
