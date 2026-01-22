/*
 * RNG Code courtesy of ChatGPT
 */

// Create a seed from today’s date
function getTodaySeed() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

// Convert the seed string to a number
function hashStringToInt(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

// Seeded PRNG (Mulberry32)
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded Fisher–Yates shuffle
function shuffleWithSeed(array, random) {
  const result = [...array]; // don’t mutate original
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const Color = Object.freeze({
  RED: 'red',
  GREEN: 'green',
  PURPLE: 'purple'
});

const Count = Object.freeze({
  ONE: 1,
  TWO: 2,
  THREE: 3
});

const Shape = Object.freeze({
  OVAL: 'oval',
  DIAMOND: 'diamond',
  SQUIGGLE: 'squiggle'
});

const Fill = Object.freeze({
  SOLID: 'solid',
  STRIPED: 'stripes',
  EMPTY: 'empty'
});

class Card {

  static ALL_CARDS = []

  static {
    let count = 0
    for (let color in Color) {
      for (let count in Count) {
        for (let shape in Shape) {
          for (let fill in Fill) {
            this.ALL_CARDS.push(new Card(Color[color], Count[count], Shape[shape], Fill[fill]));
          }
        }
      }
    }
  }

  constructor(color, count, shape, fill) {
    this.color = color;
    this.count = count;
    this.shape = shape;
    this.fill = fill;
  }

  static isMatch(card1, card2, card3) {
    return ((card1.color == card2.color && card2.color == card3.color)
      || (card1.color != card2.color && card2.color != card3.color && card3.color != card1.color))
      && ((card1.count == card2.count && card2.count == card3.count)
        || (card1.count != card2.count && card2.count != card3.count && card3.count != card1.count))
      && ((card1.shape == card2.shape && card2.shape == card3.shape)
        || (card1.shape != card2.shape && card2.shape != card3.shape && card3.shape != card1.shape))
      && ((card1.fill == card2.fill && card2.fill == card3.fill)
        || (card1.fill != card2.fill && card2.fill != card3.fill && card3.fill != card1.fill));
  }
}

class Board {
  deck = [];
  constructor(seed = hashStringToInt(getTodaySeed()), matches = 6) {
    console.debug(`Building board with ${matches} matches...`)
    const start = performance.now()
    seed |= 0 // force seed to be 32-bit integer
    console.debug(`Random Seed: ${seed}`);
    const random = mulberry32(seed);
    // change inital random number generation value
    // for (let i = 0; i++ < 6; random());

    let count = 0;
    while (count != matches) {
      this.deck = shuffleWithSeed(Card.ALL_CARDS, random);
      console.debug("SHUFFLE")
      for (let idx = 0; idx < this.deck.length - 12; idx += 12) {
        let cards = this.deck.slice(idx, idx + 12);
        count = 0;
        for (let i = 0; i < 12 && count <= matches; i++) {
          for (let j = i + 1; j < 12 && count <= matches; j++) {
            for (let k = j + 1; k < 12 && count <= matches; k++) {
              if (Card.isMatch(cards[i], cards[j], cards[k])) {
                count++;
              }
            }
          }
        }
        if (count == matches) {
          console.debug("MATCH")
          this.deck = cards;
          break;
        }
        if (count > matches) {
          console.debug("OVER")
        } else {
          console.debug("UNDER")
        }
      }
    }

    const end = performance.now();
    console.debug(`Completed in ${(end - start).toFixed(2)} milliseconds`);
  }
}

const urlParams = new URLSearchParams(window.location.search);
const seed = urlParams.get("id");

let b = seed ? new Board(seed) : new Board();

let selected = [];
let selectedCards = [];
let matches = [];
function onClick(card, e) {
  let idx = b.deck.indexOf(card);
  const cardHolder = document.querySelectorAll("#board .card")[idx];
  if (selected.indexOf(card) == -1) {
    if (selected.length >= 3) {
      return;
    }
    cardHolder.classList.add("selected");
    selected.push(card);
    if (selected.length == 3) {
      checkMatch();
    }
  } else {
    cardHolder.classList.remove("selected");
    selected.splice(selected.indexOf(card), 1);
  }
}

function checkMatch() {
  if (Card.isMatch(...selected)) {
    let newMatch = true;
    for (let match of matches) {
      if (match.includes(selected[0])
        && match.includes(selected[1])
        && match.includes(selected[2])) {
        newMatch = false;
        break;
      }
    }
    if (newMatch) {
      showToast("Found a set!", "success");
      let idx = matches.length;
      matches.push([...selected]);

      const matchPreview = document.querySelectorAll(".match-preview:not(.example)")[idx];
      matchPreview.innerHTML = "";
      matchPreview.appendChild(makeMatch(selected));

      const matchHeader = document.getElementById("match-header");
      if (matches.length == 1) {
        matchHeader.innerText = `1 set found:`
      } else {
        matchHeader.innerText = `${matches.length} Sets found:`
      }

      if (matches.length == 6) {
        // game is done!
        clearInterval(timerId);
        const timerEl = document.getElementById("timer");
        timerEl.classList.add("blink");
        let time = Date.now() - startTime;
        timerEl.textContent = new Date(time).toISOString().slice(14, -1);
        const shareEl = document.getElementById("share-container");
        const linkEl = shareEl.querySelector("a");
        linkEl.setAttribute("href", `sms:?&body=${encodeURIComponent(`I just solved the Daily SET in ${timerEl.textContent}! Give it a try!\nhttps://levilarsen.me/set-game/set.html`)}`);
        shareEl.classList.remove("hidden");
      }

    } else {
      showToast("Already found!", "info");
    }

  } else {
    showToast("Not a set!", "fail");
  }
  for (const card of [...selected]) {
    onClick(card, null);
  }
}

function showToast(message, style) {
  const container = document.getElementById("toast-container");
  const template = document.getElementById("toast-template");
  const clone = template.content.firstElementChild.cloneNode(true);
  clone.classList.add(style);
  const msgEl = clone.querySelector(".message");
  msgEl.innerText = message;
  container.appendChild(clone);
  requestAnimationFrame(() => clone.classList.add("show"));
  setTimeout(() => {
    // clone.classList.remove("show")
    clone.classList.add("hide");
    clone.addEventListener('transitionend', clone.remove, { once: true });
  }, 5000);
}

function makeCard(card, active = false) {
  const cardWrapper = document.createElement("div");
  cardWrapper.className = "card-wrapper";

  const cardEl = document.createElement("div");
  cardEl.className = `card ${card.color}`.trim();
  cardWrapper.appendChild(cardEl);

  const svg = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  );
  svg.classList.add("shape");
  /*
  if (tiny) {
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "20");
  } else {
    svg.setAttribute("width", "30");
    svg.setAttribute("height", "60");
  }
  */
  svg.setAttribute("viewBox", "0 0 200 400");

  const stroke = document.createElementNS(
    'http://www.w3.org/2000/svg',
    "use"
  );
  stroke.classList.add("stroke");
  stroke.setAttribute("href", `#${card.shape}`);
  if (card.fill != Fill.EMPTY) {
    const fill = document.createElementNS(
      'http://www.w3.org/2000/svg',
      "use"
    );
    fill.classList.add("fill");
    fill.setAttribute("href", `#${card.shape}`);
    if (card.fill == Fill.STRIPED) {
      fill.setAttribute("mask", "url(#mask-stripes)");
    }
    svg.append(fill);
  }
  svg.append(stroke);

  for (let i = 1; i < card.count; i++) {
    cardEl.append(svg.cloneNode(true));
  }
  cardEl.append(svg);

  if (active) {
    cardEl.addEventListener("click", e => onClick(card, e));
    cardEl.classList.add("active");
  }

  return cardWrapper;
}

function makeMatch(cards, cardClasses = []) {
  const frag = document.createDocumentFragment();
  let idx = 0;
  for (const card of cards) {
    const cardEl = makeCard(card);
    cardEl.setAttribute("style", `grid-column: 2; grid-row: ${2 + idx};`);
    if (cardClasses.length > 0) {
      cardEl.classList.add(cardClasses);
    }
    idx++;
    frag.append(cardEl);
  }

  return frag;
}

let timerId = null;
let startTime = null;

document.addEventListener("DOMContentLoaded", () => {

  // set up details panes
  document.querySelectorAll("details").forEach(details => {
    const summary = details.querySelector("summary");
    const content = details.querySelector(".details-content");

    summary.addEventListener("click", e => {
      e.preventDefault();
      if (summary.classList.contains("opened")) {
        // close it! ... animate first, then close details
        content.style.height = content.scrollHeight + "px";
        content.style.opacity = "1";
        content.offsetHeight;

        content.style.height = "0px";
        content.style.opacity = "0";
        summary.classList.remove("opened");

        content.addEventListener(
          "transitionend",
          () => {
            if (!summary.classList.contains("opened")) {
              details.open = false;
            }
          },
          { once: true }
        );
      } else {
        // first, close any opened details
        document.querySelectorAll("details").forEach(dt => {
          if (dt.hasAttribute("open")) {
            dt.querySelector("summary").click();
          }
        });

        // open it! ... open details first, then animate
        details.open = true;
        summary.classList.add("opened");

        requestAnimationFrame(() => {
          content.style.height = content.scrollHeight + "px";
          content.style.opacity = "1";

          content.addEventListener(
            "transitionend",
            () => {
              if (summary.classList.contains("opened")) {
                content.style.height = "auto";
              }
            },
            { once: true }
          );
        });
      }
    });
  });

  // open first detail panel
  const details = document.querySelector("details");
  const summary = details.querySelector("summary");
  const content = details.querySelector(".details-content");

  details.open = true;
  summary.classList.add("opened");
  content.style.height = "auto";
  content.style.opacity = "1";
  content.style.transition = "none";

  // re-enable transitions on next frame
  requestAnimationFrame(() => {
    content.style.transition = "";
  });

  // set up example sets
  const examples = document.querySelectorAll(".match-preview.example");
  const cards = [
    [
      new Card(Color.PURPLE, 2, Shape.SQUIGGLE, Fill.STRIPED),
      new Card(Color.PURPLE, 2, Shape.DIAMOND, Fill.STRIPED),
      new Card(Color.PURPLE, 2, Shape.OVAL, Fill.STRIPED)
    ],
    [
      new Card(Color.RED, 1, Shape.OVAL, Fill.EMPTY),
      new Card(Color.PURPLE, 2, Shape.OVAL, Fill.SOLID),
      new Card(Color.GREEN, 3, Shape.OVAL, Fill.STRIPED)
    ],
    [
      new Card(Color.GREEN, 3, Shape.DIAMOND, Fill.SOLID),
      new Card(Color.RED, 1, Shape.OVAL, Fill.STRIPED),
      new Card(Color.PURPLE, 2, Shape.SQUIGGLE, Fill.EMPTY)
    ],
    [
      new Card(Color.RED, 1, Shape.DIAMOND, Fill.EMPTY),
      new Card(Color.RED, 3, Shape.DIAMOND, Fill.SOLID),
      new Card(Color.RED, 3, Shape.DIAMOND, Fill.STRIPED)
    ],
    [
      new Card(Color.RED, 2, Shape.SQUIGGLE, Fill.STRIPED),
      new Card(Color.PURPLE, 2, Shape.DIAMOND, Fill.STRIPED),
      new Card(Color.PURPLE, 2, Shape.OVAL, Fill.SOLID)
    ],
    [
      new Card(Color.GREEN, 3, Shape.SQUIGGLE, Fill.SOLID),
      new Card(Color.RED, 1, Shape.OVAL, Fill.STRIPED),
      new Card(Color.PURPLE, 2, Shape.SQUIGGLE, Fill.EMPTY)
    ]
  ];

  for (let i = 0; i < cards.length && i < examples.length; i++) {
    examples[i].innerHTML = "";
    examples[i].appendChild(makeMatch(cards[i]));
  }

  // set up ghost cards
  const matchPreviews = document.querySelectorAll(".match-preview:not(.example)");
  const fakeCard = new Card(null, 3, Shape.OVAL, Fill.SOLID);
  for (const preview of matchPreviews) {
    preview.innerHTML = "";
    preview.appendChild(makeMatch([fakeCard, fakeCard, fakeCard], ["ghost"]));
  }

  // show cards
  const container = document.getElementById("board");
  const frag = document.createDocumentFragment();

  let idx = 0;
  for (const card of b.deck) {
    let cardEl = makeCard(card, true);
    cardEl.setAttribute("style", `grid-column: ${2 + (idx % 3)}; grid-row: ${2 + Math.floor(idx / 3)};`);
    idx++;
    frag.append(cardEl);
  }

  container.innerHTML = "";
  container.appendChild(frag);

  // timer V1: 100ms interval
  const timerEl = document.getElementById("timer");
  startTime = Date.now();
  timerId = setInterval(() => {
    let time = Date.now() - startTime;
    timerEl.textContent = new Date(time).toISOString().slice(14, -5);
  }, 1000);

  // timer V2: requestAnimationFrame()
  /*
  const timerEl = document.getElementById("timer");
  function updateTimer(now) {
    const time = now - startTime;
    timerEl.textContent = new Date(time).toISOString().slice(14, -5);
    requestAnimationFrame(updateTimer);
  }
  requestAnimationFrame(updateTimer);
  */
});
