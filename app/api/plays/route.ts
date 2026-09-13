import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Participant = { id: number; winner?: boolean; score?: number | null };

export async function POST(request: NextRequest) {
  const body = await request.json();
  const players = body.players as Participant[];
  const validPlayers = Array.isArray(players) && players.length > 0 && players.every(player =>
    Number.isInteger(player.id) &&
    (player.score === undefined || player.score === null || Number.isFinite(player.score))
  );
  if (!Number.isInteger(body.gameId) || !validPlayers || new Set(players.map(player => player.id)).size !== players.length)
    return NextResponse.json({ error: "Choisissez au moins un joueur et vérifiez les scores." }, { status: 400 });
  if (body.duration !== null && body.duration !== undefined && (!Number.isInteger(body.duration) || body.duration < 1))
    return NextResponse.json({ error: "Durée invalide." }, { status: 400 });
  if (!db.prepare("SELECT id FROM games WHERE id=?").get(body.gameId))
    return NextResponse.json({ error: "Jeu introuvable." }, { status: 404 });
  const found = db.prepare(`SELECT count(*) count FROM players WHERE id IN (${players.map(() => "?").join(",")})`).get(...players.map(player => player.id)) as { count: number };
  if (found.count !== players.length) return NextResponse.json({ error: "Un joueur est introuvable." }, { status: 400 });

  const id = db.transaction(() => {
    const play = db.prepare("INSERT INTO plays(gameId,duration,notes) VALUES(?,?,?)").run(body.gameId, body.duration ?? null, body.notes || null);
    const add = db.prepare("INSERT INTO participants(playId,playerId,winner,score) VALUES(?,?,?,?)");
    players.forEach(player => add.run(play.lastInsertRowid, player.id, player.winner ? 1 : 0, player.score ?? null));
    return play.lastInsertRowid;
  })();
  return NextResponse.json({ id }, { status: 201 });
}
