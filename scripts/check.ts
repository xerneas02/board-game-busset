import { strict as assert } from "node:assert";
import { seedGames } from "../data/seed-games";

type Filter = "all"|"veryEasy"|"easy"|"medium"|"hard";
const difficultyMatches=(value:number|undefined,filter:Filter)=>filter==="all"||!!value&&(filter==="veryEasy"?value<=1.3:filter==="easy"?value>1.3&&value<=2:filter==="medium"?value>2&&value<=2.6:value>2.6);
const tagMatches=(tags:string[]|undefined,include:string[]=[],exclude:string[]=[])=>(!include.length||include.some(tag=>tags?.includes(tag)))&&!exclude.some(tag=>tags?.includes(tag));
const choose=(players:number,minutes?:number,difficulty:Filter="all",include:string[]=[],exclude:string[]=[])=>seedGames.filter(game=>game.min<=players&&game.max>=players&&difficultyMatches(game.difficulty,difficulty)&&tagMatches(game.tags,include,exclude)&&(!minutes||(game.minutes!==undefined&&(minutes===60?game.minutes>=30&&game.minutes<=60:minutes===30?game.minutes<30:game.minutes>60))));

const four=choose(4);
assert.ok(four.every(game=>game.min<=4&&game.max>=4),"jeu incompatible à 4");
assert.ok(choose(4,30).every(game=>game.minutes!==undefined&&game.minutes<30),"filtre court incorrect");
assert.ok(choose(4,60).every(game=>game.minutes!==undefined&&game.minutes>=30&&game.minutes<=60),"filtre moyen incorrect");
assert.ok(choose(4,undefined,"veryEasy").every(game=>(game.difficulty||9)<=1.3),"filtre de difficulté incorrect");
assert.ok(choose(4,undefined,"all",["Jeu de plis"]).every(game=>game.tags?.includes("Jeu de plis")),"inclusion de tag incorrecte");
assert.ok(choose(4,undefined,"all",[],["Jeu de cartes"]).every(game=>!game.tags?.includes("Jeu de cartes")),"exclusion de tag incorrecte");
assert.ok(seedGames.some(game=>game.name==="Skyjo Action"&&game.difficulty===1.17));
assert.ok(seedGames.some(game=>game.name==="Palet breton")&&seedGames.some(game=>game.name==="Jeu de la grenouille"));
assert.ok(["Fort Boyard","Monopoly","Risk"].every(name=>!seedGames.some(game=>game.name===name)));
assert.ok(["Cryptide","TTMC","Codenames"].every(name=>seedGames.some(game=>game.name===name)));
console.log("Sélecteur : joueurs, durée, difficulté et collection OK");
