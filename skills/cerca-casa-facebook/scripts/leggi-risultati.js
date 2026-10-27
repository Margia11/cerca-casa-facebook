// leggi-risultati.js
// Da eseguire dopo raccogli-feed.js, sulla stessa scheda.
// Attende al massimo ~30 secondi che la raccolta finisca (resta sotto i timeout tipici di 45 s)
// e restituisce in JSON solo i post nuovi che servono. Se "done" è false, eseguilo di nuovo.
//
// Impostazioni (nella stessa chiamata, prima di questo codice, oppure una volta per giro in
// sessionStorage 'cc_filtri' come JSON):
//   window.__modo   = 'affitto' | 'acquisto'
//   window.__filtri = {
//     prezzo_max: 810,           // prezzo massimo più alto di config.md + tolleranza (affitto: al mese)
//     escludi: ['donne', 'studenti', 'posto_letto', 'breve'],   // solo quelli che config.md esclude:
//         'donne'       annunci solo per donne/ragazze (per un uomo)
//         'uomini'      annunci solo per uomini/ragazzi (per una donna)
//         'studenti'    solo studenti, no lavoratori (per un lavoratore)
//         'posto_letto' posti letto e stanze doppie (se l'utente non li vuole)
//         'breve'       affitti brevi o con una durata scritta chiaramente breve
//     fuori: ['Ostia', 'Pomezia']   // nomi di località o zone fuori dai criteri
//   }
// Le esclusioni scattano solo quando il motivo è chiaro: nel dubbio l'offerta passa e la valuta Claude.
//
// Restituisce:
//   impronte_lette  tutte le chiavi (k… e p…) dei post nuovi letti in questo giro (offerte e non):
//                   vanno TUTTE aggiunte alla memoria, così la prossima volta vengono saltati
//   offerte         offerte nuove da valutare, con testo (500 caratteri), autore, prezzo_rilevato,
//                   mq_rilevati, kt, foto_h, link, forse_non_disponibile
//   escluse         offerte nuove già scartate dallo script, con motivo, inizio (160 caratteri) e i
//                   dati per la voce di prezzo (non vanno rivalutate)
// Il testo completo di un post (fino a 1500 caratteri) resta in window.__cc.seen['<k>'].t.
//
//   kt      impronta del solo testo, senza autore, date e numeri: uguale se lo stesso annuncio
//           viene ripubblicato da un altro account o con un altro prezzo
//   foto_h  impronte visive (dHash a 64 bit, in esadecimale) delle prime 3 foto:
//           due foto sono la stessa se differiscono per al massimo 6 bit
//
// Per non rimandare il testo dello script a ogni gruppo:
//   sessionStorage.setItem('cc_leggi', <testo di questo file>)                    (una volta per giro)
//   { const s = sessionStorage.getItem('cc_leggi'); eval(s.slice(0, s.lastIndexOf('// --- avvio ---'))); }
//   await window.__ccLeggi()                                                      (a ogni gruppo)

window.__ccLeggi = async function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 15 && !(window.__cc && window.__cc.done); i++) await sleep(2000);

  const cc = window.__cc || { seen: {}, ordine: [], done: false, steps: 0 };
  const MODO = window.__modo === 'acquisto' ? 'acquisto' : 'affitto';
  const F = window.__filtri || JSON.parse(sessionStorage.getItem('cc_filtri') || '{}');
  const ESC = new Set(F.escludi || []);

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

  // Esclusioni sicure
  const NON_CASA = /\b(ripetizioni|traslochi|sgomberi|posto auto|box auto|magazzino|pulizie|nuovi membri)\b/i;
  // in affitto: vendite (case, auto, mobili); in acquisto: affitti. Guardando solo l'inizio del post.
  const VENDITA = /\b(vendo|vendesi|in vendita|si vende|vendiamo)\b/i;
  const AFFITTO = /\b(affitt\w*|canone|locazione)\b/i;
  const altroModo = (b) => {
    const h = b.slice(0, 150);
    return MODO === 'affitto' ? VENDITA.test(h) && !AFFITTO.test(h) : AFFITTO.test(h) && !VENDITA.test(h);
  };
  const DONNE = /\b(solo|esclusivamente|soltanto|unicamente)\s+(a\s+|per\s+)?(ragazz[ae]|donn[ae]|studentess[ae]|lavoratric[ie]|femmin[ae])\b|\b(cerco|cercasi|cerchiamo)\s+(una\s+)?(nuova\s+)?coinquilina\b|\bper\s+(sola\s+)?(ragazza|studentessa|lavoratrice|donna)\b/i;
  const UOMO = /\b(ragazzo|uomo|uomini|maschi|lavoratore|studente)\b|\bo ragazzi\b/i;
  const UOMINI = /\b(solo|esclusivamente|soltanto|unicamente)\s+(a\s+|per\s+)?(ragazzi|uomini|maschi|studenti maschi|lavoratori maschi)\b|\b(cerco|cercasi|cerchiamo)\s+(un\s+)?(nuovo\s+)?coinquilino maschio\b/i;
  const STUDENTI = /\bsolo studenti\b|\bsolo studentesse\b|\bno lavorat(ori|rici)\b|\bsolo erasmus\b|\bsolo universitari[ei]?\b/i;
  const LETTO = /\bposto letto\b|\b(camera|stanza) doppia\b(?!\s+(ad\s+)?uso\s+singol)/i;
  const BREVE = /\b(affitt[oi] brev[ei]|a notte|per notte|settimanal[ei])\b|\bdal \d{1,2}[^\n]{0,25}\bal \d{1,2}[^\n]{0,15}(novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio)\b|\bfino a (novembre|dicembre|gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre)\b(?!\s*20(2[89]|[3-9]\d))|\bper (\d|due|tre|quattro|cinque|sei) mesi\b/i;
  const esc = (s) => s.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
  const FUORI = (F.fuori || []).length ? new RegExp('\\b(' + F.fuori.map(esc).join('|') + ')\\b', 'i') : null;

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

  const motivo = (t, prezzo) => {
    const b = bodyOf(t);
    if (NON_CASA.test(b)) return 'non è una casa';
    if (altroModo(b)) return MODO === 'affitto' ? 'vendita, non affitto' : 'affitto, non vendita';
    if (ESC.has('donne') && DONNE.test(b) && !UOMO.test(b)) return 'solo donne';
    if (ESC.has('uomini') && UOMINI.test(b)) return 'solo uomini';
    if (ESC.has('studenti') && STUDENTI.test(b)) return 'solo studenti';
    if (ESC.has('posto_letto') && LETTO.test(b)) return 'posto letto o stanza doppia';
    if (FUORI && FUORI.test(b)) return 'fuori zona';
    if (ESC.has('breve') && BREVE.test(b)) return 'breve periodo';
    if (F.prezzo_max && prezzo && prezzo > F.prezzo_max) return 'prezzo troppo alto';
    return '';
  };

  const all = (cc.ordine || Object.keys(cc.seen)).map((k) => cc.seen[k]);
  const nuovi = all.filter((p) => !p.visto);
  const offerteTutte = nuovi.filter((p) => !isSeeker(p.t));
  const impronte = [];
  for (const p of nuovi) {
    impronte.push(p.k);
    if (p.id) impronte.push(p.id);
  }
  const prep = await Promise.all(
    offerteTutte.slice(0, 60).map(async (o) => {
      const prezzo = priceOf(o.t);
      return { o, prezzo, m: motivo(o.t, prezzo), fh: (await Promise.all((o.img || []).slice(0, 3).map(dHash))).filter(Boolean) };
    })
  );
  const base = (o, prezzo, fh) => ({
    k: o.k, kt: textPrint(o.t), autore: o.t.split('\n')[0].trim(), prezzo_rilevato: prezzo, mq_rilevati: mqOf(o.t), foto_h: fh,
  });

  return JSON.stringify({
    done: cc.done,
    scorrimenti: cc.steps,
    fermato_prima: !!cc.fermatoPrima,
    post_letti: all.length,
    gia_visti: all.length - nuovi.length,
    scartati_perche_cercano: nuovi.length - offerteTutte.length,
    impronte_lette: impronte,
    offerte: prep.filter((x) => !x.m).slice(0, 30).map(({ o, prezzo, fh }) => ({
      ...base(o, prezzo, fh), link: o.l, forse_non_disponibile: AFFITTATO.test(o.t), testo: bodyOf(o.t).slice(0, 500),
    })),
    escluse: prep.filter((x) => x.m).map(({ o, prezzo, m, fh }) => ({
      ...base(o, prezzo, fh), motivo: m, inizio: bodyOf(o.t).replace(/\s+/g, ' ').slice(0, 160),
    })),
  });
};

// --- avvio ---
await window.__ccLeggi();
