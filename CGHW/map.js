import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { landtrap, wiretrap, traplockdoor, sleepgas, gasleak, gasnear } from './traps.js';
import { blueprint, blueprint1 } from './mapdata.js';

export class GameMap {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.textureLoader = new THREE.TextureLoader();

        this.textures = {
            floor: this.textureLoader.load('./assets/Floor.png'),
            floorNormal: this.textureLoader.load('./assets/Floor_normal.png'),
            wall: this.textureLoader.load('./assets/Wall.png'),
            wallNormal: this.textureLoader.load('./assets/Wall_normal.png'),
            wood: this.textureLoader.load('./assets/Wood.png'),
            woodNormal: this.textureLoader.load('./assets/Wood_normal.png')
        };

        const setupTexture = (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
        };
        Object.values(this.textures).forEach(setupTexture);

        this.textures.wall.repeat.set(3, 6);
        this.textures.wallNormal.repeat.set(3, 6);
    }

    makeGround(x, y, z) {
        const width = 6 * x;
        const height = 1;
        const depth = 6 * z;
        const tileSize = 5;

        this.textures.floor.repeat.set(width / tileSize, depth / tileSize);
        this.textures.floorNormal.repeat.set(width / tileSize, depth / tileSize);

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhongMaterial({
            map: this.textures.floor,
            normalMap: this.textures.floorNormal,
            shininess: 10
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, y, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, y, 0);
        const rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
        this.physicsWorld.createCollider(colliderDesc, rigidBody);
    }

    makeWall(gridX, gridY, gridZ) {
        const width = 4;
        const height = 6;
        const depth = 4;
        const worldX = 4 * gridX;
        const worldY = 5 * gridY;
        const worldZ = 4 * gridZ;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshPhongMaterial({
            map: this.textures.wall,
            normalMap: this.textures.wallNormal,
            shininess: 5
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(worldX, worldY, worldZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(worldX, worldY, worldZ);
        const rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
        this.physicsWorld.createCollider(colliderDesc, rigidBody);
    }

    makeLight(worldX, worldY, worldZ) {
        const geometry = new THREE.BoxGeometry(2, 0.2, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(worldX, worldY, worldZ);
        this.scene.add(this.mesh);

        const pointLight = new THREE.PointLight(0xffffff, 100);
        pointLight.position.set(worldX, worldY, worldZ);
        this.scene.add(pointLight);
    }

    makespotLight(worldX, worldY, worldZ) {
        const geometry = new THREE.BoxGeometry(2, 0.2, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(worldX, worldY, worldZ);
        this.scene.add(this.mesh);

        const spotLight = new THREE.SpotLight(0xffffff, 100);
        spotLight.angle = Math.PI / 6;
        spotLight.position.set(worldX, worldY, worldZ);
        spotLight.target.position.set(worldX, worldY - 6, worldZ);

        this.scene.add(spotLight.target);
        this.scene.add(spotLight);
    }

    makeSlopePlatform() {
        const minX = 34.5, maxX = 37.5;
        const minY = -0.5, maxY = 5.5;
        const minZ = -24.0, maxZ = -12.0;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        const angleX = Math.atan2(sizeY, sizeZ);
        const planeLength = Math.sqrt(sizeZ * sizeZ + sizeY * sizeY);

        const geometry = new THREE.BoxGeometry(sizeX, 0.5, planeLength);
        const material = new THREE.MeshPhongMaterial({
            map: this.textures.wood,
            normalMap: this.textures.woodNormal,
            shininess: 5
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(centerX, centerY, centerZ);
        mesh.rotation.x = -angleX;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const hX = sizeX / 2;
        const hY = 0.25;
        const hZ = planeLength / 2;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(centerX, centerY, centerZ);
        const rigidBody = this.physicsWorld.createRigidBody(bodyDesc);
        const threeQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-angleX, 0, 0));
        
        rigidBody.setRotation({
            x: threeQuaternion.x,
            y: threeQuaternion.y,
            z: threeQuaternion.z,
            w: threeQuaternion.w
        }, true);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(hX, hY, hZ);
        this.physicsWorld.createCollider(colliderDesc, rigidBody);
    }

    createMap() {
        this.makeGround(10, -0.5, 10);
        this.makeWall(2, 0.5, 2);
        this.makeWall(-2, 0.5, 2);
        this.makeWall(0, 0.5, -3);
    }

    createMap2() {
        this.blueprint = blueprint;
        const rows = blueprint.length;
        const cols = blueprint[0].length;

        this.makeGround(cols, -0.5, rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (blueprint[r][c] === 1) {
                    this.makeWall(c - (cols / 2), 0.5, r - (rows / 2));
                }
            }
        }

        this.blueprint = blueprint1;
        const rows1 = blueprint1.length;
        const cols1 = blueprint1[0].length;

        this.makeGround(cols1, 12, rows1);

        for (let r = 0; r < rows1; r++) {
            for (let c = 0; c < cols1; c++) {
                if (blueprint1[r][c] === 1) {
                    this.makeWall(c - (cols1 / 2), 1.7, r - (rows1 / 2));
                }
            }
        }

        const lights = [
            [26, 11.55, 62], [36, 11.55, 62], [16, 11.55, 62], [-35, 11.55, 65],
            [83, 11.55, 0], [-78, 11.55, -15], [-80, 11.55, -54], [80, 11.55, -54],
            [11, 11.55, 2], [36, 11.55, 2], [36, 11.55, 25], [0, 11.55, -19],
            [17, 11.55, -19], [85, 11.55, 66], [85, 11.55, 40]
        ];
        lights.forEach(l => this.makeLight(...l));

        this.makespotLight(3, 11.55, -57);
        this.makespotLight(-36, 11.55, 3);
        this.makeSlopePlatform();
    }
}