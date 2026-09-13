import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request:NextRequest) {
  const gameId=Number(request.nextUrl.searchParams.get("gameId"));
  if(gameId) return NextResponse.json({
    total:(db.prepare("SELECT count(*) count FROM plays WHERE gameId=?").get(gameId) as {count:number}).count,
    averageScore:db.prepare("SELECT ROUND(AVG(participants.score),1) value,count(participants.score) count FROM participants JOIN plays ON plays.id=participants.playId WHERE plays.gameId=? AND participants.score IS NOT NULL").get(gameId),
    scoresByPlayerCount:db.prepare(`
      WITH sizes AS (SELECT participants.playId,count(*) playerCount FROM participants JOIN plays ON plays.id=participants.playId WHERE plays.gameId=? GROUP BY participants.playId)
      SELECT sizes.playerCount,ROUND(AVG(participants.score),1) averageScore,count(participants.score) scoreCount
      FROM participants JOIN sizes ON sizes.playId=participants.playId
      WHERE participants.score IS NOT NULL GROUP BY sizes.playerCount ORDER BY sizes.playerCount
    `).all(gameId),
    players:db.prepare(`
      SELECT players.id,players.name,count(DISTINCT participants.playId) plays,
        count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END) wins,
        ROUND(AVG(participants.score),1) averageScore,count(participants.score) scoreCount
      FROM participants JOIN players ON players.id=participants.playerId JOIN plays ON plays.id=participants.playId
      WHERE plays.gameId=? GROUP BY players.id ORDER BY plays DESC,players.name
    `).all(gameId),
  });

  return NextResponse.json({
    total:(db.prepare("SELECT count(*) count FROM plays").get() as {count:number}).count,
    totalWins:(db.prepare("SELECT count(*) count FROM participants WHERE winner=1").get() as {count:number}).count,
    topGames:db.prepare("SELECT games.name,count(*) plays FROM games JOIN plays ON plays.gameId=games.id GROUP BY games.id ORDER BY plays DESC,games.name LIMIT 5").all(),
    players:db.prepare(`
      SELECT players.id,players.name,count(DISTINCT participants.playId) plays,
        count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END) wins,
        ROUND(100.0*count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END)/NULLIF(count(DISTINCT participants.playId),0)) winRate
      FROM players LEFT JOIN participants ON participants.playerId=players.id
      GROUP BY players.id ORDER BY plays DESC,players.name
    `).all(),
  });
}
