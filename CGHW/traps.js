import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { registerTrap, unregisterTrap } from './interactions.js';
import { Player } from './player.js';
import { Mob } from './mobs.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const textureLoader = new THREE.TextureLoader();
const buttonNormalMap = textureLoader.load('./assets/Button.png');

// 지형 발동 트리거
export class landtrap {
    constructor(x, y, z, trap, scene, physicsWorld){
        this.trap = trap;
        this.isTriggered = false;

        // 외형 설정
        const geometry = new THREE.BoxGeometry(2, 0.2, 2);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x222223,        
            specular: 0x333333,     
            shininess: 7,          
            normalMap: buttonNormalMap,       
            normalScale: new THREE.Vector2(1.5, 1.5) 
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y, z);

        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        scene.add(this.mesh);

        // 물리 설정
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z); 
        this.rigidBody = physicsWorld.createRigidBody(bodyDesc);                
        
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1.0, 1).setSensor(true);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidBody);
        
        registerTrap(this.collider.handle, this);
    }

    _catch(){
        this.trap._trigger();
        this.isTriggered = true;
        this.mesh.position.y -= 0.15;
    }

    _release(){
        this.mesh.position.y += 0.15;
        this.isTriggered = false;
    }
}

// 와이어 감지 트리거
export class wiretrap {
    constructor(x, y, z, axis, length, trap, scene, physicsWorld) {
        this.physicsWorld = physicsWorld;
        this.trap = trap;

        let size = new THREE.Vector3(0.05, 0.05, 0.05);
        let offset = new THREE.Vector3(0, 0, 0);

        switch(axis) {
            case 0: size.x = length; offset.x = length / 2; break;  
            case 1: size.y = length; offset.y = length / 2; break;  
            case 2: size.z = length; offset.z = length / 2; break;  
            case 3: size.x = length; offset.x = -length / 2; break; 
            case 4: size.y = length; offset.y = -length / 2; break; 
            case 5: size.z = length; offset.z = -length / 2; break; 
        }

        const finalX = x + offset.x;
        const finalY = y + offset.y;
        const finalZ = z + offset.z;

        // 외형 설정
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(finalX, finalY, finalZ);
        scene.add(this.mesh); 

        // 물리 설정
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(finalX, finalY, finalZ);
        this.rigidBody = physicsWorld.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setSensor(true);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidBody);
        
        registerTrap(this.collider.handle, this);
    }

    _catch() {
        this.trap._trigger();
        this.mesh.visible = false;
        
        // 해제 및 제거
        if (this.collider) {
            unregisterTrap(this.collider.handle); 
            this.physicsWorld.removeCollider(this.collider, false);
        }
        if (this.rigidBody) {
            this.physicsWorld.removeRigidBody(this.rigidBody);
        }

        this.collider = null;
        this.rigidBody = null;
    }
}

// 철창문 기믹
export class traplockdoor {
    constructor(x, y, z, axis, size, scene, physicsWorld) {
        this.physicsWorld = physicsWorld; 
        this.isOpen = false;
        this.isFinished = false;

        this.originY = y;
        this.targetY = y + 5 * size; 
        this.currentY = y;
        this.openSpeed = 8.0; 

        let rotationY = 0;
        if (axis === 1) rotationY = Math.PI / 2;

        // 외형 설정
        const geometry = new THREE.BoxGeometry(3*size, 5*size, 0.5*size);
        this.material = new THREE.MeshStandardMaterial({ 
            color: 0x444444,
            normalMap: buttonNormalMap,       
            normalScale: new THREE.Vector2(1.0, 1.0)
        });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(x, y, z);
        this.mesh.rotation.y = rotationY;
        scene.add(this.mesh); 

        // 물리 설정
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(x, y, z)
            .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

        this.rigidBody = physicsWorld.createRigidBody(bodyDesc); 
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1.5*size, 2.5*size, 0.25*size);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    _trigger() {
        if (this.isOpen) return;
        this.isOpen = true;
    }

    update(deltaTime) {
        if (!this.isOpen || this.isFinished) return;
        
        if (this.currentY < this.targetY) {
            this.currentY += this.openSpeed * deltaTime;
            
            if (this.currentY >= this.targetY) {
                this.currentY = this.targetY;
                this.isFinished = true; 
                
                // 제거
                if (this.collider) {
                    this.physicsWorld.removeCollider(this.collider, false);
                }
                if (this.rigidBody) {
                    this.physicsWorld.removeRigidBody(this.rigidBody);
                }
                this.collider = null;
                this.rigidBody = null;
            }

            if (!this.isFinished) {
                const pos = this.rigidBody.translation();
                this.rigidBody.setNextKinematicTranslation({ x: pos.x, y: this.currentY, z: pos.z });
            }
            this.mesh.position.y = this.currentY;
        }
    }
}

// 몹 소환 함정
export class spawntrap {
    constructor(x, y, z, activeMobsRef, scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.x = x;
        this.y = y;
        this.z = z;
        this.isTriggered = false;
        this.activeMobsRef = activeMobsRef; 
        this.isFinished = false;
    }

    _trigger() {
        if (this.isTriggered) return;
        this.isTriggered = true;

        const spawnedZombie = new Mob(this.x, this.y, this.z, this.scene, this.physicsWorld, 8);
        spawnedZombie.hasSpotted = true; 

        if (window.gameMobs) {
            window.gameMobs.push(spawnedZombie);
        }

        this.isFinished = true;
    }

    update(deltaTime) {}
}

// 수면 가스 효과
export class sleepgas {
    constructor(playerInstance, time) {
        this.player = playerInstance;
        this.time = time;
    }

    _trigger() {
        if (this.player && typeof this.player.gassed === 'function') {
            this.player.gassed(this.time); 
        }
    }
}

// 가스 분출 장치
export class gasleak {
    constructor(x, y, z, axis, time, repeat, gas, scene, physicsWorld) {
        this.physicsWorld = physicsWorld; 
        this.gas = gas;
        this.time = time;         
        this.repeat = repeat;     
        
        this.isActive = true;     
        this.timer = time;        

        let offset = new THREE.Vector3(0, 0, 0);
        switch(axis) {
            case 0: offset.x = 0.5; break;  
            case 1: offset.y = 0.25; break; 
            case 2: offset.z = 0.5; break;  
            case 3: offset.x = -0.5; break; 
            case 4: offset.y = -0.25; break;
            case 5: offset.z = -0.5; break; 
        }

        this.finalX = x + offset.x;
        this.finalY = y + offset.y;
        this.finalZ = z + offset.z;

        // 외형 설정
        const geometry = new THREE.BoxGeometry(2, 7, 2);
        this.material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.6 
        });
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(this.finalX, this.finalY, this.finalZ);
        scene.add(this.mesh); 

        this._createCollider();
    }

    _createCollider() {
        const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 3.5, 1)
            .setTranslation(this.finalX, this.finalY, this.finalZ)
            .setSensor(true);
        this.collider = this.physicsWorld.createCollider(colliderDesc); 
        
        registerTrap(this.collider.handle, this);
    }

    _catch() {
        if (!this.isActive) return;
        this.gas._trigger();
    }

    update(deltaTime) {
        this.timer -= deltaTime;

        if (this.timer <= 0) {
            if (this.isActive) {
                this.isActive = false;
                this.mesh.visible = false; 
                
                if (this.collider) {
                    unregisterTrap(this.collider.handle);
                    this.physicsWorld.removeCollider(this.collider, false); 
                    this.collider = null;
                }

                if (this.repeat === 0) return;
                this.timer = this.repeat; 
            } else {
                this.isActive = true;
                this.mesh.visible = true; 
                this._createCollider();   
                this.timer = this.time;   
            }
        }
    }
}

// 근접 가스 함정 (책 오브젝트)
export class gasnear {
    constructor(x, y, z, size, gas, scene, physicsWorld, playerInstance) {
        this.physicsWorld = physicsWorld; 
        this.gas = gas;
        this.radius = size;
        this.player = playerInstance; 

        this.isPlayerInside = false; 
        this.state = 'IDLE';         
        this.timer = 0;

        // 컨테이너 설정
        this.bookGroup = new THREE.Group();
        this.bookGroup.position.set(x, y - 1, z); 
        scene.add(this.bookGroup);

        this.mixer = null;
        this.actions = {};
        this.currentActionName = 'IDLE_BOOK'; 
        this.modelReady = false;

        this._loadBookAndAnims(x, y, z);
    }

    async _loadBookAndAnims(x, y, z) {
        const loader = new FBXLoader();
        loader.setPath('./assets/'); 

        const loadFBX = (filename) => {
            return new Promise((resolve, reject) => {
                loader.load(filename, (obj) => resolve(obj), undefined, (err) => reject(err));
            });
        };

        try {
            const bookModel = await loadFBX('book.fbx');
            bookModel.scale.set(0.15, 0.15, 0.15); 
            
            bookModel.traverse(child => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    const newMaterials = materials.map(oldMat => {
                        if (oldMat.map) oldMat.map.flipY = false;
                        return new THREE.MeshToonMaterial({ color: oldMat.color, map: oldMat.map });
                    });
                    child.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
                    child.castShadow = true;
                }
            });

            this.bookGroup.add(bookModel);
            this.mixer = new THREE.AnimationMixer(bookModel);

            const animFiles = {
                'IDLE_BOOK': 'book1.fbx',
                'ACTIVE_BOOK': 'book2.fbx'
            };

            for (const [animName, fileName] of Object.entries(animFiles)) {
                try {
                    const animObj = await loadFBX(fileName);
                    if (animObj.animations.length > 0) {
                        const action = this.mixer.clipAction(animObj.animations[0]);
                        
                        if (animName === 'ACTIVE_BOOK') {
                            action.loop = THREE.LoopOnce;
                            action.clampWhenFinished = true;
                        } else {
                            action.loop = THREE.LoopRepeat;
                        }
                        action.setEffectiveTimeScale(3.0);

                        this.actions[animName] = action;
                    }
                } catch (e) {
                    // 애니메이션 유실 예외 처리
                }
            }

            this.modelReady = true;
            if (this.actions['IDLE_BOOK']) {
                this.actions['IDLE_BOOK'].play();
                this.currentActionName = 'IDLE_BOOK';
            }

            this._createCollider(x, y, z);

        } catch (error) {
            // 로딩 에러 예외 처리
        }
    }

    _createCollider(x, y, z) {
        if (this.collider) return;
        const colliderDesc = RAPIER.ColliderDesc.ball(this.radius).setTranslation(x, y, z).setSensor(true);
        this.collider = this.physicsWorld.createCollider(colliderDesc); 
        registerTrap(this.collider.handle, this);
    }

    _switchAnimation(newActionName) {
        if (!this.modelReady || this.currentActionName === newActionName) return;

        const currentAction = this.actions[this.currentActionName];
        const newAction = this.actions[newActionName];

        if (newAction) {
            if (currentAction) currentAction.fadeOut(0.15);
            newAction.reset().fadeIn(0.15).play();
            this.currentActionName = newActionName;
        }
    }

    _catch() {
        if (!this.modelReady) return;
        this.isPlayerInside = true;

        if (this.state === 'IDLE' || this.state === 'COOLING') {
            this.state = 'WARNING';
            this.timer = 1.0; 

            this._switchAnimation('ACTIVE_BOOK');
        }
    }

    _release() {
        if (!this.modelReady) return;
        this.isPlayerInside = false;

        if (this.state === 'EXPLODED' || this.state === 'WARNING') {
            this.state = 'COOLING';
            this.timer = 1.0; 
            
            this._switchAnimation('IDLE_BOOK');
        }
    }

    update(deltaTime) {
        if (!this.modelReady) return;

        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.player && this.player.mesh) {
            const playerPos = this.player.mesh.position;
            this.bookGroup.lookAt(playerPos.x, this.bookGroup.position.y, playerPos.z);
        }

        if (this.state === 'WARNING') {
            this.timer -= deltaTime;
            if (this.timer <= 0) {
                this.state = 'EXPLODED';

                if (this.isPlayerInside) {
                    this.gas._trigger();
                }
            }
        } 
        else if (this.state === 'COOLING') {
            this.timer -= deltaTime;
            if (this.timer <= 0) {
                this.state = 'IDLE';
                this._switchAnimation('IDLE_BOOK');
            }
        }
    }
}