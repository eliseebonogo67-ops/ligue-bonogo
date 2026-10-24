export const FORMATS = [
  { id: "a", mise: 5, max: 4 },
  { id: "b", mise: 10, max: 6 },
  { id: "c", mise: 16, max: 10 }
];

export const FENETRE_MS = 45000;

export function formatDe(fid) {
  return FORMATS.find(function (f) {
    return f.id === fid;
  });
}

// Chaque cycle d'une salle a un identifiant calculé à partir de son heure d'ouverture
export function idCycle(fid, ouvreMs) {
  return fid + "_" + Math.floor(ouvreMs / 1000);
}

export function ouvreDeId(id) {
  return parseInt(id.split("_")[1], 10) * 1000;
}
