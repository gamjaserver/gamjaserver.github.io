import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { landtrap, wiretrap, traplockdoor, sleepgas, gasleak, gasnear, spawntrap } from './traps.js';
import { Player } from './player.js';
import { Mob } from './mobs.js';
import { GameMap } from './map.js';
import { handleTrapCollisions } from './interactions.js';

let scene, camera, renderer;
let physicsWorld;
const objects = [];
let playerInstance;
let particlesMaterial;
let gameMap;
let activeTraps = [];
let activeMobs = [];
let eventQueue;
let gui;
const debugCoords = { x: 0, y: 0, z: 0 };
let guiControllers = {};
let isGameOver = false;
let gameOverCamera = null;

window.gameMobs = activeMobs;

async function init() {
    initThree();
    await initPhysics();
    createmap();
    createParticles();
    createplayer();
    createmobs();
    createtraps();
    initDebugGUI();
    initGameOverListener();
    animate();
}

function initThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xaaa055, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xccccaa, 0.5);
    dirLight.position.set(10, 20, 15);
    scene.fog = new THREE.Fog(0x111111, 5, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (gameOverCamera) {
        gameOverCamera.aspect = window.innerWidth / window.innerHeight;
        gameOverCamera.updateProjectionMatrix();
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
}

async function initPhysics() {
    await RAPIER.init();
    physicsWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    eventQueue = new RAPIER.EventQueue(true);
}

function createmap() {
    gameMap = new GameMap(scene, physicsWorld);
    gameMap.createMap2();
}

function createParticles() {
    const particlesGeometry = new THREE.BufferGeometry();
    const count = 6000;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 200;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffffff,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    window.roomParticles = particles;
}

function createtraps() {
    const maindoor = new traplockdoor(28, 2.5, 80.5, 3, 1.5, scene, physicsWorld);
    const lastdoor = new traplockdoor(-12, 8, 2.25, 1, 1.5, scene, physicsWorld);
    const stairdoor = new traplockdoor(36.25, 2.5, -30.5, 3, 1.5, scene, physicsWorld);
    const door1 = new traplockdoor(5, 2.5, 65.75, 1, 1.5, scene, physicsWorld);
    
    activeTraps.push(maindoor, lastdoor, stairdoor, door1);
    new landtrap(-36, 5.6, 3, maindoor, scene, physicsWorld);
    new landtrap(82, 0.1, 46, door1, scene, physicsWorld);
    new landtrap(-79, 0.1, -24, lastdoor, scene, physicsWorld);
    new landtrap(3, 0.1, -57, stairdoor, scene, physicsWorld);

    const spawn1 = new spawntrap(-58, 1, 38, activeMobs, scene, physicsWorld);
    const spawn2 = new spawntrap(-10, 1, 66, activeMobs, scene, physicsWorld);
    activeTraps.push(spawn1, spawn2);

    new wiretrap(-40, 1.0, 28, 2, 54, spawn1, scene, physicsWorld);
    new wiretrap(-25, 1.0, 28, 2, 54, spawn2, scene, physicsWorld);
    new wiretrap(-18, 0.5, 36, 3, 33, spawn2, scene, physicsWorld);
    new wiretrap(-18, 4, 54, 3, 33, spawn2, scene, physicsWorld);
    new wiretrap(-44, 0, 49, 1, 33, spawn1, scene, physicsWorld);
    new wiretrap(-32, 0, 38, 1, 33, spawn1, scene, physicsWorld);
    new wiretrap(-21, 0, 72, 1, 33, spawn2, scene, physicsWorld);
    new wiretrap(-18, 2, 71, 3, 33, spawn2, scene, physicsWorld);

    const sleepEffect = new sleepgas(playerInstance, 5.0);
    activeTraps.push(
        new gasleak(-85.5, 0, -48.5, 1, 4.2, 7.8, sleepEffect, scene, physicsWorld),
        new gasleak(-68.5, 0, -65.5, 1, 1.5, 9.2, sleepEffect, scene, physicsWorld),
        new gasleak(-74.5, 0, -53.5, 1, 8.0, 3.1, sleepEffect, scene, physicsWorld),
        new gasleak(-91.5, 0, -43.5, 1, 0.5, 5.5, sleepEffect, scene, physicsWorld),
        new gasleak(-63.5, 0, -71.5, 1, 6.7, 2.4, sleepEffect, scene, physicsWorld),
        new gasleak(-79.5, 0, -60.5, 1, 3.3, 8.1, sleepEffect, scene, physicsWorld),
        new gasleak(-88.5, 0, -67.5, 1, 9.4, 1.0, sleepEffect, scene, physicsWorld),
        new gasleak(-71.5, 0, -49.5, 1, 5.1, 6.3, sleepEffect, scene, physicsWorld),
        new gasleak(-82.5, 0, -56.5, 1, 2.8, 4.7, sleepEffect, scene, physicsWorld),
        new gasleak(-92.5, 0, -72.5, 1, 7.2, 9.9, sleepEffect, scene, physicsWorld),
        new gasnear(64, 1.0, 23, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(95, 1.0, 12, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(74, 1.0, 30, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(68, 1.0, 2, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(88, 1.0, -9, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(68, 1.0, -21, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(100, 1.0, 0, 9, sleepEffect, scene, physicsWorld, playerInstance),
        new gasnear(75, 1.0, 15, 9, sleepEffect, scene, physicsWorld, playerInstance)
    );
}

function createmobs() {
    activeMobs.push(
        new Mob(3, 4, -57, scene, physicsWorld, 8),
        new Mob(-89, 4, 53, scene, physicsWorld, 10),
        new Mob(-89, 4, 22, scene, physicsWorld, 10)
    );
}

function createplayer() {
    playerInstance = new Player(15, 3, 75, scene, physicsWorld, camera);
}

function initDebugGUI() {
    gui = new GUI({ title: 'Player Debugger' });
    const folder = gui.addFolder('Position');
    guiControllers.x = folder.add(debugCoords, 'x').name('X Coords').listen().disable();
    guiControllers.y = folder.add(debugCoords, 'y').name('Y Coords').listen().disable();
    guiControllers.z = folder.add(debugCoords, 'z').name('Z Coords').listen().disable();
    folder.open();
}

function initGameOverListener() {
    window.addEventListener('player-caught', () => {
        if (isGameOver) return;
        isGameOver = true;
        document.exitPointerLock();
        createBlackRoom();
        setupGameOverCamera();
    });
}

function destroyParticles() {
    if (window.roomParticles) {
        scene.remove(window.roomParticles);
        if (window.roomParticles.geometry) window.roomParticles.geometry.dispose();
        if (particlesMaterial) particlesMaterial.dispose();
        window.roomParticles = null;
        particlesMaterial = null;
    }
}

function createBlackRoom() {
    const geometry = new THREE.BoxGeometry(8, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide });
    const blackBox = new THREE.Mesh(geometry, material);
    blackBox.position.set(0, -20, 0);
    scene.add(blackBox);
}

function setupGameOverCamera() {
    gameOverCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    gameOverCamera.position.set(0, -17.5, 3.5);
    gameOverCamera.lookAt(0, -20, 0);
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = 0.016;

    if (!isGameOver) {
        physicsWorld.step(eventQueue);
        handleTrapCollisions(physicsWorld, eventQueue, playerInstance);

        if (playerInstance) {
            playerInstance.update();
            if (playerInstance.body) {
                const pos = playerInstance.body.translation();
                debugCoords.x = pos.x; debugCoords.y = pos.y; debugCoords.z = pos.z;
            }
        }

        activeTraps = activeTraps.filter(trap => {
            if (!trap.isFinished) { trap.update(deltaTime); return true; }
            return false;
        });

        activeMobs = activeMobs.filter(mob => {
            if (!mob.isDead) { mob.update(playerInstance); return true; }
            return false;
        });
        window.gameMobs = activeMobs;

        objects.forEach((obj) => {
            const pos = obj.body.translation();
            const rot = obj.body.rotation();
            obj.mesh.position.set(pos.x, pos.y, pos.z);
            obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        });
    }

    if (particlesMaterial) {
        const time = performance.now() * 0.001;
        particlesMaterial.opacity = (Math.sin((time * Math.PI * 2) / 3) + 1) * 0.5;
    }

    if (isGameOver && gameOverCamera) {
        destroyParticles();
        renderer.render(scene, gameOverCamera);
    } else {
        renderer.render(scene, camera);
    }
}

init().catch(err => {});