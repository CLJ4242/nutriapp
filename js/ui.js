// Rendu des 5 vues. UI mobile-first, en français.
import {
  JOURS, TYPES_REPAS, LIBELLE_REPAS,
  getAliments, getRecettes, getFoyer, setFoyer,
  getPlan, setPlan, getCourses, setCourses,
  alimentsById, uid,
  ajouterRecette, modifierRecette, supprimerRecette, ajouterAliment,
  getMasquerExemples, setMasquerExemples
} from "./store.js";
import { listeRegimes } from "./regimes/index.js";
import { validerPlan } from "./planner.js";
import { genererCourses } from "./courses.js";
import { parserIngredients } from "./parse.js";

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
  const aliments = getAliments().slice().sort((a, b) => a.nom.localeCompare(b.nom));
  const tbl = el("table", { class: "tbl" });
  tbl.appendChild(el("tr", {}, [
    el("th", { text: "Nom" }), el("th", { text: "Catégorie" }),
    el("th", { text: "Rayon" }), el("th", { text: "Tags" })
  ]));
  for (const al of aliments) {
    tbl.appendChild(el("tr", {}, [
      el("td", { text: al.nom }),
      el("td", { text: al.categorie }),
      el("td", { text: al.rayon }),
      el("td", { text: (al.tags || []).join(", ") })
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

  for (const t of TYPES_REPAS) {
    const recs = recettes.filter(r => r.typeRepas === t);
    if (!recs.length) continue;
    c.appendChild(el("h3", { text: LIBELLE_REPAS[t] }));
    for (const r of recs) {
      const bloc = el("div", { class: "carte" });
      const titre = el("div", { class: "ligne" }, [
        el("strong", { text: r.nom }),
        r.source === "seed" ? el("span", { class: "badge", text: "exemple" }) : null
      ]);
      bloc.appendChild(titre);
      const ul = el("ul");
      for (const ing of r.ingredients) {
        const al = alIdx[ing.alimentId];
        ul.appendChild(el("li", {
          text: `${al ? al.nom : ing.alimentId} — ${arrondi(ing.qteParPersonne)} ${ing.unite} / pers.`
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
    typeRepas: recetteExistante ? recetteExistante.typeRepas : "dejeuner",
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

  const selType = el("select");
  for (const t of TYPES_REPAS) {
    const o = el("option", { value: t, text: LIBELLE_REPAS[t] });
    if (t === etat.typeRepas) o.selected = true;
    selType.appendChild(o);
  }
  selType.addEventListener("change", () => etat.typeRepas = selType.value);

  const inNb = el("input", { type: "number", min: "1", value: String(etat.nbPersonnes) });
  inNb.addEventListener("input", () => etat.nbPersonnes = Math.max(1, parseInt(inNb.value, 10) || 1));

  form.appendChild(el("label", { class: "champ" }, ["Nom", inNom]));
  form.appendChild(el("label", { class: "champ" }, ["Type de repas", selType]));
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

      const inUnite = el("input", { type: "text", value: ligne.unite || "g" });
      inUnite.addEventListener("input", () => ligne.unite = inUnite.value);

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
    if (erreurs.length) {
      zoneErr.style.display = "";
      zoneErr.textContent = erreurs.join(" ");
      return;
    }
    const n = etat.nbPersonnes;
    const recette = {
      id: recetteExistante ? recetteExistante.id : undefined,
      nom: etat.nom.trim(),
      typeRepas: etat.typeRepas,
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
  const plan = getPlan();
  const recettes = getRecettes();

  const zoneMsg = el("div", { class: "messages" });

  for (const jour of JOURS) {
    const bloc = el("div", { class: "carte" });
    bloc.appendChild(el("h3", { text: jour.charAt(0).toUpperCase() + jour.slice(1) }));
    for (const t of TYPES_REPAS) {
      const case_ = plan.semaine[jour][t];
      const sel = el("select");
      sel.appendChild(el("option", { value: "", text: "— aucun —" }));
      for (const r of recettes.filter(r => r.typeRepas === t)) {
        const o = el("option", { value: r.id, text: r.nom });
        if (r.id === case_.recetteId) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => { case_.recetteId = sel.value || null; setPlan(plan); });

      const cbExc = el("input", { type: "checkbox", title: "Exception autorisée" });
      cbExc.checked = !!case_.exception;
      cbExc.addEventListener("change", () => { case_.exception = cbExc.checked; setPlan(plan); });

      bloc.appendChild(el("div", { class: "ligne-repas" }, [
        el("span", { class: "etiq", text: LIBELLE_REPAS[t] }),
        sel,
        el("label", { class: "exc", title: "Exception 1–2×/sem." }, [cbExc, " except."])
      ]));
    }
    c.appendChild(bloc);
  }

  c.appendChild(el("button", {
    class: "primaire", text: "Vérifier le plan",
    onclick: () => rendreMessages(zoneMsg)
  }));
  c.appendChild(zoneMsg);
}

function rendreMessages(zone) {
  vider(zone);
  const res = validerPlan();
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
  c.appendChild(el("p", { class: "muted", text: `Quantités pour ${nb} convive(s), semaine entière.` }));

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
        cb, ` ${ligne.nom} — ${arrondi(ligne.qte)} ${ligne.unite}`
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
