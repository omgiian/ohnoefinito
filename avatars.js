// Avatar disegnati a mano: animaletti tondi su fondo pastello opaco.
const INK = "#3a3540";
const BLUSH = `<ellipse cx="20.5" cy="42" rx="3.4" ry="2.1" fill="#ef9aa3" opacity=".75"/><ellipse cx="43.5" cy="42" rx="3.4" ry="2.1" fill="#ef9aa3" opacity=".75"/>`;
const eyes = (y = 36, r = 2.3) => `<circle cx="25" cy="${y}" r="${r}" fill="${INK}"/><circle cx="39" cy="${y}" r="${r}" fill="${INK}"/>`;
const mouth = (y = 43) => `<path d="M29 ${y}q1.5 1.7 3 0q1.5 1.7 3 0" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;

export const AVATAR_COLORS = [
  { id: "mint", label: "Menta", value: "#b7d6c4" },
  { id: "rose", label: "Rosa", value: "#f0cfcf" },
  { id: "butter", label: "Burro", value: "#f4e3b2" },
  { id: "sky", label: "Cielo", value: "#c6dbeb" },
  { id: "lilac", label: "Lilla", value: "#dad2ec" },
  { id: "peach", label: "Pesca", value: "#f4d6c2" },
];

const FACES = {
  gatto: {
    label: "Gatto",
    svg: () => {
      const f = "#f2d9bd";
      return `<path d="M15 30 L18 11 L29 20 Z M49 30 L46 11 L35 20 Z" fill="${f}"/>
        <path d="M18.5 25 L19.8 15.5 L25 20 Z M45.5 25 L44.2 15.5 L39 20 Z" fill="#efa9b0"/>
        <circle cx="32" cy="37" r="17" fill="${f}"/>${eyes()}${BLUSH}${mouth(42)}
        <path d="M13 38h7M13.5 42l6.5-1.5M51 38h-7M50.5 42l-6.5-1.5" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>
        <path d="M30.6 39.3h2.8l-1.4 1.5z" fill="${INK}"/>`;
    },
  },
  orso: {
    label: "Orso",
    svg: () => {
      const f = "#c9a383";
      return `<circle cx="18" cy="23" r="7" fill="${f}"/><circle cx="46" cy="23" r="7" fill="${f}"/>
        <circle cx="18" cy="23" r="3.6" fill="#e6c9ad"/><circle cx="46" cy="23" r="3.6" fill="#e6c9ad"/>
        <circle cx="32" cy="37" r="18" fill="${f}"/>
        <ellipse cx="32" cy="43" rx="7.5" ry="5.5" fill="#ecd9c4"/>${eyes(35)}${BLUSH}
        <ellipse cx="32" cy="40.5" rx="2.6" ry="1.8" fill="${INK}"/>${mouth(44.5)}`;
    },
  },
  coniglio: {
    label: "Coniglio",
    svg: () => {
      const f = "#fbf7f2";
      return `<ellipse cx="24" cy="15" rx="5.5" ry="12" fill="${f}"/><ellipse cx="40" cy="15" rx="5.5" ry="12" fill="${f}"/>
        <ellipse cx="24" cy="16" rx="2.6" ry="8" fill="#efb3b9"/><ellipse cx="40" cy="16" rx="2.6" ry="8" fill="#efb3b9"/>
        <circle cx="32" cy="39" r="17" fill="${f}"/>${eyes(38)}${BLUSH.replace(/cy="42"/g, 'cy="44"')}
        <path d="M30.8 41.5h2.4l-1.2 1.3z" fill="#e48c98"/>${mouth(44.5)}`;
    },
  },
  rana: {
    label: "Rana",
    svg: () => {
      const f = "#a9cf9a";
      return `<circle cx="21" cy="25" r="7.5" fill="${f}"/><circle cx="43" cy="25" r="7.5" fill="${f}"/>
        <ellipse cx="32" cy="40" rx="20" ry="15" fill="${f}"/>
        <circle cx="21" cy="25" r="4.6" fill="#fbf7f2"/><circle cx="43" cy="25" r="4.6" fill="#fbf7f2"/>
        <circle cx="21.5" cy="25.5" r="2.3" fill="${INK}"/><circle cx="43.5" cy="25.5" r="2.3" fill="${INK}"/>
        ${BLUSH}<path d="M24 41.5q8 6.5 16 0" stroke="${INK}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    },
  },
  pulcino: {
    label: "Pulcino",
    svg: () => {
      const f = "#f6dc7a";
      return `<path d="M30 20q1-6 4-7q-1 4 1 7" fill="${f}"/><circle cx="32" cy="37" r="18" fill="${f}"/>${eyes(35)}${BLUSH}
        <path d="M28.5 39.5h7l-3.5 4.2z" fill="#f0a35e"/>`;
    },
  },
  panda: {
    label: "Panda",
    svg: () => `<circle cx="18" cy="23" r="6.8" fill="${INK}"/><circle cx="46" cy="23" r="6.8" fill="${INK}"/>
      <circle cx="32" cy="37" r="18" fill="#fbf7f2"/>
      <ellipse cx="24.5" cy="35.5" rx="4.8" ry="6.2" fill="${INK}" transform="rotate(-22 24.5 35.5)"/>
      <ellipse cx="39.5" cy="35.5" rx="4.8" ry="6.2" fill="${INK}" transform="rotate(22 39.5 35.5)"/>
      <circle cx="25.3" cy="35" r="1.7" fill="#fbf7f2"/><circle cx="38.7" cy="35" r="1.7" fill="#fbf7f2"/>${BLUSH}
      <ellipse cx="32" cy="41" rx="2.4" ry="1.6" fill="${INK}"/>${mouth(44)}`,
  },
  volpe: {
    label: "Volpe",
    svg: () => {
      const f = "#e9a46f";
      return `<path d="M13 31 L17 10 L29 20 Z M51 31 L47 10 L35 20 Z" fill="${f}"/>
        <path d="M17.5 25 L18.8 15 L24.5 19.5 Z M46.5 25 L45.2 15 L39.5 19.5 Z" fill="${INK}" opacity=".8"/>
        <circle cx="32" cy="37" r="17" fill="${f}"/>
        <path d="M15.5 39q8 -2 16.5 7q8.5 -9 16.5 -7q-3 13 -16.5 15q-13.5 -2 -16.5 -15z" fill="#fbf7f2"/>${eyes(34)}
        <ellipse cx="32" cy="43" rx="2.4" ry="1.7" fill="${INK}"/>`;
    },
  },
  maialino: {
    label: "Maialino",
    svg: () => {
      const f = "#f2bfc4";
      return `<path d="M16 26 L18 14 L27 21 Z M48 26 L46 14 L37 21 Z" fill="#e9a3ab"/>
        <circle cx="32" cy="37" r="18" fill="${f}"/>${eyes(34)}${BLUSH.replace(/#ef9aa3/g, "#e58995")}
        <ellipse cx="32" cy="42" rx="7" ry="4.8" fill="#e79aa4"/>
        <ellipse cx="29.6" cy="42" rx="1.3" ry="1.8" fill="${INK}"/><ellipse cx="34.4" cy="42" rx="1.3" ry="1.8" fill="${INK}"/>`;
    },
  },
  cane: {
    label: "Cane",
    svg: () => {
      const f = "#f3e3cc";
      return `<circle cx="32" cy="36" r="17" fill="${f}"/>
        <ellipse cx="16" cy="34" rx="6" ry="11.5" fill="#b98a63" transform="rotate(14 16 34)"/>
        <ellipse cx="48" cy="34" rx="6" ry="11.5" fill="#b98a63" transform="rotate(-14 48 34)"/>
        <ellipse cx="38.5" cy="30" rx="5" ry="4.5" fill="#e3c9a8"/>${eyes(34)}${BLUSH}
        <ellipse cx="32" cy="40" rx="2.9" ry="2.1" fill="${INK}"/>${mouth(43.5)}`;
    },
  },
  pinguino: {
    label: "Pinguino",
    svg: () => `<circle cx="32" cy="36" r="19" fill="#525a70"/>
      <circle cx="26" cy="39" r="9.5" fill="#fbf7f2"/><circle cx="38" cy="39" r="9.5" fill="#fbf7f2"/>
      ${eyes(36)}${BLUSH.replace(/cy="42"/g, 'cy="43"')}
      <path d="M29 40.5h6l-3 3.6z" fill="#f0a35e"/>`,
  },
};

export const AVATARS = Object.entries(FACES).map(([id, f]) => ({ id, label: f.label }));
export const DEFAULT_AVATAR = { avatar: "gatto", color: "mint" };

export function randomAvatar() {
  const a = AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
  const c = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)].id;
  return { avatar: a, color: c };
}

/** SVG dell'avatar. `label` diventa il testo alternativo. */
export function avatarSvg(avatar, color, label = "") {
  const face = FACES[avatar] || FACES[DEFAULT_AVATAR.avatar];
  const bg = (AVATAR_COLORS.find(c => c.id === color) || AVATAR_COLORS[0]).value;
  const a11y = label ? `role="img" aria-label="${String(label).replace(/[&<>"]/g, "")}"` : `aria-hidden="true"`;
  return `<svg class="avatar-svg" viewBox="0 0 64 64" ${a11y}><circle cx="32" cy="32" r="32" fill="${bg}"/>${face.svg()}</svg>`;
}
