# cerca-casa-facebook

Una **skill per Claude** che cerca stanze, monolocali e appartamenti in affitto nei **gruppi Facebook** della tua città, scarta i post che non fanno per te e ti restituisce una shortlist ordinata con i link.

Nei gruppi di affitti la maggior parte dei post sono di persone che *cercano* casa, annunci "solo studentesse", affitti brevi o zone sbagliate. La skill li legge al posto tuo e ti mostra solo quelli compatibili con i tuoi criteri: budget, tipologia, zone, chi sei e cosa preferisci.

## Come funziona

1. **Configurazione guidata**: al primo avvio Claude ti chiede città, budget, tipologia, zone e qualche informazione su di te (lavoratore o studente, animali, ecc.) e salva tutto in `config.md`.
2. **Ricerca dei gruppi**: trova i gruppi a cui sei già iscritto e cerca quelli più attivi nella tua città e nei tuoi quartieri. Se gli dai il permesso, si iscrive ai gruppi pubblici. Non risponde mai alle domande d'ingresso senza chiederti cosa scrivere.
3. **Lettura**: apre ogni gruppo nel **tuo** browser, dove hai già fatto il login, e scorre il feed in ordine cronologico.
4. **Memoria**: ogni post riceve un'impronta. I post già letti non vengono riproposti, la lettura si ferma da sola quando arriva a post già visti e lo stesso annuncio pubblicato in più gruppi viene riconosciuto come uno solo.
5. **Filtro**: scarta chi cerca casa, gli annunci incompatibili e quelli fuori zona o fuori budget, e mette da parte quelli sospetti di truffa.
6. **Foto**: per i candidati a cui manca un dato (prezzo, letto, numero di camere), guarda fino a 5 foto dell'annuncio, dove spesso ci sono planimetria e prezzo.
7. **Tabella degli annunci**: salva tutto in una pagina online privata (`assets/tabella-annunci.html`) dove segni lo stato di ogni annuncio: *nuovo*, *da contattare*, *scritto*, *visita fissata*, *scartato*, *già affittato*. Gli annunci scartati non tornano più. Se la pagina online non è disponibile, usa dei file locali.
8. **Prezzi per zona**: registra il prezzo di tutte le offerte lette e mostra, per quartiere e tipologia, mediana, minimo e massimo. Su ogni annuncio dice se il prezzo è sotto o sopra la zona, e un prezzo troppo basso viene segnalato come possibile truffa.
9. **Annunci ripubblicati**: riconosce lo stesso annuncio (stesso testo o stesse foto, tramite un'impronta visiva) pubblicato da un altro account o con un altro prezzo, un segnale tipico di truffa.
10. **In automatico**: se la tua versione di Claude supporta le attività pianificate, gira 2-3 volte al giorno e ti manda una notifica solo quando esce un annuncio nuovo compatibile.

Esempio di risultato:

> **Stanza singola – 600 € tutto incluso – Furio Camillo (metro A, 7 minuti)**
> 1 coinquilino · disponibile da novembre · contratto di 2 mesi · [link al post]
> Note: chiedere che letto c'è e se c'è il condizionatore.

## Requisiti

- **Claude** con accesso a un browser che può eseguire JavaScript nella pagina:
  - l'app desktop di Claude con il browser integrato, oppure
  - l'estensione **Claude in Chrome**, oppure
  - Claude Code con un server MCP di automazione del browser (es. Playwright) e un profilo in cui hai fatto il login.
- Un account Facebook con il **login già fatto in quel browser**. Il login lo fai tu: la skill non chiede né inserisce mai password.

## Installazione

**Claude Code**: copia la cartella della skill tra le tue skill personali.

```bash
git clone https://github.com/Margia11/cerca-casa-facebook.git
mkdir -p ~/.claude/skills
cp -r cerca-casa-facebook/skills/cerca-casa-facebook ~/.claude/skills/
```

**App di Claude (claude.ai / desktop)**: comprimi la cartella `skills/cerca-casa-facebook` in un file .zip e caricalo tra le skill nelle impostazioni dell'app.

## Uso

Scrivi a Claude, ad esempio:

- "Cercami una stanza su Facebook" (al primo avvio parte la configurazione)
- "/cerca-casa-facebook"
- "Cerca casa, ma alza il budget a 700 €" (aggiorna `config.md` e cerca)
- "Aggiungi la zona Testaccio"

Se vuoi configurarla a mano, copia `config.template.md` come `config.md` nella stessa cartella e compilalo. In `examples/roma.md` trovi un esempio completo.

**Consiglio:** ogni passaggio copre circa le ultime 4-8 ore dei gruppi più attivi, quindi conviene eseguirla 2-3 volte al giorno. Grazie alla memoria, ogni esecuzione legge solo i post nuovi. Se la tua versione di Claude supporta le attività pianificate, chiedigli di farla partire in automatico, per esempio "esegui cerca-casa-facebook ogni giorno alle 9, alle 14 e alle 20".

## Struttura

```
skills/cerca-casa-facebook/
├── SKILL.md               # istruzioni per Claude
├── config.template.md     # modello dei criteri personali
├── examples/roma.md       # esempio compilato
├── assets/
│   └── tabella-annunci.html  # tabella online degli annunci, con stato
└── scripts/
    ├── raccogli-feed.js   # scorre il feed, calcola le impronte, si ferma sui post già visti
    └── leggi-risultati.js # restituisce solo le offerte nuove, senza i post di chi cerca
```

Il tuo `config.md` è nel `.gitignore`, così non lo pubblichi per sbaglio.

## Limiti e avvertenze

- **Uso personale.** La skill legge le pagine come faresti tu, a ritmo umano e solo nei gruppi a cui hai accesso. Non usarla per raccogliere dati in massa: i [termini di Facebook](https://www.facebook.com/terms) vietano la raccolta automatizzata di dati, e un uso aggressivo può portare a limitazioni dell'account. Usala con buon senso e sotto la tua responsabilità.
- **Solo lettura.** Non pubblica, non commenta e non scrive messaggi. Se vuoi contattare un inserzionista, prepara il testo e lo invia solo dopo una tua conferma.
- **Facebook cambia spesso l'interfaccia.** Se gli script smettono di trovare i post, probabilmente è cambiata la struttura della pagina: apri una issue.
- **Interfaccia in italiano o in inglese.** Gli script riconoscono i pulsanti in diverse lingue, ma sono stati provati soprattutto con Facebook in italiano.
- **Attenzione alle truffe.** La skill segnala gli annunci sospetti, ma la verifica finale spetta a te: non pagare nulla prima di aver visto la casa.

## Contribuire

Sono benvenuti miglioramenti agli script, esempi per altre città (`examples/milano.md`, `examples/bologna.md`, ...) e traduzioni.

## Licenza

[MIT](LICENSE)
