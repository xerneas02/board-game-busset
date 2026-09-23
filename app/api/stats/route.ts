import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
export async function GET(request:NextRequest) {
 const gameId=Number(request.nextUrl.searchParams.get("gameId"));
 const playerId=Number(request.nextUrl.searchParams.get("playerId"));
 if(gameId){
  const game=db.prepare("SELECT lowerScoreWins FROM games WHERE id=?").get(gameId) as {lowerScoreWins:number}|undefined;
  if(!game)return NextResponse.json({error:"Jeu introuvable."},{status:404});
  const lowerScoreWins=game.lowerScoreWins?1:0;
  return NextResponse.json({
  total:(db.prepare("SELECT count(*) count FROM plays WHERE gameId=?").get(gameId) as {count:number}).count,
  averageDuration:db.prepare("SELECT ROUND(AVG(duration)) value,count(duration) count FROM plays WHERE gameId=? AND duration IS NOT NULL").get(gameId),
  totalDuration:db.prepare("SELECT COALESCE(SUM(duration),0) value FROM plays WHERE gameId=?").get(gameId),
  durationByPlayerCount:db.prepare(`WITH sizes AS (SELECT playId,count(*) playerCount FROM participants GROUP BY playId) SELECT sizes.playerCount,ROUND(AVG(plays.duration)) averageDuration,count(plays.duration) count FROM plays JOIN sizes ON sizes.playId=plays.id WHERE plays.gameId=? AND plays.duration IS NOT NULL GROUP BY sizes.playerCount ORDER BY sizes.playerCount`).all(gameId),
  averageScore:db.prepare("SELECT ROUND(AVG(participants.score),1) value,count(participants.score) count FROM participants JOIN plays ON plays.id=participants.playId WHERE plays.gameId=? AND participants.score IS NOT NULL").get(gameId),
  bestScore:db.prepare("SELECT participants.score value,players.id playerId,players.name playerName FROM participants JOIN plays ON plays.id=participants.playId JOIN players ON players.id=participants.playerId WHERE plays.gameId=? AND participants.score IS NOT NULL ORDER BY (CASE WHEN ? THEN participants.score ELSE -participants.score END),plays.playedAt DESC,participants.playerId LIMIT 1").get(gameId,lowerScoreWins),
  bestMonthlyScore:db.prepare("SELECT participants.score value,players.id playerId,players.name playerName FROM participants JOIN plays ON plays.id=participants.playId JOIN players ON players.id=participants.playerId WHERE plays.gameId=? AND participants.score IS NOT NULL AND strftime('%Y-%m',plays.playedAt)=strftime('%Y-%m','now') ORDER BY (CASE WHEN ? THEN participants.score ELSE -participants.score END),plays.playedAt DESC,participants.playerId LIMIT 1").get(gameId,lowerScoreWins),
  lowestScore:db.prepare("SELECT participants.score value,players.id playerId,players.name playerName FROM participants JOIN plays ON plays.id=participants.playId JOIN players ON players.id=participants.playerId WHERE plays.gameId=? AND participants.score IS NOT NULL ORDER BY (CASE WHEN ? THEN -participants.score ELSE participants.score END),plays.playedAt DESC,participants.playerId LIMIT 1").get(gameId,lowerScoreWins),
  lowestMonthlyScore:db.prepare("SELECT participants.score value,players.id playerId,players.name playerName FROM participants JOIN plays ON plays.id=participants.playId JOIN players ON players.id=participants.playerId WHERE plays.gameId=? AND participants.score IS NOT NULL AND strftime('%Y-%m',plays.playedAt)=strftime('%Y-%m','now') ORDER BY (CASE WHEN ? THEN -participants.score ELSE participants.score END),plays.playedAt DESC,participants.playerId LIMIT 1").get(gameId,lowerScoreWins),
  scoresByPlayerCount:db.prepare(`WITH sizes AS (SELECT participants.playId,count(*) playerCount FROM participants JOIN plays ON plays.id=participants.playId WHERE plays.gameId=? GROUP BY participants.playId) SELECT sizes.playerCount,ROUND(AVG(participants.score),1) averageScore,count(participants.score) scoreCount FROM participants JOIN sizes ON sizes.playId=participants.playId WHERE participants.score IS NOT NULL GROUP BY sizes.playerCount ORDER BY sizes.playerCount`).all(gameId),
  players:db.prepare(`SELECT players.id,players.name,count(DISTINCT participants.playId) plays,count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END) wins,ROUND(AVG(participants.score),1) averageScore,count(participants.score) scoreCount,COALESCE(SUM(plays.duration),0) totalDuration FROM participants JOIN players ON players.id=participants.playerId JOIN plays ON plays.id=participants.playId WHERE plays.gameId=? GROUP BY players.id ORDER BY plays DESC,players.name`).all(gameId)
 });
 }
 if(playerId){
  const player=db.prepare("SELECT id,name FROM players WHERE id=?").get(playerId) as {id:number;name:string}|undefined;
  if(!player)return NextResponse.json({error:"Joueur introuvable."},{status:404});
  return NextResponse.json({
   player,
   total:(db.prepare("SELECT count(*) count FROM participants WHERE playerId=?").get(playerId) as {count:number}).count,
   wins:(db.prepare("SELECT count(*) count FROM participants WHERE playerId=? AND winner=1").get(playerId) as {count:number}).count,
   winRate:db.prepare("SELECT ROUND(100.0*count(CASE WHEN winner=1 THEN 1 END)/NULLIF(count(*),0)) value FROM participants WHERE playerId=?").get(playerId),
   totalDuration:db.prepare("SELECT COALESCE(SUM(plays.duration),0) value FROM participants JOIN plays ON plays.id=participants.playId WHERE participants.playerId=?").get(playerId),
   averageDuration:db.prepare("SELECT ROUND(AVG(plays.duration)) value,count(plays.duration) count FROM participants JOIN plays ON plays.id=participants.playId WHERE participants.playerId=? AND plays.duration IS NOT NULL").get(playerId),
   averageScore:db.prepare("SELECT ROUND(AVG(score),1) value,count(score) count FROM participants WHERE playerId=? AND score IS NOT NULL").get(playerId),
   games:db.prepare(`SELECT games.id,games.name,count(*) plays,count(CASE WHEN participants.winner=1 THEN 1 END) wins,ROUND(100.0*count(CASE WHEN participants.winner=1 THEN 1 END)/NULLIF(count(*),0)) winRate,COALESCE(SUM(plays.duration),0) totalDuration,ROUND(AVG(plays.duration)) averageDuration,ROUND(AVG(participants.score),1) averageScore,count(participants.score) scoreCount FROM participants JOIN plays ON plays.id=participants.playId JOIN games ON games.id=plays.gameId WHERE participants.playerId=? GROUP BY games.id ORDER BY plays DESC,games.name`).all(playerId)
  });
 }
 return NextResponse.json({
  total:(db.prepare("SELECT count(*) count FROM plays").get() as {count:number}).count,
  totalWins:(db.prepare("SELECT count(*) count FROM participants WHERE winner=1").get() as {count:number}).count,
  averageDuration:db.prepare("SELECT ROUND(AVG(duration)) value,count(duration) count FROM plays WHERE duration IS NOT NULL").get(),
  totalDuration:db.prepare("SELECT COALESCE(SUM(duration),0) value FROM plays").get(),
  topGames:db.prepare("SELECT games.name,count(*) plays FROM games JOIN plays ON plays.gameId=games.id GROUP BY games.id ORDER BY plays DESC,games.name LIMIT 5").all(),
  players:db.prepare(`SELECT players.id,players.name,count(DISTINCT participants.playId) plays,count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END) wins,ROUND(100.0*count(DISTINCT CASE WHEN participants.winner=1 THEN participants.playId END)/NULLIF(count(DISTINCT participants.playId),0)) winRate,COALESCE(SUM(plays.duration),0) totalDuration FROM players LEFT JOIN participants ON participants.playerId=players.id LEFT JOIN plays ON plays.id=participants.playId GROUP BY players.id ORDER BY plays DESC,players.name`).all()
 });
}
