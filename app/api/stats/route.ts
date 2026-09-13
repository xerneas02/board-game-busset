import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    total: (db.prepare("SELECT count(*) n FROM plays").get() as { n: number }).n,
    top: db.prepare("SELECT g.name,count(*) plays FROM games g JOIN plays p ON p.gameId=g.id GROUP BY g.id ORDER BY plays DESC LIMIT 1").get(),
    averageScore: (db.prepare("SELECT ROUND(AVG(score),1) value, count(score) count FROM participants WHERE score IS NOT NULL").get() as { value: number | null; count: number }),
    scoresByPlayerCount: db.prepare(`
      WITH sizes AS (SELECT playId, count(*) playerCount FROM participants GROUP BY playId)
      SELECT sizes.playerCount, ROUND(AVG(participants.score),1) averageScore, count(participants.score) scoreCount
      FROM participants JOIN sizes ON sizes.playId=participants.playId
      WHERE participants.score IS NOT NULL
      GROUP BY sizes.playerCount ORDER BY sizes.playerCount
    `).all(),
    players: db.prepare(`
      SELECT players.*, count(DISTINCT participants.playId) plays,
        count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END) wins,
        ROUND(AVG(participants.score),1) averageScore, count(participants.score) scoreCount
      FROM players LEFT JOIN participants ON participants.playerId=players.id
      GROUP BY players.id ORDER BY plays DESC,name
    `).all(),
  });
}
