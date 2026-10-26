// raccogli-feed.js
// Da eseguire con lo strumento JavaScript del browser sulla pagina di un gruppo Facebook
// aperta in ordine cronologico: https://www.facebook.com/groups/<ID>/?sorting_setting=CHRONOLOGICAL
//
// Avvia in background lo scorrimento del feed e la raccolta dei post, poi ritorna subito.
// Il feed di Facebook è "virtualizzato" (tiene in pagina pochi post alla volta), quindi i post
// vengono salvati man mano in window.__cc. I risultati si leggono con leggi-risultati.js.
//
// MEMORIA: prima di eseguirlo si può impostare nella pagina l'elenco delle impronte già viste:
//   window.__visti = ["k1a2b3c", ...];
// Ogni post riceve un'impronta (k) calcolata dal testo, uguale anche se lo stesso annuncio è
// pubblicato in gruppi diversi. Quando lo scorrimento incontra STOP_DOPO_VISTI post già visti,
// si ferma prima: significa che da lì in giù il feed era già stato letto.
//
// Per ogni post salva anche gli indirizzi delle prime foto (max 4): leggi-risultati.js ne calcola
// l'impronta visiva per riconoscere gli annunci ripubblicati.
//
// Parametri: SCORRIMENTI (massimo, default 16 ≈ 35-40 s) e STOP_DOPO_VISTI (default 8).

const SCORRIMENTI = 16;
const STOP_DOPO_VISTI = 8;

window.__cc = { seen: {}, done: false, steps: 0, giaVisti: 0, fermatoPrima: false, startedAt: Date.now() };

(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visti = new Set(Array.isArray(window.__visti) ? window.__visti : []);
  // Pulsanti "Altro…" per espandere i post troncati (Facebook in più lingue)
  const MORE = /^(Altro|Mostra altro|See more|Ver más|Voir plus|Mehr anzeigen|Ver mais)/;
  const clean = (t) =>
    t
      .replace(/(Facebook\n)+/g, '')
      .replace(/\n(Commenta|Rispondi|Comment|Reply|Comentar|Commenter) (come|as|como|en tant que)[\s\S]*/, '')
      .replace(
        /Nessuna descrizione[^\n]*|Potrebbe essere[^\n]*|No photo description[^\n]*|May be an image[^\n]*|Post condiviso|Visualizza altri commenti|View more comments/g,
        ''
      )
      .replace(/(.͏\n)+/g, '') // caratteri offuscati che Facebook inserisce vicino alla data
      .replace(/\n\s*\n/g, '\n')
      .trim();

  // Impronta del post: autore + inizio del testo, senza data relativa ("2 ore fa") né punteggiatura
  const TEMPO = /^(·|Segui|Follow|Contenuti IA|Amministratore|\d+\s*(min|h|g)|.*\b(fa|ago)\b|ieri|yesterday|.*\d{1,2}:\d{2})$/i;
  const fingerprint = (t) => {
    const lines = t.split('\n').map((l) => l.trim()).filter((l) => l && !TEMPO.test(l));
    const s = lines.join(' ').toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, '').slice(0, 160);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'k' + (h >>> 0).toString(36);
  };
  // Facebook mostra il vero link del post solo al passaggio del mouse sulla data: lo simuliamo
  const revealLinks = (d) =>
    d.querySelectorAll('a[role="link"][href="#"], a[role="link"]:not([href])').forEach((a) => {
      a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      a.dispatchEvent(new FocusEvent('focus'));
    });

  const grab = async () => {
    document.querySelectorAll('div[role="button"]').forEach((b) => {
      if (MORE.test(b.innerText.trim())) b.click();
    });
    const feed = document.querySelector('div[role="feed"]');
    if (feed) for (const d of feed.children) revealLinks(d);
    await sleep(700);
    if (!feed) return;
    for (const d of feed.children) {
      const t = clean(d.innerText || '');
      if (t.length < 60) continue;
      const k = fingerprint(t);
      const links = [...d.querySelectorAll('a[href*="/posts/"],a[href*="/permalink/"]')].map(
        (a) => a.href.split('?')[0]
      );
      // foto del post (escluse le immagini del profilo e le miniature), per l'impronta visiva
      const img = [...d.querySelectorAll('img')]
        .filter((i) => i.naturalWidth >= 300 && i.width >= 100 && !/\/t39\.30808-1\//.test(i.src))
        .map((i) => i.src)
        .slice(0, 4);
      const prev = window.__cc.seen[k];
      if (!prev) {
        window.__cc.seen[k] = { k, l: links[0] || '', t: t.slice(0, 1200), img, visto: visti.has(k) };
        if (visti.has(k)) window.__cc.giaVisti++;
      } else {
        if (!prev.l && links[0]) prev.l = links[0];
        if (!prev.img.length && img.length) prev.img = img;
      }
    }
  };

  for (let i = 0; i < SCORRIMENTI; i++) {
    await grab();
    if (visti.size && window.__cc.giaVisti >= STOP_DOPO_VISTI) {
      window.__cc.fermatoPrima = true;
      break;
    }
    window.scrollBy(0, 1800);
    window.__cc.steps = i + 1;
    await sleep(2000);
  }
  await grab();
  window.__cc.done = true;
})();

'raccolta avviata';
