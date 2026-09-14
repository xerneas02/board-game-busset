import puppeteer from "puppeteer-core";
import { strict as assert } from "node:assert";

const base = process.env.SMOKE_BASE || "http://localhost:3000";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  try {
    for (const width of [360, 390, 1280]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 844, deviceScaleFactor: 1 });
      await page.goto(base, { waitUntil: "networkidle2" });
      if (await page.$("#family-password")) {
        assert.ok(process.env.SMOKE_PASSWORD, "SMOKE_PASSWORD requis pour la page protégée");
        if (width === 360) await page.screenshot({ path: "login-360.png" });
        await page.type("#family-password", process.env.SMOKE_PASSWORD);
        await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2" }), page.click(".login-panel button")]);
      }
      const sizing = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(sizing.innerWidth, width);
      assert.ok(sizing.scrollWidth <= width, `Débordement à ${width}px : ${sizing.scrollWidth}`);

      if (width === 390) {
        await page.waitForSelector(".tag-filter button");
        const tag = ".tag-filter button";
        await page.click(tag); assert.equal(await page.$eval(tag, button=>button.getAttribute("data-mode")),"include");
        await page.click(tag); assert.equal(await page.$eval(tag, button=>button.getAttribute("data-mode")),"exclude");
        await page.click(tag); assert.equal(await page.$eval(tag, button=>button.getAttribute("data-mode")),"neutral");
        await page.screenshot({ path: "mobile-390.png" });
        await page.click(".bottom-nav button:nth-child(2)");
        await page.waitForSelector(".game-tile");
        await page.evaluate(() => [...document.images].forEach(image => image.loading = "eager"));
        await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>(".game-tile img")].every(image => image.complete));
        const missing = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".game-tile")].filter(tile => {
          const name = tile.querySelector(":scope > span")?.textContent?.trim();
          return !tile.querySelector("img") && !["421", "Coinche", "Tarot", "Yams", "10 000", "Whist", "Las Vegas", "Palet breton", "Jeu de la grenouille"].includes(name || "");
        }).map(tile => tile.querySelector(":scope > span")?.textContent));
        assert.deepEqual(missing, [], `Couvertures manquantes : ${missing.join(", ")}`);
        await page.screenshot({ path: "library-390.png" });
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>(".game-tile")].find(button => button.querySelector(":scope > span")?.textContent === "Catan")?.click());
        await page.waitForSelector(".game-title");
        await page.click('button[aria-label="Modifier ce jeu"]');
        await page.waitForSelector(".editor-tag-list button");
        assert.ok(await page.$$eval(".editor-tag-list button", buttons=>buttons.length>=5));
        await page.type('.new-tag input',"Jeu coopératif");
        await page.click('.new-tag button');
        assert.ok(await page.$$eval(".editor-tag-list button",buttons=>buttons.some(button=>button.textContent?.includes("Jeu coopératif")&&button.getAttribute("aria-pressed")==="true")));
        await page.screenshot({path:"tags-editor-390.png"});
        await page.click(".form-sheet .sheet-close");
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Nouvelle partie")?.click());
        await page.waitForSelector("#picker-title");
        if (!(await page.$(".known-player-list button"))) {
          await page.type('input[aria-label="Nouveau joueur"]', "Joueur test");
          await page.click('button[aria-label="Ajouter le joueur"]');
        } else {
          await page.click(".known-player-list button");
        }
        await page.waitForSelector(".selected-players button");
        await new Promise(resolve => setTimeout(resolve, 250));
        await page.screenshot({ path: "players-390.png" });
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Commencer avec le chrono")?.click());
        await page.waitForSelector(".running strong");
        assert.match(await page.$eval(".running strong", element => element.textContent || ""), /^\d\d:\d\d:\d\d$/);
        await page.screenshot({ path: "timer-390.png" });
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Terminer la partie")?.click());
        await page.waitForSelector(".scores input");
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Ne pas enregistrer ce chrono")?.click());
        assert.match(await page.$eval(".finished-time", element => element.textContent || ""), /non enregistrée/);
        await page.click(".player-grid button");
        await page.type(".scores input", "42");
        await new Promise(resolve => setTimeout(resolve, 250));
        await page.screenshot({ path: "scores-390.png" });
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Enregistrer la partie")?.click());
        await page.waitForSelector("#replay-title");
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Rejouer")?.click());
        await page.waitForSelector(".running strong");
        page.once("dialog", dialog => dialog.accept());
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Annuler cette partie")?.click());
        await page.waitForSelector(".game-stats");
        assert.match(await page.$eval(".game-stats", element => element.textContent || ""), /score moyen/i);
        await page.screenshot({ path: "game-stats-390.png", fullPage: true });
        await page.evaluate(() => [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Retour"))?.click());
        await page.click(".bottom-nav button:nth-child(3)");
        await page.waitForSelector(".stats .stat-row");
        const globalStats = await page.$eval(".stats", element => element.textContent || "");
        assert.doesNotMatch(globalStats, /score moyen/i);
        assert.match(globalStats, /% de victoires/);
        await page.screenshot({ path: "stats-390.png", fullPage: true });
      }
      await page.close();
      console.log(`${width}px : OK`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
