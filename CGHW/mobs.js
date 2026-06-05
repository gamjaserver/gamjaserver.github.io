import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class Mob {
    constructor(x, y, z, scene, physicsWorld, speed = 10) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.speed = speed;
        this.isDead = false;

        // 애니메이션 및 에셋 관리 변수
        this.mixer = null;
        this.actions = {};
        this.currentActionName = 'IDLE'; 
        this.modelReady = false;
        this.hasSpotted = false; 

        // 멀티 마테리얼 대응 배열
        this.mobMaterials = [];

        // 외형 컨테이너 생성 및 씬 추가
        this.mesh = new THREE.Group();
        this.mesh.position.set(x, y, z);
        scene.add(this.mesh);

        // 비동기 에셋 로드 실행
        this._loadMobAndAnims();

        // Rapier 물리 바디 세팅
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(1.0)
            .restrictRotations(false, true, false); 

        this.rigidBody = physicsWorld.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 1, 0.5).setRestitution(0.6);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidBody);
    }

    /**
     * 메쉬 및 애니메이션 에셋 비동기 로드
     */
    async _loadMobAndAnims() {
        const loader = new FBXLoader();
        const assetPath = './assets/'; 
        loader.setPath(assetPath);

        const loadFBX = (filename) => {
            return new Promise((resolve, reject) => {
                loader.load(filename, (obj) => resolve(obj), undefined, (err) => reject(err));
            });
        };

        try {
            // 기본 캐릭터 메쉬 생성 및 트랜스폼 보정
            const baseObject = await loadFBX('mob.fbx');
            baseObject.scale.set(0.07, 0.07, 0.07);
            baseObject.position.y = -1.0;
            baseObject.rotation.y = Math.PI / 2;

            // 하위 메쉬 탐색 및 Toon 셰이더 적용
            baseObject.traverse(child => {
                if (child.isMesh) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    const newMaterials = [];

                    materials.forEach(oldMat => {
                        const originalColor = oldMat.color ? oldMat.color.clone() : new THREE.Color(0xff0055);
                        const originalMap = oldMat.map;

                        if (originalMap) {
                            originalMap.flipY = false;
                            originalMap.needsUpdate = true;
                        }

                        const newMat = new THREE.MeshToonMaterial({
                            color: originalColor,
                            map: originalMap,
                            transparent: false
                        });

                        newMaterials.push(newMat);
                        this.mobMaterials.push(newMat); 
                    });

                    child.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.mesh.add(baseObject);

            // 믹서 및 액션 등록
            this.mixer = new THREE.AnimationMixer(baseObject);
            const animFiles = {
                'IDLE': 'mob0.fbx',
                'CHASE': 'mob1.fbx'
            };

            for (const [animName, fileName] of Object.entries(animFiles)) {
                try {
                    const animObj = await loadFBX(fileName);
                    if (animObj.animations.length > 0) {
                        this.actions[animName] = this.mixer.clipAction(animObj.animations[0]);
                    }
                } catch (e) {
                    // 애니메이션 개별 로드 실패 대응
                }
            }

            if (this.actions['IDLE']) {
                this.actions['IDLE'].play();
            }
            this.modelReady = true;

        } catch (error) {
            // 루트 로드 실패 대응
        }
    }

    /**
     * 크로스페이드를 이용한 애니메이션 전환
     */
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

    /**
     * 프레임별 상태 업데이트 및 AI 추격 로직
     */
    update(playerInstance) {
        if (this.isDead || !playerInstance || !this.rigidBody) return;

        const mobPos = this.rigidBody.translation();
        const playerPos = playerInstance.mesh.position;

        // 플레이어 타겟 거리 계산
        const diffX = playerPos.x - mobPos.x;
        const diffZ = playerPos.z - mobPos.z;
        const distSq = diffX * diffX + diffZ * diffZ; 
        const distance = Math.sqrt(distSq);
        const dirToPlayer = new THREE.Vector3(diffX, 0, diffZ).normalize();

        // 플레이어 감지 조건 체크
        if (!this.hasSpotted && distance < 20) {
            this.hasSpotted = true;
        }

        // 상태별 인공지능 핸들러
        if (this.hasSpotted) {
            this._changeColor(0xaaaaaa);      
            this._switchAnimation('CHASE');    
            if (this.actions['CHASE']) this.actions['CHASE'].timeScale = 3;
            
            this._lookAtTarget(playerPos);
            this._moveToward(dirToPlayer, this.speed);

            // 거리 기반 잡힘 판정
            if (distSq <= 2.25) { 
                window.dispatchEvent(new CustomEvent('player-caught', { detail: { mob: this } }));
            }
        } else {
            this._changeColor(0x555555);      
            this._switchAnimation('IDLE');     
            this._stopMovement();
        }

        // 트랜스폼 및 믹서 동기화
        this._syncMeshAndBody();
        if (this.mixer) {
            this.mixer.update(0.016); 
        }
    }

    _moveToward(dirVector, targetSpeed) {
        const currentVel = this.rigidBody.linvel();
        this.rigidBody.setLinvel({
            x: dirVector.x * targetSpeed,
            y: currentVel.y,
            z: dirVector.z * targetSpeed
        }, true);
    }

    _stopMovement() {
        const currentVel = this.rigidBody.linvel();
        this.rigidBody.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true);
    }

    _lookAtTarget(targetPos) {
        this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
    }

    _syncMeshAndBody() {
        const pos = this.rigidBody.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
        this.rigidBody.setRotation(this.mesh.quaternion, true); 
    }

    _changeColor(hexColor) {
        if (this.mobMaterials && this.mobMaterials.length > 0) {
            this.mobMaterials.forEach(mat => {
                if (mat.color && mat.color.getHex() !== hexColor) {
                    mat.color.setHex(hexColor);
                }
            });
        }
    }
}