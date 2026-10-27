// raccogli-feed.js
// Da eseguire con lo strumento JavaScript del browser sulla pagina di un gruppo Facebook
// aperta in ordine cronologico: https://www.facebook.com/groups/<ID>/?sorting_setting=CHRONOLOGICAL
//
// Avvia in background lo scorrimento del feed e la raccolta dei post, poi ritorna subito.
// I risultati restano in window.__cc e si leggono con leggi-risultati.js.
//
// Post già letti: l'elenco delle chiavi viste si passa in window.__visti (nella stessa chiamata,
// prima di questo codice) oppure si salva una volta in sessionStorage 'cc_visti'
// (Facebook svuota il localStorage a ogni caricamento, il sessionStorage no).
// Ogni post ha due chiavi:
//   k…  impronta del testo (cambia se l'autore modifica il post)
//   p…  numero del post preso dal link /posts/<n> o /permalink/<n> (non cambia mai)
// Un post è "già letto" se una delle due chiavi è nell'elenco.
//
// Lo scorrimento si ferma da solo quando ritrova 3 post letti nei GIRI PRECEDENTI di fila (è
// arrivato al punto dove si era fermata la ricerca precedente) oppure 6 in tutto. Il conteggio parte
// dopo il primo scorrimento, così i post in evidenza in cima al gruppo non lo bloccano.
// I post letti in un altro gruppo durante QUESTO giro vengono saltati ma non fermano lo scorrimento
// (gli annunci pubblicati in più gruppi lo farebbero fermare troppo presto). Per distinguerli,
// salvare all'inizio del giro una copia delle chiavi in sessionStorage 'cc_visti_old' (o in
// window.__vistiVecchi) e non aggiornarla durante il giro; se manca, vale l'elenco completo.
//
// Se Facebook non carica i post con lo scorrimento dello script (feed fermo con riquadri grigi,
// pannello nascosto), durante la raccolta far scorrere la pagina con la rotella del mouse
// (azione "scroll" dello strumento del browser) ogni ~3 secondi finché window.__cc.done è true.
// Con la finestra del browser ridotta a icona non funziona niente: vedere la sezione 3.
//
// Per non rimandare il testo dello script a ogni gruppo:
//   sessionStorage.setItem('cc_raccogli', <testo di questo file>)   (una volta per giro)
//   eval(sessionStorage.getItem('cc_raccogli'))                     (a ogni gruppo)

window.__ccRaccogli = function () {
  const SCORRIMENTI = 16;
  const STOP_DI_FILA = 3;
  const STOP_TOTALE = 6;
  const cc = (window.__cc = {
    seen: {}, ordine: [], done: false, steps: 0, giaVisti: 0, diFila: 0, fermatoPrima: false, startedAt: Date.now(),
  });

  (async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const elenco = Array.isArray(window.__visti) && window.__visti.length
      ? window.__visti
      : JSON.parse(sessionStorage.getItem('cc_visti') || '[]');
    const visti = new Set(elenco);
    const elencoVecchi = Array.isArray(window.__vistiVecchi) && window.__vistiVecchi.length
      ? window.__vistiVecchi
      : JSON.parse(sessionStorage.getItem('cc_visti_old') || 'null') || elenco;
    const vecchi = new Set(elencoVecchi);
    const vecchio = (p) => vecchi.has(p.k) || (p.id && vecchi.has(p.id));
    const MORE = /^(Altro|Mostra altro|See more|Ver más|Voir plus|Mehr anzeigen|Ver mais)/;
    const clean = (t) =>
      t
        .replace(/(Facebook\n)+/g, '')
        .replace(/\n(Commenta|Rispondi|Comment|Reply|Comentar|Commenter) (come|as|como|en tant que)[\s\S]*/, '')
        .replace(
          /Nessuna descrizione[^\n]*|Potrebbe essere[^\n]*|No photo description[^\n]*|May be an image[^\n]*|Post condiviso|Visualizza altri commenti|View more comments/g,
          ''
        )
        .replace(new RegExp('(.' + String.fromCharCode(0x34f) + '\\n)+', 'g'), '') // caratteri invisibili vicino alla data
        .replace(/\n\s*\n/g, '\n')
        .trim();

    // L'impronta ignora le righe che cambiano nel tempo ("3 h", "ieri", "Segui"...)
    const TEMPO = /^(·|Segui|Follow|Contenuti IA|Amministratore|\d+\s*(min|h|g)|.*\b(fa|ago)\b|ieri|yesterday|.*\d{1,2}:\d{2})$/i;
    const fingerprint = (t) => {
      const s = t.split('\n').map((l) => l.trim()).filter((l) => l && !TEMPO.test(l)).join(' ')
        .toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, '').slice(0, 160);
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return 'k' + (h >>> 0).toString(36);
    };
    const postId = (href) => {
      const m = /\/(?:posts|permalink)\/(\d+)/.exec(href || '');
      return m ? 'p' + m[1] : '';
    };
    const segna = (p) => {
      if (p.visto) return;
      if (visti.has(p.k) || (p.id && visti.has(p.id))) {
        p.visto = true;
        if (vecchio(p)) {
          cc.giaVisti++;
          if (cc.steps >= 1) cc.diFila++;
        }
      } else if (!p.contato) {
        cc.diFila = 0;
      }
      p.contato = true;
    };

    const grab = async () => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return;
      // apre i testi troncati ("Altro"): solo nel feed, solo pulsanti brevi fuori dai link,
      // così non apre per sbaglio un reel o un altro post
      feed.querySelectorAll('div[role="button"]').forEach((b) => {
        const tx = b.innerText.trim();
        if (MORE.test(tx) && tx.length < 20 && !b.closest('a')) b.click();
      });
      // i link dei post compaiono solo al passaggio del mouse sulla data
      for (const d of feed.children)
        d.querySelectorAll('a[role="link"][href="#"], a[role="link"]:not([href])').forEach((a) => {
          a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          a.dispatchEvent(new FocusEvent('focus'));
        });
      await sleep(700);
      for (const d of feed.children) {
        const t = clean(d.innerText || '');
        if (t.length < 60) continue;
        const k = fingerprint(t);
        const l = [...d.querySelectorAll('a[href*="/posts/"],a[href*="/permalink/"]')].map((a) => a.href.split('?')[0])[0] || '';
        // foto del post (esclude avatar e icone)
        const img = [...d.querySelectorAll('img')]
          .filter((i) => i.naturalWidth >= 300 && i.width >= 100 && !/\/t39\.30808-1\//.test(i.src))
          .map((i) => i.src)
          .slice(0, 3);
        let p = cc.seen[k];
        if (!p) {
          p = cc.seen[k] = { k, id: postId(l), l, t: t.slice(0, 1500), img, visto: false };
          cc.ordine.push(k);
        } else {
          if (!p.l && l) {
            p.l = l;
            p.id = postId(l);
            if (!p.visto && visti.has(p.id)) { p.visto = true; if (vecchio(p)) cc.giaVisti++; }
          }
          if (!p.img.length && img.length) p.img = img;
        }
        segna(p);
      }
    };

    for (let i = 0; i < SCORRIMENTI; i++) {
      await grab();
      if (visti.size && (cc.diFila >= STOP_DI_FILA || cc.giaVisti >= STOP_TOTALE)) {
        cc.fermatoPrima = true;
        break;
      }
      window.scrollBy(0, 1200);
      cc.steps = i + 1;
      await sleep(2500);
    }
    await grab();
    cc.done = true;
  })();

  return 'raccolta avviata';
};

window.__ccRaccogli();
