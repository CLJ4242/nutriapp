// Rendu des 5 vues. UI mobile-first, en français.
import {
  JOURS, TYPES_REPAS, LIBELLE_REPAS,
  getAliments, getRecettes, getFoyer, setFoyer,
  getPlan, setPlan, getCourses, setCourses,
  alimentsById
} from "./store.js";
import { listeRegimes } from "./regimes/index.js";
import { validerPlan } from "./planner.js";
import { genererCourses } from "./courses.js";

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

function uid() {
  return "p" + Math.random().toString(36).slice(2, 8);
}

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
      const def = regimes.find(r => r.id === "stef") || regimes[0];
      foyer.personnes.push({ id: uid(), nom: "", regimeId: def.id, aimes: [], exclus: [] });
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
  const alIdx = alimentsById();
  for (const t of TYPES_REPAS) {
    const recs = getRecettes().filter(r => r.typeRepas === t);
    if (!recs.length) continue;
    c.appendChild(el("h3", { text: LIBELLE_REPAS[t] }));
    for (const r of recs) {
      const bloc = el("div", { class: "carte" });
      bloc.appendChild(el("strong", { text: r.nom }));
      const ul = el("ul");
      for (const ing of r.ingredients) {
        const al = alIdx[ing.alimentId];
        ul.appendChild(el("li", {
          text: `${al ? al.nom : ing.alimentId} — ${ing.qteParPersonne} ${ing.unite} / pers.`
        }));
      }
      bloc.appendChild(ul);
      c.appendChild(bloc);
    }
  }
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
