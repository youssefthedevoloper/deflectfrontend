import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Scene + Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0,0,3);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5,5,5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x555555));

// Texture Loader
const loader = new THREE.TextureLoader();

// Earth
const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({
  map: loader.load("https://threejs.org/examples/textures/land_ocean_ice_cloud_2048.jpg")
});
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// Clouds
const cloudsGeometry = new THREE.SphereGeometry(1.005, 64, 64); // Slightly larger
const cloudsMaterial = new THREE.MeshStandardMaterial({
  map: loader.load("https://threejs.org/examples/textures/cloud.png"),
  transparent: true,
  opacity: 0.6
});
const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
scene.add(clouds);

// Atmosphere Glow
const atmosphereGeometry = new THREE.SphereGeometry(1.1, 64, 64);
const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: {
    'c': { value: 0.2 },
    'p': { value: 2.0 },
    glowColor: { value: new THREE.Color(0x00aaff) },
    viewVector: { value: camera.position }
  },
  vertexShader: `
    uniform vec3 viewVector;
    uniform float c;
    uniform float p;
    varying float intensity;
    void main() {
      vec3 vNormal = normalize( normalMatrix * normal );
      vec3 vNormel = normalize( normalMatrix * viewVector );
      intensity = pow( c - dot(vNormal, vNormel), p );
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: `
    uniform vec3 glowColor;
    varying float intensity;
    void main() {
      vec3 glow = glowColor * intensity;
      gl_FragColor = vec4( glow, 1.0 );
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true
});
const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphere);

// Starfield Background
const starGeometry = new THREE.BufferGeometry();
const starMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.05
});

const starVertices = [];
for (let i = 0; i < 10000; i++) {
  const x = THREE.MathUtils.randFloatSpread(2000);
  const y = THREE.MathUtils.randFloatSpread(2000);
  const z = THREE.MathUtils.randFloatSpread(2000);
  starVertices.push(x, y, z);
}
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Animate
function animate() {
  requestAnimationFrame(animate);
  earth.rotation.y += 0.001;
  clouds.rotation.y += 0.0015; // Rotate clouds slightly faster
  atmosphere.rotation.y += 0.0005; // Atmosphere rotates with the globe, but slightly differently for a dynamic effect
  controls.update();
  renderer.render(scene, camera);
}
animate();