import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import getStarfield from "./js/getStarfield.js";
import { getFresnelMat } from "./js/getFresnelMat.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,0,6);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
THREE.ColorManagement.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

scene.add(new THREE.DirectionalLight(0xffffff,3));
scene.add(new THREE.AmbientLight(0x333333));

const earthGroup = new THREE.Group();
scene.add(earthGroup);

const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1,14);
earthGroup.add(new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({map: loader.load("./images/earthmap.jpg")})));
earthGroup.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map: loader.load("./images/earth_lights.png"), blending:THREE.AdditiveBlending})));
const cloudsMesh = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map: loader.load("./images/cloud_combined.jpg"),transparent:true,opacity:0.8,blending:THREE.AdditiveBlending}));
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);
earthGroup.add(new THREE.Mesh(geometry,getFresnelMat()));

scene.add(getStarfield({numStars:5000}));

function clamp(val,min,max){return Math.min(Math.max(val,min),max);}
function latLonToXYZ(latDeg,lonDeg,radius=1){
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return new THREE.Vector3(x,y,z);
}
const egyptPos = latLonToXYZ(26,30,1);

let meteorMesh, meteorVelocity, meteorActive=false;
let explosions=[], shockwaves=[];
let params={mass:1e8, velocity:20000, strength:1e7};

document.getElementById("simulateBtn").onclick=()=>{
  params.mass = clamp(parseFloat(document.getElementById("mass").value),1e6,1e12);
  params.velocity = clamp(parseFloat(document.getElementById("velocity").value),11000,72000);
  params.strength = clamp(parseFloat(document.getElementById("strength").value),1e6,1e9);
  simulate();
};

function spawnMeteor(){
  if(meteorMesh) scene.remove(meteorMesh);
  const geo = new THREE.SphereGeometry(0.05,16,16);
  meteorMesh = new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xff5500,emissive:0xff3300,emissiveIntensity:1}));
  meteorMesh.position.set(2,2,2);
  scene.add(meteorMesh);
  const dir = egyptPos.clone().sub(meteorMesh.position).normalize();
  const speed = params.velocity / 1e6;
  meteorVelocity = dir.multiplyScalar(speed);
}
function simulate(){ spawnMeteor(); meteorActive=true; }

function createExplosion(position){
  const particleCount = 3000;
  const positions = new Float32Array(particleCount*3);
  const colors = new Float32Array(particleCount*3);

  for(let i=0;i<particleCount;i++){
    const theta = Math.random()*Math.PI*2;
    const phi = Math.acos(2*Math.random()-1);
    const r = 0.05 + Math.random()*0.05;
    positions[i*3] = position.x + r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1] = position.y + r*Math.sin(phi)*Math.sin(theta);
    positions[i*3+2] = position.z + r*Math.cos(phi);
    const c = new THREE.Color(1,0.2,0);
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
  const mat = new THREE.PointsMaterial({size:0.02,vertexColors:true,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
  const points = new THREE.Points(geo,mat);
  scene.add(points);

  let life=120,alive=true;
  function update(){ if(!alive) return; mat.opacity = life/120; if(life-- <=0){alive=false;scene.remove(points);} }
  explosions.push({update,isAlive:()=>alive});

  const geo2 = new THREE.SphereGeometry(0.1,32,32);
  const mat2 = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const shock = new THREE.Mesh(geo2,mat2);
  shock.position.copy(position);
  scene.add(shock);
  let shockLife=60,shockScale=0.1;
  function updateShock(){
    shock.scale.setScalar(shockScale);
    mat2.opacity = (shockLife/60)*0.5;
    shockScale += 0.03;
    shockLife--;
    if(shockLife<=0) scene.remove(shock);
  }
  shockwaves.push({update:updateShock,isAlive:()=>shockLife>0});

  setTimeout(flashScreen,1000);
}

function flashScreen(){
  const overlay = document.createElement("div");
  overlay.style.position="absolute";
  overlay.style.top=0;
  overlay.style.left=0;
  overlay.style.width="100%";
  overlay.style.height="100%";
  overlay.style.background="white";
  overlay.style.opacity="1";
  overlay.style.pointerEvents="none";
  overlay.style.zIndex="1000";
  document.body.appendChild(overlay);

  let opacity = 1;
  const fadeDuration = 1000;
  const fadeStep = 16;
  const fadeInterval = setInterval(()=>{
    opacity -= fadeStep/fadeDuration;
    if(opacity <= 0){
      document.body.removeChild(overlay);
      clearInterval(fadeInterval);
    } else overlay.style.opacity = opacity.toString();
  }, fadeStep);
}

function animate(){
  requestAnimationFrame(animate);
  if(meteorActive){
    meteorMesh.position.add(meteorVelocity);
    if(meteorMesh.position.distanceTo(egyptPos)<0.05){
      createExplosion(egyptPos.clone());
      scene.remove(meteorMesh);
      meteorActive=false;
    }
  }
  explosions.forEach(e=>e.update());
  explosions = explosions.filter(e=>e.isAlive());
  shockwaves.forEach(s=>s.update());
  shockwaves = shockwaves.filter(s=>s.isAlive());
  controls.update();
  renderer.render(scene,camera);
}

animate();

window.addEventListener("resize",()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});
