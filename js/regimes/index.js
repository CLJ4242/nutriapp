// Registre des régimes. Pour ajouter un régime, l'importer et l'enregistrer ici.
import stef from "./stef.js";

const REGIMES = {
  [stef.id]: stef
};

// Régime « neutre » par défaut : aucune contrainte.
const AUCUN = {
  id: "aucun",
  nom: "Aucun régime",
  heures: stef.heures,
  valideRepas() {
    return { violations: [], avertissements: [] };
  },
  valideJour() {
    return { violations: [], avertissements: [] };
  }
};

export function getRegime(id) {
  return REGIMES[id] || AUCUN;
}

export function listeRegimes() {
  return [AUCUN, ...Object.values(REGIMES)];
}
