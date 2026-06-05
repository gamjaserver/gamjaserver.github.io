import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { registerPlayer } from './interactions.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class Player {
    constructor(X, Y, Z, scene, physicsWorld, camera) {
        
        // 변수 초기화
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.mixer = null;
        this.actions = {};       
        this.currentActionName = 'IDLE'; 
        this.modelReady = false; 

        // 외형 컨테이너
        this.mesh = new THREE.Group();
        this.mesh.position.set(X, Y, Z);
        scene.add(this.mesh);

        // 모델 로드
        this._loadCharacterAndAnims();
        
        // 리지드 바디
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(X, Y, Z).lockRotations();
        this.rigidBody = physicsWorld.createRigidBody(bodyDesc);
        
        // 콜라이더
        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 1, 0.5); 
        colliderDesc.setRestitution(0.1).setFriction(1.0);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidBody);
        
        // 이벤트 등록
        this.collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        registerPlayer(this.collider.handle);

        // 카메라 피벗
        this.camera = camera;
        this.cameraPivotY = new THREE.Group(); 
        scene.add(this.cameraPivotY);
        this.cameraPivotX = new THREE.Group(); 
        this.cameraPivotY.add(this.cameraPivotX);
        this.cameraPivotX.add(camera); 

        // 카메라 초기화
        this.cameraTargetPos = new THREE.Vector3(0, 4, 8); 
        this.camera.position.copy(this.cameraTargetPos);
        this.camera.lookAt(0, 1 , 0);

        // 거리 계산
        this.maxCameraDist = this.cameraTargetPos.length();

        // 상태이상 구조체
        this.status = {
            current: 'NONE',      
            timer: 0,            
            isImmune: false,     
            immuneTimer: 0,      
            gassedTimer: 0,      
            willSleep: false,    
            lastTapKey: ''       
        };

        // 입력 상태
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        this.isRunning = false;
        this.lastTargetAngle = 0; 
        
        // 속성 설정
        this.speed = 4.0;
        this.runSpeed = 10.0;
        this.mouseSensitivity = 0.002;
        this.jumpForce = 7;       
        this.isGrounded = true;    
        this.isRapidTurning = false; 
        this.rapidTurnTimer = 0;     

        // 리스너 등록
        this._setupInput();
        this._setupMouse();
    }

    // 에셋 로드
    async _loadCharacterAndAnims() {
        const loader = new FBXLoader();
        const assetPath = './assets/'; 
        loader.setPath(assetPath);

        const loadFBX = (filename) => {
            return new Promise((resolve, reject) => {
                loader.load(filename, (obj) => resolve(obj), undefined, (err) => reject(err));
            });
        };

        try {
            // 메쉬 보정
            const baseObject = await loadFBX('player.fbx');
            baseObject.position.y = -1.0; 

            // 툰 셰이더
            baseObject.traverse(child => {
                if (child.isMesh) {
                    const originalColor = child.material.color || new THREE.Color(0xffffff);
                    const originalMap = child.material.map;

                    child.material = new THREE.MeshToonMaterial({
                        color: originalColor,
                        map: originalMap,
                        transparent: false
                    });

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.mesh.add(baseObject);

            // 믹서 생성
            this.mixer = new THREE.AnimationMixer(baseObject);

            // 매핑 구조
            const animFiles = {
                'IDLE': 'player0.fbx',          
                'WALK': 'player1.fbx',          
                'RUN': 'player2.fbx',           
                'JUMP': 'player3.fbx',          
                'GASSED_WALK': 'player4.fbx',   
                'FALL_ASLEEP': 'player5.fbx',   
                'TRAPPED': 'player6.fbx',       
                'SLEEPING': 'player7.fbx',      
                'GASSED_IDLE': 'player8.fbx'    
            };

            // 액션 등록
            for (const [animName, fileName] of Object.entries(animFiles)) {
                try {
                    const animObj = await loadFBX(fileName);
                    if (animObj.animations.length > 0) {
                        this.actions[animName] = this.mixer.clipAction(animObj.animations[0]);
                        
                        // 속성 설정
                        if (animName === 'FALL_ASLEEP') {
                            this.actions[animName].setLoop(THREE.LoopOnce);
                            this.actions[animName].clampWhenFinished = true;
                        }
                        if (animName === 'JUMP') {
                            this.actions[animName].setLoop(THREE.LoopOnce); 
                            this.actions[animName].clampWhenFinished = true; 
                            this.actions[animName].timeScale = 6;
                        }
                    }
                } catch (e) {}
            }

            // 재생 시작
            if (this.actions['IDLE']) {
                this.actions['IDLE'].play();
            }
            this.modelReady = true;

        } catch (error) {}
    }

    // 전환 연산
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

    // 논리 제어
    _handleAnimationLogic() {
        if (!this.modelReady) return;

        const isMoving = this.moveState.forward || this.moveState.backward || this.moveState.left || this.moveState.right;

        // 속박 상태
        if (this.status.current === 'TRAPPED') {
            this._switchAnimation('TRAPPED');
            return;
        }

        // 수면 상태
        if (this.status.current === 'ASLEEP') {
            if (this.status.timer > 5.5 && this.actions['FALL_ASLEEP']) {
                this._switchAnimation('FALL_ASLEEP');
            } else {
                this._switchAnimation('SLEEPING');
            }
            return;
        }

        // 체공 상태
        if (!this.isGrounded && !this.isRapidTurning) {
            this._switchAnimation('JUMP');
            return;
        }

        // 가스/감속 상태
        if (this.status.current === 'GASSED' || this.status.current === 'SLOWED') {
            if (isMoving) {
                this._switchAnimation('GASSED_WALK');
            } else {
                this._switchAnimation('GASSED_IDLE');
            }
            return;
        }

        // 이동/대기 상태
        if (isMoving && !this.isRapidTurning) {
            if (this.isRunning) {
                this._switchAnimation('RUN');
            } else {
                this._switchAnimation('WALK');
            }
        } else {
            this._switchAnimation('IDLE');
        }
    }

    // 회전 설정
    _setupMouse() {
        const self = this;
        window.addEventListener('click', () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                self.cameraPivotY.rotation.y -= e.movementX * self.mouseSensitivity;
                self.cameraPivotX.rotation.x -= e.movementY * self.mouseSensitivity;
                self.cameraPivotX.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 6, self.cameraPivotX.rotation.x));
            }
        });
    }

    // 이벤트 바인딩
    _setupInput() {
        window.addEventListener('keydown', (e) => {
            if (this.status.current === 'ASLEEP') return;
            if (this.status.current === 'TRAPPED') {
                this._handleTrappedEscape(e.code);
                return;
            }
            
            switch (e.code) {
                case 'KeyW': this.moveState.forward = true; break;
                case 'KeyS': this.moveState.backward = true; break;
                case 'KeyA': this.moveState.left = true; break;
                case 'KeyD': this.moveState.right = true; break;
                case 'ShiftLeft': this.isRunning = true; break;
                case 'KeyF': this.tryInteract(); break;
                case 'Space': this.jump(); break; 
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': this.moveState.forward = false; break;
                case 'KeyS': this.moveState.backward = false; break;
                case 'KeyA': this.moveState.left = false; break;
                case 'KeyD': this.moveState.right = false; break;
                case 'ShiftLeft': this.isRunning = false; break;
            }
        });
    }

    // 탈출 연산
    _handleTrappedEscape(keyCode) {
        if (keyCode === 'KeyQ' || keyCode === 'KeyE') {
            if (this.status.lastTapKey !== keyCode) {
                this.status.lastTapKey = keyCode;
                this.status.timer -= 0.3; 
            }
        }
    }

    // 면역 설정
    nope() {
        this.status.isImmune = true;
        this.status.immuneTimer = 3.0;
    }

    // 속박 부여
    trapped(time) {
        if (this.status.isImmune) return;
        this.status.current = 'TRAPPED';
        this.status.timer = time;
        this.status.lastTapKey = ''; 
        this.rigidBody.setLinvel({ x: 0, y: this.rigidBody.linvel().y, z: 0 }, true);
    }

    // 가스 부여
    gassed(time) {
        if (this.status.isImmune || this.status.current == 'GASSED') return;
        this.status.current = 'GASSED';
        this.status.timer = time;
        this.status.willSleep = true; 
    }

    // 감속 부여
    slowed(time) {
        if (this.status.isImmune) return;
        this.status.current = 'SLOWED';
        this.status.timer = time;
    }

    // 타이머 갱신
    _updateStatusTimers(deltaTime) {
        if (this.status.isImmune) {
            this.status.immuneTimer -= deltaTime;
            if (this.status.immuneTimer <= 0) {
                this.status.isImmune = false;
            }
        }

        if (this.status.current !== 'NONE') {
            this.status.timer -= deltaTime;

            if (this.status.timer <= 0) {
                const oldStatus = this.status.current;
                this.status.current = 'NONE';

                if (oldStatus === 'TRAPPED') {
                    this.nope(); 
                } 
                else if (oldStatus === 'GASSED' && this.status.willSleep) {
                    this.status.willSleep = false;
                    this.status.current = 'ASLEEP';
                    this.status.timer = 7.0; 
                    this.rigidBody.setLinvel({ x: 0, y: this.rigidBody.linvel().y, z: 0 }, true);
                } 
                else if (oldStatus === 'ASLEEP') {
                    this.nope(); 
                }
            }
        }
    }

    // 점프 구현
    jump() {
        if (this.status.current === 'TRAPPED' || this.status.current === 'ASLEEP') return;
        if (this.isGrounded && !this.isRapidTurning) {
            const velocity = this.rigidBody.linvel();
            this.rigidBody.setLinvel({ x: velocity.x, y: this.jumpForce, z: velocity.z }, true);
            this.isGrounded = false; 
        }
    }

    // 착지 판정
    _checkGrounded() {
        if (!this.rigidBody) return;

        const pos = this.rigidBody.translation();
        const scene = this.mesh.parent;
        if (!scene) {
            this.isGrounded = false;
            return;
        }

        const o = 0.35; 
        const rayPositions = [
            new THREE.Vector3(pos.x,     pos.y, pos.z),     
        ];

        const rayDirection = new THREE.Vector3(0, -1, 0); 
        const raycaster = new THREE.Raycaster();
        raycaster.far = 1.15; 

        for (let i = 0; i < rayPositions.length; i++) {
            raycaster.set(rayPositions[i], rayDirection);
            const intersects = raycaster.intersectObjects(scene.children, true);

            // 필터링 처리
            const filtered = intersects.filter(hit => {
                let currentObj = hit.object;
                
                while (currentObj) {
                    if (currentObj === this.mesh) {
                        return false; 
                    }
                    currentObj = currentObj.parent;
                }
                
                return !hit.object.name.includes("wire");
            });

            if (filtered.length > 0 && filtered[0].distance <= 1.05) {
                this.isGrounded = true;
                return; 
            }
        }
        this.isGrounded = false;
    }

    // 급선회 메커니즘
    rapidTurn(directionVector) {
        if (this.status.current === 'TRAPPED' || this.status.current === 'ASLEEP') return;
        if (!this.rigidBody) return;

        this.isRapidTurning = true;
        this.rapidTurnTimer = 0.2; 

        const turnSpeed = 22.0; 
        const currentVelocity = this.rigidBody.linvel();

        this.rigidBody.setLinvel({
            x: directionVector.x * turnSpeed,
            y: currentVelocity.y, 
            z: directionVector.z * turnSpeed
        }, true);
    }

    // 캡슐 이동
    _handleMovement() {
        if (this.status.current === 'TRAPPED' || this.status.current === 'ASLEEP') {
            const currentVelocity = this.rigidBody.linvel();
            this.rigidBody.setLinvel({ x: 0, y: currentVelocity.y, z: 0 }, true);
            return; 
        }
        if (this.isRapidTurning) {
            this.rapidTurnTimer -= 0.016; 
            if (this.rapidTurnTimer <= 0) {
                this.isRapidTurning = false;
            }
            return; 
        }

        const camDirection = new THREE.Vector3();
        this.cameraPivotY.getWorldDirection(camDirection);
        camDirection.multiplyScalar(-1).y = 0; 
        camDirection.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDirection, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVector = new THREE.Vector3();
        if (this.moveState.forward)  moveVector.add(camDirection);
        if (this.moveState.backward) moveVector.addScaledVector(camDirection, -1);
        if (this.moveState.left)     moveVector.addScaledVector(camRight, -1);                  
        if (this.moveState.right)    moveVector.add(camRight); 

        if (moveVector.lengthSq() > 0) {
            const targetAngle = Math.atan2(moveVector.x, moveVector.z);
            let frameAngleDiff = targetAngle - this.lastTargetAngle;
            frameAngleDiff = Math.atan2(Math.sin(frameAngleDiff), Math.cos(frameAngleDiff));
            const limitAngle = (120 * Math.PI) / 180;

            if (Math.abs(frameAngleDiff) >= limitAngle && this.isRunning) {
                this.rapidTurn(moveVector); 
                this.lastTargetAngle = targetAngle; 
                return;
            }

            this.lastTargetAngle = targetAngle;
            const targetQuaternion = new THREE.Quaternion();
            targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
            this.mesh.quaternion.slerp(targetQuaternion, 0.15);
        }

        let currentSpeed = this.speed;
        if (this.status.current !== 'GASSED' && this.status.current !== 'SLOWED') {
            currentSpeed = this.isRunning ? this.runSpeed : this.speed;
        }
        const currentVelocity = this.rigidBody.linvel();

        this.rigidBody.setLinvel({
            x: moveVector.x * currentSpeed,
            y: currentVelocity.y, 
            z: moveVector.z * currentSpeed
        }, true);
    }

    // 충돌 보정
    _handleCameraCollision() {
        const scene = this.mesh.parent;
        if (!scene) return;

        const pivotWorldPos = new THREE.Vector3();
        this.cameraPivotX.getWorldPosition(pivotWorldPos);

        const idealCamPos = new THREE.Vector3()
            .copy(this.cameraTargetPos)
            .applyQuaternion(this.cameraPivotX.quaternion)
            .applyQuaternion(this.cameraPivotY.quaternion)
            .add(pivotWorldPos);

        const rayDirection = new THREE.Vector3().subVectors(idealCamPos, pivotWorldPos);
        const maxDist = rayDirection.length();
        rayDirection.normalize();

        const raycaster = new THREE.Raycaster(pivotWorldPos, rayDirection, 0, maxDist);
        const intersects = raycaster.intersectObjects(scene.children, true);

        const wallHits = intersects.filter(hit => {
            let currentObj = hit.object;
            while (currentObj) {
                if (currentObj === this.mesh) return false;
                currentObj = currentObj.parent;
            }
            return !hit.object.name.includes("wire");
        });

        if (wallHits.length > 0) {
            const hitDistance = wallHits[0].distance;
            const safeDistance = Math.max(0.5, hitDistance - 0.2); 
            this.camera.position.setLength(safeDistance);
        } else {
            this.camera.position.setLength(
                THREE.MathUtils.lerp(this.camera.position.length(), this.maxCameraDist, 0.1)
            );
        }
    }

    tryInteract() {
        // 상호작용
    }

    // 동기화 및 업데이트
    update() {
        if (!this.rigidBody) return;
        
        this._updateStatusTimers(0.016);
        this._checkGrounded();

        const pos = this.rigidBody.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
        this.cameraPivotY.position.set(pos.x, pos.y, pos.z);

        this._handleMovement();
        this._handleAnimationLogic();

        if (this.mixer) {
            this.mixer.update(0.006); 
        }

        this._handleCameraCollision();
    }
}
