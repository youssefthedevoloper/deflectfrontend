import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import getStarfield from "./js/getStarfield.js";
import { getFresnelMat } from "./js/getFresnelMat.js";

// ---------- Scene & Camera ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,0,6);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
THREE.ColorManagement.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

// ---------- Controls ----------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ---------- Lights ----------
scene.add(new THREE.DirectionalLight(0xffffff,3));
scene.add(new THREE.AmbientLight(0x333333));

// ---------- Earth Group ----------
const earthGroup = new THREE.Group();
scene.add(earthGroup);

const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1,14);

const earthMesh = new THREE.Mesh(
  geometry,
  new THREE.MeshPhongMaterial({map: loader.load("./images/earthmap.jpg")})
);
earthGroup.add(earthMesh);

earthGroup.add(new THREE.Mesh(
  geometry,
  new THREE.MeshBasicMaterial({map: loader.load("./images/earth_lights.png"), blending:THREE.AdditiveBlending})
));

const cloudsMesh = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({map: loader.load("./images/cloud_combined.jpg"),transparent:true,opacity:0.8,blending:THREE.AdditiveBlending})
);
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

earthGroup.add(new THREE.Mesh(geometry,getFresnelMat()));
scene.add(getStarfield({numStars:5000}));

// ---------- Helpers ----------
function clamp(val,min,max){return Math.min(Math.max(val,min),max);}
function latLonToXYZ(latDeg,lonDeg,radius=1){
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  return new THREE.Vector3(x,y,z);
}

// ---------- Variables ----------
let targetPos = latLonToXYZ(26,30,1);
let meteorMesh=null, meteorVelocity=new THREE.Vector3(), meteorActive=false;
let explosions=[], shockwaves=[], rings=[];
let params={mass:1e8, velocity:20000, strength:1e7};
let deflectorMesh=null, markerMesh=null, deflecting=false;

// ---------- Event Handlers ----------
document.getElementById("simulateBtn").onclick=()=>{
  params.mass = clamp(parseFloat(document.getElementById("mass").value),1e6,1e12);
  params.velocity = clamp(parseFloat(document.getElementById("velocity").value),11000,72000);
  params.strength = clamp(parseFloat(document.getElementById("strength").value),1e6,1e9);
  spawnMeteor();
};

document.getElementById("deflectBtn").onclick=()=>{
  if(meteorActive && meteorMesh){
    const distanceToEarth = meteorMesh.position.distanceTo(targetPos);
    const minDistance = 0.5; // منع الانحراف إذا قريب جدًا
    if(distanceToEarth < minDistance){
        alert("Too late to deflect! The meteor is too close to Earth!");
        return;
    }

    deflecting = true;
    const deltaV = 0.01 * (params.velocity/20000) * (1e8/params.mass);
    const perpendicular = new THREE.Vector3().crossVectors(meteorVelocity, new THREE.Vector3(0,1,0)).normalize();
    meteorVelocity.add(perpendicular.multiplyScalar(deltaV));

    if(deflectorMesh) scene.remove(deflectorMesh);
    const geo = new THREE.ConeGeometry(0.07,0.15,8);
    const mat = new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:2});
    deflectorMesh = new THREE.Mesh(geo,mat);
    deflectorMesh.position.copy(meteorMesh.position.clone().add(new THREE.Vector3(0.2,0.2,0.2)));
    deflectorMesh.lookAt(meteorMesh.position);
    scene.add(deflectorMesh);

    // نقطة الاصطدام بعد الانحراف
    const ray = new THREE.Raycaster(meteorMesh.position, meteorVelocity.clone().normalize());
    const intersects = ray.intersectObject(earthMesh);
    if(intersects.length>0){
        console.log("Predicted impact point:", intersects[0].point);
    }
  }
};

// ---------- Mouse click for target ----------
window.addEventListener("click",(event)=>{
  const mouse = new THREE.Vector2((event.clientX/window.innerWidth)*2-1,-(event.clientY/window.innerHeight)*2+1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse,camera);
  const intersects = ray.intersectObject(earthMesh);
  if(intersects.length>0){
    targetPos = intersects[0].point.clone();
    if(markerMesh) scene.remove(markerMesh);
    const geo = new THREE.SphereGeometry(0.02,8,8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    markerMesh = new THREE.Mesh(geo, mat);
    markerMesh.position.copy(targetPos);
    scene.add(markerMesh);
  }
});

// ---------- Spawn Meteor ----------
function spawnMeteor(){
  if(meteorMesh) scene.remove(meteorMesh);
  const geo = new THREE.SphereGeometry(0.05,16,16);
  meteorMesh = new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xff5500,emissive:0xff3300,emissiveIntensity:1}));
  meteorMesh.position.set(targetPos.x+2,targetPos.y+2,targetPos.z+2);
  scene.add(meteorMesh);
  const dir = targetPos.clone().sub(meteorMesh.position).normalize();
  meteorVelocity = dir.multiplyScalar(0.02);
  meteorActive=true;
}

// ---------- Explosion ----------
function createExplosion(position){
  const particleCount=3000;
  const positions = new Float32Array(particleCount*3);
  const colors = new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){
    const theta=Math.random()*Math.PI*2;
    const phi=Math.acos(2*Math.random()-1);
    const r=0.05+Math.random()*0.05;
    positions[i*3]=position.x+r*Math.sin(phi)*Math.cos(theta);
    positions[i*3+1]=position.y+r*Math.sin(phi)*Math.sin(theta);
    positions[i*3+2]=position.z+r*Math.cos(phi);
    const c=new THREE.Color(1,0.2,0);
    colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geo.setAttribute("color",new THREE.BufferAttribute(colors,3));
  const mat = new THREE.PointsMaterial({size:0.02,vertexColors:true,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
  const points = new THREE.Points(geo,mat);
  scene.add(points);

  let life=120,alive=true;
  function update(){ 
    if(!alive) return; 
    mat.opacity=life/120; 
    if(life--<=0){ 
      alive=false; scene.remove(points); 
    } 
  }
  explosions.push({update,isAlive:()=>alive});
}

// ---------- Animate ----------
function animate(){
  requestAnimationFrame(animate);

  if(meteorActive && meteorMesh){
    meteorMesh.position.add(meteorVelocity);
    if(meteorMesh.position.distanceTo(targetPos)<0.05){
      createExplosion(targetPos.clone());
      scene.remove(meteorMesh);
      meteorActive=false;
    }
  }

  explosions.forEach(e=>e.update());
  explosions=explosions.filter(e=>e.isAlive());

  controls.update();
  renderer.render(scene,camera);
}

animate();

// ---------- Handle Resize ----------
window.addEventListener("resize",()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});