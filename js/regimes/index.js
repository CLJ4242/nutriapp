// Registre des régimes. Pour ajouter un régime, l'importer et l'enregistrer ici.
import samaras from "./samaras.js";

const REGIMES = {
  [samaras.id]: samaras
};

// Régime « neutre » par défaut : aucune contrainte.
const AUCUN = {
  id: "aucun",
  nom: "Aucun régime",
  heures: samaras.heures,
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
