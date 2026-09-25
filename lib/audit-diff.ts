export type Snapshot = {
  key: string;
  category: string;
  subject: string;
  value: string;
};
export function diffSnapshots(
  before: Snapshot[],
  after: Snapshot[],
  initial: boolean,
) {
  const old = new Map(before.map((r) => [r.key, r]));
  const next = new Map(after.map((r) => [r.key, r]));
  const events: {
    category: string;
    action: string;
    subject: string;
    details: string;
  }[] = [];
  for (const r of after) {
    const prev = old.get(r.key);
    if (!prev)
      events.push({
        category: r.category,
        action: initial ? "État initial" : "Ajout détecté",
        subject: r.subject,
        details: r.value,
      });
    else if (prev.value !== r.value)
      events.push({
        category: r.category,
        action: "Modification détectée",
        subject: r.subject,
        details: `Avant : ${prev.value}\nAprès : ${r.value}`,
      });
  }
  for (const r of before)
    if (!next.has(r.key))
      events.push({
        category: r.category,
        action: "Absence détectée",
        subject: r.subject,
        details: `Dernier état : ${r.value}. Absent du nouveau relevé ; suppression, archivage ou suivi désactivé à vérifier.`,
      });
  return events;
}
