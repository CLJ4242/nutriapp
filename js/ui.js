// Rendu des 5 vues. UI mobile-first, en français.
import {
  JOURS, TYPES_REPAS, LIBELLE_REPAS,
  getAliments, getRecettes, getFoyer, setFoyer,
  getPlan, setPlan, getCourses, setCourses,
  alimentsById, recettesById, uid,
  ajouterRecette, modifierRecette, supprimerRecette, ajouterAliment,
  getMasquerExemples, setMasquerExemples, setTypesRepas
} from "./store.js";
import { listeRegimes } from "./regimes/index.js";
import { validerPlan, proposer, proposerRepas, planVide, normaliserVariete, assainir, recetteConforme, NB_CRENEAUX } from "./planner.js";
import { genererCourses } from "./courses.js";
import { parserIngredients } from "./parse.js";
import { MOIS, moisCourant, nomMois, statut, libelleSaison, analyseRecette } from "./saison.js";

// Horaires des repas — cœur du régime (pas la pesée).
const HORAIRES = {
  "petit-dejeuner": "8h00",
  "dejeuner": "12h00",
  "collation": "16h45",
  "diner": "19h00"
};

// Catégories et rayons proposés quand on crée un nouvel ingrédient.
const CATEGORIES = [
  "legume", "fruit", "proteine", "feculent", "laitier",
  "matiere-grasse", "sucre", "boisson", "condiment"
];
const LIBELLE_CATEGORIE = {
  "legume": "Légume", "fruit": "Fruit", "proteine": "Protéine",
  "feculent": "Féculent", "laitier": "Laitier", "matiere-grasse": "Matière grasse",
  "sucre": "Sucre / dessert", "boisson": "Boisson", "condiment": "Condiment"
};
const RAYONS = [
  "fruits-legumes", "boucherie-poissonnerie", "cremerie", "epicerie-salee",
  "epicerie-sucree", "boulangerie", "boissons", "surgeles", "autre"
];
const LIBELLE_RAYON_UI = {
  "fruits-legumes": "Fruits & légumes", "boucherie-poissonnerie": "Boucherie / Poissonnerie",
  "cremerie": "Crèmerie", "epicerie-salee": "Épicerie salée", "epicerie-sucree": "Épicerie sucrée",
  "boulangerie": "Boulangerie", "boissons": "Boissons", "surgeles": "Surgelés", "autre": "Autre"
};

// Unités proposées pour les ingrédients d'une recette.
const UNITES = ["g", "kg", "ml", "cl", "l", "pièce", "c. à soupe", "c. à café", "tranche", "gousse", "pincée"];

// Petit helper de création d'éléments.
function el(tag, props = {}, enfants = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const e of [].concat(enfants)) {
    if (e == null) continue;
    n.appendChild(typeof e === "string" ? document.createTextNode(e) : e);
  }
  return n;
}

function vider(c) { c.innerHTML = ""; }

// ---------- Vue Foyer ----------
function rendreFoyer(c) {
  vider(c);
  const foyer = getFoyer();
  const regimes = listeRegimes();
  const aliments = getAliments();

  c.appendChild(el("h2", { text: "Foyer" }));
  c.appendChild(el("p", { class: "muted", text: `${foyer.personnes.length} personne(s).` }));

  for (const p of foyer.personnes) {
    const bloc = el("div", { class: "carte" });

    const nom = el("input", { type: "text", value: p.nom || "", placeholder: "Nom" });
    nom.addEventListener("input", () => { p.nom = nom.value; setFoyer(foyer); });

    const selReg = el("select");
    for (const r of regimes) {
      const o = el("option", { value: r.id, text: r.nom });
      if (r.id === p.regimeId) o.selected = true;
      selReg.appendChild(o);
    }
    selReg.addEventListener("change", () => { p.regimeId = selReg.value; setFoyer(foyer); });

    const suppr = el("button", {
      class: "danger", text: "Supprimer",
      onclick: () => {
        foyer.personnes = foyer.personnes.filter(x => x.id !== p.id);
        setFoyer(foyer);
        rendreFoyer(c);
      }
    });

    // Exclusions alimentaires.
    const details = el("details");
    details.appendChild(el("summary", { text: `Aliments exclus (${(p.exclus || []).length})` }));
    const liste = el("div", { class: "cases" });
    for (const al of aliments) {
      const cb = el("input", { type: "checkbox" });
      cb.checked = (p.exclus || []).includes(al.id);
      cb.addEventListener("change", () => {
        p.exclus = p.exclus || [];
        if (cb.checked) p.exclus.push(al.id);
        else p.exclus = p.exclus.filter(x => x !== al.id);
        setFoyer(foyer);
        details.querySelector("summary").textContent = `Aliments exclus (${p.exclus.length})`;
      });
      liste.appendChild(el("label", { class: "case" }, [cb, " " + al.nom]));
    }
    details.appendChild(liste);

    bloc.appendChild(el("div", { class: "ligne" }, [nom, selReg]));
    bloc.appendChild(details);
    bloc.appendChild(suppr);
    c.appendChild(bloc);
  }

  c.appendChild(el("button", {
    class: "primaire", text: "+ Ajouter une personne",
    onclick: () => {
      const def = regimes.find(r => r.id === "samaras") || regimes[0];
      foyer.personnes.push({ id: uid("p"), nom: "", regimeId: def.id, aimes: [], exclus: [] });
      setFoyer(foyer);
      rendreFoyer(c);
    }
  }));
}

// ---------- Vue Aliments ----------
function rendreAliments(c) {
  vider(c);
  c.appendChild(el("h2", { text: "Aliments" }));
  const mois = moisCourant();
  c.appendChild(el("p", { class: "muted", text: `Saison affichée pour ${nomMois(mois)}.` }));
  const aliments = getAliments().slice().sort((a, b) => a.nom.localeCompare(b.nom));
  const tbl = el("table", { class: "tbl" });
  tbl.appendChild(el("tr", {}, [
    el("th", { text: "Nom" }), el("th", { text: "Catégorie" }),
    el("th", { text: "Rayon" }), el("th", { text: "Saison" })
  ]));
  for (const al of aliments) {
    const s = statut(al, mois);
    const tdSaison = el("td", {}, [
      libelleSaison(al),
      s === "de-saison" ? el("span", { class: "badge", text: "de saison" }) : null
    ]);
    tbl.appendChild(el("tr", {}, [
      el("td", { text: al.nom }),
      el("td", { text: al.categorie }),
      el("td", { text: al.rayon }),
      tdSaison
    ]));
  }
  c.appendChild(tbl);
}

// ---------- Vue Recettes ----------
function rendreRecettes(c) {
  vider(c);
  c.appendChild(el("h2", { text: "Recettes" }));

  const barre = el("div", { class: "ligne" });
  barre.appendChild(el("button", {
    class: "primaire", text: "+ Ajouter une recette",
    onclick: () => formulaireRecette(c, null)
  }));
  const masque = getMasquerExemples();
  barre.appendChild(el("button", {
    class: "danger", text: masque ? "Afficher les exemples" : "Masquer les exemples",
    onclick: () => { setMasquerExemples(!masque); rendreRecettes(c); }
  }));
  c.appendChild(barre);

  const alIdx = alimentsById();
  const recettes = getRecettes();
  if (!recettes.length) {
    c.appendChild(el("p", { class: "muted", text: "Aucune recette. Clique sur « + Ajouter une recette »." }));
    return;
  }

  // Modifie les types de repas d'une recette (user -> recette ; exemple -> surcharge).
  const changerTypes = (r, types) => {
    if (!types.length) { rendreRecettes(c); return; } // au moins un type
    if (r.source === "user") modifierRecette({ ...r, typesRepas: types, typeRepas: types[0], source: undefined });
    else setTypesRepas(r.id, types);
    rendreRecettes(c);
  };

  // Chaque recette est listée une fois, sous son type principal.
  for (const t of TYPES_REPAS) {
    const recs = recettes.filter(r => (r.typesRepas || [r.typeRepas])[0] === t);
    if (!recs.length) continue;
    c.appendChild(el("h3", { text: LIBELLE_REPAS[t] }));
    for (const r of recs) {
      const types = r.typesRepas || [r.typeRepas];
      const bloc = el("div", { class: "carte" });
      bloc.appendChild(el("div", { class: "ligne" }, [
        el("strong", { text: r.nom }),
        r.source === "seed" ? el("span", { class: "badge", text: "exemple" }) : null
      ]));

      // Cases à cocher des repas où le plat est autorisé.
      const cases = el("div", { class: "types" });
      for (const tr of TYPES_REPAS) {
        const cb = el("input", { type: "checkbox" });
        cb.checked = types.includes(tr);
        cb.addEventListener("change", () => {
          const nouveaux = TYPES_REPAS.filter(x => x === tr ? cb.checked : types.includes(x));
          changerTypes(r, nouveaux);
        });
        cases.appendChild(el("label", { class: "case" }, [cb, " " + LIBELLE_REPAS[tr]]));
      }
      bloc.appendChild(cases);

      const ul = el("ul");
      for (const ing of r.ingredients) {
        const al = alIdx[ing.alimentId];
        ul.appendChild(el("li", {
          text: `${al ? al.nom : ing.alimentId} — ~${arrondi(ing.qteParPersonne)} ${ing.unite} / pers.`
        }));
      }
      bloc.appendChild(ul);
      if (r.source === "user") {
        bloc.appendChild(el("div", { class: "ligne" }, [
          el("button", { text: "Modifier", onclick: () => formulaireRecette(c, r) }),
          el("button", {
            class: "danger", text: "Supprimer",
            onclick: () => { if (confirm(`Supprimer « ${r.nom} » ?`)) { supprimerRecette(r.id); rendreRecettes(c); } }
          })
        ]));
      }
      c.appendChild(bloc);
    }
  }
}

// Formulaire d'ajout / modification d'une recette.
function formulaireRecette(c, recetteExistante) {
  vider(c);
  const edition = !!recetteExistante;
  c.appendChild(el("h2", { text: edition ? "Modifier la recette" : "Nouvelle recette" }));

  const nbFoyer = Math.max(1, getFoyer().personnes.length);
  const etat = {
    nom: recetteExistante ? recetteExistante.nom : "",
    typesRepas: recetteExistante ? (recetteExistante.typesRepas || [recetteExistante.typeRepas]).slice() : ["dejeuner"],
    nbPersonnes: nbFoyer || 2,
    // lignes = { alimentId, nom, qte (TOTALE), unite }
    lignes: []
  };
  if (recetteExistante) {
    const alIdx = alimentsById();
    etat.lignes = recetteExistante.ingredients.map(ing => ({
      alimentId: ing.alimentId,
      nom: alIdx[ing.alimentId] ? alIdx[ing.alimentId].nom : ing.alimentId,
      qte: Math.round(ing.qteParPersonne * etat.nbPersonnes * 100) / 100,
      unite: ing.unite
    }));
  }

  const form = el("div", { class: "carte" });

  const inNom = el("input", { type: "text", value: etat.nom, placeholder: "Nom de la recette" });
  inNom.addEventListener("input", () => etat.nom = inNom.value);

  // Types de repas (plusieurs possibles : un plat peut être matin ET midi, etc.).
  const casesType = el("div", { class: "types" });
  for (const t of TYPES_REPAS) {
    const cb = el("input", { type: "checkbox" });
    cb.checked = etat.typesRepas.includes(t);
    cb.addEventListener("change", () => {
      etat.typesRepas = TYPES_REPAS.filter(x => x === t ? cb.checked : etat.typesRepas.includes(x));
    });
    casesType.appendChild(el("label", { class: "case" }, [cb, " " + LIBELLE_REPAS[t]]));
  }

  const inNb = el("input", { type: "number", min: "1", value: String(etat.nbPersonnes) });
  inNb.addEventListener("input", () => etat.nbPersonnes = Math.max(1, parseInt(inNb.value, 10) || 1));

  form.appendChild(el("label", { class: "champ" }, ["Nom", inNom]));
  form.appendChild(el("div", { class: "champ" }, ["Repas (un ou plusieurs)", casesType]));
  form.appendChild(el("label", { class: "champ" }, ["Quantités pour combien de personnes ?", inNb]));

  // Zone des lignes d'ingrédients.
  form.appendChild(el("h3", { text: "Ingrédients (quantités totales)" }));
  const zoneLignes = el("div");
  form.appendChild(zoneLignes);

  function dessinerLignes() {
    vider(zoneLignes);
    const aliments = getAliments().slice().sort((a, b) => a.nom.localeCompare(b.nom));
    etat.lignes.forEach((ligne, i) => {
      const sel = el("select");
      sel.appendChild(el("option", { value: "", text: ligne.nom ? `— ${ligne.nom} (à choisir) —` : "— choisir —" }));
      for (const al of aliments) {
        const o = el("option", { value: al.id, text: al.nom });
        if (al.id === ligne.alimentId) o.selected = true;
        sel.appendChild(o);
      }
      sel.appendChild(el("option", { value: "__nouveau__", text: "➕ Nouvel ingrédient…" }));
      sel.addEventListener("change", () => {
        if (sel.value === "__nouveau__") {
          miniFormAliment(zoneLignes, ligne.nom, (id) => { ligne.alimentId = id; dessinerLignes(); });
          sel.value = ligne.alimentId || "";
        } else {
          ligne.alimentId = sel.value || null;
        }
      });

      const inQte = el("input", { type: "number", min: "0", step: "any", value: String(ligne.qte) });
      inQte.addEventListener("input", () => ligne.qte = parseFloat(inQte.value) || 0);

      const inUnite = el("select");
      const uniteCourante = ligne.unite || "g";
      const options = UNITES.includes(uniteCourante) ? UNITES : [uniteCourante, ...UNITES];
      for (const u of options) {
        const o = el("option", { value: u, text: u });
        if (u === uniteCourante) o.selected = true;
        inUnite.appendChild(o);
      }
      inUnite.addEventListener("change", () => ligne.unite = inUnite.value);

      const btnX = el("button", {
        class: "danger", text: "×", title: "Retirer",
        onclick: () => { etat.lignes.splice(i, 1); dessinerLignes(); }
      });

      zoneLignes.appendChild(el("div", { class: "ligne-ing" }, [sel, inQte, inUnite, btnX]));
    });
  }
  dessinerLignes();

  form.appendChild(el("button", {
    text: "+ Ingrédient",
    onclick: () => { etat.lignes.push({ alimentId: null, nom: "", qte: 0, unite: "g" }); dessinerLignes(); }
  }));

  // Collage de texte.
  const details = el("details");
  details.appendChild(el("summary", { text: "Coller une liste d'ingrédients" }));
  const zoneTexte = el("textarea", { rows: "6", placeholder: "Ex. :\n200 g de carottes\n2 œufs\n150 g de riz" });
  details.appendChild(zoneTexte);
  details.appendChild(el("button", {
    text: "Analyser le texte",
    onclick: () => {
      const parsed = parserIngredients(zoneTexte.value, getAliments());
      if (!parsed.length) { alert("Rien à analyser."); return; }
      const alIdx = alimentsById();
      for (const p of parsed) {
        etat.lignes.push({
          alimentId: p.alimentId || null,
          nom: p.alimentId && alIdx[p.alimentId] ? alIdx[p.alimentId].nom : p.nom,
          qte: p.qte, unite: p.unite
        });
      }
      zoneTexte.value = "";
      details.open = false;
      dessinerLignes();
    }
  }));
  form.appendChild(details);

  // Boutons d'action.
  const zoneErr = el("p", { class: "bilan ko", style: "display:none" });
  form.appendChild(zoneErr);
  form.appendChild(el("div", { class: "ligne" }, [
    el("button", {
      class: "primaire", text: edition ? "Enregistrer" : "Créer la recette",
      onclick: () => enregistrer()
    }),
    el("button", { text: "Annuler", onclick: () => rendreRecettes(c) })
  ]));

  function enregistrer() {
    const erreurs = [];
    if (!etat.nom.trim()) erreurs.push("Donne un nom à la recette.");
    const lignesValides = etat.lignes.filter(l => l.qte > 0);
    if (!lignesValides.length) erreurs.push("Ajoute au moins un ingrédient avec une quantité.");
    const nonClasses = lignesValides.filter(l => !l.alimentId).map(l => l.nom || "(sans nom)");
    if (nonClasses.length) erreurs.push("Ingrédients à choisir/classer : " + nonClasses.join(", ") + ".");
    if (!etat.typesRepas.length) erreurs.push("Coche au moins un repas (matin, midi, collation ou soir).");
    if (erreurs.length) {
      zoneErr.style.display = "";
      zoneErr.textContent = erreurs.join(" ");
      return;
    }
    const n = etat.nbPersonnes;
    const recette = {
      id: recetteExistante ? recetteExistante.id : undefined,
      nom: etat.nom.trim(),
      typesRepas: etat.typesRepas.slice(),
      typeRepas: etat.typesRepas[0],
      ingredients: lignesValides.map(l => ({
        alimentId: l.alimentId,
        qteParPersonne: Math.round((l.qte / n) * 100) / 100,
        unite: l.unite || "g"
      }))
    };
    if (edition) modifierRecette(recette); else ajouterRecette(recette);
    rendreRecettes(c);
  }

  c.appendChild(form);
}

// Mini-formulaire pour classer un nouvel ingrédient, inséré en place.
function miniFormAliment(zone, nomSuggere, onCree) {
  const panneau = el("div", { class: "carte mini" });
  panneau.appendChild(el("strong", { text: "Nouvel ingrédient" }));

  const inNom = el("input", { type: "text", value: nomSuggere || "", placeholder: "Nom" });

  const selCat = el("select");
  for (const cat of CATEGORIES) selCat.appendChild(el("option", { value: cat, text: LIBELLE_CATEGORIE[cat] }));

  const selRayon = el("select");
  for (const r of RAYONS) selRayon.appendChild(el("option", { value: r, text: LIBELLE_RAYON_UI[r] }));

  const cbInterdit = el("input", { type: "checkbox" });
  const cbFibre = el("input", { type: "checkbox" });

  panneau.appendChild(el("label", { class: "champ" }, ["Nom", inNom]));
  panneau.appendChild(el("label", { class: "champ" }, ["Catégorie", selCat]));
  panneau.appendChild(el("label", { class: "champ" }, ["Rayon", selRayon]));
  panneau.appendChild(el("label", { class: "case" }, [cbInterdit, " Interdit après 17h"]));
  panneau.appendChild(el("label", { class: "case" }, [cbFibre, " Source de fibre"]));

  panneau.appendChild(el("div", { class: "ligne" }, [
    el("button", {
      class: "primaire", text: "Ajouter",
      onclick: () => {
        if (!inNom.value.trim()) { inNom.focus(); return; }
        const tags = [];
        if (cbInterdit.checked) tags.push("interdit-apres-17h");
        if (cbFibre.checked) tags.push("fibre");
        const id = ajouterAliment({
          nom: inNom.value.trim(), categorie: selCat.value, rayon: selRayon.value, tags
        });
        panneau.remove();
        onCree(id);
      }
    }),
    el("button", { text: "Annuler", onclick: () => panneau.remove() })
  ]));

  zone.appendChild(panneau);
  inNom.focus();
}

// ---------- Vue Plan ----------
function rendrePlan(c) {
  vider(c);
  c.appendChild(el("h2", { text: "Plan de la semaine" }));
  let plan = getPlan();
  if (!plan.mois) plan.mois = moisCourant();
  if (plan.mealPrep === undefined) plan.mealPrep = true;
  if (!Number.isInteger(plan.debut)) plan.debut = 0;
  if (!Number.isInteger(plan.fin)) plan.fin = NB_CRENEAUX - 1;
  plan.variete = normaliserVariete(plan.variete);
  const regen = () => proposer({ mois: plan.mois, variete: plan.variete, mealPrep: plan.mealPrep, debut: plan.debut, fin: plan.fin });

  // Auto-remplissage : si le plan est vide, on le génère tout de suite.
  if (planVide(plan)) {
    plan = regen();
    setPlan(plan);
  } else if (assainir(plan, plan.mois)) {
    // Remplace les repas devenus non conformes (ex. aliment exclu ajouté après).
    setPlan(plan);
  }

  const recettes = getRecettes();
  const recById = recettesById();
  const alIdx = alimentsById();

  // En-tête : mois + variété + regénération.
  const selMois = el("select");
  for (let m = 1; m <= 12; m++) {
    const o = el("option", { value: String(m), text: nomMois(m) });
    if (m === plan.mois) o.selected = true;
    selMois.appendChild(o);
  }
  selMois.addEventListener("change", () => {
    plan.mois = parseInt(selMois.value, 10);
    plan = regen();
    setPlan(plan); rendrePlan(c);
  });

  // Sélecteurs de période (du créneau X au créneau Y).
  const creneauSelect = (valeur) => {
    const s = el("select");
    let idx = 0;
    for (const jour of JOURS) for (const t of TYPES_REPAS) {
      const lib = jour.charAt(0).toUpperCase() + jour.slice(1) + " · " + LIBELLE_REPAS[t];
      const o = el("option", { value: String(idx), text: lib });
      if (idx === valeur) o.selected = true;
      s.appendChild(o); idx++;
    }
    return s;
  };
  const selDebut = creneauSelect(plan.debut);
  const selFin = creneauSelect(plan.fin);
  selDebut.addEventListener("change", () => {
    plan.debut = parseInt(selDebut.value, 10);
    if (plan.fin < plan.debut) plan.fin = plan.debut;
    plan = regen(); setPlan(plan); rendrePlan(c);
  });
  selFin.addEventListener("change", () => {
    plan.fin = parseInt(selFin.value, 10);
    if (plan.debut > plan.fin) plan.debut = plan.fin;
    plan = regen(); setPlan(plan); rendrePlan(c);
  });

  // Interrupteur meal prep.
  const cbMP = el("input", { type: "checkbox" });
  cbMP.checked = plan.mealPrep;
  cbMP.addEventListener("change", () => {
    plan.mealPrep = cbMP.checked;
    plan = regen();
    setPlan(plan); rendrePlan(c);
  });

  // Un sélecteur de variété par type de repas (uniquement en meal prep).
  const champsVar = el("div", { class: "variete" });
  for (const t of TYPES_REPAS) {
    const sv = el("select");
    for (const [v, lib] of [[2, "2 plats (meal prep)"], [3, "3 plats"], [4, "4 plats"], [5, "5 plats"], [7, "Chaque jour différent"]]) {
      const o = el("option", { value: String(v), text: lib });
      if (v === plan.variete[t]) o.selected = true;
      sv.appendChild(o);
    }
    sv.addEventListener("change", () => {
      plan.variete[t] = parseInt(sv.value, 10);
      plan = regen();
      setPlan(plan); rendrePlan(c);
    });
    champsVar.appendChild(el("label", { class: "champ" }, [LIBELLE_REPAS[t], sv]));
  }

  const entete = el("div", { class: "carte" });
  entete.appendChild(el("label", { class: "champ" }, ["Mois (pour la saison)", selMois]));
  entete.appendChild(el("details", {}, [
    el("summary", { text: "Période à planifier" }),
    el("label", { class: "champ" }, ["Du", selDebut]),
    el("label", { class: "champ" }, ["au", selFin]),
    el("p", { class: "muted", text: "Pratique si tu fais les courses en cours de semaine : ne génère que ces repas (le reste est laissé vide)." })
  ]));
  entete.appendChild(el("label", { class: "case" }, [cbMP, " Mode meal prep (répéter des plats)"]));
  if (plan.mealPrep) {
    entete.appendChild(el("details", {}, [
      el("summary", { text: "Variété des repas" }),
      champsVar
    ]));
  }
  entete.appendChild(el("button", {
    class: "accent", text: "🎲 Regénérer la semaine",
    onclick: () => { plan = regen(); setPlan(plan); rendrePlan(c); }
  }));
  const hint = plan.mealPrep
    ? "Meal prep : un même plat revient plusieurs jours (midi surtout), pratique à cuisiner en avance."
    : "Mode normal : un plat différent chaque jour.";
  entete.appendChild(el("p", { class: "muted", text: "Rempli automatiquement (de saison, conforme au régime, dîners simples). " + hint + " Change un repas dans le menu, ou re-tire-le avec 🎲." }));
  c.appendChild(entete);

  const zoneMsg = el("div", { class: "messages" });

  for (const jour of JOURS) {
    const bloc = el("div", { class: "carte" });
    bloc.appendChild(el("h3", { text: jour.charAt(0).toUpperCase() + jour.slice(1) }));
    for (const t of TYPES_REPAS) {
      const case_ = plan.semaine[jour][t];
      const sel = el("select");
      sel.appendChild(el("option", { value: "", text: "— aucun —" }));
      sel.appendChild(el("option", { value: "__dehors__", text: "🍽️ Au restaurant / dehors" }));
      // On ne liste que les recettes conformes (régime + aliments exclus),
      // en gardant la recette déjà choisie même si elle ne l'est pas.
      for (const r of recettes.filter(r => (r.typesRepas || [r.typeRepas]).includes(t) && (recetteConforme(r) || r.id === case_.recetteId))) {
        const o = el("option", { value: r.id, text: r.nom });
        if (!case_.dehors && r.id === case_.recetteId) o.selected = true;
        sel.appendChild(o);
      }
      if (case_.dehors) sel.value = "__dehors__";
      sel.addEventListener("change", () => {
        if (sel.value === "__dehors__") { case_.recetteId = null; case_.dehors = true; }
        else { case_.recetteId = sel.value || null; case_.dehors = false; }
        setPlan(plan); rendrePlan(c);
      });

      const btnDe = el("button", {
        class: "de", text: "🎲", title: "Re-tirer ce repas",
        onclick: () => {
          const exclure = case_.recetteId ? new Set([case_.recetteId]) : new Set();
          const id = proposerRepas(t, plan.mois, exclure);
          if (id) { case_.recetteId = id; case_.dehors = false; setPlan(plan); rendrePlan(c); }
        }
      });

      const horaire = t === "collation" ? `${HORAIRES[t]} (obligatoire)` : HORAIRES[t];
      bloc.appendChild(el("div", { class: "ligne-repas" }, [
        el("span", { class: "etiq" }, [
          el("strong", { text: LIBELLE_REPAS[t] }),
          el("span", { class: "horaire", text: " · " + horaire })
        ]),
        sel,
        btnDe
      ]));

      if (case_.dehors) {
        bloc.appendChild(el("div", { class: "dehors", text: "🍽️ Repas pris dehors — non planifié, hors courses." }));
      } else {
        // Indicateur de saison pour la recette choisie.
        const recette = case_.recetteId ? recById[case_.recetteId] : null;
        if (recette) {
          const a = analyseRecette(recette, alIdx, plan.mois);
          if (!a.ok) {
            const quoi = [...a.horsSaison.map(n => n + " (hors saison)"), ...a.importes.map(n => n + " (importé)")];
            bloc.appendChild(el("div", { class: "hors-saison", text: "⚠ " + quoi.join(", ") }));
          }
        }
      }
    }
    c.appendChild(bloc);
  }

  c.appendChild(el("button", {
    class: "primaire", text: "Vérifier le plan",
    onclick: () => rendreMessages(zoneMsg, plan.mois)
  }));
  c.appendChild(zoneMsg);
}

function rendreMessages(zone, mois) {
  vider(zone);
  const res = validerPlan({ mois });
  const entete = el("p", {
    class: res.nbViolations ? "bilan ko" : "bilan ok",
    text: res.nbViolations
      ? `${res.nbViolations} problème(s), ${res.nbAvertissements} avertissement(s).`
      : `Plan conforme. ${res.nbAvertissements} avertissement(s).`
  });
  zone.appendChild(entete);

  for (const jour of JOURS) {
    const msgs = res.parJour[jour].messages;
    if (!msgs.length) continue;
    zone.appendChild(el("h4", { text: jour.charAt(0).toUpperCase() + jour.slice(1) }));
    const ul = el("ul", { class: "msgs" });
    for (const m of msgs) {
      ul.appendChild(el("li", { class: m.niveau, text: m.texte }));
    }
    zone.appendChild(ul);
  }
}

// ---------- Vue Courses ----------
function rendreCourses(c) {
  vider(c);
  c.appendChild(el("h2", { text: "Liste de courses" }));
  const nb = Math.max(1, getFoyer().personnes.length);
  c.appendChild(el("p", { class: "muted", text: `Quantités indicatives pour ${nb} convive(s) sur la semaine — pas besoin de peser.` }));

  const groupes = genererCourses();
  const courses = getCourses();

  if (!groupes.length) {
    c.appendChild(el("p", { text: "Aucun repas planifié pour l'instant." }));
    return;
  }

  for (const g of groupes) {
    const bloc = el("div", { class: "carte" });
    bloc.appendChild(el("h3", { text: g.libelle }));
    for (const ligne of g.lignes) {
      const cb = el("input", { type: "checkbox" });
      cb.checked = !!courses.coches[ligne.cle];
      cb.addEventListener("change", () => {
        courses.coches[ligne.cle] = cb.checked;
        setCourses(courses);
        label.classList.toggle("coche", cb.checked);
      });
      const label = el("label", { class: "case" + (cb.checked ? " coche" : "") }, [
        cb, ` ${ligne.nom} — ~${arrondi(ligne.qte)} ${ligne.unite}`
      ]);
      bloc.appendChild(label);
    }
    c.appendChild(bloc);
  }
}

function arrondi(x) {
  return Math.round(x * 10) / 10;
}

// ---------- Routeur ----------
const VUES = {
  foyer: rendreFoyer,
  aliments: rendreAliments,
  recettes: rendreRecettes,
  plan: rendrePlan,
  courses: rendreCourses
};

export function afficher(vue, container) {
  (VUES[vue] || rendreFoyer)(container);
}
