import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seedGames } from "@/data/seed-games";
import { seedAssets } from "@/data/seed-assets";
import cachedCovers from "@/data/cached-covers.json";
const path = process.env.DATABASE_PATH || "./data/library.db";
mkdirSync(dirname(path), { recursive: true });
const globalDb = global as unknown as { db?: Database.Database };
export const db = globalDb.db || new Database(path);
if (process.env.NODE_ENV !== "production") globalDb.db = db;
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 10000");
db.exec(`CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT NOT NULL, coverPath TEXT, minPlayers INTEGER NOT NULL, maxPlayers INTEGER NOT NULL, estimatedMinutes INTEGER, difficulty TEXT, rating INTEGER, notes TEXT, tags TEXT NOT NULL DEFAULT '[]', active INTEGER DEFAULT 1, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT, active INTEGER DEFAULT 1, createdAt TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS plays (id INTEGER PRIMARY KEY, gameId INTEGER NOT NULL REFERENCES games(id), playedAt TEXT DEFAULT CURRENT_TIMESTAMP, duration INTEGER, notes TEXT);
CREATE TABLE IF NOT EXISTS participants (playId INTEGER REFERENCES plays(id) ON DELETE CASCADE, playerId INTEGER REFERENCES players(id), winner INTEGER DEFAULT 0, score INTEGER, PRIMARY KEY(playId,playerId));
CREATE TABLE IF NOT EXISTS game_events (id INTEGER PRIMARY KEY, gameId INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE, name TEXT NOT NULL COLLATE NOCASE, UNIQUE(gameId,name));
CREATE TABLE IF NOT EXISTS play_events (playId INTEGER NOT NULL REFERENCES plays(id) ON DELETE CASCADE, eventId INTEGER NOT NULL REFERENCES game_events(id) ON DELETE CASCADE, playerId INTEGER REFERENCES players(id), count INTEGER NOT NULL CHECK(count>0), PRIMARY KEY(playId,eventId,playerId));
CREATE TABLE IF NOT EXISTS active_session (id INTEGER PRIMARY KEY CHECK(id=1), gameId INTEGER NOT NULL REFERENCES games(id), players TEXT NOT NULL, startedAt INTEGER, elapsedSeconds INTEGER NOT NULL DEFAULT 0, tracking INTEGER NOT NULL DEFAULT 1, paused INTEGER NOT NULL DEFAULT 0, events TEXT NOT NULL DEFAULT '[]', version INTEGER NOT NULL DEFAULT 1, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rule_sections (id INTEGER PRIMARY KEY, gameId INTEGER REFERENCES games(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, position INTEGER DEFAULT 0);
CREATE VIRTUAL TABLE IF NOT EXISTS rules_fts USING fts5(gameId UNINDEXED, title, content);`);
if (!db.prepare("PRAGMA table_info(games)").all().some((column: any) => column.name === "rulesUrl")) { try { db.exec("ALTER TABLE games ADD COLUMN rulesUrl TEXT") } catch (error) { if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error } }
const needsSeedTags = !db.prepare("PRAGMA table_info(games)").all().some((column: any) => column.name === "tags");
if (needsSeedTags) {
  try {
    db.exec("ALTER TABLE games ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
  }
}
db.exec("CREATE TABLE IF NOT EXISTS rule_documents (id INTEGER PRIMARY KEY, gameId INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE, filePath TEXT NOT NULL, fileName TEXT NOT NULL, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)");
db.exec("CREATE TABLE IF NOT EXISTS rule_pages (id INTEGER PRIMARY KEY, documentId INTEGER NOT NULL REFERENCES rule_documents(id) ON DELETE CASCADE, gameId INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE, page INTEGER NOT NULL, content TEXT NOT NULL); CREATE VIRTUAL TABLE IF NOT EXISTS rule_pages_fts USING fts5(content, content='rule_pages', content_rowid='id')");
// Migrate existing event totals so an event can be attributed to a player.
if (!db.prepare("PRAGMA table_info(play_events)").all().some((column:any)=>column.name==="playerId")) db.transaction(()=>{
  db.exec("CREATE TABLE play_events_new (playId INTEGER NOT NULL REFERENCES plays(id) ON DELETE CASCADE, eventId INTEGER NOT NULL REFERENCES game_events(id) ON DELETE CASCADE, playerId INTEGER REFERENCES players(id), count INTEGER NOT NULL CHECK(count>0), PRIMARY KEY(playId,eventId,playerId)); INSERT INTO play_events_new(playId,eventId,playerId,count) SELECT playId,eventId,NULL,count FROM play_events; DROP TABLE play_events; ALTER TABLE play_events_new RENAME TO play_events;");
}).immediate();
export const slugify = (s:string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
export const cleanTags = (value:unknown) => [...new Set((Array.isArray(value)?value:[]).map(tag=>String(tag).trim()).filter(Boolean))].slice(0,20);
export const gameJson = (row:any) => ({...row,tags:(()=>{try{return cleanTags(JSON.parse(row.tags||"[]"))}catch{return[]}})()});
const duplicateGroups = db.prepare("SELECT lower(trim(name)) name FROM games WHERE active=1 GROUP BY lower(trim(name)) HAVING count(*)>1").all() as {name:string}[];
db.transaction(() => {
  for (const group of duplicateGroups) {
    const rows = db.prepare("SELECT * FROM games WHERE active=1 AND lower(trim(name))=? ORDER BY id").all(group.name) as {id:number;name:string;slug:string;coverPath:string|null;rulesUrl:string|null;notes:string|null;rating:number|null}[];
    const keep = rows.find(row => row.slug === slugify(row.name)) || rows[0];
    const customCover = rows.find(row => row.coverPath?.startsWith("/api/media/"))?.coverPath;
    const cover = customCover || keep.coverPath || rows.find(row => row.coverPath)?.coverPath || null;
    const rulesUrl = keep.rulesUrl || rows.find(row => row.rulesUrl)?.rulesUrl || null;
    const notes = keep.notes || rows.find(row => row.notes)?.notes || null;
    const rating = keep.rating || rows.find(row => row.rating)?.rating || null;
    db.prepare("UPDATE games SET coverPath=?,rulesUrl=?,notes=?,rating=? WHERE id=?").run(cover,rulesUrl,notes,rating,keep.id);
    for (const duplicate of rows.filter(row => row.id !== keep.id)) {
      db.prepare("UPDATE plays SET gameId=? WHERE gameId=?").run(keep.id,duplicate.id);
      db.prepare("UPDATE rule_sections SET gameId=? WHERE gameId=?").run(keep.id,duplicate.id);
      db.prepare("UPDATE rules_fts SET gameId=? WHERE gameId=?").run(keep.id,duplicate.id);
      db.prepare("UPDATE rule_documents SET gameId=? WHERE gameId=?").run(keep.id,duplicate.id);
      db.prepare("UPDATE rule_pages SET gameId=? WHERE gameId=?").run(keep.id,duplicate.id);
      db.prepare("UPDATE games SET active=0 WHERE id=?").run(duplicate.id);
    }
  }
}).immediate();
const insertSeed = db.prepare("INSERT OR IGNORE INTO games (slug,name,minPlayers,maxPlayers,estimatedMinutes,difficulty,rating,tags) VALUES (?,?,?,?,?,?,?,?)");
const findActiveByName = db.prepare("SELECT id FROM games WHERE active=1 AND lower(trim(name))=lower(trim(?))");
const fillDifficulty = db.prepare("UPDATE games SET difficulty=? WHERE name=? AND (difficulty IS NULL OR difficulty IN ('Très facile','Facile','Moyenne','Relevée'))");
db.transaction(() => seedGames.forEach(game => {
  if (!findActiveByName.get(game.name)) insertSeed.run(slugify(game.name), game.name, game.min, game.max, game.minutes ?? null, game.difficulty ?? null, game.rating ?? null, JSON.stringify(game.tags || []));
  if (game.difficulty !== undefined) fillDifficulty.run(game.difficulty, game.name);
})).immediate();
if (needsSeedTags) db.transaction(() => seedGames.forEach(game => db.prepare("UPDATE games SET tags=? WHERE name=?").run(JSON.stringify(game.tags || []),game.name)))();
db.transaction(() => {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS games_active_name_unique ON games(lower(trim(name))) WHERE active=1");
}).immediate();
const fillCover=db.prepare("UPDATE games SET coverPath=? WHERE name=? AND (coverPath IS NULL OR coverPath=?)");
const fillRules=db.prepare("UPDATE games SET rulesUrl=? WHERE name=? AND rulesUrl IS NULL");
db.transaction(()=>{for(const [name,asset] of Object.entries(seedAssets)){const local=cachedCovers[name as keyof typeof cachedCovers];if(local)fillCover.run(local,name,asset.cover);if(asset.rules)fillRules.run(asset.rules,name)}})();
db.prepare("UPDATE games SET rulesUrl=? WHERE name='Sequence' AND rulesUrl=?").run("https://www.jaxgames.com/sequence-game-rules/","https://www.jaxgames.com/sequence-game-instructions/");
