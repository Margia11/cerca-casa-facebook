// leggi-risultati.js
// Da eseguire dopo raccogli-feed.js, sulla stessa scheda.
// Attende al massimo ~30 secondi che la raccolta finisca (resta sotto i timeout tipici di 45 s),
// scarta i post di chi CERCA casa e restituisce le offerte in JSON.
// Se "done" è false, eseguilo di nuovo: la raccolta continua in background.

{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 15 && !(window.__cc && window.__cc.done); i++) await sleep(2000);

  const cc = window.__cc || { seen: {}, done: false, steps: 0 };
  // Post di persone che cercano casa (non sono offerte)
  const CERCO =
    /\b(cerco|cerchiamo|cercasi|sto cercando|stiamo cercando|cercando|alla ricerca|in cerca|looking for|searching for|i'?m looking|we are looking|busco|buscamos|je cherche|ich suche)\b/i;
  // Segnali di un'offerta: evitano di scartare annunci tipo "Affittasi stanza, cerchiamo coinquilino"
  const OFFRO =
    /\b(affittasi|si affitta|si affittano|si libera|si liberano|libera dal|canone|offro|subentro|disponibile|disponibili|for rent|available)\b|(^|\n)\s*(affitto|affittiamo)\b/i;
  const all = Object.values(cc.seen);
  const isSeeker = (t) => {
    const head = t.slice(0, 350);
    return CERCO.test(head) && !OFFRO.test(head);
  };
  const offers = all.filter((p) => !isSeeker(p.t));

  JSON.stringify({
    done: cc.done,
    scorrimenti: cc.steps,
    post_letti: all.length,
    scartati_perche_cercano: all.length - offers.length,
    offerte: offers.map((o) => ({ link: o.l, testo: o.t.slice(0, 700) })),
  });
}
