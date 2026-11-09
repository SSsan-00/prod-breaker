import type { EnemyKind } from "@/game/engine";
export type Character = EnemyKind | "sentinel";
const palette: Record<Character, [string, string]> = {
  sentinel: ["#d6e4cd", "#caff98"], brute: ["#d69b7f", "#ffb77c"], phish: ["#aa9cc5", "#e9b7ff"],
  inject: ["#be7f93", "#ff8eab"], ransom: ["#9890bd", "#bbabff"], ddos: ["#bbac76", "#ffe297"], zero: ["#b96e84", "#ff7399"],
};
/** Bake metal, visor and glow once. Each character costs one drawImage per frame. */
export function createCharacterSprites(): Record<Character, HTMLCanvasElement> {
  return Object.fromEntries(Object.entries(palette).map(([kind, [metal, light]]) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 192;
    const c = canvas.getContext("2d")!; c.scale(2, 2); c.translate(48, 48);
    const shape = (points: number[][]) => { c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); };
    const fill = (points: number[][], color: string | CanvasGradient, stroke?: string) => { shape(points); c.fillStyle = color; c.fill(); if(stroke) { c.strokeStyle=stroke; c.stroke(); } };
    const armor = c.createLinearGradient(-25,-29,29,28); armor.addColorStop(0,"#e7e9dd"); armor.addColorStop(.18,metal); armor.addColorStop(.43,"#4c5a60"); armor.addColorStop(.5,metal); armor.addColorStop(.59,"#39434c"); armor.addColorStop(1,"#101923");
    const aura = c.createRadialGradient(0,1,10,0,1,43); aura.addColorStop(0,light+"38"); aura.addColorStop(1,light+"00"); c.fillStyle=aura;c.fillRect(-46,-46,92,92);
    c.fillStyle="#0008";c.beginPath();c.ellipse(0,30,27,8,0,0,Math.PI*2);c.fill();
    c.lineWidth=1;
    if(kind === "phish") {
      fill([[-35,-9],[-20,-27],[-9,-10],[-15,20],[-33,10]],armor,metal);
      fill([[35,-9],[20,-27],[9,-10],[15,20],[33,10]],armor,metal);
    } else if(kind === "inject") {
      fill([[0,-39],[8,-23],[5,-10],[-5,-10],[-8,-23]],armor,light);
      fill([[-13,7],[-27,26],[-10,21],[0,13],[10,21],[27,26],[13,7]],armor,metal);
    } else {
      for(const side of [-1,1]) {
        c.save();c.scale(side,1);
        fill([[19,-18],[30,-12],[32,5],[24,16],[18,9]],armor,metal);
        c.fillStyle="#142029";c.fillRect(25,-7,4,11);c.fillStyle=light;c.fillRect(26,-5,2,4);
        fill([[7,20],[18,20],[20,31],[6,31]],armor,metal);
        c.restore();
      }
    }
    const body = kind==="inject" ? [[0,-25],[19,-9],[15,18],[0,28],[-15,18],[-19,-9]] : [[-14,-27],[14,-27],[24,-14],[23,16],[11,28],[-11,28],[-23,16],[-24,-14]];
    fill(body,armor,metal);
    fill([[-14,-20],[14,-20],[19,-10],[16,12],[0,21],[-16,12],[-19,-10]],"#09141e","#a0b4be66");
    const glass = c.createLinearGradient(-15,-18,12,13);glass.addColorStop(0,"#67939466");glass.addColorStop(.5,"#2b3b4e22");glass.addColorStop(1,"#04141b");
    fill([[-14,-18],[14,-18],[16,-8],[13,10],[0,18],[-13,10],[-16,-8]],glass);
    c.shadowColor=light;c.shadowBlur=8;
    fill([[-13,-7],[-3,-3],[-4,3],[-12,1]],light);
    fill([[13,-7],[3,-3],[4,3],[12,1]],light);
    c.shadowBlur=0;c.fillStyle="#fff9";c.fillRect(-11,-5,4,1);c.fillRect(7,-5,4,1);
    c.strokeStyle=light;c.lineWidth=1.3;c.beginPath();c.moveTo(-4,10);c.lineTo(0,12);c.lineTo(5,9);c.stroke();
    c.strokeStyle="#fff7";c.lineWidth=.7;c.beginPath();c.moveTo(-13,-25);c.lineTo(12,-25);c.lineTo(20,-14);c.stroke();
    for(const x of [-19,19])for(const y of [-12,15]){c.fillStyle="#14212d";c.beginPath();c.arc(x,y,1.8,0,7);c.fill();c.fillStyle="#a7b6b8";c.fillRect(x-.7,y-.7,1.4,.7);}
    if(kind==="sentinel"){
      c.strokeStyle=metal;c.lineWidth=3;c.beginPath();c.moveTo(0,-26);c.lineTo(0,-34);c.stroke();c.fillStyle=light;c.beginPath();c.arc(0,-36,3,0,7);c.fill();
      fill([[-34,2],[-22,-2],[-11,5],[-15,23],[-25,31],[-36,21]],armor,light);
      fill([[-31,6],[-23,3],[-16,8],[-19,21],[-25,25],[-31,18]],"#1d4c40",light);
      c.strokeStyle=light;c.lineWidth=2;c.beginPath();c.moveTo(-28,13);c.lineTo(-24,17);c.lineTo(-19,10);c.stroke();
      fill([[24,3],[36,-2],[39,4],[27,12]],armor,metal);c.fillStyle=light;c.fillRect(35,-1,4,5);
    } else if(kind==="ransom") {
      c.strokeStyle=light;c.lineWidth=2;c.beginPath();c.arc(0,-30,7,Math.PI,0);c.stroke();c.fillStyle=light;c.fillRect(-9,-30,18,7);
    } else if(kind==="zero") {
      fill([[-23,-18],[-29,-34],[-12,-26],[0,-37],[12,-26],[29,-34],[23,-18]],armor,light);
      c.fillStyle=light;c.beginPath();c.arc(0,-27,2.4,0,7);c.fill();
    } else if(kind==="ddos") {
      c.strokeStyle=light;c.lineWidth=1;
      for(const x of [-36,36]){c.beginPath();c.arc(x,0,7,-Math.PI/2,Math.PI/2,x<0);c.stroke();}
    }
    return [kind,canvas];
  })) as Record<Character, HTMLCanvasElement>;
}
