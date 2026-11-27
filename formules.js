// Affichage des formules mathématiques : racines, puissances, fractions, indices, symboles.
// Le texte reste sûr : tout ce qui n'est pas une formule connue est affiché tel quel (jamais interprété comme du code).

const SYMBOLES = {
  times: "×", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", pi: "π", infty: "∞", cdot: "·", rightarrow: "→", to: "→", leftarrow: "←",
  Rightarrow: "⇒", Leftrightarrow: "⇔", Delta: "Δ", delta: "δ", alpha: "α", beta: "β", gamma: "γ",
  theta: "θ", lambda: "λ", mu: "μ", sigma: "σ", Sigma: "Σ", phi: "φ", omega: "ω", Omega: "Ω",
  in: "∈", cup: "∪", cap: "∩", forall: "∀", exists: "∃", degree: "°", circ: "°", ldots: "…", dots: "…"
};

let stylesPrets = false;

function injecterStyles() {
  if (stylesPrets || typeof document === "undefined") return;
  stylesPrets = true;
  const s = document.createElement("style");
  s.textContent =
    "sup,sub{line-height:0;}" +
    ".rac{white-space:nowrap;}" +
    ".rad{border-top:0.09em solid currentColor;padding:0 0.12em;margin-left:0.03em;}" +
    ".fr{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.92em;margin:0 0.15em;}" +
    ".fn{border-bottom:0.09em solid currentColor;padding:0 0.2em;}" +
    ".fd{padding:0 0.2em;}";
  document.head.appendChild(s);
}

function echapper(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// s[i] est une ouvrante : renvoie le contenu jusqu'à la fermante assortie
function groupe(s, i) {
  const ouvrante = s[i];
  const fermante = ouvrante === "(" ? ")" : ouvrante === "[" ? "]" : "}";
  let profondeur = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === ouvrante) profondeur++;
    else if (s[j] === fermante) {
      profondeur--;
      if (profondeur === 0) return { texte: s.slice(i + 1, j), fin: j + 1 };
    }
  }
  return { texte: s.slice(i + 1), fin: s.length };
}

// Argument d'une commande : {…} ou un seul caractère
function argument(s, i) {
  while (s[i] === " ") i++;
  if (s[i] === "{") return groupe(s, i);
  if (i < s.length) return { texte: s[i], fin: i + 1 };
  return { texte: "", fin: i };
}

function racine(contenu) {
  return '<span class="rac">√<span class="rad">' + contenu + "</span></span>";
}

function fraction(num, den) {
  return '<span class="fr"><span class="fn">' + num + '</span><span class="fd">' + den + "</span></span>";
}

function estAlnum(c) {
  return !!c && /[0-9A-Za-zÀ-ÿ]/.test(c);
}

function rendre(s) {
  let i = 0;
  let out = "";
  while (i < s.length) {
    const c = s[i];

    if (c === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (m) {
        const nom = m[1];
        i += m[0].length;
        if (nom === "frac" || nom === "dfrac") {
          const a = argument(s, i);
          const b = argument(s, a.fin);
          i = b.fin;
          out += fraction(rendre(a.texte), rendre(b.texte));
        } else if (nom === "sqrt") {
          if (s[i] === "[") i = groupe(s, i).fin;
          const a = argument(s, i);
          i = a.fin;
          out += racine(rendre(a.texte));
        } else if (nom === "text") {
          const a = argument(s, i);
          i = a.fin;
          out += echapper(a.texte);
        } else if (SYMBOLES[nom]) {
          out += SYMBOLES[nom];
        } else {
          out += echapper("\\" + nom);
        }
      } else {
        out += "\\";
        i++;
      }
      continue;
    }

    if (c === "√" || s.startsWith("sqrt(", i)) {
      let contenu;
      if (c === "√") {
        i++;
        if (s[i] === "(" || s[i] === "{") {
          const g = groupe(s, i);
          contenu = g.texte;
          i = g.fin;
        } else {
          const m = /^[0-9A-Za-z²³¹⁰⁴⁵⁶⁷⁸⁹]+(?:[.,][0-9]+)?/.exec(s.slice(i));
          contenu = m ? m[0] : "";
          i += contenu.length;
        }
      } else {
        const g = groupe(s, i + 4);
        contenu = g.texte;
        i = g.fin;
      }
      out += racine(rendre(contenu));
      continue;
    }

    if (c === "^") {
      i++;
      let texte = null;
      if (s[i] === "{" || s[i] === "(") {
        const g = groupe(s, i);
        texte = g.texte;
        i = g.fin;
      } else {
        const m = /^[+\-−]?[0-9A-Za-z]+/.exec(s.slice(i));
        if (m) {
          texte = m[0];
          i += texte.length;
        }
      }
      out += texte === null ? "^" : "<sup>" + rendre(texte) + "</sup>";
      continue;
    }

    if (c === "_") {
      const avant = s[i - 1];
      const avantAvant = s[i - 2];
      let texte = null;
      let fin = i + 1;
      if (s[i + 1] === "{" && (estAlnum(avant) || avant === ")")) {
        const g = groupe(s, i + 1);
        texte = g.texte;
        fin = g.fin;
      } else {
        const chiffres = /^[0-9]+/.exec(s.slice(i + 1));
        if (chiffres && (estAlnum(avant) || avant === ")")) {
          texte = chiffres[0];
          fin = i + 1 + texte.length;
        } else if (/^[A-Za-z]/.test(s.slice(i + 1)) && /[A-Za-z]/.test(avant || "") && !estAlnum(avantAvant)) {
          texte = s[i + 1];
          fin = i + 2;
        }
      }
      if (texte === null) {
        out += "_";
        i++;
      } else {
        out += "<sub>" + rendre(texte) + "</sub>";
        i = fin;
      }
      continue;
    }

    if (c === "$") {
      i++;
      continue;
    }
    if (c === "\n") {
      out += "<br>";
      i++;
      continue;
    }
    out += echapper(c);
    i++;
  }
  return out;
}

// Transforme un texte de question en HTML sûr. Quelques balises simples sont acceptées : b, i, u, sup, sub, br.
export function htmlMath(texte) {
  injecterStyles();
  const t = String(texte === undefined || texte === null ? "" : texte);
  return t
    .split(/(<\/?(?:sup|sub|b|i|u)>|<br\s*\/?>)/i)
    .map(function (morceau) {
      if (/^<br/i.test(morceau)) return "<br>";
      const balise = /^<(\/?)(sup|sub|b|i|u)>$/i.exec(morceau);
      if (balise) return "<" + balise[1] + balise[2].toLowerCase() + ">";
      return rendre(morceau);
    })
    .join("");
    }
