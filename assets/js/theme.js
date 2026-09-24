// Tema visual bersama KITA SEBAYA (dimuat tepat setelah Tailwind CDN).
//
// Arah desain: e-learning gamifikasi untuk pelajar — ceria dan hidup,
// tapi tetap rapi. Dua warna merek dipertahankan (hijau pinus dari materi,
// merah pita dari simbol kepedulian HIV/AIDS) dan dilengkapi dua aksen
// permainan (kuning matahari untuk XP/penghargaan, biru langit untuk info)
// agar kartu, lencana, dan progres punya variasi warna tanpa jadi ramai.

(function () {
    const netral = {
        50: "#FAF9F5", 100: "#F1EFE6", 200: "#E4E0D0", 300: "#CDC6AC", 400: "#9C9478",
        500: "#736C55", 600: "#544F3D", 700: "#3D3929", 800: "#28251A", 900: "#1B1911", 950: "#100F0A",
    };
    const pinus = {
        50: "#EDF7F0", 100: "#D3EEDC", 200: "#A5DDB8", 300: "#70C793", 400: "#3FAE73",
        500: "#1F9259", 600: "#137347", 700: "#0F5C3A", 800: "#0F4931", 900: "#0D3C2A", 950: "#062017",
    };
    const pita = {
        50: "#FEF1F0", 100: "#FCDEDB", 200: "#F9BAB4", 300: "#F38F86", 400: "#EA5F53",
        500: "#DB3F31", 600: "#BC2C20", 700: "#96241B", 800: "#7B221B", 900: "#66201B", 950: "#380D09",
    };
    const matahari = {
        50: "#FFF9EB", 100: "#FEEFC7", 200: "#FDDC89", 300: "#FCC64C", 400: "#FBAF22",
        500: "#F58F0B", 600: "#D96906", 700: "#B44A09", 800: "#92390E", 900: "#792F0F", 950: "#451604",
    };
    const langit = {
        50: "#EFF8FF", 100: "#DBEEFE", 200: "#BFE3FE", 300: "#93D2FD", 400: "#5FB8FB",
        500: "#3B9AF5", 600: "#257CE8", 700: "#1E64D1", 800: "#1F52A8", 900: "#1F4685", 950: "#182B52",
    };
    const ungu = {
        50: "#F6F2FE", 100: "#EBE2FD", 200: "#D9C8FB", 300: "#BEA3F7", 400: "#A17DF0",
        500: "#8657E6", 600: "#743ED2", 700: "#6230B0", 800: "#51298F", 900: "#432574", 950: "#2A1550",
    };

    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    slate: netral, gray: netral, zinc: netral, neutral: netral, stone: netral,
                    teal: pinus, emerald: pinus, green: pinus, cyan: langit, sky: langit, blue: langit,
                    indigo: ungu, violet: ungu, purple: ungu,
                    rose: pita, red: pita, pink: pita,
                    amber: matahari, yellow: matahari, orange: matahari,
                    pinus, pita, netral, matahari, langit, ungu,
                },
                fontFamily: {
                    sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                    display: ['"Baloo 2"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
                },
                fontWeight: { medium: "500", semibold: "600", bold: "650", extrabold: "720", black: "780" },
                borderRadius: {
                    sm: "8px", DEFAULT: "12px", md: "14px", lg: "18px", xl: "22px", "2xl": "28px", "3xl": "34px",
                },
                boxShadow: {
                    sm: "0 1px 3px rgba(27,25,17,.06)",
                    DEFAULT: "0 2px 6px rgba(27,25,17,.07)",
                    md: "0 6px 16px -4px rgba(27,25,17,.12)",
                    lg: "0 14px 30px -10px rgba(27,25,17,.18)",
                    xl: "0 24px 48px -16px rgba(27,25,17,.22)",
                    "2xl": "0 36px 72px -20px rgba(27,25,17,.28)",
                    pop: "0 6px 0 0 var(--tw-shadow-color, rgba(15,92,58,.9))",
                    inner: "inset 0 1px 2px rgba(27,25,17,.06)",
                },
                letterSpacing: { tight: "-0.01em", tighter: "-0.025em" },
            },
        },
    };
})();
