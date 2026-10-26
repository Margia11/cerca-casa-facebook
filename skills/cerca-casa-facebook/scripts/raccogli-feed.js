// raccogli-feed.js
// Da eseguire con lo strumento JavaScript del browser sulla pagina di un gruppo Facebook
// aperta in ordine cronologico: https://www.facebook.com/groups/<ID>/?sorting_setting=CHRONOLOGICAL
//
// Avvia in background lo scorrimento del feed e la raccolta dei post, poi ritorna subito.
// Il feed di Facebook è "virtualizzato" (tiene in pagina pochi post alla volta), quindi i post
// vengono salvati man mano in window.__cc. I risultati si leggono con leggi-risultati.js.
//
// Parametro: SCORRIMENTI (default 16, circa 35-40 secondi, ~20-45 post nei gruppi attivi).

const SCORRIMENTI = 16;

window.__cc = { seen: {}, done: false, steps: 0, startedAt: Date.now() };

(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

  const grab = async () => {
    document.querySelectorAll('div[role="button"]').forEach((b) => {
      if (MORE.test(b.innerText.trim())) b.click();
    });
    await sleep(700);
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return;
    for (const d of feed.children) {
      const t = clean(d.innerText || '');
      if (t.length < 60) continue;
      const key = t.slice(0, 100);
      const links = [...d.querySelectorAll('a[href*="/posts/"],a[href*="/permalink/"]')].map(
        (a) => a.href.split('?')[0]
      );
      const prev = window.__cc.seen[key];
      if (!prev || (!prev.l && links[0])) window.__cc.seen[key] = { l: links[0] || '', t: t.slice(0, 1200) };
    }
  };

  for (let i = 0; i < SCORRIMENTI; i++) {
    await grab();
    window.scrollBy(0, 1800);
    window.__cc.steps = i + 1;
    await sleep(2000);
  }
  await grab();
  window.__cc.done = true;
})();

'raccolta avviata';
