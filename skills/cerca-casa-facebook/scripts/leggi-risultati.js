// leggi-risultati.js
// Da eseguire dopo raccogli-feed.js, sulla stessa scheda.
// Attende al massimo ~30 secondi che la raccolta finisca (resta sotto i timeout tipici di 45 s),
// scarta i post di chi CERCA casa e quelli già visti in ricerche precedenti, e restituisce
// in JSON solo le offerte nuove. Se "done" è false, eseguilo di nuovo.
//
// "impronte_lette" elenca le impronte di TUTTI i post letti in questo giro (offerte e non):
// vanno aggiunte alla memoria, così la prossima volta vengono saltati.

{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 15 && !(window.__cc && window.__cc.done); i++) await sleep(2000);

  const cc = window.__cc || { seen: {}, done: false, steps: 0, giaVisti: 0 };
  // Post di persone che cercano casa (non sono offerte)
  const CERCO =
    /\b(cerco|cerchiamo|cercasi|cerca una|cerca un|sto cercando|stiamo cercando|cercando|alla ricerca|in cerca|looking for|searching for|i'?m looking|we are looking|busco|buscamos|je cherche|ich suche)\b/i;
  // Segnali di un'offerta: evitano di scartare annunci tipo "Affittasi stanza, cerchiamo coinquilino"
  const OFFRO =
    /\b(affittasi|si affitta|si affittano|si libera|si liberano|libera dal|canone|offro|subentro|coinquilin[oaie]|room available|for rent|available from)\b|(^|\n)\s*(affitto|affittiamo)\b/i;
  const isSeeker = (t) => {
    // corpo del post senza intestazione (autore, data, "Segui")
    const body = (t.split(/\n·\n/).slice(1).join('\n') || t).trim();
    const start = body.slice(0, 100);
    if (OFFRO.test(start)) return false;
    if (CERCO.test(start)) return true; // "CERCO STANZA…" all'inizio: è una richiesta
    const head = body.slice(0, 350);
    return CERCO.test(head) && !OFFRO.test(head);
  };
  // Indizi che l'annuncio non è più disponibile (spesso scritti nei commenti o nel post modificato)
  const AFFITTATO = /\b(affittat[ao]|gi[aà] affittat|non pi[uù] disponibil|rented|no longer available)\b/i;

  const all = Object.values(cc.seen);
  const nuovi = all.filter((p) => !p.visto);
  const offerte = nuovi.filter((p) => !isSeeker(p.t));

  JSON.stringify({
    done: cc.done,
    scorrimenti: cc.steps,
    fermato_prima: !!cc.fermatoPrima,
    post_letti: all.length,
    gia_visti: all.length - nuovi.length,
    scartati_perche_cercano: nuovi.length - offerte.length,
    impronte_lette: nuovi.map((p) => p.k),
    offerte: offerte.map((o) => ({
      k: o.k,
      link: o.l,
      forse_affittato: AFFITTATO.test(o.t),
      testo: o.t.slice(0, 900),
    })),
  });
}
