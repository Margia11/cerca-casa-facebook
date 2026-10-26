// leggi-risultati.js
// Da eseguire dopo raccogli-feed.js, sulla stessa scheda.
// Attende al massimo ~30 secondi che la raccolta finisca (resta sotto i timeout tipici di 45 s),
// scarta i post di chi CERCA casa e quelli già visti in ricerche precedenti, e restituisce
// in JSON solo le offerte nuove. Se "done" è false, eseguilo di nuovo.
//
// "impronte_lette" elenca le impronte di TUTTI i post letti in questo giro (offerte e non):
// vanno aggiunte alla memoria, così la prossima volta vengono saltati.
//
// Per ogni offerta restituisce anche, per i prezzi per zona e gli annunci ripubblicati:
//   autore           prima riga del post
//   prezzo_rilevato  primo importo plausibile in euro trovato nel testo (da verificare):
//                    canone mensile in affitto, prezzo totale in vendita
//   mq_rilevati      superficie in metri quadri, se scritta nel testo
//
// Per gli annunci di vendita impostare window.__modo = 'acquisto' nella stessa chiamata.
//   kt               impronta del solo testo, senza autore, date e numeri: uguale se lo stesso
//                    annuncio viene ripubblicato da un altro account o con un altro prezzo
//   foto_h           impronte visive (dHash a 64 bit, in esadecimale) delle prime 3 foto:
//                    due foto sono la stessa se differiscono per al massimo 6 bit

{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 15 && !(window.__cc && window.__cc.done); i++) await sleep(2000);

  const cc = window.__cc || { seen: {}, done: false, steps: 0, giaVisti: 0 };
  // Post di persone che cercano casa (non sono offerte)
  const CERCO =
    /\b(cerco|cerchiamo|cercasi|cerca una|cerca un|sto cercando|stiamo cercando|cercando|alla ricerca|in cerca|looking for|searching for|i'?m looking|we are looking|busco|buscamos|je cherche|ich suche)\b/i;
  // Segnali di un'offerta: evitano di scartare annunci tipo "Affittasi stanza, cerchiamo coinquilino"
  const OFFRO =
    /\b(affittasi|si affitta|si affittano|si libera|si liberano|libera dal|canone|offro|subentro|coinquilin[oaie]|room available|for rent|available from|vendesi|si vende|in vendita|vendo|vendiamo|mettiamo in vendita|for sale)\b|(^|\n)\s*(affitto|affittiamo)\b/i;
  const bodyOf = (t) => (t.split(/\n·\n/).slice(1).join('\n') || t).trim();
  const isSeeker = (t) => {
    const body = bodyOf(t);
    const start = body.slice(0, 100);
    if (OFFRO.test(start)) return false;
    if (CERCO.test(start)) return true; // "CERCO STANZA…" all'inizio: è una richiesta
    const head = body.slice(0, 350);
    return CERCO.test(head) && !OFFRO.test(head);
  };
  // Indizi che l'annuncio non è più disponibile (spesso scritti nei commenti o nel post modificato)
  const AFFITTATO = /\b(affittat[ao]|gi[aà] affittat|vendut[ao]|sotto compromesso|non pi[uù] disponibil|rented|sold|no longer available)\b/i;
  // window.__modo = 'acquisto' (impostato nella stessa chiamata) per gli annunci di vendita
  const MODO = window.__modo === 'acquisto' ? 'acquisto' : 'affitto';

  const djb2 = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };
  // impronta del solo testo: niente autore/intestazione, niente cifre né punteggiatura
  const textPrint = (t) => {
    const s = bodyOf(t).toLowerCase().replace(/[^a-zàèéìòù]+/g, '').slice(0, 220);
    return s.length >= 40 ? 't' + djb2(s) : '';
  };
  // primo importo plausibile con € o "euro" accanto: 150-5000 in affitto, 15.000-5.000.000 in vendita.
  // Riconosce 600 €, € 1.200, 250.000 €, 250k €, € 1,2 mln, 250 mila euro.
  const [PMIN, PMAX] = MODO === 'acquisto' ? [15000, 5000000] : [150, 5000];
  const toNum = (n, suf) => {
    let v = parseFloat(n.replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.'));
    if (/^(k|mila)$/i.test(suf || '')) v *= 1e3;
    if (/^(mln|milion[ei])$/i.test(suf || '')) v *= 1e6;
    return Math.round(v);
  };
  const NUM = '(\\d{1,3}(?:[.,]\\d{3})+|\\d+(?:[.,]\\d{1,2})?)\\s*(k|mila|mln|milion[ei])?';
  const PREZZO = new RegExp('(?:€|eur(?:o)?)\\s*' + NUM + '|' + NUM + '\\s*(?:€|eur(?:o)?\\b)', 'gi');
  const priceOf = (t) => {
    let m;
    const body = bodyOf(t);
    PREZZO.lastIndex = 0;
    while ((m = PREZZO.exec(body))) {
      const n = m[1] ? toNum(m[1], m[2]) : toNum(m[3], m[4]);
      if (n >= PMIN && n <= PMAX) return n;
    }
    return null;
  };
  // superficie: "78 mq", "78 m²", "78 metri quadri"
  const mqOf = (t) => {
    const m = bodyOf(t).match(/(\d{2,4})(?:[.,]\d+)?\s*(?:mq|m²|m2|metri\s*quadr[ia]|sqm)(?![a-z])/i);
    const n = m ? parseInt(m[1], 10) : null;
    return n && n >= 12 && n <= 1000 ? n : null;
  };
  // dHash 9x8: confronta la luminosità di pixel adiacenti
  const dHash = async (src) => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const blob = await (await fetch(src, { mode: 'cors', signal: ctl.signal })).blob();
      clearTimeout(timer);
      const bmp = await createImageBitmap(blob);
      const c = new OffscreenCanvas(9, 8);
      const x = c.getContext('2d');
      x.drawImage(bmp, 0, 0, 9, 8);
      const d = x.getImageData(0, 0, 9, 8).data;
      const g = (px, py) => {
        const i = (py * 9 + px) * 4;
        return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      };
      let bits = '';
      for (let y = 0; y < 8; y++) for (let xx = 0; xx < 8; xx++) bits += g(xx, y) > g(xx + 1, y) ? '1' : '0';
      let hex = '';
      for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
      return hex;
    } catch (e) {
      return null;
    }
  };

  const all = Object.values(cc.seen);
  const nuovi = all.filter((p) => !p.visto);
  const offerte = nuovi.filter((p) => !isSeeker(p.t)).slice(0, 40);

  const fotoH = await Promise.all(
    offerte.map(async (o) => (await Promise.all((o.img || []).slice(0, 3).map(dHash))).filter(Boolean))
  );

  JSON.stringify({
    done: cc.done,
    scorrimenti: cc.steps,
    fermato_prima: !!cc.fermatoPrima,
    post_letti: all.length,
    gia_visti: all.length - nuovi.length,
    scartati_perche_cercano: nuovi.length - nuovi.filter((p) => !isSeeker(p.t)).length,
    impronte_lette: nuovi.map((p) => p.k),
    offerte: offerte.map((o, i) => ({
      k: o.k,
      kt: textPrint(o.t),
      autore: o.t.split('\n')[0].trim(),
      prezzo_rilevato: priceOf(o.t),
      mq_rilevati: mqOf(o.t),
      foto_h: fotoH[i],
      link: o.l,
      forse_non_disponibile: AFFITTATO.test(o.t),
      testo: o.t.slice(0, 900),
    })),
  });
}
