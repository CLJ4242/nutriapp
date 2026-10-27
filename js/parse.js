// Aide à la saisie : découpe une liste d'ingrédients collée en lignes éditables,
// et rapproche chaque nom d'un aliment de la base. Ce n'est qu'une pré-saisie ;
// l'utilisatrice corrige ensuite.

// Normalise un nom pour la comparaison : minuscules, sans accents, sans article.
export function normaliser(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/^\s*(de\s+la\s+|de\s+l'|d'|des\s+|du\s+|de\s+|la\s+|le\s+|les\s+|l'|un\s+|une\s+)/,"")
    .replace(/[.,;:()]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Unités reconnues (motif -> unité normalisée stockée).
const UNITES = [
  { re: /\b(kg|kilos?|kilogrammes?)\b/, u: "kg" },
  { re: /\b(g|gr|grammes?)\b/, u: "g" },
  { re: /\b(ml|millilitres?)\b/, u: "ml" },
  { re: /\b(cl|centilitres?)\b/, u: "cl" },
  { re: /\b(l|litres?)\b/, u: "l" },
  { re: /\bc\.?\s*à\s*s(oupe)?\b|\bcuill[eè]res?\s*à\s*soupe\b|\bcas\b/, u: "c. à soupe" },
  { re: /\bc\.?\s*à\s*c(af[ée])?\b|\bcuill[eè]res?\s*à\s*caf[ée]\b|\bcac\b/, u: "c. à café" },
  { re: /\b(pinc[ée]es?)\b/, u: "pincée" },
  { re: /\b(tranches?)\b/, u: "tranche" },
  { re: /\b(gousses?)\b/, u: "gousse" }
];

// Convertit "1/2", "1,5", "2" en nombre.
function lireNombre(txt) {
  const frac = txt.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  const num = txt.match(/^\d+(?:[.,]\d+)?/);
  if (num) return parseFloat(num[0].replace(",", "."));
  return null;
}

// Parse une ligne -> { qte, unite, nom }. Valeurs par défaut tolérantes.
export function parserLigne(ligne) {
  let reste = ligne.replace(/^[\s•\-*–—.]+/, "").trim();
  if (!reste) return null;

  let qte = lireNombre(reste);
  if (qte !== null) {
    reste = reste.replace(/^(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/, "").trim();
  }

  let unite = "pièce";
  const bas = " " + reste.toLowerCase() + " ";
  for (const { re, u } of UNITES) {
    if (re.test(bas)) {
      unite = u;
      // retire le premier mot d'unité du texte restant
      reste = reste.replace(re, " ").replace(/\s+/g, " ").trim();
      break;
    }
  }

  const nom = reste.replace(/^(de\s+la\s+|de\s+l'|d'|des\s+|du\s+|de\s+)/i, "").trim();
  if (!nom) return null;
  return { qte: qte === null ? 1 : qte, unite, nom };
}

// Parse un bloc de texte collé -> tableau de lignes { qte, unite, nom, alimentId }.
export function parserIngredients(texte, aliments) {
  const lignes = (texte || "").split(/\r?\n/);
  const out = [];
  for (const l of lignes) {
    const parsed = parserLigne(l);
    if (!parsed) continue;
    parsed.alimentId = trouverAliment(parsed.nom, aliments);
    out.push(parsed);
  }
  return out;
}

// Rapproche un nom d'un aliment existant : égalité normalisée, puis inclusion.
export function trouverAliment(nom, aliments) {
  const n = normaliser(nom);
  if (!n) return null;
  let exact = aliments.find(a => normaliser(a.nom) === n);
  if (exact) return exact.id;
  // inclusion dans un sens ou l'autre (ex. "tomates cerises" ~ "tomates")
  let partiel = aliments.find(a => {
    const an = normaliser(a.nom);
    return n.includes(an) || an.includes(n);
  });
  return partiel ? partiel.id : null;
}
