import { strict as assert } from "node:assert";
import { seedGames } from "../data/seed-games";

type Difficulty = "veryEasy"|"easy"|"medium"|"complex"|"hard";
const difficultyMatches=(value:number|undefined,filters:Difficulty[]=[])=>!filters.length||(value!==undefined&&filters.some(filter=>filter==="veryEasy"?value>=0&&value<1:filter==="easy"?value>=1&&value<2:filter==="medium"?value>=2&&value<3:filter==="complex"?value>=3&&value<4:value>=4&&value<=5));
const tagMatches=(tags:string[]|undefined,include:string[]=[],exclude:string[]=[])=>(!include.length||include.some(tag=>tags?.includes(tag)))&&!exclude.some(tag=>tags?.includes(tag));
const choose=(players:number,minutes?:number,difficulty:Difficulty[]=[],include:string[]=[],exclude:string[]=[])=>seedGames.filter(game=>game.min<=players&&game.max>=players&&difficultyMatches(game.difficulty,difficulty)&&tagMatches(game.tags,include,exclude)&&(!minutes||(game.minutes!==undefined&&(minutes===60?game.minutes>=30&&game.minutes<=60:minutes===30?game.minutes<30:game.minutes>60))));

const four=choose(4);
assert.ok(four.every(game=>game.min<=4&&game.max>=4),"jeu incompatible à 4");
assert.ok(choose(4,30).every(game=>game.minutes!==undefined&&game.minutes<30),"filtre court incorrect");
assert.ok(choose(4,60).every(game=>game.minutes!==undefined&&game.minutes>=30&&game.minutes<=60),"filtre moyen incorrect");
assert.ok(choose(4,undefined,["veryEasy"]).every(game=>game.difficulty!==undefined&&game.difficulty>=0&&game.difficulty<1),"tranche très facile incorrecte");
assert.ok(choose(4,undefined,["easy","medium"]).every(game=>game.difficulty!==undefined&&game.difficulty>=1&&game.difficulty<3),"multi-sélection de difficulté incorrecte");
assert.ok(choose(4,undefined,[],["Jeu de plis"]).every(game=>game.tags?.includes("Jeu de plis")),"inclusion de tag incorrecte");
assert.ok(choose(4,undefined,[],[],["Jeu de cartes"]).every(game=>!game.tags?.includes("Jeu de cartes")),"exclusion de tag incorrecte");
assert.ok(seedGames.some(game=>game.name==="Skyjo Action"&&game.difficulty===0.9));
assert.ok(seedGames.some(game=>game.name==="Palet breton")&&seedGames.some(game=>game.name==="Jeu de la grenouille"));
assert.ok(["Fort Boyard","Monopoly","Risk"].every(name=>!seedGames.some(game=>game.name===name)));
assert.ok(["Cryptide","TTMC","Codenames"].every(name=>seedGames.some(game=>game.name===name)));
console.log("Sélecteur : joueurs, durées, difficultés et collection OK");
