// 01-getting-started.js
// - import add-ons
// - default export vs named export
// - scene, background
// - camera, PerspectiveCamera
// - Setting a position
// - renderer: antialiasing, outputColorSpace, enabling shadowMap, shadowMap type, 
// - renderer: setting size, setting clearColor, append renderer to html document
// - stats object
// - orbitControls object: damping
// - GUI value input
// - resize event listener
// - AxesHelper
// - GridHelper
// - ambient light
// - directional light, how to change the target of directional light, casting shadow
// - Mesh = geometry + material
// - cubeGeometry, torusKnotGeometry, planeGeometry, casting shadows, receiving shadows
// - MeshLambertMaterial, MeshPhongMaterial
// - rotation transformation
// - requestAnimationFrame

// main three.module.js library
import * as THREE from 'three';  

// addons: OrbitControls (jsm/controls), Stats (jsm/libs), GUI (jsm/libs)
//
// module default export & import (library에서 export하는 것이 하나뿐인 경우):
//             export default function myFunction() { ... }
//             import myFunction from './myModule'; // 중괄호 없이 import
//
// module named export & import:
//             export myFunction() { ... };
//             export const myVariable = 42;
//             import { myFunction, myVariable } from './myModule'; // 중괄호 사용

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const textureLoader = new THREE.TextureLoader();

const MercuryT = textureLoader.load('./Mercury.jpg');
const VenusT = textureLoader.load('./Venus.jpg');
const EarthT = textureLoader.load('./Earth.jpg');
const MarsT = textureLoader.load('./Mars.jpg');

// main scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);  // white background

// Perspective camera: fov, aspect ratio, near, far
let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// set camera position: camera.position.set(-3, 8, 2) 가 더 많이 사용됨 (약간 빠름))
camera.position.x = 0;
camera.position.y = 60;
camera.position.z = 100;

// add camera to the scene
scene.add(camera);

// setup the renderer
// antialias = true: 렌더링 결과가 부드러워짐
const renderer = new THREE.WebGLRenderer({ antialias: true });

// outputColorSpace의 종류
// sRGBColorSpace: 보통 monitor에서 보이는 color로, 어두운 부분을 약간 밝게 보이게 Gamma correction을 함
// sRGBColorSpace는 PBR (Physically Based Rendering), HDR(High Dynamic Range)에서는 필수적으로 사용함
// LinearColorSpace: 모든 색상을 선형으로 보이게 함
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.shadowMap.enabled = true; // scene에서 shadow를 보이게

// shadowMap의 종류
// BasicShadowMap: 가장 기본적인 shadow map, 쉽고 빠르지만 부드럽지 않음
// PCFShadowMap (default): Percentage-Closer Filtering, 주변의 색상을 평균내서 부드럽게 보이게 함
// PCFSoftShadowMap: 더 부드럽게 보이게 함
// VSMShadowMap: Variance Shadow Map, 더 자연스러운 블러 효과, GPU에서 더 많은 연산 필요
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 현재 열린 browser window의 width와 height에 맞게 renderer의 size를 설정
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff);
// attach renderer to the body of the html page
document.body.appendChild(renderer.domElement);

// add Stats: 현재 FPS를 보여줌으로써 rendering 속도 표시
const stats = new Stats();
// attach Stats to the body of the html page
document.body.appendChild(stats.dom);

// add OrbitControls: arcball-like camera control
let orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true; // 관성효과, 바로 멈추지 않고 부드럽게 멈춤
orbitControls.dampingFactor = 0.05; // 감속 정도, 크면 더 빨리 감속, default = 0.05

// add GUI: 간단한 user interface를 제작 가능
// 사용법은 https://lil-gui.georgealways.com/ 
// http://yoonbumtae.com/?p=942 참고

let Mercury_orbitstep = 0;
let Venus_orbitstep = 0;
let Earth_orbitstep = 0;
let Mars_orbitstep = 0;

const gui = new GUI();
const props = {
    Mercury_rotatespeed : 0.02,
    Mercury_orbitspeed : 0.02,
    Venus_rotatespeed : 0.015,
    Venus_orbitspeed : 0.015,
    Earth_rotatespeed : 0.01,
    Earth_orbitspeed : 0.01,
    Mars_rotatespeed : 0.008,
    Mars_orbitspeed : 0.008
};


const controls = new function () {
    this.perspective = "Perspective";
    this.switchCamera = function () {
        if (camera instanceof THREE.PerspectiveCamera) {
            scene.remove(camera);
            camera = null; // 기존의 camera 제거    
            // OrthographicCamera(left, right, top, bottom, near, far)
            camera = new THREE.OrthographicCamera(window.innerWidth / -16, 
                window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / -16, -200, 500);
            camera.position.x = 120;
            camera.position.y = 60;
            camera.position.z = 180;
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.perspective = "Orthographic";
        } else {
            scene.remove(camera);
            camera = null; 
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.x = 120;
            camera.position.y = 60;
            camera.position.z = 180;
            camera.lookAt(scene.position);
            orbitControls.dispose(); // 기존의 orbitControls 제거
            orbitControls = null;
            orbitControls = new OrbitControls(camera, renderer.domElement);
            orbitControls.enableDamping = true;
            this.perspective = "Perspective";
        }
    };
};

const folder1 = gui.addFolder('Camera');
const folder2 = gui.addFolder('Mercury');
const folder3 = gui.addFolder('Venus');
const folder4 = gui.addFolder('Earth');
const folder5 = gui.addFolder('Mars');

folder1.add(controls, 'switchCamera');
folder1.add(controls, 'perspective').listen();
folder2.add(props, 'Mercury_rotatespeed', 0, 0.2, 0.01).name('Rotation Speed');
folder2.add(props, 'Mercury_orbitspeed', 0, 0.2, 0.01).name('Orbit Speed');
folder3.add(props, 'Venus_rotatespeed', 0, 0.2, 0.01).name('Rotation Speed');
folder3.add(props, 'Venus_orbitspeed', 0, 0.2, 0.01).name('Orbit Speed');
folder4.add(props, 'Earth_rotatespeed', 0, 0.2, 0.01).name('Rotation Speed');
folder4.add(props, 'Earth_orbitspeed', 0, 0.2, 0.01).name('Orbit Speed');
folder5.add(props, 'Mars_rotatespeed', 0, 0.2, 0.01).name('Rotation Speed');
folder5.add(props, 'Mars_orbitspeed', 0, 0.2, 0.01).name('Orbit Speed');


// listen to the resize events
window.addEventListener('resize', onResize, false);
function onResize() { // resize handler
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// axes helper: x, y, z 축을 보여줌 (red, green, blue 순서))
const axesHelper = new THREE.AxesHelper(10); // 10 unit 길이의 축을 보여줌
scene.add(axesHelper);

// GridHelper: xz plane에 grid를 보여줌
const gridHelper = new THREE.GridHelper(10, 7); // size: 10, division: 7
scene.add(gridHelper);

// add ambient light
const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// add directional light
const dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(5, 12, 8); // 여기서 부터 (0, 0, 0) 방향으로 light ray 방향
dirLight.castShadow = true;  // 이 light가 shadow를 만들어 낼 것임
scene.add(dirLight);


const SunG = new THREE.SphereGeometry(10,32,32);
const SunM = new THREE.MeshBasicMaterial({color: 0xffff00});
const Sun = new THREE.Mesh(SunG,SunM);
scene.add(Sun);

const MercuryG = new THREE.SphereGeometry(1.5,32,32);
const MercuryM = new THREE.MeshPhongMaterial({color: '#a6a6a6', map : MercuryT});
const Mercury = new THREE.Mesh(MercuryG,MercuryM);
scene.add(Mercury);

const VenusG = new THREE.SphereGeometry(3,32,32);
const VenusM = new THREE.MeshPhongMaterial({color: '#e39e1c' , map : VenusT});
const Venus = new THREE.Mesh(VenusG,VenusM);
scene.add(Venus);

const EarthG = new THREE.SphereGeometry(3.5,32,32);
const EarthM = new THREE.MeshPhongMaterial({color: '#3498db' , map : EarthT});
const Earth = new THREE.Mesh(EarthG,EarthM);
scene.add(Earth);

const MarsG = new THREE.SphereGeometry(2.5,32,32);
const MarsM = new THREE.MeshPhongMaterial({color: '#c0392b' , map : MarsT});
const Mars = new THREE.Mesh(MarsG,MarsM);
scene.add(Mars);

let step = 0;

function animate() {

    // stats와 orbitControls는 매 frame마다 update 해줘야 함
    stats.update();
    orbitControls.update();

    
    Mercury_orbitstep += props.Mercury_orbitspeed;
    Mercury.position.x = 20 * Math.cos(Mercury_orbitstep);
    Mercury.position.z = 20 * Math.sin(Mercury_orbitstep);

    
    Venus_orbitstep += props.Venus_orbitspeed;
    Venus.position.x = 35 * Math.cos(Venus_orbitstep);
    Venus.position.z = 35 * Math.sin(Venus_orbitstep);

    
    Earth_orbitstep += props.Earth_orbitspeed;
    Earth.position.x = 50 * Math.cos(Earth_orbitstep);
    Earth.position.z = 50 * Math.sin(Earth_orbitstep);

    
    Mars_orbitstep += props.Mars_orbitspeed;
    Mars.position.x = 65 * Math.cos(Mars_orbitstep);
    Mars.position.z = 65 * Math.sin(Mars_orbitstep);

    // cube의 rotation transformation (model transformation)
    // 각각 x, y, z 축을 기준으로 하는 rotation angle (radian)

    Mercury.rotation.x += props.Mercury_rotatespeed;
    Mercury.rotation.z += props.Mercury_rotatespeed;

    Venus.rotation.x += props.Venus_rotatespeed;
    Venus.rotation.z += props.Venus_rotatespeed;

    Earth.rotation.x += props.Earth_rotatespeed;
    Earth.rotation.z += props.Earth_rotatespeed;

    Mars.rotation.x += props.Mars_rotatespeed;
    Mars.rotation.z += props.Mars_rotatespeed;

    orbitControls.update();
    stats.update();
    // 모든 transformation 적용 후, renderer에 렌더링을 한번 해 줘야 함
    renderer.render(scene, camera);

    // 다음 frame을 위해 requestAnimationFrame 호출 
    requestAnimationFrame(animate);

}

animate();






