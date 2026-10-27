// Régime « Samaras » — règles codées explicitement.
// Chaque fonction renvoie { violations: [], avertissements: [] }.
// Les violations sont bloquantes, les avertissements sont indicatifs.

const HEURES = {
  "petit-dejeuner": "08:00",
  "dejeuner": "12:00",
  "collation": "16:45",
  "diner": "19:00"
};

// Un repas « du soir » (après 17h) est soumis aux interdits.
function estApres17h(typeRepas) {
  return typeRepas === "diner";
}

function alimentsDuRepas(recette, ctx) {
  if (!recette) return [];
  return recette.ingredients
    .map(ing => ctx.alimentsById[ing.alimentId])
    .filter(Boolean);
}

function a(aliment, tag) {
  return aliment.tags && aliment.tags.includes(tag);
}

function sommeGrammes(recette) {
  if (!recette) return 0;
  return recette.ingredients
    .filter(ing => ing.unite === "g")
    .reduce((s, ing) => s + ing.qteParPersonne, 0);
}

// Validation d'un repas isolé pour un profil donné.
function valideRepas(repas, profil, ctx) {
  const violations = [];
  const avertissements = [];
  const { typeRepas, recette, exception } = repas;
  const aliments = alimentsDuRepas(recette, ctx);

  // Exclusions personnelles du profil (aliments exclus).
  for (const al of aliments) {
    if (profil.exclus && profil.exclus.includes(al.id)) {
      violations.push(`« ${al.nom} » est exclu du profil de ${profil.nom}.`);
    }
  }

  // Règle : interdits après 17h (dîner).
  if (estApres17h(typeRepas)) {
    const interdits = aliments.filter(al => a(al, "interdit-apres-17h"));
    if (interdits.length > 0) {
      if (exception) {
        avertissements.push(
          `Exception utilisée au dîner : ${interdits.map(x => x.nom).join(", ")}.`
        );
      } else {
        for (const al of interdits) {
          violations.push(`« ${al.nom} » est interdit après 17h.`);
        }
      }
    }
    const alcool = aliments.filter(al => a(al, "alcool"));
    if (alcool.length > 0) {
      avertissements.push("Alcool : 1 verre maximum.");
    }
  }

  // Règles de composition par type de repas.
  const categories = aliments.map(al => al.categorie);
  const aCategorie = c => categories.includes(c);
  const aTag = t => aliments.some(al => a(al, t));

  if (typeRepas === "petit-dejeuner") {
    // Petit-déjeuner varié et approuvé : bol, tartines, quiche, œufs, soupe…
    // On demande surtout une source de protéine (non bloquant).
    const aProteine = aCategorie("laitier") || aCategorie("proteine");
    if (!aProteine) {
      avertissements.push("Le petit-déjeuner gagnerait à inclure une protéine (laitier, œufs, poisson…).");
    }
  }

  if (typeRepas === "dejeuner") {
    if (!aCategorie("legume")) {
      violations.push("Le déjeuner doit contenir des légumes (≈ 2/3 de l'assiette).");
    }
    if (!aCategorie("proteine")) {
      avertissements.push("Le déjeuner devrait contenir une protéine.");
    }
    if (!aCategorie("feculent")) {
      avertissements.push("Le déjeuner prévoit 1/3 protéine + féculent.");
    }
  }

  if (typeRepas === "collation") {
    // Les laitiers (skyr, fromage blanc) comptent comme source de protéine.
    if (!aCategorie("proteine") && !aCategorie("laitier")) {
      violations.push("La collation doit contenir 1 protéine.");
    }
    if (!aTag("fibre")) {
      violations.push("La collation doit contenir 1 fibre.");
    }
  }

  if (typeRepas === "diner") {
    if (!aCategorie("legume")) {
      violations.push("Le dîner doit contenir des légumes.");
    }
    if (!aCategorie("proteine")) {
      violations.push("Le dîner doit contenir une protéine.");
    }
    const pdj = ctx.repasDuJour && ctx.repasDuJour["petit-dejeuner"];
    if (pdj && pdj.recette) {
      if (sommeGrammes(recette) > sommeGrammes(pdj.recette)) {
        avertissements.push("Le dîner devrait être plus léger que le petit-déjeuner.");
      }
    }
  }

  return { violations, avertissements };
}

// Validation à l'échelle d'une journée (règles transversales).
function valideJour(repasDuJour, profil, ctx) {
  const violations = [];
  const avertissements = [];

  // Collation de 16h45 obligatoire (sauf si prise dehors).
  const collation = repasDuJour["collation"];
  if (!collation || (!collation.recette && !collation.dehors)) {
    violations.push("La collation de 16h45 est obligatoire.");
  }

  return { violations, avertissements };
}

export default {
  id: "samaras",
  nom: "Régime Samaras",
  heures: HEURES,
  valideRepas,
  valideJour
};
